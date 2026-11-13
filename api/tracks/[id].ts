import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getR2CatalogTracks,
  updateR2CatalogTrack,
  deleteR2CatalogTrack,
} from '../_lib/r2.js';
import { readJsonBody, sendJson } from '../_utils.js';

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
