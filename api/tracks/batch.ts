import type { IncomingMessage, ServerResponse } from 'node:http';
import { upsertR2CatalogTracks, R2StoredTrack } from '../_lib/r2.js';
import { readJsonBody, sendJson } from '../_utils.js';

interface BatchBody {
  tracks?: Array<Partial<R2StoredTrack> & { lyricsText?: string }>;
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
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
}
