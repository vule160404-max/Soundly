import type { IncomingMessage, ServerResponse } from 'node:http';
import { createR2PresignedUploadUrl } from '../_lib/r2.js';
import { readJsonBody, sendJson } from '../_utils.js';

interface PresignBody {
  fileName?: string;
  contentType?: string;
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
    const body = await readJsonBody<PresignBody>(req);
    const fileName = body.fileName || `track-${Date.now()}.mp3`;
    const contentType = body.contentType || 'audio/mpeg';

    const result = await createR2PresignedUploadUrl(fileName, contentType);
    sendJson(res, 200, {
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    console.error('Cloudflare R2 presign error:', err);
    sendJson(res, 500, {
      error:
        err instanceof Error
          ? err.message
          : 'Không thể tạo URL tải lên Cloudflare R2.',
    });
  }
}
