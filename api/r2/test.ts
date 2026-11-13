import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  loadR2Config,
  isR2Configured,
  getMissingR2EnvVars,
  testR2Connection,
} from '../../server-r2';
import { sendJson } from '../_utils';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const config = loadR2Config();
  if (!isR2Configured(config)) {
    const missing = getMissingR2EnvVars(config);
    sendJson(res, 400, {
      success: false,
      error: `Cloudflare R2 chưa đủ biến môi trường trên server. Thiếu: ${missing.join(', ')}`,
    });
    return;
  }

  const result = await testR2Connection();
  sendJson(res, result.success ? 200 : 500, result);
}
