import {
  DEFAULT_COVER_URL,
  R2StoredTrack,
  isR2Configured,
  loadR2Config,
  uploadBufferToR2,
  uploadImageBufferToR2,
  uploadRemoteImageToR2,
} from './r2.js';

export interface SpotflowLyricLine {
  time: number;
  text: string;
}

export interface SpotflowIncomingItem {
  id?: string;
  jobId?: string;
  trackId?: string;
  title?: string;
  artist?: string;
  album?: string;
  bitrate?: number;
  durationMs?: number;
  duration?: number;
  spotifyUrl?: string;
  fileName?: string;
  downloadUrl?: string;
  coverUrl?: string | null;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  downloadedAt?: string;
}

export interface ExistingTrackLookup {
  id: string;
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  audioUrl?: string;
  duration?: number;
  genre?: string;
  releaseYear?: number;
  lyrics?: SpotflowLyricLine[];
  bpm?: number;
  mood?: string;
  plays?: number;
  aiClassified?: boolean;
  aiReason?: string;
  spotifyTrackId?: string;
  spotifyUrl?: string;
  syncedLyrics?: string;
  plainLyrics?: string;
  lyricsMode?: 'synced' | 'plain' | 'none';
}

export interface IngestSpotflowResult {
  addedTracks: R2StoredTrack[];
  updatedTracks: R2StoredTrack[];
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  tracks: R2StoredTrack[];
}

export function resolveSpotflowEndpoint(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  if (withProtocol.toLowerCase().endsWith('/api/external/tracks')) {
    return withProtocol;
  }
  return `${withProtocol}/api/external/tracks`;
}

export function resolveRemoteMediaUrl(
  rawUrl: string | null | undefined,
  baseEndpoint?: string
): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (baseEndpoint) {
    try {
      return new URL(trimmed, baseEndpoint).toString();
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function parseLrcLyrics(
  syncedText?: string | null,
  plainText?: string | null
): {
  lyrics: SpotflowLyricLine[];
  syncedLyrics?: string;
  plainLyrics?: string;
  lyricsMode: 'synced' | 'plain' | 'none';
} {
  const cleanSynced =
    typeof syncedText === 'string' && syncedText.trim()
      ? syncedText.trim().slice(0, 50000)
      : undefined;
  const cleanPlain =
    typeof plainText === 'string' && plainText.trim()
      ? plainText.trim().slice(0, 50000)
      : undefined;

  if (cleanSynced) {
    const parsed: SpotflowLyricLine[] = [];
    const lines = cleanSynced.split(/\r?\n/);
    const tagRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

    for (const rawLine of lines) {
      const timestamps: number[] = [];
      let match: RegExpExecArray | null;
      tagRegex.lastIndex = 0;

      while ((match = tagRegex.exec(rawLine)) !== null) {
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        const fracRaw = match[3] || '0';
        const millis = parseInt(fracRaw.padEnd(3, '0').slice(0, 3), 10);
        if (!Number.isNaN(mins) && !Number.isNaN(secs)) {
          timestamps.push(mins * 60 + secs + millis / 1000);
        }
      }

      if (timestamps.length > 0) {
        const text = rawLine.replace(tagRegex, '').trim();
        if (text) {
          for (const time of timestamps) {
            parsed.push({ time, text });
          }
        }
      }
    }

    if (parsed.length > 0) {
      parsed.sort((a, b) => a.time - b.time);
      return {
        lyrics: parsed.slice(0, 500),
        syncedLyrics: cleanSynced,
        plainLyrics: cleanPlain,
        lyricsMode: 'synced',
      };
    }
  }

  if (cleanPlain) {
    return {
      lyrics: [],
      syncedLyrics: cleanSynced,
      plainLyrics: cleanPlain,
      lyricsMode: 'plain',
    };
  }

  return {
    lyrics: [],
    lyricsMode: 'none',
  };
}

function readSynchsafeInt(buf: Buffer, offset: number): number {
  return (
    ((buf[offset] & 0x7f) << 21) |
    ((buf[offset + 1] & 0x7f) << 14) |
    ((buf[offset + 2] & 0x7f) << 7) |
    (buf[offset + 3] & 0x7f)
  );
}

function deunsynchronise(buf: Buffer): Buffer {
  const out: number[] = [];
  for (let i = 0; i < buf.length; i++) {
    out.push(buf[i]);
    if (buf[i] === 0xff && i + 1 < buf.length && buf[i + 1] === 0x00) {
      i++;
    }
  }
  return Buffer.from(out);
}

function findStringTerminator(buf: Buffer, start: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    // UTF-16: look for 0x00 0x00 on 2-byte boundary
    for (let i = start; i + 1 < buf.length; i += 2) {
      if (buf[i] === 0x00 && buf[i + 1] === 0x00) {
        return i + 2;
      }
    }
    return buf.length;
  }
  // ISO-8859-1 or UTF-8: single 0x00
  const idx = buf.indexOf(0x00, start);
  return idx === -1 ? buf.length : idx + 1;
}

function inferImageMime(buf: Buffer, declaredMime: string): { mimeType: string; ext: string } {
  const clean = declaredMime.trim().toLowerCase();
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mimeType: 'image/png', ext: 'png' };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mimeType: 'image/jpeg', ext: 'jpg' };
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mimeType: 'image/webp', ext: 'webp' };
  }
  if (clean === 'image/png' || clean === 'png') {
    return { mimeType: 'image/png', ext: 'png' };
  }
  if (clean === 'image/webp' || clean === 'webp') {
    return { mimeType: 'image/webp', ext: 'webp' };
  }
  return { mimeType: 'image/jpeg', ext: 'jpg' };
}

export function extractId3CoverArt(
  mp3Buffer: Buffer
): { buffer: Buffer; mimeType: string; ext: string } | null {
  if (!mp3Buffer || mp3Buffer.length < 16) return null;
  if (mp3Buffer.toString('ascii', 0, 3) !== 'ID3') return null;

  const majorVersion = mp3Buffer[3];
  if (majorVersion < 2 || majorVersion > 4) return null;

  const tagFlags = mp3Buffer[5];
  const tagUnsync = (tagFlags & 0x80) !== 0;
  const hasExtendedHeader = majorVersion >= 3 && (tagFlags & 0x40) !== 0;
  const tagSize = readSynchsafeInt(mp3Buffer, 6);
  const tagEnd = Math.min(mp3Buffer.length, 10 + tagSize);

  let body = mp3Buffer.subarray(10, tagEnd);
  if (tagUnsync && majorVersion <= 3) {
    body = deunsynchronise(body);
  }

  let offset = 0;
  if (hasExtendedHeader && body.length >= 4) {
    const extSize =
      majorVersion === 4 ? readSynchsafeInt(body, 0) : body.readUInt32BE(0) + 4;
    offset += Math.min(body.length, Math.max(4, extSize));
  }

  let fallbackCover: { buffer: Buffer; mimeType: string; ext: string } | null = null;

  while (offset < body.length) {
    if (majorVersion === 2) {
      if (offset + 6 > body.length) break;
      const frameId = body.toString('ascii', offset, offset + 3);
      if (frameId === '\u0000\u0000\u0000' || !/^[A-Z0-9]{3}$/.test(frameId)) break;
      const frameSize =
        (body[offset + 3] << 16) | (body[offset + 4] << 8) | body[offset + 5];
      offset += 6;
      if (frameSize <= 0 || offset + frameSize > body.length) break;
      const frameData = body.subarray(offset, offset + frameSize);
      offset += frameSize;

      if (frameId === 'PIC' && frameData.length > 6) {
        const encoding = frameData[0];
        const fmt = frameData.toString('ascii', 1, 4);
        const picType = frameData[4];
        const imgStart = findStringTerminator(frameData, 5, encoding);
        const imgBuf = frameData.subarray(imgStart);
        if (imgBuf.length > 32) {
          const { mimeType, ext } = inferImageMime(imgBuf, fmt);
          const result = { buffer: Buffer.from(imgBuf), mimeType, ext };
          if (picType === 3) return result;
          if (!fallbackCover) fallbackCover = result;
        }
      }
    } else {
      if (offset + 10 > body.length) break;
      const frameId = body.toString('ascii', offset, offset + 4);
      if (frameId === '\u0000\u0000\u0000\u0000' || !/^[A-Z0-9]{4}$/.test(frameId)) break;
      const frameSize =
        majorVersion === 4
          ? readSynchsafeInt(body, offset + 4)
          : body.readUInt32BE(offset + 4);
      const frameFlagsLow = body[offset + 9];
      offset += 10;
      if (frameSize <= 0 || offset + frameSize > body.length) break;

      let frameData = body.subarray(offset, offset + frameSize);
      offset += frameSize;

      if (frameId === 'APIC' && frameData.length > 4) {
        if (majorVersion === 4 && ((frameFlagsLow & 0x02) !== 0 || tagUnsync)) {
          frameData = deunsynchronise(frameData);
        }
        const encoding = frameData[0];
        const mimeEnd = frameData.indexOf(0x00, 1);
        if (mimeEnd === -1 || mimeEnd + 2 >= frameData.length) continue;
        const declaredMime = frameData.toString('ascii', 1, mimeEnd);
        const picType = frameData[mimeEnd + 1];
        const descStart = mimeEnd + 2;
        const imgStart = findStringTerminator(frameData, descStart, encoding);
        const imgBuf = frameData.subarray(imgStart);
        if (imgBuf.length > 32 && declaredMime !== '-->') {
          const { mimeType, ext } = inferImageMime(imgBuf, declaredMime);
          const result = { buffer: Buffer.from(imgBuf), mimeType, ext };
          if (picType === 3) return result;
          if (!fallbackCover) fallbackCover = result;
        }
      }
    }
  }

  return fallbackCover;
}

function normalizeTextKey(val?: string): string {
  return (val || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeTitleArtistKey(title?: string, artist?: string): string {
  return `${normalizeTextKey(title)}::${normalizeTextKey(artist)}`;
}

function isMissingOrDefaultCover(url?: string | null): boolean {
  if (!url || !url.trim()) return true;
  return url.trim() === DEFAULT_COVER_URL;
}

function hasUsableLyrics(track: ExistingTrackLookup): boolean {
  if (track.syncedLyrics && track.syncedLyrics.trim()) return true;
  if (track.plainLyrics && track.plainLyrics.trim()) return true;
  if (Array.isArray(track.lyrics) && track.lyrics.length > 2) return true;
  if (
    Array.isArray(track.lyrics) &&
    track.lyrics.length > 0 &&
    !track.lyrics.every(l => l.text.startsWith('Đang phát bản nhạc'))
  ) {
    return true;
  }
  return false;
}

async function downloadAudioBuffer(
  audioUrl: string,
  apiKey?: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const headers: Record<string, string> = {};
  if (apiKey && apiKey.trim()) {
    headers['X-API-Key'] = apiKey.trim();
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }
  const res = await fetch(audioUrl, { headers });
  if (!res.ok) {
    throw new Error(`Không thể tải tệp MP3 từ SpotFlow (HTTP ${res.status}).`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = res.headers.get('content-type') || 'audio/mpeg';
  return { buffer, contentType };
}

async function persistCoverForTrack(params: {
  remoteCoverUrl: string;
  mp3Buffer: Buffer | null;
  fileStem: string;
  shouldSaveToR2: boolean;
}): Promise<string> {
  const { remoteCoverUrl, mp3Buffer, fileStem, shouldSaveToR2 } = params;

  if (remoteCoverUrl) {
    if (shouldSaveToR2) {
      try {
        const uploaded = await uploadRemoteImageToR2(remoteCoverUrl, fileStem);
        return uploaded.coverUrl;
      } catch (err) {
        console.warn('[SpotFlow] Failed to download/save coverUrl to R2:', err);
      }
    } else {
      return remoteCoverUrl;
    }
  }

  // Fallback: extract embedded cover art from ID3 tag of downloaded MP3
  if (mp3Buffer) {
    const id3Cover = extractId3CoverArt(mp3Buffer);
    if (id3Cover) {
      if (shouldSaveToR2) {
        try {
          const uploaded = await uploadImageBufferToR2(
            id3Cover.buffer,
            `${fileStem}.${id3Cover.ext}`,
            id3Cover.mimeType
          );
          return uploaded.coverUrl;
        } catch (err) {
          console.warn('[SpotFlow] Failed to upload ID3 cover to R2:', err);
        }
      }
    }
  }

  return remoteCoverUrl || DEFAULT_COVER_URL;
}

export async function ingestSpotflowTracks(params: {
  items: SpotflowIncomingItem[];
  baseEndpoint?: string;
  apiKey?: string;
  saveToR2?: boolean;
  existingTracks: ExistingTrackLookup[];
  sourceLabel?: string;
}): Promise<IngestSpotflowResult> {
  const {
    items,
    baseEndpoint,
    apiKey,
    saveToR2 = true,
    existingTracks,
    sourceLabel = 'SpotFlow MP3',
  } = params;

  const r2Config = loadR2Config();
  const shouldSaveToR2 = isR2Configured(r2Config) && saveToR2 !== false;

  const bySpotifyId = new Map<string, ExistingTrackLookup>();
  const byTitleArtist = new Map<string, ExistingTrackLookup>();

  const registerLookup = (track: ExistingTrackLookup) => {
    if (track.spotifyTrackId) {
      bySpotifyId.set(track.spotifyTrackId.trim(), track);
    }
    const taKey = makeTitleArtistKey(track.title, track.artist);
    if (taKey !== '::') {
      byTitleArtist.set(taKey, track);
    }
  };

  for (const t of existingTracks) {
    registerLookup(t);
  }

  const addedTracks: R2StoredTrack[] = [];
  const updatedTracks: R2StoredTrack[] = [];
  let skippedCount = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const spotifyTrackId = (item.trackId || item.id || '').trim() || undefined;
    const title = (item.title || 'Bài hát SpotFlow').trim().slice(0, 300);
    const artist = (item.artist || 'Nghệ sĩ SpotFlow').trim().slice(0, 300);
    const album = (item.album || 'SpotFlow MP3 Download').trim().slice(0, 300);
    const fileStem = `${artist} - ${title}`.slice(0, 120);

    const parsedLyrics = parseLrcLyrics(item.syncedLyrics, item.plainLyrics);
    const remoteAudioUrl = resolveRemoteMediaUrl(item.downloadUrl, baseEndpoint);
    const remoteCoverUrl = resolveRemoteMediaUrl(item.coverUrl, baseEndpoint);
    const durationSecs =
      typeof item.durationMs === 'number' && item.durationMs > 0
        ? Math.round(item.durationMs / 1000)
        : typeof item.duration === 'number' && item.duration > 0
          ? Math.round(item.duration)
          : 210;

    // 1. Check duplicate by spotifyTrackId first, then by normalized (title + artist)
    const taKey = makeTitleArtistKey(title, artist);
    const existing =
      (spotifyTrackId ? bySpotifyId.get(spotifyTrackId) : undefined) ||
      byTitleArtist.get(taKey);

    if (existing) {
      const needsCover = isMissingOrDefaultCover(existing.coverUrl);
      const needsLyrics =
        !hasUsableLyrics(existing) ||
        (!existing.syncedLyrics && Boolean(parsedLyrics.syncedLyrics));

      if (!needsCover && !needsLyrics) {
        skippedCount++;
        continue;
      }

      let updatedCoverUrl = existing.coverUrl || DEFAULT_COVER_URL;
      if (needsCover) {
        let mp3BufferForCover: Buffer | null = null;
        if (!remoteCoverUrl && remoteAudioUrl) {
          try {
            const downloaded = await downloadAudioBuffer(remoteAudioUrl, apiKey);
            mp3BufferForCover = downloaded.buffer;
          } catch (err) {
            console.warn('[SpotFlow] Could not download MP3 to extract missing ID3 cover:', err);
          }
        }
        const resolvedCover = await persistCoverForTrack({
          remoteCoverUrl,
          mp3Buffer: mp3BufferForCover,
          fileStem,
          shouldSaveToR2,
        });
        if (!isMissingOrDefaultCover(resolvedCover)) {
          updatedCoverUrl = resolvedCover;
        }
      }

      const nextSyncedLyrics = existing.syncedLyrics || parsedLyrics.syncedLyrics;
      const nextPlainLyrics = existing.plainLyrics || parsedLyrics.plainLyrics;
      const nextLyrics =
        parsedLyrics.lyricsMode === 'synced' && (!existing.syncedLyrics || !hasUsableLyrics(existing))
          ? parsedLyrics.lyrics
          : existing.lyrics && existing.lyrics.length > 0
            ? existing.lyrics
            : parsedLyrics.lyrics;
      const nextLyricsMode =
        nextSyncedLyrics || nextLyrics.length > 0
          ? 'synced'
          : nextPlainLyrics
            ? 'plain'
            : existing.lyricsMode || 'none';

      const coverImproved = updatedCoverUrl !== existing.coverUrl;
      const lyricsImproved =
        nextSyncedLyrics !== existing.syncedLyrics ||
        nextPlainLyrics !== existing.plainLyrics ||
        (!hasUsableLyrics(existing) && (nextLyrics.length > 0 || Boolean(nextPlainLyrics)));

      if (!coverImproved && !lyricsImproved) {
        skippedCount++;
        continue;
      }

      const mergedTrack: R2StoredTrack = {
        id: existing.id,
        title: existing.title || title,
        artist: existing.artist || artist,
        album: existing.album || album,
        audioUrl: (existing.audioUrl || remoteAudioUrl).slice(0, 2000),
        coverUrl: updatedCoverUrl.slice(0, 2000),
        duration: existing.duration || durationSecs,
        genre: (existing.genre || 'Pop').slice(0, 100),
        releaseYear: existing.releaseYear || new Date().getFullYear(),
        bpm: existing.bpm ?? (item.bitrate === 320 ? 120 : 110),
        mood: (existing.mood || 'Sôi động & Chất lượng cao').slice(0, 150),
        aiClassified: existing.aiClassified ?? true,
        aiReason: (existing.aiReason || `Cập nhật metadata từ ${sourceLabel}`).slice(0, 500),
        lyrics: nextLyrics,
        plays: existing.plays ?? 0,
        ...(spotifyTrackId || existing.spotifyTrackId
          ? { spotifyTrackId: (existing.spotifyTrackId || spotifyTrackId || '').slice(0, 128) }
          : {}),
        ...(item.spotifyUrl || existing.spotifyUrl
          ? { spotifyUrl: (existing.spotifyUrl || item.spotifyUrl || '').slice(0, 500) }
          : {}),
        ...(nextSyncedLyrics ? { syncedLyrics: nextSyncedLyrics } : {}),
        ...(nextPlainLyrics ? { plainLyrics: nextPlainLyrics } : {}),
        lyricsMode: nextLyricsMode,
      };

      updatedTracks.push(mergedTrack);
      registerLookup(mergedTrack);
      continue;
    }

    // 2. New track: download MP3 binary & cover binary (or extract ID3 APIC) and upload to R2
    let finalAudioUrl = remoteAudioUrl;
    let downloadedMp3Buffer: Buffer | null = null;

    if (remoteAudioUrl && (shouldSaveToR2 || !remoteCoverUrl)) {
      try {
        const downloaded = await downloadAudioBuffer(remoteAudioUrl, apiKey);
        downloadedMp3Buffer = downloaded.buffer;
        if (shouldSaveToR2) {
          const uploadName = item.fileName || `${fileStem}.mp3`;
          const r2Audio = await uploadBufferToR2(
            downloadedMp3Buffer,
            uploadName,
            downloaded.contentType
          );
          finalAudioUrl = r2Audio.audioUrl;
        }
      } catch (err) {
        console.warn('[SpotFlow] Could not download/upload MP3 to R2:', err);
      }
    }

    const finalCoverUrl = await persistCoverForTrack({
      remoteCoverUrl,
      mp3Buffer: downloadedMp3Buffer,
      fileStem,
      shouldSaveToR2,
    });

    const rawId = `spotflow-${spotifyTrackId || item.jobId || `${Date.now()}-${idx}`}`;
    const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);

    const releaseYear = item.downloadedAt
      ? new Date(item.downloadedAt).getFullYear() || new Date().getFullYear()
      : new Date().getFullYear();

    const newTrack: R2StoredTrack = {
      id: safeId,
      title,
      artist,
      album,
      audioUrl: finalAudioUrl.slice(0, 2000),
      coverUrl: (finalCoverUrl || DEFAULT_COVER_URL).slice(0, 2000),
      duration: durationSecs,
      genre: 'Pop',
      releaseYear,
      bpm: item.bitrate === 320 ? 120 : 110,
      mood: 'Sôi động & Chất lượng cao',
      aiClassified: true,
      aiReason: (shouldSaveToR2
        ? `Đồng bộ từ ${sourceLabel} & lưu trữ trên Cloudflare R2`
        : `Đồng bộ tự động từ ${sourceLabel} (${item.bitrate || 320}kbps)`
      ).slice(0, 500),
      lyrics: parsedLyrics.lyrics,
      plays: 0,
      ...(spotifyTrackId ? { spotifyTrackId: spotifyTrackId.slice(0, 128) } : {}),
      ...(item.spotifyUrl ? { spotifyUrl: item.spotifyUrl.trim().slice(0, 500) } : {}),
      ...(parsedLyrics.syncedLyrics ? { syncedLyrics: parsedLyrics.syncedLyrics } : {}),
      ...(parsedLyrics.plainLyrics ? { plainLyrics: parsedLyrics.plainLyrics } : {}),
      lyricsMode: parsedLyrics.lyricsMode,
    };

    addedTracks.push(newTrack);
    registerLookup(newTrack);
  }

  return {
    addedTracks,
    updatedTracks,
    addedCount: addedTracks.length,
    updatedCount: updatedTracks.length,
    skippedCount,
    tracks: [...addedTracks, ...updatedTracks],
  };
}
