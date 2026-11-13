import { LyricLine, Track } from '../types/music';

export function parseSyncedLrcClient(syncedLyrics?: string): LyricLine[] {
  if (!syncedLyrics || typeof syncedLyrics !== 'string') return [];
  const parsed: LyricLine[] = [];
  const lines = syncedLyrics.split(/\r?\n/);
  const tagRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const rawLine of lines) {
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    tagRegex.lastIndex = 0;

    while ((match = tagRegex.exec(rawLine)) !== null) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const fracRaw = match[3] || '0';
      const millis = parseInt(fracRaw.padEnd(3, '0').slice(0, 3), 10);
      if (!Number.isNaN(mins) && !Number.isNaN(secs)) {
        timestamps.push(mins * 60 + secs + millis / 1000);
      }
    }

    if (timestamps.length > 0) {
      const text = rawLine.replace(tagRegex, '').trim();
      if (text) {
        for (const time of timestamps) {
          parsed.push({ time, text });
        }
      }
    }
  }

  parsed.sort((a, b) => a.time - b.time);
  return parsed;
}

/**
 * Returns timestamped lyric lines for a track.
 * Priority:
 * 1. LRC string in `track.syncedLyrics`
 * 2. Pre-parsed `track.lyrics` array
 * 3. Auto-timed lines derived from `track.plainLyrics` distributed across track duration
 */
export function getTrackSyncedLines(track: Track | null, currentDuration?: number): LyricLine[] {
  if (!track) return [];

  const fromLrc = parseSyncedLrcClient(track.syncedLyrics);
  if (fromLrc.length > 0) return fromLrc;

  if (Array.isArray(track.lyrics) && track.lyrics.length > 0) {
    return track.lyrics;
  }

  if (track.plainLyrics && typeof track.plainLyrics === 'string') {
    const rawLines = track.plainLyrics
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (rawLines.length > 0) {
      const totalDur = Math.max(60, currentDuration || track.duration || 180);
      const effectiveSpan = Math.max(30, totalDur - 8);
      const step = effectiveSpan / rawLines.length;
      return rawLines.map((text, idx) => ({
        time: Math.round((3 + idx * step) * 10) / 10,
        text,
      }));
    }
  }

  return [];
}

export function findActiveLyricIndex(lines: LyricLine[], currentTime: number): number {
  if (!lines.length) return -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (currentTime >= lines[i].time) {
      return i;
    }
  }
  return -1;
}
