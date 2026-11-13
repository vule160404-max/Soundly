import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request, Response } from 'express';
import multer from 'multer';
import {
  loadR2Config,
  isR2Configured,
  getMissingR2EnvVars,
  uploadBufferToR2,
} from '../_lib/r2.js';
import { sendJson } from '../_utils.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4.5 * 1024 * 1024 },
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: IncomingMessage,
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
}
