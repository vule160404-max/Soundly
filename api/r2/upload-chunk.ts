import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  loadR2Config,
  isR2Configured,
  getMissingR2EnvVars,
  uploadTempChunkToR2,
} from '../_lib/r2.js';
import { sendJson } from '../_utils.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_CHUNK_BYTES = 4 * 1024 * 1024;

async function readBinaryBody(
  req: IncomingMessage & { body?: unknown }
): Promise<Buffer> {
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (req.body instanceof Uint8Array) {
    return Buffer.from(req.body);
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_CHUNK_BYTES) {
      throw new Error('Kích thước phần dữ liệu vượt quá giới hạn 4MB.');
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
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

    const parsedUrl = new URL(
      req.url || '/api/r2/upload-chunk',
      'http://localhost'
    );
    const uploadId = parsedUrl.searchParams.get('uploadId') || '';
    const chunkIndexRaw = parsedUrl.searchParams.get('chunkIndex');
    const chunkIndex =
      chunkIndexRaw !== null ? Number.parseInt(chunkIndexRaw, 10) : -1;

    if (!uploadId || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
      sendJson(res, 400, { error: 'Thiếu uploadId hoặc chunkIndex hợp lệ.' });
      return;
    }

    const buffer = await readBinaryBody(req);
    if (buffer.length === 0) {
      sendJson(res, 400, { error: 'Dữ liệu chunk trống.' });
      return;
    }

    const result = await uploadTempChunkToR2(uploadId, chunkIndex, buffer);
    sendJson(res, 200, {
      success: true,
      chunkIndex,
      ...result,
    });
  } catch (err: unknown) {
    console.error('Cloudflare R2 chunk upload error:', err);
    sendJson(res, 500, {
      error:
        err instanceof Error
          ? err.message
          : 'Tải phần dữ liệu lên Cloudflare R2 thất bại.',
    });
  }
}
