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

const CLIENT_VIETNAMESE_ARTIST_MAP: Record<string, string> = {
  'buitruonglinh': 'buitruonglinh',
  'bui truong linh': 'Bùi Trường Linh',
  'le quyen': 'Lệ Quyên',
  'bang kieu': 'Bằng Kiều',
  'quang le': 'Quang Lê',
  'le quyen quang le': 'Lệ Quyên, Quang Lê',
  'hoai sa': 'Hoài Sa',
  'son tung m tp': 'Sơn Tùng M-TP',
  'den vau': 'Đen Vâu',
  'hoang dung': 'Hoàng Dũng',
  'phan manh quynh': 'Phan Mạnh Quỳnh',
  'ha anh tuan': 'Hà Anh Tuấn',
  'my tam': 'Mỹ Tâm',
  'noo phuoc thinh': 'Noo Phước Thịnh',
  'bich phuong': 'Bích Phương',
  'duc phuc': 'Đức Phúc',
  'hoa minzy': 'Hòa Minzy',
  'van mai huong': 'Văn Mai Hương',
  'trung quan': 'Trung Quân',
  'quan a p': 'Quân A.P',
  'hai dang doo': 'Hải Đăng Doo',
  'quang dang tran': 'Quang Đăng Trần',
  'ha an huy': 'Hà An Huy',
};

const CLIENT_VIETNAMESE_TITLE_MAP: Record<
  string,
  { title: string; artist?: string; genre?: string }
> = {
  'du cho mai ve sau': { title: 'Dù Cho Mai Về Sau', artist: 'buitruonglinh', genre: 'V-Pop' },
  'du cho mai ve sau acoustic version': {
    title: 'Dù Cho Mai Về Sau (Acoustic Version)',
    artist: 'buitruonglinh',
    genre: 'Ballad',
  },
  'du cho mai ve sau instrumental': {
    title: 'Dù Cho Mai Về Sau (Instrumental)',
    artist: 'buitruonglinh',
    genre: 'Ballad',
  },
  'em a': { title: 'Em À', artist: 'buitruonglinh', genre: 'V-Pop' },
  'cho em gan anh them chut nua feat. hoai sa': {
    title: 'Cho Em Gần Anh Thêm Chút Nữa (feat. Hoài Sa)',
    artist: 'Lệ Quyên',
    genre: 'Ballad',
  },
  'cho em gan anh them chut nua feat hoai sa': {
    title: 'Cho Em Gần Anh Thêm Chút Nữa (feat. Hoài Sa)',
    artist: 'Lệ Quyên',
    genre: 'Ballad',
  },
  'cho em gan anh them chut nua': {
    title: 'Cho Em Gần Anh Thêm Chút Nữa',
    artist: 'Lệ Quyên',
    genre: 'Ballad',
  },
  'giac mo co that': { title: 'Giấc Mơ Có Thật', artist: 'Lệ Quyên', genre: 'Ballad' },
  'tinh lo': { title: 'Tình Lỡ', artist: 'Lệ Quyên', genre: 'Ballad' },
  'e nho mot thoi ta a yeu': {
    title: 'Để Nhớ Một Thời Ta Đã Yêu',
    artist: 'Bằng Kiều',
    genre: 'Ballad',
  },
  'de nho mot thoi ta da yeu': {
    title: 'Để Nhớ Một Thời Ta Đã Yêu',
    artist: 'Bằng Kiều',
    genre: 'Ballad',
  },
  'sau tim thiep hong': {
    title: 'Sầu Tím Thiệp Hồng',
    artist: 'Lệ Quyên, Quang Lê',
    genre: 'Ballad',
  },
  'nhu mot nguoi dung': { title: 'Như Một Người Dưng', genre: 'V-Pop' },
  'nhu mot nguoi rung': { title: 'Như Một Người Dưng', genre: 'V-Pop' },
  'thien menh': { title: 'Thiên Mệnh', genre: 'V-Pop' },
  'anh van o day': { title: 'Anh Vẫn Ở Đây', genre: 'V-Pop' },
  'anh van o ay': { title: 'Anh Vẫn Ở Đây', genre: 'V-Pop' },
  'de danh khi thuc giac': { title: 'Để Dành Khi Thức Giấc', genre: 'Indie' },
  'e danh khi thuc giac': { title: 'Để Dành Khi Thức Giấc', genre: 'Indie' },
};

export function isRawSlugDisplayText(text?: string | null): boolean {
  if (!text || !text.trim()) return true;
  const t = text.trim();
  if (PLACEHOLDER_ARTISTS.has(normalizeVietnameseText(t))) return true;
  return !/[^\u0000-\u007f]/.test(t) && t === t.toLowerCase();
}

export function healTrackVietnameseDisplay(track: Track): Track {
  let title = (track.title || '').trim();
  let artist = (track.artist || '').trim();
  let genre = track.genre || 'Pop';

  const titleKey = title.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const titleKeyAlpha = titleKey.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const artistKey = artist
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const matchedTitle =
    CLIENT_VIETNAMESE_TITLE_MAP[titleKey] ||
    CLIENT_VIETNAMESE_TITLE_MAP[titleKeyAlpha];

  if (matchedTitle && isRawSlugDisplayText(title)) {
    title = matchedTitle.title;
    if (matchedTitle.genre && genre === 'Pop') {
      genre = matchedTitle.genre;
    }
    if (matchedTitle.artist && isRawSlugDisplayText(artist)) {
      artist = matchedTitle.artist;
    }
  }

  if (CLIENT_VIETNAMESE_ARTIST_MAP[artistKey] && isRawSlugDisplayText(artist)) {
    artist = CLIENT_VIETNAMESE_ARTIST_MAP[artistKey];
  }

  if (title === track.title && artist === track.artist && genre === track.genre) {
    return track;
  }

  return {
    ...track,
    title,
    artist,
    genre,
  };
}

function pickBetterDisplayString(a?: string, b?: string): string {
  const cleanA = (a || '').trim();
  const cleanB = (b || '').trim();
  if (!cleanA) return cleanB;
  if (!cleanB) return cleanA;

  const aHasDiacritics = /[^\u0000-\u007f]/.test(cleanA);
  const bHasDiacritics = /[^\u0000-\u007f]/.test(cleanB);
  if (aHasDiacritics && !bHasDiacritics) return cleanA;
  if (bHasDiacritics && !aHasDiacritics) return cleanB;

  const aIsSlug = isRawSlugDisplayText(cleanA);
  const bIsSlug = isRawSlugDisplayText(cleanB);
  if (!aIsSlug && bIsSlug) return cleanA;
  if (!bIsSlug && aIsSlug) return cleanB;

  return cleanA;
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
  if (!titleA || !titleB) return false;

  const exactTitleMatch = titleA === titleB;
  const dStrippedTitleMatch =
    !exactTitleMatch &&
    titleA.length >= 6 &&
    titleB.length >= 6 &&
    titleA.replace(/\bd/g, '').replace(/\s+/g, ' ').trim() ===
      titleB.replace(/\bd/g, '').replace(/\s+/g, ' ').trim();

  if (!exactTitleMatch && !dStrippedTitleMatch) {
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
  const healedPrimary = healTrackVietnameseDisplay(primary);
  const healedSecondary = healTrackVietnameseDisplay(secondary);

  const primaryOnR2 = isR2AudioUrl(healedPrimary.audioUrl);
  const secondaryOnR2 = isR2AudioUrl(healedSecondary.audioUrl);

  const bestAudioTrack =
    primaryOnR2 || !secondaryOnR2 ? healedPrimary : healedSecondary;
  const otherTrack = bestAudioTrack === healedPrimary ? healedSecondary : healedPrimary;

  const hasBetterLyrics = (t: Track) =>
    Boolean(t.syncedLyrics?.trim()) ||
    Boolean(t.plainLyrics?.trim()) ||
    (Array.isArray(t.lyrics) &&
      t.lyrics.length > 2 &&
      !t.lyrics.every(l => l.text.startsWith('Đang phát bản nhạc') || l.text.startsWith('Đang phát:')));

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

  const bestTitle = pickBetterDisplayString(bestAudioTrack.title, otherTrack.title);
  const bestArtist = pickBetterDisplayString(bestAudioTrack.artist, otherTrack.artist);
  const bestAlbum =
    bestAudioTrack.album && bestAudioTrack.album !== 'Kho nhạc Cloudflare R2'
      ? bestAudioTrack.album
      : otherTrack.album || bestAudioTrack.album;
  const bestDuration =
    bestAudioTrack.duration && bestAudioTrack.duration !== 210
      ? bestAudioTrack.duration
      : otherTrack.duration && otherTrack.duration !== 210
        ? otherTrack.duration
        : bestAudioTrack.duration || otherTrack.duration || 210;
  const bestGenre =
    bestAudioTrack.genre && bestAudioTrack.genre !== 'Pop'
      ? bestAudioTrack.genre
      : otherTrack.genre || bestAudioTrack.genre || 'Pop';

  return {
    ...otherTrack,
    ...bestAudioTrack,
    id: bestAudioTrack.id || otherTrack.id,
    title: bestTitle || bestAudioTrack.title || otherTrack.title,
    artist: bestArtist || bestAudioTrack.artist || otherTrack.artist,
    album: bestAlbum,
    genre: bestGenre,
    duration: bestDuration,
    audioUrl: bestAudioTrack.audioUrl || otherTrack.audioUrl,
    coverUrl: bestCover,
    plays: Math.max(Number(healedPrimary.plays) || 0, Number(healedSecondary.plays) || 0),
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

  for (const rawTrack of tracks) {
    if (!rawTrack || !rawTrack.id) continue;
    const track = healTrackVietnameseDisplay(rawTrack);
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
