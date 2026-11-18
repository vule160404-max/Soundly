import { useEffect, useMemo, useState } from 'react';
import { LyricLine } from '../types/music';

type FetchedLyrics = {
  id: string;
  lyrics?: LyricLine[];
  syncedLyrics?: string;
  plainLyrics?: string;
  lyricsMode?: 'synced' | 'plain' | 'none';
};

/**
 * Returns the track merged with lyrics lazily fetched from the API,
 * so every lyrics surface (preview card + full drawer) shows the same data.
 */
export function useTrackLyrics<T extends { id: string } & Record<string, any>>(
  track: T | null | undefined,
  enabled: boolean = true
): T | null {
  const [fetched, setFetched] = useState<FetchedLyrics | null>(null);

  useEffect(() => {
    if (!enabled || !track?.id) return;
    const alreadyHasLyrics =
      Boolean(track.syncedLyrics?.trim()) ||
      Boolean(track.plainLyrics?.trim()) ||
      (Array.isArray(track.lyrics) && track.lyrics.length > 2);
    if (alreadyHasLyrics || track.lyricsMode === 'none') return;
    if (fetched?.id === track.id) return;

    let cancelled = false;
    fetch(`/api/tracks/${encodeURIComponent(track.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data || !data.id) return;
        setFetched({
          id: data.id,
          lyrics: Array.isArray(data.lyrics) ? data.lyrics : [],
          syncedLyrics: data.syncedLyrics,
          plainLyrics: data.plainLyrics,
          lyricsMode: data.lyricsMode,
        });
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [enabled, track, fetched?.id]);

  return useMemo(() => {
    if (!track) return null;
    if (fetched && fetched.id === track.id) {
      return {
        ...track,
        lyrics: fetched.lyrics && fetched.lyrics.length > 0 ? fetched.lyrics : track.lyrics,
        syncedLyrics: fetched.syncedLyrics || track.syncedLyrics,
        plainLyrics: fetched.plainLyrics || track.plainLyrics,
        lyricsMode: fetched.lyricsMode || track.lyricsMode,
      } as T;
    }
    return track;
  }, [track, fetched]);
}
