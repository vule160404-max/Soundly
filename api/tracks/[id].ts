import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getR2CatalogTracks,
  upsertR2CatalogTracks,
  updateR2CatalogTrack,
  batchUpdateR2CatalogTracks,
  incrementR2CatalogTrackPlays,
  deleteR2CatalogTrack,
  getR2PublicAlbums,
  upsertR2PublicAlbum,
  deleteR2PublicAlbum,
  getR2TrendingCharts,
  saveR2TrendingCharts,
  R2StoredTrack,
  R2StoredAlbum,
} from '../_lib/r2.js';
import { fetchSpotifyCollectionMetadata } from '../_lib/spotifyAlbum.js';
import {
  AUTO_SYNC_TTL_MS,
  MatchableCatalogTrack,
  TrendingChartRegion,
  TrendingChartSnapshot,
  syncSpotifyTrendingChart,
} from '../_lib/spotifyChart.js';
import { readJsonBody, sendJson } from '../_utils.js';

interface BatchBody {
  tracks?: Array<Partial<R2StoredTrack> & { lyricsText?: string }>;
}

interface PlayTrackBody {
  trackId?: string;
  id?: string;
}

interface SpotifyAlbumBody {
  url?: string;
  spotifyUrl?: string;
}

export default async function handler(
  req: IncomingMessage & { query?: { id?: string | string[] }; body?: unknown },
  res: ServerResponse
) {
  const rawParam = req.query?.id;
  let id = Array.isArray(rawParam) ? rawParam[0] : rawParam || '';
  if (!id && req.url) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    id = decodeURIComponent(pathname.split('/').pop() || '');
  }

  if (!id) {
    sendJson(res, 400, { error: 'Track ID is required' });
    return;
  }

  // Handle GET / POST /api/tracks/trending-chart
  if (id === 'trending-chart') {
    const isStaleChart = (snap?: TrendingChartSnapshot | null): boolean => {
      if (!snap || !snap.updatedAt) return true;
      const nextSyncMs = snap.nextAutoSyncAt ? Date.parse(snap.nextAutoSyncAt) : NaN;
      if (Number.isFinite(nextSyncMs)) return Date.now() >= nextSyncMs;
      const updatedMs = Date.parse(snap.updatedAt);
      return !Number.isFinite(updatedMs) || Date.now() - updatedMs >= AUTO_SYNC_TTL_MS;
    };

    if (req.method === 'GET') {
      try {
        const reqUrl = new URL(req.url || '/api/tracks/trending-chart', 'http://localhost');
        const allowAutoSync = reqUrl.searchParams.get('autoSync') !== '0';
        const stored = await getR2TrendingCharts();
        let vnChart = (stored.vn as TrendingChartSnapshot | null | undefined) || null;
        let globalChart = (stored.global as TrendingChartSnapshot | null | undefined) || null;
        let autoSynced = false;

        if (allowAutoSync && (isStaleChart(vnChart) || isStaleChart(globalChart))) {
          const catalog = await getR2CatalogTracks();
          if (catalog.length > 0) {
            const nextMap = { ...stored };
            if (isStaleChart(vnChart)) {
              try {
                vnChart = await syncSpotifyTrendingChart({
                  region: 'vn',
                  catalogTracks: catalog,
                  previousSnapshot: vnChart,
                  customSpotifyUrl: vnChart?.customSpotifyUrl,
                });
                nextMap.vn = vnChart as unknown as Record<string, unknown>;
                autoSynced = true;
              } catch (err) {
                console.warn('[TrendingChart] Auto-sync VN failed:', err);
              }
            }
            if (isStaleChart(globalChart)) {
              try {
                globalChart = await syncSpotifyTrendingChart({
                  region: 'global',
                  catalogTracks: catalog,
                  previousSnapshot: globalChart,
                  customSpotifyUrl: globalChart?.customSpotifyUrl,
                });
                nextMap.global = globalChart as unknown as Record<string, unknown>;
                autoSynced = true;
              } catch (err) {
                console.warn('[TrendingChart] Auto-sync Global failed:', err);
              }
            }
            if (autoSynced) {
              await saveR2TrendingCharts(nextMap);
            }
          }
        }

        sendJson(res, 200, {
          charts: {
            vn: vnChart,
            global: globalChart,
          },
          autoSynced,
        });
      } catch (err: unknown) {
        sendJson(res, 500, {
          error:
            err instanceof Error
              ? err.message
              : 'Không thể tải Bảng Xếp Hạng Thịnh Hành.',
        });
      }
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await readJsonBody<{
          region?: TrendingChartRegion | 'all';
          customSpotifyUrl?: string;
          clearCustomUrl?: boolean;
          catalogSummary?: MatchableCatalogTrack[];
        }>(req);

        const targetRegion = body.region || 'all';
        const regions: TrendingChartRegion[] =
          targetRegion === 'vn'
            ? ['vn']
            : targetRegion === 'global'
              ? ['global']
              : ['vn', 'global'];

        const stored = await getR2TrendingCharts(true);
        const r2Catalog = await getR2CatalogTracks();
        const catalogMap = new Map<string, MatchableCatalogTrack>();
        for (const t of r2Catalog) {
          catalogMap.set(t.id, t);
        }
        if (Array.isArray(body.catalogSummary)) {
          for (const t of body.catalogSummary) {
            if (t && t.id && !catalogMap.has(t.id)) {
              catalogMap.set(t.id, t);
            }
          }
        }
        const mergedCatalog = Array.from(catalogMap.values());
        const nextMap = { ...stored };

        for (const reg of regions) {
          const prevSnap = (stored[reg] as TrendingChartSnapshot | null | undefined) || null;
          const customUrl = body.clearCustomUrl
            ? undefined
            : body.customSpotifyUrl !== undefined
              ? body.customSpotifyUrl
              : prevSnap?.customSpotifyUrl;

          const updated = await syncSpotifyTrendingChart({
            region: reg,
            catalogTracks: mergedCatalog,
            previousSnapshot: prevSnap,
            customSpotifyUrl: customUrl,
          });
          nextMap[reg] = updated as unknown as Record<string, unknown>;
        }

        await saveR2TrendingCharts(nextMap);
        sendJson(res, 200, {
          success: true,
          charts: {
            vn: (nextMap.vn as TrendingChartSnapshot | null | undefined) || null,
            global: (nextMap.global as TrendingChartSnapshot | null | undefined) || null,
          },
        });
      } catch (err: unknown) {
        sendJson(res, 400, {
          error:
            err instanceof Error
              ? err.message
              : 'Đồng bộ BXH Spotify thất bại.',
        });
      }
      return;
    }

    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // Handle GET / POST / DELETE /api/tracks/public-albums
  if (id === 'public-albums') {
    if (req.method === 'GET') {
      try {
        const albums = await getR2PublicAlbums();
        sendJson(res, 200, albums);
      } catch (err: unknown) {
        sendJson(res, 500, {
          error: err instanceof Error ? err.message : 'Failed to load public albums',
        });
      }
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      try {
        const body = await readJsonBody<{ album?: Partial<R2StoredAlbum> } & Partial<R2StoredAlbum>>(req);
        const payload = body.album && typeof body.album === 'object' ? body.album : body;
        if (!payload.title || !String(payload.title).trim()) {
          sendJson(res, 400, { error: 'Album title is required' });
          return;
        }
        const saved = await upsertR2PublicAlbum(payload);
        sendJson(res, 200, { success: true, album: saved });
      } catch (err: unknown) {
        sendJson(res, 500, {
          error: err instanceof Error ? err.message : 'Failed to save public album',
        });
      }
      return;
    }

    if (req.method === 'DELETE') {
      try {
        const reqUrl = new URL(req.url || '/api/tracks/public-albums', 'http://localhost');
        const qId = reqUrl.searchParams.get('albumId') || reqUrl.searchParams.get('id') || '';
        let targetId = qId.trim();
        if (!targetId) {
          const body = await readJsonBody<{ id?: string; albumId?: string }>(req).catch(
            () => ({}) as { id?: string; albumId?: string }
          );
          targetId = String(body.albumId || body.id || '').trim();
        }
        if (!targetId) {
          sendJson(res, 400, { error: 'albumId is required' });
          return;
        }
        await deleteR2PublicAlbum(targetId);
        sendJson(res, 200, { success: true, deletedId: targetId });
      } catch (err: unknown) {
        sendJson(res, 500, {
          error: err instanceof Error ? err.message : 'Failed to delete public album',
        });
      }
      return;
    }

    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  // Handle POST /api/tracks/spotify-album
  if (id === 'spotify-album') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }
    try {
      const body = await readJsonBody<SpotifyAlbumBody>(req);
      const rawUrl = String(body.url || body.spotifyUrl || '').trim();
      if (!rawUrl) {
        sendJson(res, 400, {
          error: 'Vui lòng nhập đường dẫn (link) Album hoặc Playlist từ Spotify.',
        });
        return;
      }

      const collection = await fetchSpotifyCollectionMetadata(rawUrl);
      sendJson(res, 200, collection);
    } catch (err: unknown) {
      console.error('Error parsing Spotify album/playlist:', err);
      sendJson(res, 400, {
        error:
          err instanceof Error
            ? err.message
            : 'Không thể lấy thông tin Album từ Spotify.',
      });
    }
    return;
  }

  // Handle POST /api/tracks/batch
  if (id === 'batch') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }
    try {
      const body = await readJsonBody<BatchBody>(req);
      const incoming = body.tracks;
      if (!Array.isArray(incoming) || incoming.length === 0) {
        sendJson(res, 400, { error: 'Tracks array is required' });
        return;
      }

      const formatted: R2StoredTrack[] = incoming.map((item, idx) => {
        let lyrics = Array.isArray(item.lyrics) ? item.lyrics : [];
        if (lyrics.length === 0 && typeof item.lyricsText === 'string' && item.lyricsText.trim()) {
          lyrics = item.lyricsText
            .split('\n')
            .filter(l => l.trim().length > 0)
            .map((line, lIdx) => ({ time: lIdx * 6, text: line.trim() }));
        }
        if (lyrics.length === 0) {
          lyrics = [
            { time: 5, text: `Đang phát bản nhạc: ${item.title || 'Bài hát'}` },
            { time: 20, text: `Thể loại: ${item.genre || 'Pop'}` },
          ];
        }

        const rawId = item.id || `uploaded-${Date.now()}-${idx}`;
        const safeId = String(rawId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);

        return {
          id: safeId,
          title: String(item.title || 'Bài hát không tên').trim(),
          artist: String(item.artist || 'Nghệ sĩ chưa rõ').trim(),
          album: String(item.album || 'Kho nhạc Soundly').trim(),
          audioUrl: String(item.audioUrl || ''),
          coverUrl:
            item.coverUrl ||
            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
          duration: typeof item.duration === 'number' ? item.duration : 210,
          genre: String(item.genre || 'Pop'),
          ...(item.region === 'vn' || item.region === 'us-uk' || item.region === 'kpop' || item.region === 'other'
            ? { region: item.region }
            : {}),
          releaseYear:
            typeof item.releaseYear === 'number'
              ? item.releaseYear
              : new Date().getFullYear(),
          bpm: typeof item.bpm === 'number' ? item.bpm : 110,
          mood: String(item.mood || 'Thư giãn'),
          aiClassified: Boolean(item.aiClassified),
          aiReason: String(item.aiReason || 'Tải lên bởi quản trị viên'),
          lyrics,
          plays: typeof item.plays === 'number' ? item.plays : 0,
          ...(item.spotifyTrackId ? { spotifyTrackId: String(item.spotifyTrackId) } : {}),
          ...(item.spotifyUrl ? { spotifyUrl: String(item.spotifyUrl) } : {}),
          ...(item.r2AudioKey ? { r2AudioKey: String(item.r2AudioKey) } : {}),
          ...(item.r2CoverKey ? { r2CoverKey: String(item.r2CoverKey) } : {}),
          ...(item.syncedLyrics ? { syncedLyrics: String(item.syncedLyrics) } : {}),
          ...(item.plainLyrics ? { plainLyrics: String(item.plainLyrics) } : {}),
          ...(item.lyricsMode ? { lyricsMode: item.lyricsMode } : {}),
        };
      });

      await upsertR2CatalogTracks(formatted);
      sendJson(res, 201, { count: formatted.length, tracks: formatted });
    } catch (err: unknown) {
      console.error('Error persisting batch tracks to R2:', err);
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Failed to save tracks.',
      });
    }
    return;
  }

  // Handle PATCH /api/tracks/batch-update
  if (id === 'batch-update') {
    if (req.method !== 'PATCH') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }
    try {
      const body = await readJsonBody<{
        updates?: Array<{ id: string; patch: Partial<R2StoredTrack> }>;
      }>(req);
      const updates = Array.isArray(body.updates) ? body.updates : [];
      if (updates.length === 0) {
        sendJson(res, 400, { error: 'updates array is required' });
        return;
      }
      const updatedCount = await batchUpdateR2CatalogTracks(updates);
      sendJson(res, 200, { success: true, updatedCount });
    } catch (err: unknown) {
      console.error('Error batch updating tracks in R2:', err);
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Failed to batch update tracks.',
      });
    }
    return;
  }

  // Handle POST /api/tracks/play
  if (id === 'play') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }
    try {
      const body = await readJsonBody<PlayTrackBody>(req);
      const trackId = String(body.trackId || body.id || '').trim();

      if (!trackId) {
        sendJson(res, 400, { error: 'trackId is required' });
        return;
      }

      const r2Plays = await incrementR2CatalogTrackPlays(trackId);
      sendJson(res, 200, {
        success: true,
        id: trackId,
        plays: r2Plays,
      });
    } catch (err: unknown) {
      console.error('Error recording track play:', err);
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Failed to record track play.',
      });
    }
    return;
  }

  if (req.method === 'GET') {
    const tracks = await getR2CatalogTracks();
    const track = tracks.find(t => t.id === id);
    if (!track) {
      sendJson(res, 404, { error: 'Track not found' });
      return;
    }
    sendJson(res, 200, track);
    return;
  }

  if (req.method === 'PATCH') {
    const patch = await readJsonBody<Record<string, unknown>>(req);
    const updated = await updateR2CatalogTrack(id, patch);
    if (!updated) {
      sendJson(res, 404, { error: 'Track not found' });
      return;
    }
    sendJson(res, 200, updated);
    return;
  }

  if (req.method === 'DELETE') {
    await deleteR2CatalogTrack(id);
    sendJson(res, 200, { success: true, deletedId: id });
    return;
  }

  sendJson(res, 405, { error: 'Method Not Allowed' });
}
