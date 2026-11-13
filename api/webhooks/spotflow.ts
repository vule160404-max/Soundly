import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJsonBody, sendJson } from '../_utils.js';

interface SpotflowWebhookPayload {
  jobId?: string;
  title?: string;
  downloadUrl?: string;
  test?: boolean;
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  if (req.method === 'GET') {
    sendJson(res, 200, {
      status: 'ready',
      endpoint: '/api/webhooks/spotflow',
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const payload = await readJsonBody<SpotflowWebhookPayload>(req);
    if (payload.test || (!payload.downloadUrl && !payload.title)) {
      sendJson(res, 200, {
        success: true,
        message: 'Soundly webhook endpoint is reachable.',
      });
      return;
    }

    sendJson(res, 200, {
      success: true,
      trackId: `spotflow-wh-${payload.jobId || Date.now()}`,
      message:
        'Webhook received. Use "Kết nối & Đồng bộ ngay" in Admin Panel to persist tracks into Firestore & Cloudflare R2.',
    });
  } catch (err: unknown) {
    sendJson(res, 400, {
      error:
        err instanceof Error ? err.message : 'Webhook payload không hợp lệ.',
    });
  }
}
