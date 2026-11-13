import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  loadR2Config,
  isR2Configured,
  uploadRemoteUrlToR2,
} from '../../server-r2';
import { Track, LyricLine } from '../../src/types/music';
import { readJsonBody, sendJson } from '../_utils';

interface SpotflowBody {
  spotflowUrl?: string;
  apiKey?: string;
  saveToR2?: boolean;
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

    const cleanUrl = spotflowUrl.replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/api/external/tracks`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      sendJson(res, response.status, {
        error: `Không thể kết nối tới SpotFlow MP3 (HTTP ${response.status}). Kiểm tra lại URL hoặc API Key.`,
      });
      return;
    }

    const data = (await response.json()) as Array<{
      jobId?: string;
      title: string;
      artist?: string;
      album?: string;
      bitrate?: number;
      downloadUrl: string;
      syncedLyrics?: string;
      plainLyrics?: string;
      downloadedAt?: string;
      coverUrl?: string;
    }>;

    if (!Array.isArray(data)) {
      sendJson(res, 400, {
        error: 'Định dạng phản hồi từ SpotFlow không hợp lệ (cần là mảng bài hát).',
      });
      return;
    }

    const r2Config = loadR2Config();
    const shouldSaveToR2 = isR2Configured(r2Config) && saveToR2 !== false;

    const syncedTracks: Track[] = await Promise.all(
      data.map(async (item, idx) => {
        const trackId = `spotflow-${item.jobId || Date.now()}-${idx}`;
        const lyrics = parseSpotflowLyrics(item.syncedLyrics, item.plainLyrics);
        let audioUrl = item.downloadUrl;

        if (shouldSaveToR2) {
          try {
            const r2Upload = await uploadRemoteUrlToR2(
              item.downloadUrl,
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
          coverUrl:
            item.coverUrl ||
            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
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
