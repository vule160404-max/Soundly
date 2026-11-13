import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getR2CatalogTracks,
  isR2Configured,
  upsertR2CatalogTracksStrict,
} from '../_lib/r2.js';
import {
  ALLOWED_SPOTFLOW_API_KEYS,
  DEFAULT_SPOTFLOW_API_KEY,
  SpotflowIncomingItem,
  ingestSpotflowTracks,
  isValidSpotflowKeyFormat,
} from '../_lib/spotflow.js';
import { readJsonBody, sendJson } from '../_utils.js';

interface SpotflowWebhookPayload {
  event?: string;
  test?: boolean;
  storage?: string;
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
  audioUrl?: string;
  r2AudioUrl?: string;
  r2CoverUrl?: string | null;
  r2AudioKey?: string;
  r2CoverKey?: string;
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

function isAuthorizedWebhookKey(provided: string, configuredSecret: string): boolean {
  if (!provided) return false;
  const allowedKeys = Array.from(
    new Set([configuredSecret, DEFAULT_SPOTFLOW_API_KEY, ...ALLOWED_SPOTFLOW_API_KEYS].filter(Boolean))
  );
  if (allowedKeys.some(expected => verifySecretConstantTime(provided, expected))) {
    return true;
  }
  return isValidSpotflowKeyFormat(provided);
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  const configuredSecret = (
    process.env.SPOTFLOW_WEBHOOK_SECRET ||
    process.env.SPOTFLOW_API_KEY ||
    DEFAULT_SPOTFLOW_API_KEY
  ).trim();

  if (req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      status: 'ready',
      endpoint: '/api/webhooks/spotflow',
      webhookSecretConfigured: Boolean(configuredSecret),
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    const rawApiKey = getHeaderValue(req.headers, 'x-api-key');
    const authHeader = getHeaderValue(req.headers, 'authorization');
    const bearerKey = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const providedKey = rawApiKey || bearerKey;

    if (!isAuthorizedWebhookKey(providedKey, configuredSecret)) {
      sendJson(res, 401, {
        ok: false,
        error: 'Unauthorized: Header X-API-Key không hợp lệ.',
      });
      return;
    }

    const payload = await readJsonBody<SpotflowWebhookPayload>(req);

    // Respond to ping_test immediately with HTTP 200
    if (payload?.event === 'ping_test' || payload?.test === true) {
      sendJson(res, 200, {
        ok: true,
        success: true,
        ignored: true,
        event: payload?.event || 'ping_test',
        message: 'SpotFlow webhook ping_test received.',
      });
      return;
    }

    const rawTrack: SpotflowIncomingItem | null =
      payload?.track && typeof payload.track === 'object'
        ? payload.track
        : payload?.title ||
            payload?.downloadUrl ||
            payload?.r2AudioUrl ||
            payload?.audioUrl
          ? payload
          : null;

    if (!rawTrack) {
      sendJson(res, 400, {
        ok: false,
        error: 'Webhook payload không hợp lệ (thiếu đối tượng track).',
      });
      return;
    }

    const effectiveStorage = (rawTrack.storage || payload?.storage || '').trim();
    const trackItem: SpotflowIncomingItem = {
      ...rawTrack,
      ...(effectiveStorage ? { storage: effectiveStorage } : {}),
    };

    const isDirectR2 =
      effectiveStorage.toLowerCase() === 'r2' ||
      Boolean(trackItem.r2AudioUrl && trackItem.r2AudioUrl.trim());

    const resolvedDirectAudioUrl = (
      trackItem.r2AudioUrl ||
      trackItem.audioUrl ||
      ''
    ).trim();
    const resolvedFallbackAudioUrl = (
      trackItem.downloadUrl ||
      trackItem.audioUrl ||
      ''
    ).trim();

    if (isDirectR2 && !resolvedDirectAudioUrl) {
      sendJson(res, 400, {
        ok: false,
        error: 'Thiếu audioUrl (r2AudioUrl / audioUrl) trong dữ liệu bài hát.',
      });
      return;
    }

    if (!isDirectR2 && !resolvedFallbackAudioUrl) {
      sendJson(res, 400, {
        ok: false,
        error: 'Thiếu downloadUrl hoặc audioUrl trong dữ liệu bài hát.',
      });
      return;
    }

    if (!isR2Configured()) {
      sendJson(res, 500, {
        ok: false,
        error: 'Database Cloudflare R2 trên App Nhạc chưa được cấu hình biến môi trường.',
      });
      return;
    }

    const existingTracks = await getR2CatalogTracks();

    const result = await ingestSpotflowTracks({
      items: [trackItem],
      apiKey: providedKey || configuredSecret,
      saveToR2: true,
      existingTracks,
      sourceLabel: 'Webhook SpotFlow',
    });

    if (result.failedAudioCount > 0 || result.tracks.length === 0) {
      const reason =
        result.failedAudioMessages[0] ||
        'Không thể xử lý hoặc lưu tệp âm thanh cho bài hát.';
      sendJson(res, 422, {
        ok: false,
        error: reason,
      });
      return;
    }

    const processedTrack = result.tracks[0];
    if (!processedTrack || !processedTrack.audioUrl) {
      sendJson(res, 400, {
        ok: false,
        error: 'Thiếu audioUrl hợp lệ sau khi xử lý bài hát.',
      });
      return;
    }

    // Strict write to R2 catalog database (throws if write fails)
    await upsertR2CatalogTracksStrict(result.tracks);

    sendJson(res, 200, {
      ok: true,
      success: true,
      event: payload.event || 'track_downloaded',
      storage: isDirectR2 ? 'r2' : effectiveStorage || 'fallback',
      addedCount: result.addedCount,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
      trackId: processedTrack.id,
      track: processedTrack,
    });
  } catch (err: unknown) {
    console.error('SpotFlow webhook error:', err);
    sendJson(res, 500, {
      ok: false,
      error:
        err instanceof Error ? err.message : 'Lỗi lưu Database khi xử lý webhook SpotFlow.',
    });
  }
}
