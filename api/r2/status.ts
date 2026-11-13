import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  loadR2Config,
  isR2Configured,
  getMissingR2EnvVars,
} from '../../server-r2';
import { sendJson } from '../_utils';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const config = loadR2Config();
  const configured = isR2Configured(config);
  const missingVars = getMissingR2EnvVars(config);

  sendJson(res, 200, {
    isConfigured: configured,
    accountId: config.accountId ? `${config.accountId.slice(0, 6)}...` : '',
    bucketName: config.bucketName,
    publicDomain: config.publicDomain,
    missingVars,
  });
}
