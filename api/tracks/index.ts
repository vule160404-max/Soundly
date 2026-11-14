import type { IncomingMessage, ServerResponse } from 'node:http';
import { getR2CatalogTracks } from '../_lib/r2.js';
import { sendJson } from '../_utils.js';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const reqUrl = new URL(req.url || '/api/tracks', 'http://localhost');
    const q = (reqUrl.searchParams.get('q') || '').toLowerCase().trim();
    const genre = (reqUrl.searchParams.get('genre') || '').trim();
    const includeLyrics = reqUrl.searchParams.get('includeLyrics') === '1';

    let results = await getR2CatalogTracks();

    if (genre && genre !== 'all') {
      results = results.filter(
        t => t.genre.toLowerCase() === genre.toLowerCase()
      );
    }

    if (q) {
      results = results.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q)
      );
    }

    const payload = includeLyrics
      ? results
      : results.map(({ syncedLyrics: _s, plainLyrics: _p, lyrics: _l, ...rest }) => ({
          ...rest,
          lyrics: [],
        }));

    sendJson(res, 200, payload);
  } catch (err: unknown) {
    console.error('Error loading R2 tracks:', err);
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'Failed to load tracks.',
    });
  }
}
