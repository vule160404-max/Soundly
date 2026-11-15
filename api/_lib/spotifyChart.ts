import { fetchSpotifyCollectionMetadata } from './spotifyAlbum.js';

export type TrendingChartRegion = 'vn' | 'global';

export interface TrendingChartEntry {
  trackId: string;
  spotifyRank: number;
  previousRank?: number | null;
  rankDelta: number;
  isNew?: boolean;
  peakRank?: number | null;
  spotifyTrackId?: string;
  spotifyTitle?: string;
  spotifyArtist?: string;
}

export interface TrendingChartMissingEntry {
  spotifyRank: number;
  title: string;
  artist: string;
  spotifyTrackId?: string;
  spotifyUrl?: string;
  rankDelta?: number;
  isNew?: boolean;
}

export interface TrendingChartSnapshot {
  id: string;
  region: TrendingChartRegion;
  title: string;
  sourceLabel: string;
  sourceUrl: string;
  customSpotifyUrl?: string;
  updatedAt: string;
  nextAutoSyncAt: string;
  totalSpotifyEntries: number;
  matchedCount: number;
  entries: TrendingChartEntry[];
  missingEntries: TrendingChartMissingEntry[];
}

export interface MatchableCatalogTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl?: string;
  spotifyTrackId?: string;
  r2AudioKey?: string;
}

interface RawSpotifyChartRow {
  spotifyRank: number;
  previousRank?: number | null;
  rankDelta: number;
  isNew: boolean;
  peakRank?: number | null;
  spotifyTrackId: string;
  spotifyUrl: string;
  title: string;
  artist: string;
}

const CHART_META: Record<
  TrendingChartRegion,
  {
    id: string;
    title: string;
    kworbUrl: string;
    spotifyPlaylistUrl: string;
    defaultSourceLabel: string;
  }
> = {
  vn: {
    id: 'spotify-vn',
    title: 'Bảng Xếp Hạng Thịnh Hành Việt Nam',
    kworbUrl: 'https://kworb.net/spotify/country/vn_daily.html',
    spotifyPlaylistUrl: 'https://open.spotify.com/playlist/37i9dQZEVXbLdGSmz6xilI',
    defaultSourceLabel: 'Spotify Top 50 - Vietnam',
  },
  global: {
    id: 'spotify-global',
    title: 'Bảng Xếp Hạng Thịnh Hành Toàn Cầu',
    kworbUrl: 'https://kworb.net/spotify/country/global_daily.html',
    spotifyPlaylistUrl: 'https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF',
    defaultSourceLabel: 'Spotify Top 50 - Global',
  },
};

export const AUTO_SYNC_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function stripHtmlTags(raw: string): string {
  return decodeHtmlEntities(raw.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTextForMatch(raw?: string | null): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitleForChartMatch(rawTitle?: string | null): string {
  const withoutParens = (rawTitle || '')
    .replace(
      /(?:\(|\[)\s*(?:feat\.?|ft\.?|featuring|with|prod\.?|official\s+(?:music\s+)?(?:video|audio|mv)|lyric\s*video|acoustic|remix|live|radio\s+edit|remastered|explicit(?:\s+ver\.?|\s+version)?|clean(?:\s+ver\.?|\s+version)?|single\s+ver\.?(?:sion)?|album\s+ver\.?(?:sion)?|deluxe(?:\s+edition)?|bonus\s+track|from\s+["']?[^)\]]+)[^)\]]*(?:\)|\])/gi,
      ' '
    )
    .replace(
      /\s+-\s+(?:remix|acoustic|live|radio\s+edit|single\s+version|explicit(?:\s+ver\.?|\s+version)?|clean(?:\s+ver\.?|\s+version)?|from\s+.*|ost.*)$/i,
      ' '
    )
    .replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.*$/i, ' ')
    .replace(/\.(mp3|wav|flac|m4a|ogg|aac|opus)$/i, ' ');
  return normalizeTextForMatch(withoutParens) || normalizeTextForMatch(rawTitle);
}

const PLACEHOLDER_ARTIST_TOKENS = new Set([
  'nghe si chua ro',
  'nghe si spotflow',
  'cho ai nhan dien',
  'unknown artist',
  'various artists',
]);

function extractArtistTokens(rawArtist?: string | null, rawTitle?: string | null): string[] {
  const featMatches: string[] = [];
  const featRegex = /(?:\(|\[)?\b(?:feat\.?|ft\.?|featuring|with|w\/)\s+([^)\]]+)(?:\)|\])?/gi;
  let m: RegExpExecArray | null;
  while ((m = featRegex.exec(rawTitle || '')) !== null) {
    if (m[1]) featMatches.push(m[1]);
  }
  const combined = [rawArtist || '', ...featMatches].join(', ');
  return Array.from(
    new Set(
      combined
        .split(/(?:,|&|;|\/|\bx\b|\bvs\.?\b|\bfeat\.?\b|\bft\.?\b|\bwith\b|\bw\/\b|\band\b)/i)
        .map(s => normalizeTextForMatch(s))
        .filter(s => s.length > 0 && !PLACEHOLDER_ARTIST_TOKENS.has(s))
    )
  );
}

function areArtistTokensMatch(tokensA: string[], tokensB: string[]): boolean {
  if (tokensA.length === 0 || tokensB.length === 0) return false;
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

function isPlayableAudioUrl(url?: string | null): boolean {
  const trimmed = (url || '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('blob:')) return false;
  if (trimmed.includes('/api/download/file/')) return false;
  if (trimmed.includes('onrender.com')) return false;
  return true;
}

async function fetchKworbTop50(region: TrendingChartRegion): Promise<RawSpotifyChartRow[]> {
  const url = CHART_META[region].kworbUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) {
      throw new Error(`Kworb HTTP ${res.status}`);
    }
    const html = await res.text();
    const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) {
      throw new Error('Could not find chart table body');
    }

    const trList = tbodyMatch[1].match(/<tr[\s\S]*?<\/tr>/gi) || [];
    const rows: RawSpotifyChartRow[] = [];

    for (const tr of trList) {
      if (rows.length >= 50) break;
      const tds = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      if (tds.length < 3) continue;

      const rank = parseInt(stripHtmlTags(tds[0] || ''), 10);
      if (!Number.isFinite(rank) || rank <= 0 || rank > 50) continue;

      const movementRaw = stripHtmlTags(tds[1] || '').toUpperCase();
      let rankDelta = 0;
      let isNew = false;
      if (movementRaw === 'NEW' || movementRaw === 'RE') {
        isNew = true;
      } else if (/^[+-]?\d+$/.test(movementRaw)) {
        rankDelta = parseInt(movementRaw, 10) || 0;
      }

      const cellHtml = tds[2] || '';
      const trackMatch = cellHtml.match(
        /<a[^>]*href=["'][^"']*\/track\/([a-zA-Z0-9]+)\.html["'][^>]*>([\s\S]*?)<\/a>/i
      );
      const spotifyTrackId = trackMatch ? trackMatch[1].trim() : '';
      const rawTitle = trackMatch ? stripHtmlTags(trackMatch[2]) : '';

      const artistMatches = Array.from(
        cellHtml.matchAll(
          /<a[^>]*href=["'][^"']*\/artist\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi
        )
      )
        .map(m => stripHtmlTags(m[1]))
        .filter(Boolean);

      let title = rawTitle;
      let artist = artistMatches.join(', ');

      if (!title) {
        const plain = stripHtmlTags(cellHtml);
        const dashIdx = plain.indexOf(' - ');
        if (dashIdx !== -1) {
          artist = artist || plain.slice(0, dashIdx).trim();
          title = plain.slice(dashIdx + 3).trim();
        } else {
          title = plain;
        }
      }

      if (!title) continue;

      const peakRaw = tds[4] ? parseInt(stripHtmlTags(tds[4]), 10) : NaN;
      const peakRank = Number.isFinite(peakRaw) && peakRaw > 0 ? peakRaw : null;
      const previousRank =
        !isNew && rankDelta !== 0
          ? rank + rankDelta
          : !isNew && movementRaw === '='
            ? rank
            : null;

      rows.push({
        spotifyRank: rank,
        previousRank,
        rankDelta,
        isNew,
        peakRank,
        spotifyTrackId,
        spotifyUrl: spotifyTrackId
          ? `https://open.spotify.com/track/${spotifyTrackId}`
          : '',
        title,
        artist: artist || 'Nghệ sĩ Spotify',
      });
    }

    if (rows.length === 0) {
      throw new Error('Parsed 0 rows from Spotify chart table');
    }
    return rows;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromSpotifyPlaylist(
  playlistUrl: string,
  previousSnapshot?: TrendingChartSnapshot | null
): Promise<{
  rows: RawSpotifyChartRow[];
  playlistTitle?: string;
  canonicalUrl: string;
}> {
  const collection = await fetchSpotifyCollectionMetadata(playlistUrl);
  const prevBySpotifyId = new Map<string, number>();
  const prevByKey = new Map<string, number>();

  if (previousSnapshot) {
    for (const entry of previousSnapshot.entries) {
      if (entry.spotifyTrackId) {
        prevBySpotifyId.set(entry.spotifyTrackId, entry.spotifyRank);
      }
      if (entry.spotifyTitle) {
        const k = `${normalizeTitleForChartMatch(entry.spotifyTitle)}|${extractArtistTokens(entry.spotifyArtist).join(',')}`;
        prevByKey.set(k, entry.spotifyRank);
      }
    }
    for (const m of previousSnapshot.missingEntries || []) {
      if (m.spotifyTrackId) {
        prevBySpotifyId.set(m.spotifyTrackId, m.spotifyRank);
      }
      const k = `${normalizeTitleForChartMatch(m.title)}|${extractArtistTokens(m.artist).join(',')}`;
      prevByKey.set(k, m.spotifyRank);
    }
  }

  const hasHistory = prevBySpotifyId.size > 0 || prevByKey.size > 0;
  const rows: RawSpotifyChartRow[] = collection.tracks.slice(0, 50).map((t, i) => {
    const rank = i + 1;
    const key = `${normalizeTitleForChartMatch(t.title)}|${extractArtistTokens(t.artist, t.title).join(',')}`;
    const prevRank =
      (t.spotifyTrackId ? prevBySpotifyId.get(t.spotifyTrackId) : undefined) ??
      prevByKey.get(key) ??
      null;

    const isNew = hasHistory && prevRank === null;
    const rankDelta = prevRank !== null ? prevRank - rank : 0;

    return {
      spotifyRank: rank,
      previousRank: prevRank,
      rankDelta,
      isNew,
      peakRank: null,
      spotifyTrackId: t.spotifyTrackId,
      spotifyUrl: t.spotifyUrl,
      title: t.title,
      artist: t.artist,
    };
  });

  return {
    rows,
    playlistTitle: collection.title,
    canonicalUrl: collection.spotifyUrl,
  };
}

function buildIndexedCatalog(catalogTracks: MatchableCatalogTrack[]) {
  const playable = catalogTracks.filter(t => isPlayableAudioUrl(t.audioUrl));
  // Prefer tracks hosted on R2 + tracks with non-placeholder titles/artists
  const sorted = [...playable].sort((a, b) => {
    const aR2 = a.r2AudioKey || (a.audioUrl || '').includes('/api/r2/stream') ? 1 : 0;
    const bR2 = b.r2AudioKey || (b.audioUrl || '').includes('/api/r2/stream') ? 1 : 0;
    if (aR2 !== bR2) return bR2 - aR2;
    const aSpotify = a.spotifyTrackId ? 1 : 0;
    const bSpotify = b.spotifyTrackId ? 1 : 0;
    return bSpotify - aSpotify;
  });

  return sorted.map(track => ({
    track,
    normTitle: normalizeTitleForChartMatch(track.title),
    rawNormTitle: normalizeTextForMatch(track.title),
    artistTokens: extractArtistTokens(track.artist, track.title),
    normArtistRaw: normalizeTextForMatch(track.artist),
  }));
}

export async function syncSpotifyTrendingChart(params: {
  region: TrendingChartRegion;
  catalogTracks: MatchableCatalogTrack[];
  previousSnapshot?: TrendingChartSnapshot | null;
  customSpotifyUrl?: string;
}): Promise<TrendingChartSnapshot> {
  const { region, catalogTracks, previousSnapshot, customSpotifyUrl } = params;
  const meta = CHART_META[region];
  const trimmedCustom = (customSpotifyUrl || '').trim();

  let rows: RawSpotifyChartRow[] = [];
  let sourceLabel = meta.defaultSourceLabel;
  let sourceUrl = meta.spotifyPlaylistUrl;

  if (trimmedCustom) {
    const fromCustom = await fetchFromSpotifyPlaylist(trimmedCustom, previousSnapshot);
    rows = fromCustom.rows;
    sourceLabel = fromCustom.playlistTitle
      ? `Spotify · ${fromCustom.playlistTitle}`
      : meta.defaultSourceLabel;
    sourceUrl = fromCustom.canonicalUrl;
  } else {
    try {
      rows = await fetchKworbTop50(region);
      sourceLabel = meta.defaultSourceLabel;
      sourceUrl = meta.spotifyPlaylistUrl;
    } catch (kworbErr) {
      console.warn(
        `[SpotifyChart] Kworb chart fetch failed for ${region}, falling back to Spotify playlist embed:`,
        kworbErr
      );
      const fromEmbed = await fetchFromSpotifyPlaylist(
        meta.spotifyPlaylistUrl,
        previousSnapshot
      );
      rows = fromEmbed.rows;
      sourceLabel = fromEmbed.playlistTitle
        ? `Spotify · ${fromEmbed.playlistTitle}`
        : meta.defaultSourceLabel;
      sourceUrl = fromEmbed.canonicalUrl;
    }
  }

  const indexed = buildIndexedCatalog(catalogTracks);
  const usedTrackIds = new Set<string>();
  const entries: TrendingChartEntry[] = [];
  const missingEntries: TrendingChartMissingEntry[] = [];

  for (const row of rows) {
    const rowTitleNorm = normalizeTitleForChartMatch(row.title);
    const rowTitleRawNorm = normalizeTextForMatch(row.title);
    const rowArtists = extractArtistTokens(row.artist, row.title);

    let matched: (typeof indexed)[number] | undefined;

    // Tier 1: Exact spotifyTrackId
    if (row.spotifyTrackId) {
      matched = indexed.find(
        c =>
          !usedTrackIds.has(c.track.id) &&
          c.track.spotifyTrackId === row.spotifyTrackId
      );
    }

    // Tier 2: Normalized title match + artist token overlap
    if (!matched && rowTitleNorm) {
      matched = indexed.find(
        c =>
          !usedTrackIds.has(c.track.id) &&
          (c.normTitle === rowTitleNorm || c.rawNormTitle === rowTitleRawNorm) &&
          areArtistTokensMatch(c.artistTokens, rowArtists)
      );
    }

    // Tier 2b: Exact multi-char title match when catalog artist is a placeholder
    if (!matched && rowTitleNorm.length >= 6) {
      matched = indexed.find(
        c =>
          !usedTrackIds.has(c.track.id) &&
          c.normTitle === rowTitleNorm &&
          c.artistTokens.length === 0
      );
    }

    // Tier 3: Fuzzy containment for remix/edition variations when artist overlaps strongly
    if (!matched && rowTitleNorm.length >= 6 && rowArtists.length > 0) {
      matched = indexed.find(
        c =>
          !usedTrackIds.has(c.track.id) &&
          c.normTitle.length >= 6 &&
          (c.normTitle.includes(rowTitleNorm) || rowTitleNorm.includes(c.normTitle)) &&
          areArtistTokensMatch(c.artistTokens, rowArtists)
      );
    }

    if (matched) {
      usedTrackIds.add(matched.track.id);
      entries.push({
        trackId: matched.track.id,
        spotifyRank: row.spotifyRank,
        previousRank: row.previousRank ?? null,
        rankDelta: row.rankDelta,
        isNew: Boolean(row.isNew),
        peakRank: row.peakRank ?? null,
        spotifyTrackId: row.spotifyTrackId || undefined,
        spotifyTitle: row.title,
        spotifyArtist: row.artist,
      });
    } else {
      missingEntries.push({
        spotifyRank: row.spotifyRank,
        title: row.title,
        artist: row.artist,
        spotifyTrackId: row.spotifyTrackId || undefined,
        spotifyUrl: row.spotifyUrl || undefined,
        rankDelta: row.rankDelta,
        isNew: Boolean(row.isNew),
      });
    }
  }

  const now = new Date();
  const nextAuto = new Date(now.getTime() + AUTO_SYNC_TTL_MS);

  return {
    id: meta.id,
    region,
    title: meta.title,
    sourceLabel,
    sourceUrl,
    ...(trimmedCustom ? { customSpotifyUrl: trimmedCustom } : {}),
    updatedAt: now.toISOString(),
    nextAutoSyncAt: nextAuto.toISOString(),
    totalSpotifyEntries: rows.length,
    matchedCount: entries.length,
    entries,
    missingEntries: missingEntries.slice(0, 50),
  };
}
