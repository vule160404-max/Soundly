import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  loadR2Config,
  isR2Configured,
  uploadRemoteUrlToR2,
  upsertR2CatalogTracks,
} from '../_lib/r2.js';
import { readJsonBody, sendJson } from '../_utils.js';

interface LyricLine {
  time: number;
  text: string;
}

interface SpotflowBody {
  spotflowUrl?: string;
  apiKey?: string;
  saveToR2?: boolean;
}

interface SpotflowTrackItem {
  jobId?: string;
  title?: string;
  artist?: string;
  album?: string;
  bitrate?: number;
  downloadUrl?: string;
  syncedLyrics?: string;
  plainLyrics?: string;
  downloadedAt?: string;
  coverUrl?: string;
}

function resolveSpotflowEndpoint(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  if (withProtocol.toLowerCase().endsWith('/api/external/tracks')) {
    return withProtocol;
  }
  return `${withProtocol}/api/external/tracks`;
}

function resolveRemoteMediaUrl(rawUrl: string, baseEndpoint: string): string {
  if (!rawUrl) return '';
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  try {
    return new URL(rawUrl, baseEndpoint).toString();
  } catch {
    return rawUrl;
  }
}

function parseSpotflowLyrics(
  syncedText?: string,
  plainText?: string
): LyricLine[] {
  if (syncedText && typeof syncedText === 'string') {
    const lines = syncedText.split('\n');
    const result: LyricLine[] = [];
    const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]\s*(.*)/;
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        const millisStr = match[3] || '0';
        const millis = parseInt(millisStr.padEnd(3, '0').slice(0, 3), 10);
        const time = mins * 60 + secs + millis / 1000;
        const text = match[4].trim();
        if (text) {
          result.push({ time, text });
        }
      }
    }
    if (result.length > 0) return result;
  }

  if (plainText && typeof plainText === 'string') {
    const lines = plainText.split('\n').filter(l => l.trim().length > 0);
    return lines.map((l, idx) => ({ time: idx * 6, text: l.trim() }));
  }

  return [{ time: 5, text: 'Đang phát bản nhạc từ SpotFlow MP3' }];
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
    const { spotflowUrl, apiKey, saveToR2 } =
      await readJsonBody<SpotflowBody>(req);
    if (!spotflowUrl || !apiKey) {
      sendJson(res, 400, {
        error: 'Vui lòng cung cấp URL của SpotFlow và API Key.',
      });
      return;
    }

    const endpoint = resolveSpotflowEndpoint(spotflowUrl);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey.trim(),
        Authorization: `Bearer ${apiKey.trim()}`,
        Accept: 'application/json',
      },
    });

    const rawBody = await response.text();

    if (!response.ok) {
      sendJson(res, response.status, {
        error: `Không thể kết nối tới SpotFlow MP3 (HTTP ${response.status} tại ${endpoint}). Kiểm tra lại URL hoặc API Key.`,
      });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      sendJson(res, 502, {
        error: `SpotFlow trả về HTML/văn bản thay vì JSON tại ${endpoint}. Hãy kiểm tra đúng REST API Endpoint hoặc đợi server SpotFlow (Render) khởi động xong rồi thử lại.`,
      });
      return;
    }

    const items: SpotflowTrackItem[] | null = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { tracks?: unknown }).tracks)
        ? (parsed as { tracks: SpotflowTrackItem[] }).tracks
        : parsed &&
            typeof parsed === 'object' &&
            Array.isArray((parsed as { data?: unknown }).data)
          ? (parsed as { data: SpotflowTrackItem[] }).data
          : null;

    if (!items) {
      sendJson(res, 400, {
        error: 'Định dạng phản hồi từ SpotFlow không hợp lệ (cần là mảng bài hát JSON).',
      });
      return;
    }

    const r2Config = loadR2Config();
    const shouldSaveToR2 = isR2Configured(r2Config) && saveToR2 !== false;

    const syncedTracks = await Promise.all(
      items.map(async (item, idx) => {
        const rawTrackId = `spotflow-${item.jobId || Date.now()}-${idx}`;
        const trackId = rawTrackId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
        const lyrics = parseSpotflowLyrics(item.syncedLyrics, item.plainLyrics);
        let audioUrl = resolveRemoteMediaUrl(item.downloadUrl || '', endpoint);
        const coverUrl = item.coverUrl
          ? resolveRemoteMediaUrl(item.coverUrl, endpoint)
          : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';

        if (shouldSaveToR2 && audioUrl) {
          try {
            const r2Upload = await uploadRemoteUrlToR2(
              audioUrl,
              `${item.artist || 'artist'} - ${item.title || 'song'}.mp3`
            );
            audioUrl = r2Upload.audioUrl;
          } catch (r2Err) {
            console.warn(
              'Could not mirror SpotFlow file to Cloudflare R2, using direct url:',
              r2Err
            );
          }
        }

        return {
          id: trackId,
          title: (item.title || 'Bài hát SpotFlow').trim(),
          artist: (item.artist || 'Nghệ sĩ SpotFlow').trim(),
          album: (item.album || 'SpotFlow MP3 Download').trim(),
          audioUrl,
          coverUrl,
          duration: 210,
          genre: 'Pop',
          releaseYear: new Date().getFullYear(),
          bpm: item.bitrate === 320 ? 120 : 110,
          mood: 'Sôi động & Chất lượng cao',
          aiClassified: true,
          aiReason: shouldSaveToR2
            ? 'Lưu trữ vĩnh viễn trên Cloudflare R2'
            : `Đồng bộ tự động từ SpotFlow MP3 (${item.bitrate || 320}kbps)`,
          lyrics,
          plays: 0,
        };
      })
    );

    if (syncedTracks.length > 0 && isR2Configured(r2Config)) {
      await upsertR2CatalogTracks(syncedTracks);
    }

    sendJson(res, 200, {
      success: true,
      count: syncedTracks.length,
      tracks: syncedTracks,
    });
  } catch (err: unknown) {
    console.error('Spotflow sync error:', err);
    sendJson(res, 500, {
      error:
        err instanceof Error ? err.message : 'Lỗi kết nối SpotFlow MP3.',
    });
  }
}
