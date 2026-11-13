import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getR2CatalogTracks,
  isR2Configured,
  loadR2Config,
  upsertR2CatalogTracks,
} from '../_lib/r2.js';
import {
  DEFAULT_SPOTFLOW_API_KEY,
  ExistingTrackLookup,
  enrichTrackMetadataFromSpotflow,
  fetchSpotflowTracksFromServer,
  ingestSpotflowTracks,
} from '../_lib/spotflow.js';
import { readJsonBody, sendJson } from '../_utils.js';

interface SpotflowSyncBody {
  action?: 'sync' | 'enrich';
  spotflowUrl?: string;
  apiKey?: string;
  saveToR2?: boolean;
  existingTracks?: ExistingTrackLookup[];
  fileName?: string;
  title?: string;
  artist?: string;
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
    const body = await readJsonBody<SpotflowSyncBody>(req);

    if (body?.action === 'enrich') {
      const enriched = await enrichTrackMetadataFromSpotflow({
        fileName: body.fileName,
        title: body.title,
        artist: body.artist,
        apiKey: body.apiKey || DEFAULT_SPOTFLOW_API_KEY,
        saveCoverToR2: true,
      });
      sendJson(res, 200, { ok: true, ...enriched });
      return;
    }

    const { spotflowUrl, apiKey, saveToR2, existingTracks: clientHints } = body;

    const { endpoint, effectiveApiKey, items } =
      await fetchSpotflowTracksFromServer({
        spotflowUrl,
        apiKey,
      });

    const r2Config = loadR2Config();
    const r2Configured = isR2Configured(r2Config);
    const r2Existing = r2Configured ? await getR2CatalogTracks() : [];

    // Merge R2 existing catalog with client-side hints (e.g. tracks only in Firestore)
    const mergedExisting: ExistingTrackLookup[] = [...r2Existing];
    const seenIds = new Set(r2Existing.map(t => t.id));
    if (Array.isArray(clientHints)) {
      for (const hint of clientHints) {
        if (hint && hint.id && !seenIds.has(hint.id)) {
          mergedExisting.push(hint);
          seenIds.add(hint.id);
        }
      }
    }

    const result = await ingestSpotflowTracks({
      items,
      baseEndpoint: endpoint,
      apiKey: effectiveApiKey,
      saveToR2: saveToR2 !== false,
      existingTracks: mergedExisting,
      sourceLabel: 'SpotFlow MP3',
    });

    if (result.tracks.length > 0 && r2Configured) {
      await upsertR2CatalogTracks(result.tracks);
    }

    sendJson(res, 200, {
      success: true,
      count: result.addedCount,
      addedCount: result.addedCount,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
      failedAudioCount: result.failedAudioCount,
      failedAudioMessages: result.failedAudioMessages,
      addedTracks: result.addedTracks,
      updatedTracks: result.updatedTracks,
      tracks: result.tracks,
    });
  } catch (err: unknown) {
    console.error('Spotflow sync error:', err);
    sendJson(res, 500, {
      error:
        err instanceof Error ? err.message : 'Lỗi kết nối SpotFlow MP3.',
    });
  }
}
