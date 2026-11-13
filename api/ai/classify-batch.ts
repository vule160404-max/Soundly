import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  classifyBatchWithGemini,
  ClassifyInputTrack,
} from '../../server-ai';
import { readJsonBody, sendJson } from '../_utils';

interface ClassifyBody {
  tracks?: Array<Record<string, unknown>>;
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
    const body = await readJsonBody<ClassifyBody>(req);
    const inputTracks = body.tracks;
    if (!Array.isArray(inputTracks) || inputTracks.length === 0) {
      sendJson(res, 400, {
        error: 'Danh sách bài hát để phân loại không hợp lệ.',
      });
      return;
    }

    const sanitized: ClassifyInputTrack[] = inputTracks.map((t, idx) => ({
      id: String(t.id || `item-${idx}`),
      title: String(t.title || t.fileName || 'Bài hát không tên'),
      artist: t.artist ? String(t.artist) : '',
      fileName: t.fileName ? String(t.fileName) : '',
      album: t.album ? String(t.album) : '',
      duration: typeof t.duration === 'number' ? t.duration : undefined,
    }));

    const classifications = await classifyBatchWithGemini(sanitized);
    sendJson(res, 200, { classifications });
  } catch (err: unknown) {
    console.error('AI Classification error:', err);
    sendJson(res, 500, {
      error:
        err instanceof Error
          ? err.message
          : 'Lỗi khi gọi AI phân loại nhạc.',
    });
  }
}
