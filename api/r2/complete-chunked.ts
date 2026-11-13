import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  loadR2Config,
  isR2Configured,
  getMissingR2EnvVars,
  completeChunkedUploadToR2,
} from '../_lib/r2.js';
import { readJsonBody, sendJson } from '../_utils.js';

export const config = {
  maxDuration: 60,
};

interface CompleteChunkedBody {
  uploadId?: string;
  totalChunks?: number;
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
    const r2Config = loadR2Config();
    if (!isR2Configured(r2Config)) {
      const missing = getMissingR2EnvVars(r2Config);
      sendJson(res, 400, {
        error: `Cloudflare R2 chưa đủ biến môi trường trên server. Thiếu: ${missing.join(', ')}`,
      });
      return;
    }

    const body = await readJsonBody<CompleteChunkedBody>(req);
    const uploadId = String(body.uploadId || '').trim();
    const totalChunks = Number(body.totalChunks);
    const fileName = String(body.fileName || `track-${Date.now()}.mp3`);
    const contentType = String(body.contentType || 'audio/mpeg');

    if (!uploadId || !Number.isInteger(totalChunks) || totalChunks < 1) {
      sendJson(res, 400, {
        error: 'Thiếu thông tin uploadId hoặc totalChunks để ghép tệp.',
      });
      return;
    }

    const result = await completeChunkedUploadToR2({
      uploadId,
      totalChunks,
      fileName,
      contentType,
    });

    sendJson(res, 200, {
      success: true,
      audioUrl: result.audioUrl,
      key: result.key,
      size: result.size,
    });
  } catch (err: unknown) {
    console.error('Cloudflare R2 complete chunked error:', err);
    sendJson(res, 500, {
      error:
        err instanceof Error
          ? err.message
          : 'Không thể ghép tệp âm thanh trên Cloudflare R2.',
    });
  }
}
