import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request, Response } from 'express';
import multer from 'multer';
import {
  loadR2Config,
  isR2Configured,
  getMissingR2EnvVars,
  testR2Connection,
  createR2PresignedUploadUrl,
  uploadBufferToR2,
  uploadTempChunkToR2,
  completeChunkedUploadToR2,
  getR2ObjectRange,
  backfillR2CatalogId3Metadata,
} from '../_lib/r2.js';
import { readJsonBody, sendJson } from '../_utils.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4.5 * 1024 * 1024 },
});

const MAX_CHUNK_BYTES = 4 * 1024 * 1024;

interface PresignBody {
  fileName?: string;
  contentType?: string;
}

interface CompleteChunkedBody {
  uploadId?: string;
  totalChunks?: number;
  fileName?: string;
  contentType?: string;
}

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

function resolveAction(
  req: IncomingMessage & { query?: { action?: string | string[] } }
): string {
  const rawParam = req.query?.action;
  const fromQuery = Array.isArray(rawParam) ? rawParam[0] : rawParam || '';
  if (fromQuery) return fromQuery.trim().toLowerCase();

  if (req.url) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const segments = pathname.split('/').filter(Boolean);
    const r2Idx = segments.indexOf('r2');
    if (r2Idx !== -1 && segments[r2Idx + 1]) {
      return segments[r2Idx + 1].toLowerCase();
    }
    return (segments.pop() || '').toLowerCase();
  }
  return '';
}

export default async function handler(
  req: IncomingMessage & { query?: { action?: string | string[] }; body?: unknown },
  res: ServerResponse
) {
  const action = resolveAction(req);

  switch (action) {
    case 'status': {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const r2Config = loadR2Config();
      const configured = isR2Configured(r2Config);
      const missingVars = getMissingR2EnvVars(r2Config);
      sendJson(res, 200, {
        isConfigured: configured,
        accountId: r2Config.accountId ? `${r2Config.accountId.slice(0, 6)}...` : '',
        bucketName: r2Config.bucketName,
        publicDomain: r2Config.publicDomain,
        missingVars,
      });
      return;
    }

    case 'config': {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const r2Config = loadR2Config();
      if (!isR2Configured(r2Config)) {
        const missing = getMissingR2EnvVars(r2Config);
        sendJson(res, 400, {
          success: false,
          isConfigured: false,
          error: `Cloudflare R2 được cấu hình qua biến môi trường server. Thiếu: ${missing.join(', ')}.`,
        });
        return;
      }
      const testResult = await testR2Connection();
      sendJson(res, 200, {
        success: testResult.success,
        message: testResult.message,
        isConfigured: true,
      });
      return;
    }

    case 'test': {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const r2Config = loadR2Config();
      if (!isR2Configured(r2Config)) {
        const missing = getMissingR2EnvVars(r2Config);
        sendJson(res, 400, {
          success: false,
          error: `Cloudflare R2 chưa đủ biến môi trường trên server. Thiếu: ${missing.join(', ')}`,
        });
        return;
      }
      const result = await testR2Connection();
      sendJson(res, result.success ? 200 : 500, result);
      return;
    }

    case 'presign': {
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
      return;
    }

    case 'upload': {
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

        await new Promise<void>((resolve, reject) => {
          upload.single('file')(
            req as unknown as Request,
            res as unknown as Response,
            (err?: unknown) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        const reqWithFile = req as IncomingMessage & { file?: Express.Multer.File };
        if (!reqWithFile.file) {
          sendJson(res, 400, { error: 'Không tìm thấy tệp âm thanh để tải lên.' });
          return;
        }

        const result = await uploadBufferToR2(
          reqWithFile.file.buffer,
          reqWithFile.file.originalname,
          reqWithFile.file.mimetype || 'audio/mpeg'
        );

        sendJson(res, 200, {
          success: true,
          audioUrl: result.audioUrl,
          key: result.key,
          size: result.size,
        });
      } catch (err: unknown) {
        console.error('Cloudflare R2 upload error:', err);
        sendJson(res, 500, {
          error:
            err instanceof Error
              ? err.message
              : 'Tải tệp lên Cloudflare R2 thất bại.',
        });
      }
      return;
    }

    case 'upload-chunk': {
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
      return;
    }

    case 'complete-chunked': {
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
      return;
    }

    case 'stream': {
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
      return;
    }

    case 'heal-id3': {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      try {
        const result = await backfillR2CatalogId3Metadata(2000);
        sendJson(res, 200, { success: true, ...result });
      } catch (err: unknown) {
        sendJson(res, 500, {
          error: err instanceof Error ? err.message : 'Failed to backfill ID3 metadata',
        });
      }
      return;
    }

    default:
      sendJson(res, 404, { error: `Unknown R2 endpoint: ${action || 'empty'}` });
  }
}
