import { ArtistProfile, Playlist, Track } from '../types/music';
import { SPOTIFY_GENRE_NAMES } from '../data/mockTracks';

const DEFAULT_COVER_FRAGMENTS = [
  'photo-1511671782779-c97d3d27a1d4',
  'soundly-default-cover.svg',
];

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

/**
 * Unifies Vietnamese old-style vs new-style tone placement on diphthongs
 * (e.g., "Hoà" <-> "Hòa", "Thuỳ" <-> "Thùy", "Thuý" <-> "Thúy", "Khoẻ" <-> "Khỏe")
 * so artist variants always map to the same key.
 */
function normalizeVietnameseTonePlacement(lowerNfc: string): string {
  return lowerNfc
    .replace(/oà/g, 'òa')
    .replace(/oá/g, 'óa')
    .replace(/oả/g, 'ỏa')
    .replace(/oã/g, 'õa')
    .replace(/oạ/g, 'ọa')
    .replace(/oè/g, 'òe')
    .replace(/oé/g, 'óe')
    .replace(/oẻ/g, 'ỏe')
    .replace(/oẽ/g, 'õe')
    .replace(/oẹ/g, 'ọe')
    .replace(/qùy/g, 'quỳ')
    .replace(/qúy/g, 'quý')
    .replace(/qủy/g, 'quỷ')
    .replace(/qũy/g, 'quỹ')
    .replace(/qụy/g, 'quỵ')
    .replace(/(^|[^q])uỳ/g, '$1ùy')
    .replace(/(^|[^q])uý/g, '$1úy')
    .replace(/(^|[^q])uỷ/g, '$1ủy')
    .replace(/(^|[^q])uỹ/g, '$1ũy')
    .replace(/(^|[^q])uỵ/g, '$1ụy');
}

export function normalizeArtistKey(name: string): string {
  const cleaned = (name || '')
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    .replace(/[\u00A0\s]+/g, ' ')
    .replace(/[’‘`]/g, "'")
    .replace(/[–—]/g, '-')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalizeVietnameseTonePlacement(cleaned);
}

function getPunctuationKeys(name: string): [string, string] {
  const base = normalizeArtistKey(name);
  const removed = base
    .replace(/[-_'"()]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const spaced = base
    .replace(/[-_'"()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [removed, spaced];
}

function hasVietnameseDiacritics(name: string): boolean {
  return /[^\u0000-\u007f]/.test(name || '');
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
    const trimmed = name.normalize('NFC').trim();
    const hasDiacritics = hasVietnameseDiacritics(trimmed) ? 1 : 0;
    const hasUpper = /[A-ZÀ-Ỹ]/.test(trimmed) ? 1 : 0;
    const usesModernTone =
      /(?:òa|óa|ỏa|õa|ọa|òe|óe|ỏe|õe|ọe|ùy|úy|ủy|ũy|ụy)/i.test(trimmed)
        ? 1
        : 0;
    const score =
      hasDiacritics * 500 +
      hasUpper * 50 +
      count * 10 +
      usesModernTone;
    if (score > bestScore) {
      bestScore = score;
      bestName = trimmed;
    }
  }

  return bestName || 'Nghệ sĩ chưa rõ';
}

function isDefaultCoverUrl(url?: string): boolean {
  if (!url) return true;
  return DEFAULT_COVER_FRAGMENTS.some(fragment => url.includes(fragment));
}

function isCustomCover(url?: string): boolean {
  return Boolean(url && !isDefaultCoverUrl(url));
}

export function buildArtistDirectory(tracks: Track[]): ArtistProfile[] {
  interface Bucket {
    variants: Map<string, number>;
    tracksMap: Map<string, Track>;
    soloCustomCovers: string[];
    anyCustomCovers: string[];
    fallbackCovers: string[];
    collaborators: Map<string, string>;
    genres: Set<string>;
    albums: Set<string>;
    totalPlays: number;
    totalDuration: number;
  }

  const mergeBuckets = (target: Bucket, source: Bucket) => {
    for (const [variant, count] of source.variants.entries()) {
      target.variants.set(variant, (target.variants.get(variant) || 0) + count);
    }
    for (const [trackId, track] of source.tracksMap.entries()) {
      if (!target.tracksMap.has(trackId)) {
        target.tracksMap.set(trackId, track);
        target.totalPlays += track.plays || 0;
        target.totalDuration += track.duration || 0;
      }
    }
    for (const url of source.soloCustomCovers) {
      if (!target.soloCustomCovers.includes(url)) target.soloCustomCovers.push(url);
    }
    for (const url of source.anyCustomCovers) {
      if (!target.anyCustomCovers.includes(url)) target.anyCustomCovers.push(url);
    }
    for (const url of source.fallbackCovers) {
      if (!target.fallbackCovers.includes(url)) target.fallbackCovers.push(url);
    }
    for (const [collabKey, collabName] of source.collaborators.entries()) {
      if (!target.collaborators.has(collabKey)) {
        target.collaborators.set(collabKey, collabName);
      }
    }
    for (const g of source.genres) target.genres.add(g);
    for (const a of source.albums) target.albums.add(a);
  };

  const rawBuckets = new Map<string, Bucket>();

  for (const track of tracks) {
    const artistNames = splitArtistNames(track.artist, track.title);
    const isSolo = artistNames.length === 1;

    for (const artistName of artistNames) {
      const key = normalizeArtistKey(artistName);
      let bucket = rawBuckets.get(key);
      if (!bucket) {
        bucket = {
          variants: new Map(),
          tracksMap: new Map(),
          soloCustomCovers: [],
          anyCustomCovers: [],
          fallbackCovers: [],
          collaborators: new Map(),
          genres: new Set(),
          albums: new Set(),
          totalPlays: 0,
          totalDuration: 0,
        };
        rawBuckets.set(key, bucket);
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
            if (isSolo && !bucket.soloCustomCovers.includes(track.coverUrl)) {
              bucket.soloCustomCovers.push(track.coverUrl);
            }
            if (!bucket.anyCustomCovers.includes(track.coverUrl)) {
              bucket.anyCustomCovers.push(track.coverUrl);
            }
          } else if (!bucket.fallbackCovers.includes(track.coverUrl)) {
            bucket.fallbackCovers.push(track.coverUrl);
          }
        }
      }

      for (const other of artistNames) {
        const otherKey = normalizeArtistKey(other);
        if (otherKey !== key && !isPlaceholderArtist(other)) {
          if (!bucket.collaborators.has(otherKey)) {
            bucket.collaborators.set(otherKey, other);
          }
        }
      }
    }
  }

  // Pass 2: Merge punctuation/hyphen variants that keep identical accented letters
  // (e.g. "Sơn Tùng M-TP" + "Sơn Tùng MTP", "B-Ray" + "B Ray")
  const punctMergedBuckets = new Map<string, Bucket>();
  const punctLookup = new Map<string, string>();

  for (const [key, bucket] of rawBuckets.entries()) {
    const sampleName = pickCanonicalName(bucket.variants);
    const [removedKey, spacedKey] = getPunctuationKeys(sampleName);
    const existingTargetKey =
      punctLookup.get(removedKey) || punctLookup.get(spacedKey);
    if (existingTargetKey && punctMergedBuckets.has(existingTargetKey)) {
      mergeBuckets(punctMergedBuckets.get(existingTargetKey)!, bucket);
      punctLookup.set(removedKey, existingTargetKey);
      punctLookup.set(spacedKey, existingTargetKey);
    } else {
      punctLookup.set(removedKey, key);
      punctLookup.set(spacedKey, key);
      punctMergedBuckets.set(key, bucket);
    }
  }

  // Pass 3: Merge unambiguous unaccented ASCII buckets (e.g. "Hoa Minzy", "Dat G", "buitruonglinh")
  // into their single matching accented Vietnamese bucket ("Hòa Minzy", "Đạt G", "Bùi Trường Linh")
  const accentedEntries: Array<{ key: string; asciiNorm: string; compactAscii: string }> = [];
  for (const [key, bucket] of punctMergedBuckets.entries()) {
    const canonical = pickCanonicalName(bucket.variants);
    if (hasVietnameseDiacritics(canonical)) {
      const asciiNorm = normalizeSearchText(canonical).replace(/[-_.'’]+/g, ' ').replace(/\s+/g, ' ').trim();
      accentedEntries.push({
        key,
        asciiNorm,
        compactAscii: asciiNorm.replace(/\s+/g, ''),
      });
    }
  }

  const buckets = new Map<string, Bucket>(punctMergedBuckets);
  for (const [key, bucket] of punctMergedBuckets.entries()) {
    const canonical = pickCanonicalName(bucket.variants);
    if (hasVietnameseDiacritics(canonical) || isPlaceholderArtist(canonical)) continue;

    const asciiNorm = normalizeSearchText(canonical).replace(/[-_.'’]+/g, ' ').replace(/\s+/g, ' ').trim();
    const compactAscii = asciiNorm.replace(/\s+/g, '');

    let matches = accentedEntries.filter(entry => entry.asciiNorm === asciiNorm);
    if (matches.length === 0 && !asciiNorm.includes(' ') && compactAscii.length >= 6) {
      matches = accentedEntries.filter(entry => entry.compactAscii === compactAscii);
    }

    if (matches.length === 1) {
      const targetBucket = buckets.get(matches[0].key);
      if (targetBucket && targetBucket !== bucket) {
        mergeBuckets(targetBucket, bucket);
        buckets.delete(key);
      }
    }
  }

  const artists: ArtistProfile[] = [];
  const usedIds = new Set<string>();

  for (const [normalizedKey, bucket] of buckets.entries()) {
    const canonicalName = pickCanonicalName(bucket.variants);
    const selfNormKey = normalizeArtistKey(canonicalName);
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
    const isDefaultAvatar = isDefaultCoverUrl(avatarUrl);

    const sortedTracks = Array.from(bucket.tracksMap.values()).sort(
      (a, b) => (b.plays || 0) - (a.plays || 0)
    );

    const gradientIdx = hashString(normalizedKey) % ARTIST_ACCENT_GRADIENTS.length;

    const dedupedCollaborators = Array.from(bucket.collaborators.entries())
      .filter(([collabKey]) => collabKey !== normalizedKey && collabKey !== selfNormKey)
      .map(([, collabName]) => collabName);

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
      collaborators: dedupedCollaborators,
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
  const byExactKey = artists.find(
    a => a.normalizedKey === targetKey || normalizeArtistKey(a.name) === targetKey
  );
  if (byExactKey) return byExactKey;

  const [punctRemoved, punctSpaced] = getPunctuationKeys(nameOrId);
  const byPunctKey = artists.find(a => {
    const [candRemoved, candSpaced] = getPunctuationKeys(a.name);
    return (
      candRemoved === punctRemoved ||
      candSpaced === punctSpaced ||
      candRemoved === punctSpaced ||
      candSpaced === punctRemoved
    );
  });
  if (byPunctKey) return byPunctKey;

  const accentNormalized = normalizeSearchText(nameOrId);
  const byAccent = artists.find(
    a => normalizeSearchText(a.name) === accentNormalized
  );
  if (byAccent) return byAccent;

  // If a compound artist string was passed, try the first parsed artist
  const split = splitArtistNames(nameOrId);
  if (split.length > 0 && split[0] !== nameOrId) {
    const firstKey = normalizeArtistKey(split[0]);
    return (
      artists.find(
        a => a.normalizedKey === firstKey || normalizeArtistKey(a.name) === firstKey
      ) || null
    );
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
  albums: Playlist[];
  artists: ArtistProfile[];
  tracks: Track[];
  genres: string[];
}

export function getSearchSuggestions(
  rawQuery: string,
  allTracks: Track[],
  artists: ArtistProfile[],
  publicAlbums: Playlist[] = []
): SearchSuggestionsResult {
  const q = normalizeSearchText(rawQuery);
  if (!q) {
    return {
      albums: [],
      artists: artists.slice(0, 4),
      tracks: allTracks.slice(0, 5),
      genres: [],
    };
  }

  const scoredAlbums = publicAlbums
    .map(album => {
      const normTitle = normalizeSearchText(album.title || '');
      const normDesc = normalizeSearchText(album.description || '');
      const titleMatch = normTitle.includes(q);
      const descMatch = normDesc.includes(q);
      if (!titleMatch && !descMatch) return null;

      let score = 0;
      if (normTitle === q) score += 130;
      else if (normTitle.startsWith(q)) score += 80;
      else if (normTitle.includes(` ${q}`)) score += 55;
      else if (titleMatch) score += 40;
      if (descMatch) score += 15;
      score += Math.min(album.trackIds?.length || 0, 15);
      return { album, score };
    })
    .filter((item): item is { album: Playlist; score: number } => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(item => item.album);

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

  const US_UK_SEARCH_ALIASES = [
    'us uk',
    'usuk',
    'us-uk',
    'nhac nuoc ngoai',
    'nuoc ngoai',
    'nhac au my',
    'au my',
    'quoc te',
    'nhac quoc te',
    'nhac anh',
    'english',
  ];

  const matchedGenres = SPOTIFY_GENRE_NAMES.filter(g => {
    if (normalizeSearchText(g).includes(q)) return true;
    if (g === 'US-UK' && q.length >= 2) {
      return US_UK_SEARCH_ALIASES.some(alias => alias.includes(q) || q.includes(alias));
    }
    return false;
  }).slice(0, 2);

  return {
    albums: scoredAlbums,
    artists: scoredArtists,
    tracks: scoredTracks,
    genres: matchedGenres,
  };
}
