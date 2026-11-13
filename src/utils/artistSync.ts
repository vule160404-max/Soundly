import { ArtistProfile, Track } from '../types/music';
import { SPOTIFY_GENRE_NAMES } from '../data/mockTracks';

const DEFAULT_COVER_FRAGMENT = 'photo-1511671782779-c97d3d27a1d4';

const ARTIST_ACCENT_GRADIENTS = [
  'from-[#243b8a] via-[#131d47] to-[#0d142c]',
  'from-[#7c2d3b] via-[#2c1532] to-[#0d142c]',
  'from-[#1c4b6e] via-[#122645] to-[#0d142c]',
  'from-[#482b78] via-[#1d1847] to-[#0d142c]',
  'from-[#8f3f2c] via-[#311b2a] to-[#0d142c]',
  'from-[#274d5a] via-[#13253a] to-[#0d142c]',
];

export function normalizeSearchText(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeArtistKey(name: string): string {
  return (name || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlaceholderArtist(name: string): boolean {
  const lower = normalizeSearchText(name);
  return (
    !lower ||
    lower === 'cho ai nhan dien...' ||
    lower === 'nghe si chua ro' ||
    lower === 'unknown artist' ||
    lower === 'unknown' ||
    lower === 'various artists'
  );
}

function slugifyArtist(name: string): string {
  const base = normalizeSearchText(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'nghe-si';
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Splits a compound artist string (e.g. "Casper, Bon Nghiêm, buitruonglinh",
 * "Đen ft. JustaTee", "tlinh x Low G") and optional featured tags in title
 * so every collaborator is synced with the track.
 */
export function splitArtistNames(artistField?: string, titleField?: string): string[] {
  const rawList: string[] = [];

  if (artistField && artistField.trim()) {
    const tokens = artistField
      .split(/\s*(?:,|;|、)\s*|\s+(?:ft\.?|feat\.?|featuring|with|prod\.?|và)\s+|\s+[x×&]\s+/i)
      .map(s => s.trim().replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
    rawList.push(...tokens);
  }

  // Also check explicit "(ft. X)" or "(feat. X)" inside track title
  if (titleField) {
    const featMatches = titleField.matchAll(/[[(]\s*(?:ft\.?|feat\.?|featuring)\s+([^\]\)]+)[\])]/gi);
    for (const match of featMatches) {
      if (match[1]) {
        const subTokens = match[1]
          .split(/\s*(?:,|;|、)\s*|\s+[x×&]\s+/i)
          .map(s => s.trim())
          .filter(Boolean);
        rawList.push(...subTokens);
      }
    }
  }

  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const item of rawList) {
    if (isPlaceholderArtist(item)) continue;
    const key = normalizeArtistKey(item);
    if (!seen.has(key)) {
      seen.add(key);
      cleaned.push(item);
    }
  }

  if (cleaned.length === 0) {
    return ['Nghệ sĩ chưa rõ'];
  }

  return cleaned;
}

function pickCanonicalName(variants: Map<string, number>): string {
  let bestName = '';
  let bestScore = -1;

  for (const [name, count] of variants.entries()) {
    const hasUpper = /[A-ZÀ-Ỹ]/.test(name) ? 1 : 0;
    const score = count * 10 + hasUpper;
    if (score > bestScore) {
      bestScore = score;
      bestName = name;
    }
  }

  return bestName || 'Nghệ sĩ chưa rõ';
}

function isCustomCover(url?: string): boolean {
  return Boolean(url && !url.includes(DEFAULT_COVER_FRAGMENT));
}

export function buildArtistDirectory(tracks: Track[]): ArtistProfile[] {
  interface Bucket {
    variants: Map<string, number>;
    tracksMap: Map<string, Track>;
    soloCustomCovers: string[];
    anyCustomCovers: string[];
    fallbackCovers: string[];
    collaborators: Set<string>;
    genres: Set<string>;
    albums: Set<string>;
    totalPlays: number;
    totalDuration: number;
  }

  const buckets = new Map<string, Bucket>();

  for (const track of tracks) {
    const artistNames = splitArtistNames(track.artist, track.title);
    const isSolo = artistNames.length === 1;

    for (const artistName of artistNames) {
      const key = normalizeArtistKey(artistName);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          variants: new Map(),
          tracksMap: new Map(),
          soloCustomCovers: [],
          anyCustomCovers: [],
          fallbackCovers: [],
          collaborators: new Set(),
          genres: new Set(),
          albums: new Set(),
          totalPlays: 0,
          totalDuration: 0,
        };
        buckets.set(key, bucket);
      }

      bucket.variants.set(artistName, (bucket.variants.get(artistName) || 0) + 1);

      if (!bucket.tracksMap.has(track.id)) {
        bucket.tracksMap.set(track.id, track);
        bucket.totalPlays += track.plays || 0;
        bucket.totalDuration += track.duration || 0;

        if (track.genre) bucket.genres.add(track.genre);
        if (track.album) bucket.albums.add(track.album);

        if (track.coverUrl) {
          if (isCustomCover(track.coverUrl)) {
            if (isSolo) bucket.soloCustomCovers.push(track.coverUrl);
            bucket.anyCustomCovers.push(track.coverUrl);
          } else {
            bucket.fallbackCovers.push(track.coverUrl);
          }
        }
      }

      for (const other of artistNames) {
        if (normalizeArtistKey(other) !== key && !isPlaceholderArtist(other)) {
          bucket.collaborators.add(other);
        }
      }
    }
  }

  const artists: ArtistProfile[] = [];
  const usedIds = new Set<string>();

  for (const [normalizedKey, bucket] of buckets.entries()) {
    const canonicalName = pickCanonicalName(bucket.variants);
    let id = `artist-${slugifyArtist(canonicalName)}`;
    if (usedIds.has(id)) {
      id = `${id}-${hashString(normalizedKey).toString(36).slice(0, 4)}`;
    }
    usedIds.add(id);

    const avatarUrl =
      bucket.soloCustomCovers[0] ||
      bucket.anyCustomCovers[0] ||
      bucket.fallbackCovers[0] ||
      '';
    const isDefaultAvatar =
      !avatarUrl || avatarUrl.includes(DEFAULT_COVER_FRAGMENT);

    const sortedTracks = Array.from(bucket.tracksMap.values()).sort(
      (a, b) => (b.plays || 0) - (a.plays || 0)
    );

    const gradientIdx = hashString(normalizedKey) % ARTIST_ACCENT_GRADIENTS.length;

    artists.push({
      id,
      name: canonicalName,
      normalizedKey,
      avatarUrl,
      isDefaultAvatar,
      tracks: sortedTracks,
      trackCount: sortedTracks.length,
      totalPlays: bucket.totalPlays,
      totalDuration: bucket.totalDuration,
      genres: Array.from(bucket.genres),
      albums: Array.from(bucket.albums),
      collaborators: Array.from(bucket.collaborators),
      accentGradient: ARTIST_ACCENT_GRADIENTS[gradientIdx],
    });
  }

  return artists.sort((a, b) => {
    const aUnknown = isPlaceholderArtist(a.name) ? 1 : 0;
    const bUnknown = isPlaceholderArtist(b.name) ? 1 : 0;
    if (aUnknown !== bUnknown) return aUnknown - bUnknown;
    if (b.trackCount !== a.trackCount) return b.trackCount - a.trackCount;
    if (b.totalPlays !== a.totalPlays) return b.totalPlays - a.totalPlays;
    return a.name.localeCompare(b.name, 'vi');
  });
}

export function findArtistByNameOrId(
  artists: ArtistProfile[],
  nameOrId: string
): ArtistProfile | null {
  if (!nameOrId) return null;

  const byId = artists.find(a => a.id === nameOrId);
  if (byId) return byId;

  const targetKey = normalizeArtistKey(nameOrId);
  const byExactKey = artists.find(a => a.normalizedKey === targetKey);
  if (byExactKey) return byExactKey;

  const accentNormalized = normalizeSearchText(nameOrId);
  const byAccent = artists.find(
    a => normalizeSearchText(a.name) === accentNormalized
  );
  if (byAccent) return byAccent;

  // If a compound artist string was passed, try the first parsed artist
  const split = splitArtistNames(nameOrId);
  if (split.length > 0 && split[0] !== nameOrId) {
    const firstKey = normalizeArtistKey(split[0]);
    return artists.find(a => a.normalizedKey === firstKey) || null;
  }

  return null;
}

export function matchesTrackSearch(track: Track, rawQuery: string): boolean {
  const q = normalizeSearchText(rawQuery);
  if (!q) return true;

  const haystacks = [
    track.title,
    track.artist,
    track.album,
    track.genre,
    ...splitArtistNames(track.artist, track.title),
  ];

  return haystacks.some(h => normalizeSearchText(h).includes(q));
}

export interface SearchSuggestionsResult {
  artists: ArtistProfile[];
  tracks: Track[];
  genres: string[];
}

export function getSearchSuggestions(
  rawQuery: string,
  allTracks: Track[],
  artists: ArtistProfile[]
): SearchSuggestionsResult {
  const q = normalizeSearchText(rawQuery);
  if (!q) {
    return {
      artists: artists.slice(0, 4),
      tracks: allTracks.slice(0, 5),
      genres: [],
    };
  }

  const scoredArtists = artists
    .map(artist => {
      const normName = normalizeSearchText(artist.name);
      if (!normName.includes(q)) return null;
      let score = 10;
      if (normName === q) score += 100;
      else if (normName.startsWith(q)) score += 50;
      else if (normName.includes(` ${q}`)) score += 30;
      score += Math.min(artist.trackCount, 20);
      return { artist, score };
    })
    .filter((item): item is { artist: ArtistProfile; score: number } => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(item => item.artist);

  const scoredTracks = allTracks
    .map(track => {
      const normTitle = normalizeSearchText(track.title);
      const normArtist = normalizeSearchText(track.artist);
      const normAlbum = normalizeSearchText(track.album || '');

      const titleMatch = normTitle.includes(q);
      const artistMatch = normArtist.includes(q);
      const albumMatch = normAlbum.includes(q);

      if (!titleMatch && !artistMatch && !albumMatch) return null;

      let score = 0;
      if (normTitle === q) score += 120;
      else if (normTitle.startsWith(q)) score += 70;
      else if (titleMatch) score += 45;

      if (normArtist.startsWith(q)) score += 35;
      else if (artistMatch) score += 25;

      if (albumMatch) score += 10;

      return { track, score };
    })
    .filter((item): item is { track: Track; score: number } => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(item => item.track);

  const matchedGenres = SPOTIFY_GENRE_NAMES.filter(g =>
    normalizeSearchText(g).includes(q)
  ).slice(0, 2);

  return {
    artists: scoredArtists,
    tracks: scoredTracks,
    genres: matchedGenres,
  };
}
