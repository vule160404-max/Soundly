import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getR2CatalogTracks,
  isR2Configured,
  upsertR2CatalogTracks,
} from '../_lib/r2.js';
import {
  SpotflowIncomingItem,
  ingestSpotflowTracks,
} from '../_lib/spotflow.js';
import { readJsonBody, sendJson } from '../_utils.js';

interface SpotflowWebhookPayload {
  event?: string;
  test?: boolean;
  track?: SpotflowIncomingItem;
  id?: string;
  jobId?: string;
  trackId?: string;
  title?: string;
  artist?: string;
  album?: string;
  durationMs?: number;
  spotifyUrl?: string;
  downloadUrl?: string;
  coverUrl?: string | null;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

function getHeaderValue(
  headers: IncomingMessage['headers'],
  name: string
): string {
  const val = headers[name.toLowerCase()];
  if (Array.isArray(val)) return (val[0] || '').trim();
  return (val || '').trim();
}

function verifySecretConstantTime(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  const configuredSecret = (
    process.env.SPOTFLOW_WEBHOOK_SECRET ||
    process.env.SPOTFLOW_API_KEY ||
    ''
  ).trim();

  if (req.method === 'GET') {
    sendJson(res, 200, {
      status: 'ready',
      endpoint: '/api/webhooks/spotflow',
      webhookSecretConfigured: Boolean(configuredSecret),
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const rawApiKey = getHeaderValue(req.headers, 'x-api-key');
    const authHeader = getHeaderValue(req.headers, 'authorization');
    const bearerKey = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const providedKey = rawApiKey || bearerKey;

    if (configuredSecret) {
      if (!providedKey || !verifySecretConstantTime(providedKey, configuredSecret)) {
        sendJson(res, 401, {
          error: 'Unauthorized: Header X-API-Key không khớp với secret cấu hình.',
        });
        return;
      }
    }

    const payload = await readJsonBody<SpotflowWebhookPayload>(req);

    // Ignore ping_test events immediately with HTTP 200
    if (payload?.event === 'ping_test' || payload?.test === true) {
      sendJson(res, 200, {
        success: true,
        ignored: true,
        event: payload?.event || 'ping_test',
        message: 'SpotFlow webhook ping_test received.',
      });
      return;
    }

    const trackItem: SpotflowIncomingItem | null =
      payload?.track && typeof payload.track === 'object'
        ? payload.track
        : payload?.title || payload?.downloadUrl
          ? payload
          : null;

    if (!trackItem || (!trackItem.title && !trackItem.downloadUrl)) {
      sendJson(res, 400, {
        error: 'Webhook payload không hợp lệ (thiếu thông tin track/downloadUrl/title).',
      });
      return;
    }

    const r2Configured = isR2Configured();
    const existingTracks = r2Configured ? await getR2CatalogTracks() : [];

    const result = await ingestSpotflowTracks({
      items: [trackItem],
      apiKey: providedKey || configuredSecret || undefined,
      saveToR2: true,
      existingTracks,
      sourceLabel: 'Webhook SpotFlow',
    });

    if (result.tracks.length > 0 && r2Configured) {
      await upsertR2CatalogTracks(result.tracks);
    }

    const processedTrack = result.tracks[0] || null;

    sendJson(res, 200, {
      success: true,
      event: payload.event || 'track_downloaded',
      addedCount: result.addedCount,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
      trackId: processedTrack?.id || null,
      track: processedTrack,
    });
  } catch (err: unknown) {
    console.error('SpotFlow webhook error:', err);
    sendJson(res, 500, {
      error:
        err instanceof Error ? err.message : 'Lỗi xử lý webhook SpotFlow MP3.',
    });
  }
}
