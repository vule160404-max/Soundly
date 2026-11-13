import {
  DEFAULT_COVER_URL,
  R2StoredTrack,
  isR2Configured,
  loadR2Config,
  uploadBufferToR2,
  uploadImageBufferToR2,
  uploadRemoteImageToR2,
} from './r2.js';

export const DEFAULT_SPOTFLOW_BASE_URL = 'https://musictool-ytsg.onrender.com';
export const DEFAULT_R2_PUBLIC_BASE_URL =
  'https://pub-abe76365ee0b4bb69d5f0f51a5abc76d.r2.dev';
export const DEFAULT_SPOTFLOW_API_KEY = 'sf_live_6c0721b02ea06aeb15490e34fa740326';
export const ALLOWED_SPOTFLOW_API_KEYS = [
  'sf_live_6c0721b02ea06aeb15490e34fa740326',
  'sf_live_b014f490c5f75dc3f64bd45d9ab82121',
  'sf_live_2c4393db2e79b7e5fc8fa672ebabaa91',
];
export const DEFAULT_SPOTFLOW_ENRICH_URL = `${DEFAULT_SPOTFLOW_BASE_URL}/api/external/enrich`;

export function isValidSpotflowKeyFormat(key?: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (ALLOWED_SPOTFLOW_API_KEYS.includes(trimmed)) return true;
  return /^sf_(?:live|api|key)_[a-zA-Z0-9_-]{12,128}$/i.test(trimmed);
}

export interface SpotflowLyricLine {
  time: number;
  text: string;
}

export interface SpotflowIncomingItem {
  id?: string;
  jobId?: string;
  trackId?: string;
  storage?: string;
  title?: string;
  artist?: string;
  album?: string;
  bitrate?: number;
  durationMs?: number;
  duration?: number;
  spotifyUrl?: string;
  fileName?: string;
  downloadUrl?: string;
  audioUrl?: string;
  r2AudioUrl?: string;
  r2CoverUrl?: string | null;
  r2AudioKey?: string;
  r2CoverKey?: string;
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
  r2AudioKey?: string;
  r2CoverKey?: string;
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
  failedAudioCount: number;
  failedAudioMessages: string[];
  tracks: R2StoredTrack[];
}

export function resolveSpotflowEndpoint(rawUrl?: string): string {
  const trimmed = (rawUrl || DEFAULT_SPOTFLOW_BASE_URL).trim().replace(/\/+$/, '');
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    // AI Studio preview URLs (*.run.app) require browser Google login cookies and redirect server-to-server requests to /__cookie_check.html.
    // Automatically route to the public Render deployment of MusicTool.
    if (parsed.hostname.endsWith('.run.app')) {
      return `${DEFAULT_SPOTFLOW_BASE_URL}/api/external/tracks`;
    }
  } catch {
    // ignore URL parse error
  }

  if (withProtocol.toLowerCase().endsWith('/api/external/tracks')) {
    return withProtocol;
  }
  return `${withProtocol}/api/external/tracks`;
}

export function slugifyMusicToolR2Segment(input: string): string {
  const ascii = (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return ascii || 'track';
}

export async function fetchSpotflowTracksFromServer(params: {
  spotflowUrl?: string;
  apiKey?: string;
}): Promise<{
  endpoint: string;
  effectiveApiKey: string;
  r2PublicBaseUrl: string;
  items: SpotflowIncomingItem[];
}> {
  const endpoint = resolveSpotflowEndpoint(params.spotflowUrl);
  const origin = new URL(endpoint).origin;
  let liveApiKey = '';
  let r2PublicBaseUrl = DEFAULT_R2_PUBLIC_BASE_URL;

  try {
    const settingsRes = await fetch(`${origin}/api/integration/settings`, {
      signal: AbortSignal.timeout(4500),
    });
    if (settingsRes.ok) {
      const settings = (await settingsRes.json()) as {
        apiKey?: string;
        webhookUrl?: string;
        r2?: { publicBaseUrl?: string };
      };
      if (settings.apiKey && settings.apiKey.trim()) {
        liveApiKey = settings.apiKey.trim();
      }
      if (settings.r2?.publicBaseUrl && settings.r2.publicBaseUrl.trim()) {
        r2PublicBaseUrl = settings.r2.publicBaseUrl.trim().replace(/\/+$/, '');
      }
      // If MusicTool's webhookUrl was accidentally pointing to /api/external/tracks or an ais-dev URL, auto-heal it
      const curWebhook = (settings.webhookUrl || '').trim();
      if (
        !curWebhook ||
        curWebhook.includes('/api/external/tracks') ||
        curWebhook.includes('.run.app')
      ) {
        void fetch(`${origin}/api/integration/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl: 'https://soundly-psi.vercel.app/api/webhooks/spotflow',
            autoPushWebhook: true,
          }),
        }).catch(() => {});
      }
    }
  } catch {
    // non-fatal
  }

  const candidateKeys = Array.from(
    new Set(
      [
        (params.apiKey || '').trim(),
        liveApiKey,
        DEFAULT_SPOTFLOW_API_KEY,
        ...ALLOWED_SPOTFLOW_API_KEYS,
      ].filter(Boolean)
    )
  );

  let response: Response | null = null;
  let usedKey = candidateKeys[0] || DEFAULT_SPOTFLOW_API_KEY;

  for (const key of candidateKeys) {
    usedKey = key;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-API-Key': key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12000),
    });
    response = res;
    if (res.status !== 401 && res.status !== 403) {
      break;
    }
  }

  if (!response || !response.ok) {
    const status = response?.status || 502;
    throw new Error(
      `Không thể kết nối tới SpotFlow MP3 (HTTP ${status} tại ${endpoint}). Kiểm tra lại URL hoặc API Key.`
    );
  }

  const rawBody = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error(
      `SpotFlow trả về HTML thay vì JSON tại ${endpoint}. Hãy dùng URL Public của SpotFlow (${DEFAULT_SPOTFLOW_BASE_URL}/api/external/tracks) thay vì link preview nội bộ AI Studio.`
    );
  }

  const rawItems: SpotflowIncomingItem[] | null = Array.isArray(parsed)
    ? (parsed as SpotflowIncomingItem[])
    : parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { tracks?: unknown }).tracks)
      ? (parsed as { tracks: SpotflowIncomingItem[] }).tracks
      : parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { data?: unknown }).data)
        ? (parsed as { data: SpotflowIncomingItem[] }).data
        : null;

  if (!rawItems) {
    throw new Error(
      'Định dạng phản hồi từ SpotFlow không hợp lệ (cần là mảng bài hát JSON).'
    );
  }

  // Pre-resolve Direct-R2 URLs for tracks already uploaded to Cloudflare R2 by MusicTool
  // (avoids re-downloading/re-uploading 50+ MP3 files through Vercel!)
  const items: SpotflowIncomingItem[] = rawItems.map(item => ({ ...item }));
  const CONCURRENCY = 12;
  for (let offset = 0; offset < items.length; offset += CONCURRENCY) {
    const batch = items.slice(offset, offset + CONCURRENCY);
    await Promise.all(
      batch.map(async item => {
        if (item.r2AudioUrl || item.storage === 'r2') {
          item.storage = 'r2';
          return;
        }
        const shortId = (item.jobId || '').trim().slice(0, 8);
        if (!shortId || !r2PublicBaseUrl) return;
        const slug = slugifyMusicToolR2Segment(
          `${item.artist ? `${item.artist}-` : ''}${item.title || ''}`
        );
        const audioKey = `tracks/${slug}-${shortId}.mp3`;
        const coverKey = `covers/${slug}-${shortId}.jpg`;
        const candidateAudioUrl = `${r2PublicBaseUrl}/${audioKey}`;
        const candidateCoverUrl = `${r2PublicBaseUrl}/${coverKey}`;

        try {
          const [audioHead, coverHead] = await Promise.all([
            fetch(candidateAudioUrl, {
              method: 'HEAD',
              signal: AbortSignal.timeout(3500),
            }),
            fetch(candidateCoverUrl, {
              method: 'HEAD',
              signal: AbortSignal.timeout(3500),
            }).catch(() => null),
          ]);
          if (audioHead.ok) {
            item.storage = 'r2';
            item.r2AudioKey = audioKey;
            item.r2AudioUrl = candidateAudioUrl;
            item.audioUrl = candidateAudioUrl;
            if (coverHead && coverHead.ok) {
              item.r2CoverKey = coverKey;
              item.r2CoverUrl = candidateCoverUrl;
              item.coverUrl = candidateCoverUrl;
            }
          }
        } catch {
          // keep fallback downloadUrl if HEAD check times out
        }
      })
    );
  }

  return {
    endpoint,
    effectiveApiKey: usedKey,
    r2PublicBaseUrl,
    items,
  };
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

function normalizeTextKey(val?: string, stripD: boolean = false): string {
  let out = (val || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripD) {
    out = out.replace(/\bd/g, '').replace(/\s+/g, ' ').trim();
  }
  return out;
}

function isRawSlugString(val?: string): boolean {
  if (!val || !val.trim()) return true;
  const t = val.trim();
  if (t === 'Nghệ sĩ chưa rõ' || t === 'Bài hát trên R2') return true;
  return !/[^\u0000-\u007f]/.test(t) && t === t.toLowerCase();
}

function pickBetterMetadataString(preferred: string, existing?: string): string {
  const cleanPref = (preferred || '').trim();
  const cleanExist = (existing || '').trim();
  if (!cleanExist) return cleanPref;
  if (!cleanPref) return cleanExist;

  const prefHasDiacritics = /[^\u0000-\u007f]/.test(cleanPref);
  const existHasDiacritics = /[^\u0000-\u007f]/.test(cleanExist);
  if (prefHasDiacritics && !existHasDiacritics) return cleanPref;
  if (existHasDiacritics && !prefHasDiacritics) return cleanExist;

  if (!isRawSlugString(cleanPref) && isRawSlugString(cleanExist)) return cleanPref;
  return cleanExist;
}

function normalizeCoreTitle(rawTitle?: string, stripD: boolean = false): string {
  const raw = (rawTitle || '')
    .replace(/(?:\(|\[)?\b(?:feat\.?|ft\.?|featuring)\s+[^)\]]+(?:\)|\])?/gi, ' ')
    .replace(/\b(?:official\s+mv|official\s+video|official\s+audio|lyric\s+video|320kbps|128kbps)\b/gi, ' ')
    .replace(/\.(mp3|wav|flac|m4a|ogg|aac|opus)$/i, ' ')
    .replace(/^[0-9]{1,3}[\s._-]+/, '');
  return normalizeTextKey(raw, stripD) || normalizeTextKey(rawTitle, stripD);
}

function extractCanonicalArtistTokens(rawArtist?: string, rawTitle?: string): string[] {
  const featMatches: string[] = [];
  const featRegex = /(?:\(|\[)?\b(?:feat\.?|ft\.?|featuring)\s+([^)\]]+)(?:\)|\])?/gi;
  let m: RegExpExecArray | null;
  const titleStr = rawTitle || '';
  while ((m = featRegex.exec(titleStr)) !== null) {
    if (m[1]) featMatches.push(m[1]);
  }
  const combined = [rawArtist || '', ...featMatches].join(', ');
  const placeholders = new Set(['nghe si chua ro', 'nghe si spotflow', 'unknown artist']);
  const tokens = combined
    .split(/(?:,|&|;|\/|\bx\b|\bvs\.?\b|\bfeat\.?\b|\bft\.?\b|\bwith\b|\band\b|\bva\b)/i)
    .map(p => normalizeTextKey(p))
    .filter(p => p.length > 0 && !placeholders.has(p));
  return Array.from(new Set(tokens)).sort();
}

function makeTitleArtistKey(title?: string, artist?: string): string {
  const coreTitle = normalizeCoreTitle(title);
  const artistKey = extractCanonicalArtistTokens(artist, title).join('|');
  return `${coreTitle}::${artistKey}`;
}

function areArtistsCompatible(tokensA: string[], tokensB: string[]): boolean {
  if (tokensA.length === 0 || tokensB.length === 0) return true;
  if (tokensA.join('|') === tokensB.join('|')) return true;
  for (const a of tokensA) {
    for (const b of tokensB) {
      if (a === b) return true;
      if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) {
        return true;
      }
    }
  }
  return false;
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
    !track.lyrics.every(l => l.text.startsWith('Đang phát bản nhạc') || l.text.startsWith('Đang phát:'))
  ) {
    return true;
  }
  return false;
}

export function isR2StoredUrl(url?: string | null, publicDomain?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes('/api/r2/stream')) return true;
  if (trimmed.includes('.r2.dev/') || trimmed.includes('.r2.cloudflarestorage.com/')) {
    return true;
  }
  if (publicDomain) {
    const cleanDomain = publicDomain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    if (cleanDomain && trimmed.includes(cleanDomain)) {
      return true;
    }
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
  const res = await fetch(audioUrl, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Không thể tải tệp MP3 từ SpotFlow (HTTP ${res.status}).`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0) {
    throw new Error('Tệp MP3 tải về từ SpotFlow bị rỗng.');
  }
  const contentType = res.headers.get('content-type') || 'audio/mpeg';
  return { buffer, contentType };
}

async function persistCoverForTrack(params: {
  remoteCoverUrl: string;
  mp3Buffer: Buffer | null;
  fileStem: string;
  shouldSaveToR2: boolean;
}): Promise<{ coverUrl: string; r2CoverKey?: string }> {
  const { remoteCoverUrl, mp3Buffer, fileStem, shouldSaveToR2 } = params;

  if (remoteCoverUrl) {
    if (shouldSaveToR2) {
      try {
        const uploaded = await uploadRemoteImageToR2(remoteCoverUrl, fileStem);
        return { coverUrl: uploaded.coverUrl, r2CoverKey: uploaded.key };
      } catch (err) {
        console.warn('[SpotFlow] Failed to download/save coverUrl to R2:', err);
      }
    } else {
      return { coverUrl: remoteCoverUrl };
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
          return { coverUrl: uploaded.coverUrl, r2CoverKey: uploaded.key };
        } catch (err) {
          console.warn('[SpotFlow] Failed to upload ID3 cover to R2:', err);
        }
      }
    }
  }

  return { coverUrl: remoteCoverUrl || DEFAULT_COVER_URL };
}

export async function ingestSpotflowTracks(params: {
  items: SpotflowIncomingItem[];
  baseEndpoint?: string;
  apiKey?: string;
  saveToR2?: boolean;
  existingTracks: ExistingTrackLookup[];
  sourceLabel?: string;
  onTrackSaved?: (track: R2StoredTrack) => Promise<void>;
}): Promise<IngestSpotflowResult> {
  const {
    items,
    baseEndpoint,
    apiKey,
    saveToR2 = true,
    existingTracks,
    sourceLabel = 'SpotFlow MP3',
    onTrackSaved,
  } = params;

  const r2Config = loadR2Config();
  const shouldSaveToR2 = isR2Configured(r2Config) && saveToR2 !== false;

  const bySpotifyId = new Map<string, ExistingTrackLookup>();
  const byTitleArtist = new Map<string, ExistingTrackLookup>();
  const byCoreTitle = new Map<string, ExistingTrackLookup[]>();
  const byNoDTitle = new Map<string, ExistingTrackLookup[]>();

  const registerLookup = (track: ExistingTrackLookup) => {
    if (track.spotifyTrackId) {
      bySpotifyId.set(track.spotifyTrackId.trim(), track);
    }
    const taKey = makeTitleArtistKey(track.title, track.artist);
    if (!taKey.startsWith('::')) {
      const prev = byTitleArtist.get(taKey);
      if (!prev || isR2StoredUrl(track.audioUrl, r2Config.publicDomain)) {
        byTitleArtist.set(taKey, track);
      }
    }
    const coreTitle = normalizeCoreTitle(track.title);
    if (coreTitle) {
      const list = byCoreTitle.get(coreTitle) || [];
      const existingIdx = list.findIndex(item => item.id === track.id);
      if (existingIdx !== -1) {
        list[existingIdx] = track;
      } else {
        list.push(track);
      }
      byCoreTitle.set(coreTitle, list);
    }
    const noDTitle = normalizeCoreTitle(track.title, true);
    if (noDTitle && noDTitle.length >= 6) {
      const list = byNoDTitle.get(noDTitle) || [];
      const existingIdx = list.findIndex(item => item.id === track.id);
      if (existingIdx !== -1) {
        list[existingIdx] = track;
      } else {
        list.push(track);
      }
      byNoDTitle.set(noDTitle, list);
    }
  };

  for (const t of existingTracks) {
    registerLookup(t);
  }

  const findMatchingExisting = (
    spotifyTrackId: string | undefined,
    title: string,
    artist: string
  ): ExistingTrackLookup | undefined => {
    if (spotifyTrackId && bySpotifyId.has(spotifyTrackId)) {
      return bySpotifyId.get(spotifyTrackId);
    }
    const taKey = makeTitleArtistKey(title, artist);
    if (byTitleArtist.has(taKey)) {
      return byTitleArtist.get(taKey);
    }
    const coreTitle = normalizeCoreTitle(title);
    const sameTitleCandidates = coreTitle ? byCoreTitle.get(coreTitle) || [] : [];
    const candidateTokens = extractCanonicalArtistTokens(artist, title);
    for (const cand of sameTitleCandidates) {
      const candTokens = extractCanonicalArtistTokens(cand.artist, cand.title);
      if (areArtistsCompatible(candidateTokens, candTokens)) {
        return cand;
      }
    }
    // Also check d-stripped title match (heals old R2 filenames where 'đ' was stripped to '_')
    const noDTitle = normalizeCoreTitle(title, true);
    const noDCandidates = noDTitle && noDTitle.length >= 6 ? byNoDTitle.get(noDTitle) || [] : [];
    for (const cand of noDCandidates) {
      const candTokens = extractCanonicalArtistTokens(cand.artist, cand.title);
      if (areArtistsCompatible(candidateTokens, candTokens)) {
        return cand;
      }
    }
    return undefined;
  };

  const addedTracks: R2StoredTrack[] = [];
  const updatedTracks: R2StoredTrack[] = [];
  let skippedCount = 0;
  let failedAudioCount = 0;
  const failedAudioMessages: string[] = [];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const spotifyTrackId = (item.trackId || item.id || '').trim() || undefined;
    const title = (item.title || 'Bài hát SpotFlow').trim().slice(0, 300);
    const artist = (item.artist || 'Nghệ sĩ SpotFlow').trim().slice(0, 300);
    const album = (item.album || 'SpotFlow MP3 Download').trim().slice(0, 300);
    const fileStem = `${artist} - ${title}`.slice(0, 120);

    const parsedLyrics = parseLrcLyrics(item.syncedLyrics, item.plainLyrics);
    const isDirectR2 =
      (item.storage || '').toLowerCase() === 'r2' ||
      Boolean(item.r2AudioUrl && item.r2AudioUrl.trim());

    const directAudioUrl = isDirectR2
      ? (item.r2AudioUrl || item.audioUrl || '').trim()
      : '';
    const directCoverUrl = isDirectR2
      ? (item.r2CoverUrl || item.coverUrl || '').trim()
      : '';
    const directAudioKey = item.r2AudioKey?.trim() || undefined;
    const directCoverKey = item.r2CoverKey?.trim() || undefined;

    const remoteAudioUrl = isDirectR2
      ? directAudioUrl
      : resolveRemoteMediaUrl(item.downloadUrl || item.audioUrl, baseEndpoint);
    const remoteCoverUrl = isDirectR2
      ? directCoverUrl
      : resolveRemoteMediaUrl(item.coverUrl || item.r2CoverUrl, baseEndpoint);

    const durationSecs =
      typeof item.durationMs === 'number' && item.durationMs > 0
        ? Math.round(item.durationMs / 1000)
        : typeof item.duration === 'number' && item.duration > 0
          ? Math.round(item.duration)
          : 210;

    // 1. Check duplicate by spotifyTrackId first, then by canonical (title + artist)
    const existing = findMatchingExisting(spotifyTrackId, title, artist);

    if (existing) {
      const bestTitle = pickBetterMetadataString(title, existing.title);
      const bestArtist = pickBetterMetadataString(artist, existing.artist);
      const bestDuration =
        durationSecs !== 210
          ? durationSecs
          : existing.duration && existing.duration !== 210
            ? existing.duration
            : durationSecs;

      // Fast path when SpotFlow already uploaded directly to Cloudflare R2
      if (isDirectR2) {
        if (!directAudioUrl) {
          failedAudioCount++;
          failedAudioMessages.push(`${title}: Thiếu audioUrl (r2AudioUrl / audioUrl)`);
          continue;
        }

        const nextCoverUrl =
          directCoverUrl && !isMissingOrDefaultCover(directCoverUrl)
            ? directCoverUrl
            : existing.coverUrl || DEFAULT_COVER_URL;

        const nextSyncedLyrics = parsedLyrics.syncedLyrics || existing.syncedLyrics;
        const nextPlainLyrics = parsedLyrics.plainLyrics || existing.plainLyrics;
        const nextLyrics =
          parsedLyrics.lyrics.length > 0
            ? parsedLyrics.lyrics
            : existing.lyrics || [];
        const nextLyricsMode =
          nextSyncedLyrics || nextLyrics.length > 0
            ? 'synced'
            : nextPlainLyrics
              ? 'plain'
              : existing.lyricsMode || 'none';

        const mergedDirectTrack: R2StoredTrack = {
          id: existing.id,
          title: bestTitle,
          artist: bestArtist,
          album:
            album && album !== 'SpotFlow MP3 Download'
              ? album
              : existing.album || album,
          audioUrl: directAudioUrl.slice(0, 2000),
          coverUrl: nextCoverUrl.slice(0, 2000),
          duration: bestDuration,
          genre: (existing.genre || 'Pop').slice(0, 100),
          releaseYear: existing.releaseYear || new Date().getFullYear(),
          bpm: existing.bpm ?? (item.bitrate === 320 ? 120 : 110),
          mood: (existing.mood || 'Sôi động & Chất lượng cao').slice(0, 150),
          aiClassified: existing.aiClassified ?? true,
          aiReason: `Đồng bộ trực tiếp Cloudflare R2 từ ${sourceLabel}`.slice(0, 500),
          lyrics: nextLyrics,
          plays: existing.plays ?? 0,
          ...(spotifyTrackId || existing.spotifyTrackId
            ? { spotifyTrackId: (existing.spotifyTrackId || spotifyTrackId || '').slice(0, 128) }
            : {}),
          ...(item.spotifyUrl || existing.spotifyUrl
            ? { spotifyUrl: (existing.spotifyUrl || item.spotifyUrl || '').slice(0, 500) }
            : {}),
          ...(directAudioKey || existing.r2AudioKey
            ? { r2AudioKey: (directAudioKey || existing.r2AudioKey || '').slice(0, 500) }
            : {}),
          ...(directCoverKey || existing.r2CoverKey
            ? { r2CoverKey: (directCoverKey || existing.r2CoverKey || '').slice(0, 500) }
            : {}),
          ...(nextSyncedLyrics ? { syncedLyrics: nextSyncedLyrics } : {}),
          ...(nextPlainLyrics ? { plainLyrics: nextPlainLyrics } : {}),
          lyricsMode: nextLyricsMode,
        };

        updatedTracks.push(mergedDirectTrack);
        registerLookup(mergedDirectTrack);
        if (onTrackSaved) {
          await onTrackSaved(mergedDirectTrack);
        }
        continue;
      }

      const needsTextUpgrade =
        bestTitle !== existing.title ||
        bestArtist !== existing.artist ||
        (existing.duration === 210 && bestDuration !== 210);
      const needsCover = isMissingOrDefaultCover(existing.coverUrl);
      const needsLyrics =
        !hasUsableLyrics(existing) ||
        (!existing.syncedLyrics && Boolean(parsedLyrics.syncedLyrics));
      const needsR2Audio =
        shouldSaveToR2 &&
        Boolean(remoteAudioUrl) &&
        !isR2StoredUrl(existing.audioUrl, r2Config.publicDomain);

      if (!needsTextUpgrade && !needsCover && !needsLyrics && !needsR2Audio) {
        skippedCount++;
        continue;
      }

      let updatedAudioUrl = existing.audioUrl || remoteAudioUrl;
      let updatedAudioKey = existing.r2AudioKey;
      let updatedCoverKey = existing.r2CoverKey;
      let downloadedMp3ForExisting: Buffer | null = null;

      if (needsR2Audio && remoteAudioUrl) {
        try {
          const downloaded = await downloadAudioBuffer(remoteAudioUrl, apiKey);
          downloadedMp3ForExisting = downloaded.buffer;
          const uploadName = item.fileName || `${fileStem}.mp3`;
          const r2Audio = await uploadBufferToR2(
            downloadedMp3ForExisting,
            uploadName,
            downloaded.contentType
          );
          updatedAudioUrl = r2Audio.audioUrl;
          updatedAudioKey = r2Audio.key;
        } catch (err) {
          failedAudioCount++;
          const reason = err instanceof Error ? err.message : 'Lỗi tải MP3';
          if (failedAudioMessages.length < 5) {
            failedAudioMessages.push(`${title}: ${reason}`);
          }
          console.warn('[SpotFlow] Could not archive existing track MP3 to R2:', err);
        }
      }

      let updatedCoverUrl = existing.coverUrl || DEFAULT_COVER_URL;
      if (needsCover) {
        let mp3BufferForCover: Buffer | null = downloadedMp3ForExisting;
        if (!mp3BufferForCover && !remoteCoverUrl && remoteAudioUrl) {
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
        if (!isMissingOrDefaultCover(resolvedCover.coverUrl)) {
          updatedCoverUrl = resolvedCover.coverUrl;
          if (resolvedCover.r2CoverKey) {
            updatedCoverKey = resolvedCover.r2CoverKey;
          }
        }
      }

      const nextSyncedLyrics = existing.syncedLyrics || parsedLyrics.syncedLyrics;
      const nextPlainLyrics = existing.plainLyrics || parsedLyrics.plainLyrics;
      const nextLyrics =
        parsedLyrics.lyricsMode === 'synced' && (!existing.syncedLyrics || !hasUsableLyrics(existing))
          ? parsedLyrics.lyrics
          : existing.lyrics && existing.lyrics.length > 0 && hasUsableLyrics(existing)
            ? existing.lyrics
            : parsedLyrics.lyrics.length > 0
              ? parsedLyrics.lyrics
              : existing.lyrics || [];
      const nextLyricsMode =
        nextSyncedLyrics || nextLyrics.length > 0
          ? 'synced'
          : nextPlainLyrics
            ? 'plain'
            : existing.lyricsMode || 'none';

      const audioImproved = updatedAudioUrl !== existing.audioUrl;
      const coverImproved = updatedCoverUrl !== existing.coverUrl;
      const lyricsImproved =
        nextSyncedLyrics !== existing.syncedLyrics ||
        nextPlainLyrics !== existing.plainLyrics ||
        (!hasUsableLyrics(existing) && (nextLyrics.length > 0 || Boolean(nextPlainLyrics)));

      if (!needsTextUpgrade && !audioImproved && !coverImproved && !lyricsImproved) {
        skippedCount++;
        continue;
      }

      const mergedTrack: R2StoredTrack = {
        id: existing.id,
        title: bestTitle,
        artist: bestArtist,
        album:
          existing.album && existing.album !== 'Kho nhạc Cloudflare R2'
            ? existing.album
            : album,
        audioUrl: updatedAudioUrl.slice(0, 2000),
        coverUrl: updatedCoverUrl.slice(0, 2000),
        duration: bestDuration,
        genre: (existing.genre || 'Pop').slice(0, 100),
        releaseYear: existing.releaseYear || new Date().getFullYear(),
        bpm: existing.bpm ?? (item.bitrate === 320 ? 120 : 110),
        mood: (existing.mood || 'Sôi động & Chất lượng cao').slice(0, 150),
        aiClassified: existing.aiClassified ?? true,
        aiReason: (audioImproved && shouldSaveToR2
          ? `Đã lưu trữ bản nhạc lên Cloudflare R2 từ ${sourceLabel}`
          : existing.aiReason || `Cập nhật metadata từ ${sourceLabel}`
        ).slice(0, 500),
        lyrics: nextLyrics,
        plays: existing.plays ?? 0,
        ...(spotifyTrackId || existing.spotifyTrackId
          ? { spotifyTrackId: (existing.spotifyTrackId || spotifyTrackId || '').slice(0, 128) }
          : {}),
        ...(item.spotifyUrl || existing.spotifyUrl
          ? { spotifyUrl: (existing.spotifyUrl || item.spotifyUrl || '').slice(0, 500) }
          : {}),
        ...(updatedAudioKey ? { r2AudioKey: updatedAudioKey.slice(0, 500) } : {}),
        ...(updatedCoverKey ? { r2CoverKey: updatedCoverKey.slice(0, 500) } : {}),
        ...(nextSyncedLyrics ? { syncedLyrics: nextSyncedLyrics } : {}),
        ...(nextPlainLyrics ? { plainLyrics: nextPlainLyrics } : {}),
        lyricsMode: nextLyricsMode,
      };

      updatedTracks.push(mergedTrack);
      registerLookup(mergedTrack);
      if (onTrackSaved) {
        await onTrackSaved(mergedTrack);
      }
      continue;
    }

    // 2A. New track with Direct R2 storage (storage === "r2" or track.r2AudioUrl present)
    if (isDirectR2) {
      if (!directAudioUrl) {
        failedAudioCount++;
        failedAudioMessages.push(`${title}: Thiếu audioUrl (r2AudioUrl / audioUrl)`);
        continue;
      }

      const rawId = `spotflow-${spotifyTrackId || item.jobId || `${Date.now()}-${idx}`}`;
      const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
      const releaseYear = item.downloadedAt
        ? new Date(item.downloadedAt).getFullYear() || new Date().getFullYear()
        : new Date().getFullYear();

      const directNewTrack: R2StoredTrack = {
        id: safeId,
        title,
        artist,
        album,
        audioUrl: directAudioUrl.slice(0, 2000),
        coverUrl: (directCoverUrl || DEFAULT_COVER_URL).slice(0, 2000),
        duration: durationSecs,
        genre: 'Pop',
        releaseYear,
        bpm: item.bitrate === 320 ? 120 : 110,
        mood: 'Sôi động & Chất lượng cao',
        aiClassified: true,
        aiReason: `Đồng bộ trực tiếp trên Cloudflare R2 từ ${sourceLabel}`.slice(0, 500),
        lyrics: parsedLyrics.lyrics,
        plays: 0,
        ...(spotifyTrackId ? { spotifyTrackId: spotifyTrackId.slice(0, 128) } : {}),
        ...(item.spotifyUrl ? { spotifyUrl: item.spotifyUrl.trim().slice(0, 500) } : {}),
        ...(directAudioKey ? { r2AudioKey: directAudioKey.slice(0, 500) } : {}),
        ...(directCoverKey ? { r2CoverKey: directCoverKey.slice(0, 500) } : {}),
        ...(parsedLyrics.syncedLyrics ? { syncedLyrics: parsedLyrics.syncedLyrics } : {}),
        ...(parsedLyrics.plainLyrics ? { plainLyrics: parsedLyrics.plainLyrics } : {}),
        lyricsMode: parsedLyrics.lyricsMode,
      };

      addedTracks.push(directNewTrack);
      registerLookup(directNewTrack);
      if (onTrackSaved) {
        await onTrackSaved(directNewTrack);
      }
      continue;
    }

    // 2B. Fallback for legacy flow (storage !== "r2"): download MP3 from downloadUrl & cover from coverUrl and upload to R2
    let finalAudioUrl = remoteAudioUrl;
    let finalAudioKey: string | undefined = directAudioKey;
    let downloadedMp3Buffer: Buffer | null = null;
    let audioUploadFailed = false;

    if (!remoteAudioUrl) {
      failedAudioCount++;
      failedAudioMessages.push(`${title}: Thiếu downloadUrl / audioUrl`);
      continue;
    }

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
          finalAudioKey = r2Audio.key;
        }
      } catch (err) {
        audioUploadFailed = true;
        if (shouldSaveToR2) {
          failedAudioCount++;
          const reason = err instanceof Error ? err.message : 'Lỗi tải MP3';
          if (failedAudioMessages.length < 5) {
            failedAudioMessages.push(`${title}: ${reason}`);
          }
        }
        console.warn('[SpotFlow] Could not download/upload MP3 to R2:', err);
      }
    }

    // Never persist broken expired external links when saveToR2 was required and audio failed
    if (shouldSaveToR2 && audioUploadFailed && !isR2StoredUrl(finalAudioUrl, r2Config.publicDomain)) {
      continue;
    }

    const coverPersisted = await persistCoverForTrack({
      remoteCoverUrl,
      mp3Buffer: downloadedMp3Buffer,
      fileStem,
      shouldSaveToR2,
    });
    const finalCoverUrl = coverPersisted.coverUrl;
    const finalCoverKey = coverPersisted.r2CoverKey || directCoverKey;

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
      ...(finalAudioKey ? { r2AudioKey: finalAudioKey.slice(0, 500) } : {}),
      ...(finalCoverKey ? { r2CoverKey: finalCoverKey.slice(0, 500) } : {}),
      ...(parsedLyrics.syncedLyrics ? { syncedLyrics: parsedLyrics.syncedLyrics } : {}),
      ...(parsedLyrics.plainLyrics ? { plainLyrics: parsedLyrics.plainLyrics } : {}),
      lyricsMode: parsedLyrics.lyricsMode,
    };

    addedTracks.push(newTrack);
    registerLookup(newTrack);
    if (onTrackSaved) {
      await onTrackSaved(newTrack);
    }
  }

  return {
    addedTracks,
    updatedTracks,
    addedCount: addedTracks.length,
    updatedCount: updatedTracks.length,
    skippedCount,
    failedAudioCount,
    failedAudioMessages,
    tracks: [...addedTracks, ...updatedTracks],
  };
}

export interface SpotflowEnrichResult {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  coverUrl?: string;
  r2CoverKey?: string;
  syncedLyrics?: string;
  plainLyrics?: string;
  lyrics: SpotflowLyricLine[];
  lyricsMode: 'synced' | 'plain' | 'none';
}

export async function enrichTrackMetadataFromSpotflow(params: {
  fileName?: string;
  title?: string;
  artist?: string;
  apiKey?: string;
  enrichUrl?: string;
  saveCoverToR2?: boolean;
}): Promise<SpotflowEnrichResult> {
  const rawEndpoint = (
    params.enrichUrl ||
    process.env.SPOTFLOW_ENRICH_URL ||
    DEFAULT_SPOTFLOW_ENRICH_URL
  ).trim();
  const endpoint = rawEndpoint.includes('.run.app')
    ? DEFAULT_SPOTFLOW_ENRICH_URL
    : rawEndpoint;
  const key = (
    params.apiKey ||
    process.env.SPOTFLOW_API_KEY ||
    process.env.SPOTFLOW_WEBHOOK_SECRET ||
    DEFAULT_SPOTFLOW_API_KEY
  ).trim();

  let res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      fileName: params.fileName || '',
      title: params.title || '',
      artist: params.artist || '',
    }),
    signal: AbortSignal.timeout(12000),
  });

  // Fallback to MusicTool's public /api/metadata/enrich if key changed after Render restart
  if (!res.ok) {
    const publicMetadataEndpoint = `${DEFAULT_SPOTFLOW_BASE_URL}/api/metadata/enrich`;
    res = await fetch(publicMetadataEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        fileName: params.fileName || '',
        title: params.title || '',
        artist: params.artist || '',
      }),
      signal: AbortSignal.timeout(12000),
    });
  }

  if (!res.ok) {
    throw new Error(`SpotFlow Enrich API trả về HTTP ${res.status}`);
  }

  const raw = (await res.json()) as Record<string, unknown>;
  const data =
    raw && typeof raw.data === 'object' && raw.data !== null
      ? (raw.data as Record<string, unknown>)
      : raw && typeof raw.track === 'object' && raw.track !== null
        ? (raw.track as Record<string, unknown>)
        : raw;

  const syncedLyrics =
    typeof data.syncedLyrics === 'string' && data.syncedLyrics.trim()
      ? data.syncedLyrics.trim()
      : undefined;
  const plainLyrics =
    typeof data.plainLyrics === 'string' && data.plainLyrics.trim()
      ? data.plainLyrics.trim()
      : undefined;
  const parsedLyrics = parseLrcLyrics(syncedLyrics, plainLyrics);

  let coverUrl =
    typeof data.r2CoverUrl === 'string' && data.r2CoverUrl.trim()
      ? data.r2CoverUrl.trim()
      : typeof data.coverUrl === 'string' && data.coverUrl.trim()
        ? data.coverUrl.trim()
        : undefined;
  let r2CoverKey =
    typeof data.r2CoverKey === 'string' && data.r2CoverKey.trim()
      ? data.r2CoverKey.trim()
      : undefined;

  if (
    coverUrl &&
    params.saveCoverToR2 !== false &&
    isR2Configured() &&
    !isR2StoredUrl(coverUrl, loadR2Config().publicDomain)
  ) {
    try {
      const stem = `${params.artist || 'artist'}-${params.title || params.fileName || 'cover'}`.slice(0, 100);
      const uploaded = await uploadRemoteImageToR2(coverUrl, stem);
      coverUrl = uploaded.coverUrl;
      r2CoverKey = uploaded.key;
    } catch {
      // keep remote coverUrl if upload fails
    }
  }

  const durationMs =
    typeof data.durationMs === 'number' && data.durationMs > 0
      ? data.durationMs
      : undefined;
  const duration =
    durationMs !== undefined
      ? Math.round(durationMs / 1000)
      : typeof data.duration === 'number' && data.duration > 0
        ? Math.round(data.duration)
        : undefined;

  return {
    title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : undefined,
    artist: typeof data.artist === 'string' && data.artist.trim() ? data.artist.trim() : undefined,
    album: typeof data.album === 'string' && data.album.trim() ? data.album.trim() : undefined,
    duration,
    coverUrl,
    r2CoverKey,
    syncedLyrics: parsedLyrics.syncedLyrics,
    plainLyrics: parsedLyrics.plainLyrics,
    lyrics: parsedLyrics.lyrics,
    lyricsMode: parsedLyrics.lyricsMode,
  };
}
