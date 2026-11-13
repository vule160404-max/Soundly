import type { IncomingMessage, ServerResponse } from 'node:http';
import { getR2ObjectRange } from '../_lib/r2.js';
import { sendJson } from '../_utils.js';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const parsedUrl = new URL(req.url || '/api/r2/stream', 'http://localhost');
    const key = (parsedUrl.searchParams.get('key') || '').trim();
    if (!key) {
      sendJson(res, 400, { error: 'Missing R2 object key' });
      return;
    }

    const rangeHeader =
      typeof req.headers.range === 'string' ? req.headers.range : undefined;

    const result = await getR2ObjectRange(key, rangeHeader);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', String(result.buffer.length));

    if (result.status === 206) {
      res.setHeader(
        'Content-Range',
        `bytes ${result.start}-${result.end}/${result.totalSize}`
      );
    }

    res.statusCode = result.status;
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(result.buffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to stream R2 object';
    const status = msg.includes('Forbidden') ? 403 : 404;
    sendJson(res, status, { error: msg });
  }
}
