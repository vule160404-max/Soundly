import { Track } from '../types/music';

const PLACEHOLDER_ARTISTS = new Set([
  'nghe si chua ro',
  'nghe si spotflow',
  'cho ai nhan dien',
  'unknown artist',
  'various artists',
]);

export function normalizeVietnameseText(raw?: string | null): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractFeaturedFromTitle(rawTitle?: string | null): {
  cleanTitle: string;
  featuredArtists: string[];
} {
  const title = (rawTitle || '').trim();
  if (!title) return { cleanTitle: '', featuredArtists: [] };

  const featuredArtists: string[] = [];
  const featRegex = /(?:\(|\[)?\b(?:feat\.?|ft\.?|featuring)\s+([^)\]]+)(?:\)|\])?/gi;
  let match: RegExpExecArray | null;
  while ((match = featRegex.exec(title)) !== null) {
    if (match[1]) {
      featuredArtists.push(match[1].trim());
    }
  }

  const withoutFeat = title
    .replace(/(?:\(|\[)?\b(?:feat\.?|ft\.?|featuring)\s+[^)\]]+(?:\)|\])?/gi, ' ')
    .replace(/\b(?:official\s+mv|official\s+music\s+video|official\s+video|official\s+audio|lyric\s+video|lyrics\s+video|audio|mv|320kbps|128kbps)\b/gi, ' ')
    .replace(/\.(mp3|wav|flac|m4a|ogg|aac|opus)$/i, ' ')
    .replace(/^[0-9]{1,3}[\s._-]+/, '');

  return {
    cleanTitle: normalizeVietnameseText(withoutFeat),
    featuredArtists,
  };
}

export function normalizeTrackTitle(rawTitle?: string | null): string {
  const { cleanTitle } = extractFeaturedFromTitle(rawTitle);
  return cleanTitle || normalizeVietnameseText(rawTitle);
}

export function extractNormalizedArtistTokens(
  rawArtist?: string | null,
  rawTitle?: string | null
): string[] {
  const { featuredArtists } = extractFeaturedFromTitle(rawTitle);
  const combined = [rawArtist || '', ...featuredArtists].join(', ');

  const parts = combined
    .split(/(?:,|&|;|\/|\bx\b|\bvs\.?\b|\bfeat\.?\b|\bft\.?\b|\bwith\b|\band\b|\bva\b)/i)
    .map(p => normalizeVietnameseText(p))
    .filter(p => p.length > 0 && !PLACEHOLDER_ARTISTS.has(p));

  return Array.from(new Set(parts)).sort();
}

export function isR2AudioUrl(audioUrl?: string | null): boolean {
  if (!audioUrl || typeof audioUrl !== 'string') return false;
  const trimmed = audioUrl.trim();
  return (
    trimmed.includes('/api/r2/stream') ||
    trimmed.includes('.r2.dev/') ||
    trimmed.includes('.r2.cloudflarestorage.com/')
  );
}

export function isExpiredExternalAudioUrl(audioUrl?: string | null): boolean {
  if (!audioUrl || typeof audioUrl !== 'string') return false;
  const trimmed = audioUrl.trim();
  return (
    trimmed.startsWith('blob:') ||
    trimmed.includes('/api/download/file/') ||
    trimmed.includes('onrender.com')
  );
}

export function areArtistListsCompatible(
  tokensA: string[],
  tokensB: string[]
): boolean {
  if (tokensA.length === 0 || tokensB.length === 0) {
    return true;
  }
  if (tokensA.join('|') === tokensB.join('|')) {
    return true;
  }
  for (const a of tokensA) {
    for (const b of tokensB) {
      if (a === b) return true;
      // Handle e.g. "14 casper" vs "casper"
      if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) {
        return true;
      }
    }
  }
  return false;
}

export function areTracksDuplicate(
  a: {
    id?: string;
    title?: string;
    artist?: string;
    audioUrl?: string;
    spotifyTrackId?: string;
  },
  b: {
    id?: string;
    title?: string;
    artist?: string;
    audioUrl?: string;
    spotifyTrackId?: string;
  }
): boolean {
  if (a.id && b.id && a.id === b.id) return true;
  if (
    a.spotifyTrackId &&
    b.spotifyTrackId &&
    a.spotifyTrackId.trim() === b.spotifyTrackId.trim()
  ) {
    return true;
  }
  if (
    a.audioUrl &&
    b.audioUrl &&
    !a.audioUrl.startsWith('blob:') &&
    a.audioUrl.trim() === b.audioUrl.trim()
  ) {
    return true;
  }

  const titleA = normalizeTrackTitle(a.title);
  const titleB = normalizeTrackTitle(b.title);
  if (!titleA || !titleB || titleA !== titleB) {
    return false;
  }

  const artistsA = extractNormalizedArtistTokens(a.artist, a.title);
  const artistsB = extractNormalizedArtistTokens(b.artist, b.title);
  return areArtistListsCompatible(artistsA, artistsB);
}

export function findDuplicateTrack(
  candidate: {
    id?: string;
    title?: string;
    artist?: string;
    audioUrl?: string;
    spotifyTrackId?: string;
  },
  existingTracks: Track[]
): Track | null {
  let matchedFallback: Track | null = null;
  for (const existing of existingTracks) {
    if (areTracksDuplicate(candidate, existing)) {
      if (isR2AudioUrl(existing.audioUrl)) {
        return existing;
      }
      if (!matchedFallback) {
        matchedFallback = existing;
      }
    }
  }
  return matchedFallback;
}

export function mergeDuplicateTrackPair(primary: Track, secondary: Track): Track {
  const primaryOnR2 = isR2AudioUrl(primary.audioUrl);
  const secondaryOnR2 = isR2AudioUrl(secondary.audioUrl);

  const bestAudioTrack =
    primaryOnR2 || !secondaryOnR2 ? primary : secondary;
  const otherTrack = bestAudioTrack === primary ? secondary : primary;

  const hasBetterLyrics = (t: Track) =>
    Boolean(t.syncedLyrics?.trim()) ||
    Boolean(t.plainLyrics?.trim()) ||
    (Array.isArray(t.lyrics) &&
      t.lyrics.length > 2 &&
      !t.lyrics.every(l => l.text.startsWith('Đang phát bản nhạc')));

  const lyricsSource = hasBetterLyrics(bestAudioTrack)
    ? bestAudioTrack
    : hasBetterLyrics(otherTrack)
      ? otherTrack
      : bestAudioTrack;

  const isDefaultCover = (url?: string) =>
    !url || url.includes('photo-1511671782779-c97d3d27a1d4');

  const bestCover = !isDefaultCover(bestAudioTrack.coverUrl)
    ? bestAudioTrack.coverUrl
    : !isDefaultCover(otherTrack.coverUrl)
      ? otherTrack.coverUrl
      : bestAudioTrack.coverUrl || otherTrack.coverUrl;

  return {
    ...otherTrack,
    ...bestAudioTrack,
    id: bestAudioTrack.id || otherTrack.id,
    title: bestAudioTrack.title || otherTrack.title,
    artist:
      bestAudioTrack.artist && !PLACEHOLDER_ARTISTS.has(normalizeVietnameseText(bestAudioTrack.artist))
        ? bestAudioTrack.artist
        : otherTrack.artist || bestAudioTrack.artist,
    audioUrl: bestAudioTrack.audioUrl || otherTrack.audioUrl,
    coverUrl: bestCover,
    plays: Math.max(Number(primary.plays) || 0, Number(secondary.plays) || 0),
    lyrics: lyricsSource.lyrics || bestAudioTrack.lyrics,
    syncedLyrics: lyricsSource.syncedLyrics || bestAudioTrack.syncedLyrics,
    plainLyrics: lyricsSource.plainLyrics || bestAudioTrack.plainLyrics,
    lyricsMode: lyricsSource.lyricsMode || bestAudioTrack.lyricsMode,
    spotifyTrackId: bestAudioTrack.spotifyTrackId || otherTrack.spotifyTrackId,
    spotifyUrl: bestAudioTrack.spotifyUrl || otherTrack.spotifyUrl,
  };
}

export function deduplicateTracksList(tracks: Track[]): {
  deduped: Track[];
  removedIds: string[];
} {
  const deduped: Track[] = [];
  const removedIds: string[] = [];

  for (const track of tracks) {
    if (!track || !track.id) continue;
    const dupIdx = deduped.findIndex(existing => areTracksDuplicate(existing, track));
    if (dupIdx === -1) {
      deduped.push(track);
    } else {
      const prev = deduped[dupIdx];
      const merged = mergeDuplicateTrackPair(prev, track);
      const discardedId = merged.id === prev.id ? track.id : prev.id;
      if (discardedId && discardedId !== merged.id) {
        removedIds.push(discardedId);
      }
      deduped[dupIdx] = merged;
    }
  }

  return { deduped, removedIds };
}
