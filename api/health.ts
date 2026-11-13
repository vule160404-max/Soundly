import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson } from './_utils.js';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  sendJson(res, 200, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}
