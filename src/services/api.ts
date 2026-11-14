import { Track, Playlist, GenreCategory, LyricLine } from '../types/music';
import { INITIAL_TRACKS, INITIAL_PLAYLISTS, INITIAL_GENRES } from '../data/mockTracks';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import {
  areTracksDuplicate,
  deduplicateTracksList,
  healTrackVietnameseDisplay,
  mergeDuplicateTrackPair,
} from '../utils/trackDedupe';

export interface AIClassifyInput {
  id: string;
  title: string;
  artist?: string;
  fileName?: string;
  album?: string;
  duration?: number;
}

export interface AIClassifyResult {
  id: string;
  genre: string;
  mood: string;
  bpm: number;
  suggestedTitle: string;
  suggestedArtist: string;
  reason: string;
}

export interface SpotifyParsedTrackItem {
  spotifyTrackId: string;
  spotifyUrl: string;
  title: string;
  artist: string;
  duration: number;
  previewUrl?: string;
}

export interface SpotifyParsedCollection {
  spotifyId: string;
  spotifyType: 'album' | 'playlist' | 'track';
  spotifyUrl: string;
  title: string;
  artist: string;
  coverUrl: string;
  releaseYear?: number;
  tracks: SpotifyParsedTrackItem[];
}

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json');
}

const LOCAL_STORAGE_KEY = 'soundly_custom_tracks_v1';

function getLocalCustomTracks(): Track[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCustomTracks(tracks: Track[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tracks));
  } catch {
    // ignore
  }
}

const LOCAL_PLAYS_KEY = 'soundly_track_plays_v1';

function getLocalPlayCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LOCAL_PLAYS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveLocalPlayCounts(counts: Record<string, number>) {
  try {
    localStorage.setItem(LOCAL_PLAYS_KEY, JSON.stringify(counts));
  } catch {
    // ignore
  }
}

function setLocalPlayCount(trackId: string, plays: number) {
  const counts = getLocalPlayCounts();
  const prev = Number(counts[trackId]) || 0;
  if (plays > prev) {
    counts[trackId] = plays;
    saveLocalPlayCounts(counts);
  }
}

const ALLOWED_FIRESTORE_TRACK_KEYS: Array<keyof Track> = [
  'id',
  'title',
  'artist',
  'album',
  'coverUrl',
  'audioUrl',
  'duration',
  'genre',
  'releaseYear',
  'lyrics',
  'bpm',
  'mood',
  'plays',
  'aiClassified',
  'aiReason',
  'spotifyTrackId',
  'spotifyUrl',
  'r2AudioKey',
  'r2CoverKey',
  'syncedLyrics',
  'plainLyrics',
  'lyricsMode',
];

function sanitizeTrackForFirestore(track: Track): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: String(track.id || `track-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128),
    title: String(track.title || 'Bài hát không tên').slice(0, 300),
    artist: String(track.artist || 'Nghệ sĩ chưa rõ').slice(0, 300),
    audioUrl: String(track.audioUrl || '').slice(0, 2000),
    genre: String(track.genre || 'Pop').slice(0, 100),
  };

  if (track.album !== undefined) out.album = String(track.album).slice(0, 300);
  if (track.coverUrl !== undefined) out.coverUrl = String(track.coverUrl).slice(0, 2000);
  if (typeof track.duration === 'number' && Number.isFinite(track.duration)) {
    out.duration = Math.max(0, Math.round(track.duration));
  }
  if (typeof track.releaseYear === 'number' && Number.isFinite(track.releaseYear)) {
    out.releaseYear = track.releaseYear;
  }
  if (Array.isArray(track.lyrics)) {
    out.lyrics = track.lyrics.slice(0, 500).map(l => ({
      time: Number.isFinite(l.time) ? l.time : 0,
      text: String(l.text || '').slice(0, 500),
    }));
  }
  if (typeof track.bpm === 'number' && Number.isFinite(track.bpm)) out.bpm = track.bpm;
  if (track.mood !== undefined) out.mood = String(track.mood).slice(0, 150);
  if (typeof track.plays === 'number' && Number.isFinite(track.plays)) out.plays = track.plays;
  if (typeof track.aiClassified === 'boolean') out.aiClassified = track.aiClassified;
  if (track.aiReason !== undefined) out.aiReason = String(track.aiReason).slice(0, 500);
  if (track.spotifyTrackId) out.spotifyTrackId = String(track.spotifyTrackId).slice(0, 128);
  if (track.spotifyUrl) out.spotifyUrl = String(track.spotifyUrl).slice(0, 500);
  if (track.r2AudioKey) out.r2AudioKey = String(track.r2AudioKey).slice(0, 500);
  if (track.r2CoverKey) out.r2CoverKey = String(track.r2CoverKey).slice(0, 500);
  if (track.syncedLyrics) out.syncedLyrics = String(track.syncedLyrics).slice(0, 50000);
  if (track.plainLyrics) out.plainLyrics = String(track.plainLyrics).slice(0, 50000);
  if (track.lyricsMode === 'synced' || track.lyricsMode === 'plain' || track.lyricsMode === 'none') {
    out.lyricsMode = track.lyricsMode;
  }

  for (const key of Object.keys(out)) {
    if (!ALLOWED_FIRESTORE_TRACK_KEYS.includes(key as keyof Track)) {
      delete out[key];
    }
  }
  return out;
}

function inferAudioContentType(file: File): string {
  if (file.type && file.type.startsWith('audio/')) {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.opus')) return 'audio/opus';
  return 'audio/mpeg';
}

function normalizePlayableUrl(url?: string): string {
  if (!url) return '';
  if (url.includes('.r2.cloudflarestorage.com/')) {
    try {
      const key = new URL(url).pathname.replace(/^\/+/, '');
      if (key.startsWith('tracks/') || key.startsWith('covers/')) {
        return `/api/r2/stream?key=${encodeURIComponent(key)}`;
      }
    } catch {
      return url;
    }
  }
  return url;
}

function normalizeTrackCover(url?: string): string {
  if (!url || url.includes('photo-1511671782779-c97d3d27a1d4')) {
    return '/assets/aistudio/soundly-default-cover.svg';
  }
  return normalizePlayableUrl(url);
}

export const musicApi = {
  async getTracks(search?: string, genre?: string): Promise<Track[]> {
    let allTracks: Track[] = [...INITIAL_TRACKS];

    const mergeTracks = (incoming: Track[]) => {
      for (const rawTrack of incoming) {
        if (!rawTrack || !rawTrack.id) continue;
        const t = healTrackVietnameseDisplay({
          ...rawTrack,
          audioUrl: normalizePlayableUrl(rawTrack.audioUrl),
          coverUrl: normalizeTrackCover(rawTrack.coverUrl),
        });
        const existingIdx = allTracks.findIndex(existing =>
          areTracksDuplicate(existing, t)
        );
        if (existingIdx !== -1) {
          allTracks[existingIdx] = mergeDuplicateTrackPair(allTracks[existingIdx], t);
          continue;
        }
        allTracks.unshift(t);
      }
    };

    // 1. Load from localStorage backup + INITIAL_TRACKS instantly (no waiting)
    const localTracks = getLocalCustomTracks();
    if (localTracks.length > 0) {
      mergeTracks(localTracks);
    }

    // 2. Fetch from Firestore & R2 API in the background so app loads instantly, then updates state smoothly
    if (typeof window !== 'undefined') {
      Promise.all([
        getDocs(collection(db, 'soundly_tracks')).catch(() => null),
        fetch('/api/tracks').then(res => (res.ok && isJsonResponse(res) ? res.json() : null)).catch(() => null),
      ]).then(([fsSnap, apiTracks]) => {
        let hasNew = false;
        const freshMap = new Map<string, Track>();
        for (const t of allTracks) freshMap.set(t.id, t);

        if (fsSnap) {
          fsSnap.forEach(d => {
            const data = d.data() as Track;
            if (data && data.id && !freshMap.has(data.id)) {
              freshMap.set(data.id, healTrackVietnameseDisplay({
                ...data,
                audioUrl: normalizePlayableUrl(data.audioUrl),
                coverUrl: normalizeTrackCover(data.coverUrl),
              }));
              hasNew = true;
            }
          });
        }

        if (Array.isArray(apiTracks)) {
          for (const t of apiTracks) {
            if (t && t.id && !freshMap.has(t.id)) {
              freshMap.set(t.id, healTrackVietnameseDisplay({
                ...t,
                audioUrl: normalizePlayableUrl(t.audioUrl),
                coverUrl: normalizeTrackCover(t.coverUrl),
              }));
              hasNew = true;
            }
          }
        }

        if (hasNew) {
          window.dispatchEvent(
            new CustomEvent('soundly:catalog-refreshed', {
              detail: { tracks: Array.from(freshMap.values()) },
            })
          );
        }
      }).catch(() => {});
    }

    // Final deduplication pass & merge locally persisted play counts
    const { deduped } = deduplicateTracksList(allTracks);
    const localPlays = getLocalPlayCounts();
    allTracks = deduped.map(t => ({
      ...t,
      plays: Math.max(Number(t.plays) || 0, Number(localPlays[t.id]) || 0),
    }));

    // Keep localStorage synced when custom tracks are updated
    const customOnly = allTracks.filter(
      t => !INITIAL_TRACKS.some(it => it.id === t.id)
    );
    if (customOnly.length > 0) {
      saveLocalCustomTracks(customOnly);
    }

    // Filter by genre
    let results = allTracks;
    if (genre && genre !== 'all') {
      results = results.filter(t => t.genre.toLowerCase() === genre.toLowerCase());
    }

    // Filter by search query
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      results = results.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q)
      );
    }

    return results;
  },

  async getTrackById(id: string): Promise<Track | null> {
    const all = await this.getTracks();
    return all.find(t => t.id === id) || null;
  },

  async getGenres(): Promise<GenreCategory[]> {
    try {
      const allTracks = await this.getTracks();
      return INITIAL_GENRES.map(g => ({
        ...g,
        trackCount: allTracks.filter(t => t.genre.toLowerCase() === g.name.toLowerCase()).length,
      }));
    } catch {
      return INITIAL_GENRES;
    }
  },

  async getPlaylists(): Promise<Playlist[]> {
    return INITIAL_PLAYLISTS;
  },

  async getLyrics(trackId: string): Promise<LyricLine[]> {
    const track = await this.getTrackById(trackId);
    return track?.lyrics || [];
  },

  async classifyTracksWithAI(items: AIClassifyInput[]): Promise<AIClassifyResult[]> {
    try {
      const res = await fetch('/api/ai/classify-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: items }),
      });

      if (res.ok && isJsonResponse(res)) {
        const data = await res.json();
        if (data.classifications) return data.classifications;
      }
    } catch {
      // fallback
    }

    // Client-side smart fallback classifier
    return items.map(item => {
      const raw = item.fileName || item.title || 'Bài hát';
      const clean = raw.replace(/\.[^/.]+$/, '');
      let artist = item.artist && item.artist !== 'Chờ AI nhận diện...' ? item.artist : 'Nghệ sĩ chưa rõ';
      let title = clean;

      if (clean.includes('-')) {
        const parts = clean.split('-');
        if (parts.length >= 2) {
          artist = parts[0].replace(/^[0-9.\s]+/, '').trim() || artist;
          title = parts.slice(1).join('-').trim() || clean;
        }
      }

      const lower = (title + ' ' + artist).toLowerCase();
      let genre = 'Pop';
      if (lower.includes('rap') || lower.includes('hiphop')) genre = 'Hip-Hop';
      else if (lower.includes('lofi') || lower.includes('chill')) genre = 'Lo-Fi';
      else if (lower.includes('acoustic')) genre = 'Acoustic';
      else if (lower.includes('rock')) genre = 'Rock';
      else if (lower.includes('edm') || lower.includes('remix')) genre = 'Dance / Electronic';
      else if (lower.includes('r&b') || lower.includes('soul')) genre = 'R&B';

      return {
        id: item.id,
        genre,
        mood: 'Thư giãn & Dễ chịu',
        bpm: 110,
        suggestedTitle: title,
        suggestedArtist: artist,
        reason: 'Phân loại tự động thông minh Soundly AI.',
      };
    });
  },

  async addBatchTracks(
    tracksData: Array<{
      id?: string;
      title: string;
      artist: string;
      album?: string;
      audioUrl: string;
      coverUrl?: string;
      genre?: string;
      duration?: number;
      bpm?: number;
      mood?: string;
      plays?: number;
      aiClassified?: boolean;
      aiReason?: string;
      lyricsText?: string;
      lyrics?: LyricLine[];
      syncedLyrics?: string;
      plainLyrics?: string;
      lyricsMode?: 'synced' | 'plain' | 'none';
      spotifyTrackId?: string;
      spotifyUrl?: string;
      r2AudioKey?: string;
      r2CoverKey?: string;
    }>
  ): Promise<Track[]> {
    const newTracks: Track[] = tracksData.map((t, idx) => {
      let formattedLyrics: LyricLine[] = [];
      if (t.lyricsText && t.lyricsText.trim()) {
        const lines = t.lyricsText.split('\n').filter(l => l.trim().length > 0);
        formattedLyrics = lines.map((l, i) => ({ time: i * 6, text: l.trim() }));
      } else if (Array.isArray(t.lyrics) && t.lyrics.length > 0) {
        formattedLyrics = t.lyrics;
      } else {
        formattedLyrics = [
          { time: 5, text: `Đang phát bản nhạc: ${t.title}` },
          { time: 20, text: `Thể loại: ${t.genre || 'Pop'}` },
        ];
      }

      return {
        id: t.id || `uploaded-${Date.now()}-${idx}`,
        title: t.title.trim(),
        artist: t.artist.trim() || 'Nghệ sĩ chưa rõ',
        album: t.album?.trim() || 'Kho nhạc Soundly',
        audioUrl: t.audioUrl,
        coverUrl:
          t.coverUrl ||
          '/assets/aistudio/soundly-default-cover.svg',
        duration: t.duration || 210,
        genre: t.genre || 'Pop',
        releaseYear: new Date().getFullYear(),
        bpm: t.bpm || 110,
        mood: t.mood || 'Thư giãn',
        aiClassified: Boolean(t.aiClassified),
        aiReason: t.aiReason || 'Tải lên bởi quản trị viên',
        lyrics: formattedLyrics,
        plays: typeof t.plays === 'number' ? t.plays : 0,
        ...(t.syncedLyrics ? { syncedLyrics: t.syncedLyrics } : {}),
        ...(t.plainLyrics ? { plainLyrics: t.plainLyrics } : {}),
        ...(t.lyricsMode ? { lyricsMode: t.lyricsMode } : {}),
        ...(t.spotifyTrackId ? { spotifyTrackId: t.spotifyTrackId } : {}),
        ...(t.spotifyUrl ? { spotifyUrl: t.spotifyUrl } : {}),
        ...(t.r2AudioKey ? { r2AudioKey: t.r2AudioKey } : {}),
        ...(t.r2CoverKey ? { r2CoverKey: t.r2CoverKey } : {}),
      };
    });

    // 1. Save to localStorage backup (deduplicated)
    const currentLocal = getLocalCustomTracks();
    const { deduped: updatedLocal } = deduplicateTracksList([...newTracks, ...currentLocal]);
    saveLocalCustomTracks(updatedLocal);

    // 2. Save to Firestore (Guarantees Vercel & cross-device persistence)
    for (const track of newTracks) {
      if (!track.audioUrl || !track.audioUrl.trim()) continue;
      try {
        await setDoc(doc(db, 'soundly_tracks', track.id), sanitizeTrackForFirestore(track));
      } catch (err) {
        console.warn('Could not save track to Firestore:', err);
      }
    }

    // 3. Persist metadata to Cloudflare R2 catalog via /api/tracks/batch
    try {
      await fetch('/api/tracks/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: newTracks }),
      });
    } catch {
      // ignore
    }

    return newTracks;
  },

  async parseSpotifyAlbumUrl(url: string): Promise<SpotifyParsedCollection> {
    const res = await fetch('/api/tracks/spotify-album', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
    });

    if (!isJsonResponse(res)) {
      throw new Error(`Máy chủ chưa sẵn sàng phản hồi (HTTP ${res.status}).`);
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data.error || 'Không thể đọc thông tin Album/Playlist từ đường dẫn Spotify này.'
      );
    }

    return data as SpotifyParsedCollection;
  },

  async updateTrack(id: string, updates: Partial<Track>): Promise<Track | null> {
    try {
      const docRef = doc(db, 'soundly_tracks', id);
      await updateDoc(docRef, updates as { [x: string]: any });
    } catch (err) {
      console.warn('Could not update track in Firestore:', err);
    }

    const local = getLocalCustomTracks();
    const updatedLocal = local.map(t => (t.id === id ? { ...t, ...updates } : t));
    saveLocalCustomTracks(updatedLocal);

    try {
      await fetch(`/api/tracks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch {
      // ignore
    }

    return null;
  },

  async deleteTrack(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'soundly_tracks', id));
    } catch (err) {
      console.warn('Could not delete track from Firestore:', err);
    }

    const local = getLocalCustomTracks();
    const updatedLocal = local.filter(t => t.id !== id);
    saveLocalCustomTracks(updatedLocal);

    try {
      await fetch(`/api/tracks/${id}`, {
        method: 'DELETE',
      });
    } catch {
      // ignore
    }

    return true;
  },

  async recordTrackPlay(trackId: string, currentKnownPlays: number = 0): Promise<number> {
    const counts = getLocalPlayCounts();
    const basePlays = Math.max(
      Number(counts[trackId]) || 0,
      Number(currentKnownPlays) || 0
    );
    const optimisticNext = basePlays + 1;
    setLocalPlayCount(trackId, optimisticNext);

    const local = getLocalCustomTracks();
    if (local.some(t => t.id === trackId)) {
      saveLocalCustomTracks(
        local.map(t =>
          t.id === trackId
            ? { ...t, plays: Math.max(Number(t.plays) || 0, optimisticNext) }
            : t
        )
      );
    }

    try {
      const res = await fetch('/api/tracks/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId }),
        keepalive: true,
      });
      if (res.ok && isJsonResponse(res)) {
        const data = await res.json();
        const serverPlays = typeof data.plays === 'number' ? data.plays : 0;
        const resolved = Math.max(optimisticNext, serverPlays);
        setLocalPlayCount(trackId, resolved);
        return resolved;
      }
    } catch {
      // keep optimistic local count if offline
    }

    return optimisticNext;
  },

  async syncSpotflowTracks(
    spotflowUrl: string,
    apiKey: string,
    saveToR2: boolean = true,
    existingTracks: Track[] = []
  ): Promise<{
    count: number;
    addedCount: number;
    updatedCount: number;
    skippedCount: number;
    failedAudioCount: number;
    failedAudioMessages: string[];
    addedTracks: Track[];
    updatedTracks: Track[];
    tracks: Track[];
  }> {
    const existingHints = existingTracks
      .filter(t => t && t.id && !INITIAL_TRACKS.some(it => it.id === t.id))
      .map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        coverUrl: t.coverUrl,
        audioUrl: t.audioUrl,
        duration: t.duration,
        genre: t.genre,
        releaseYear: t.releaseYear,
        bpm: t.bpm,
        mood: t.mood,
        plays: t.plays,
        aiClassified: t.aiClassified,
        aiReason: t.aiReason,
        spotifyTrackId: t.spotifyTrackId,
        spotifyUrl: t.spotifyUrl,
        syncedLyrics: t.syncedLyrics,
        plainLyrics: t.plainLyrics,
        lyricsMode: t.lyricsMode,
        lyrics: t.lyrics,
      }));

    const res = await fetch('/api/spotflow/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spotflowUrl,
        apiKey,
        saveToR2,
        existingTracks: existingHints,
      }),
    });

    if (!isJsonResponse(res)) {
      throw new Error(`Máy chủ Backend chưa sẵn sàng (HTTP ${res.status}).`);
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Đồng bộ SpotFlow MP3 thất bại.');
    }

    const addedTracks: Track[] = Array.isArray(data.addedTracks)
      ? data.addedTracks
      : Array.isArray(data.tracks)
        ? data.tracks
        : [];
    const updatedTracks: Track[] = Array.isArray(data.updatedTracks)
      ? data.updatedTracks
      : [];
    const changedTracks = [...addedTracks, ...updatedTracks];

    if (changedTracks.length > 0) {
      const currentLocal = getLocalCustomTracks();
      const changedById = new Map(changedTracks.map(t => [t.id, t]));
      const updatedLocal = currentLocal.map(t => changedById.get(t.id) || t);
      const localIds = new Set(currentLocal.map(t => t.id));
      const newLocal = addedTracks.filter(t => !localIds.has(t.id));
      saveLocalCustomTracks([...newLocal, ...updatedLocal]);

      for (const track of changedTracks) {
        try {
          await setDoc(doc(db, 'soundly_tracks', track.id), sanitizeTrackForFirestore(track));
        } catch (err) {
          console.warn('Could not save synced SpotFlow track to Firestore:', err);
        }
      }
    }

    return {
      count: typeof data.addedCount === 'number' ? data.addedCount : addedTracks.length,
      addedCount: typeof data.addedCount === 'number' ? data.addedCount : addedTracks.length,
      updatedCount: typeof data.updatedCount === 'number' ? data.updatedCount : updatedTracks.length,
      skippedCount: typeof data.skippedCount === 'number' ? data.skippedCount : 0,
      failedAudioCount: typeof data.failedAudioCount === 'number' ? data.failedAudioCount : 0,
      failedAudioMessages: Array.isArray(data.failedAudioMessages) ? data.failedAudioMessages : [],
      addedTracks,
      updatedTracks,
      tracks: Array.isArray(data.tracks) ? data.tracks : changedTracks,
    };
  },

  async enrichTrackWithSpotflow(params: {
    fileName?: string;
    title?: string;
    artist?: string;
    apiKey?: string;
  }): Promise<{
    title?: string;
    artist?: string;
    album?: string;
    duration?: number;
    coverUrl?: string;
    r2CoverKey?: string;
    syncedLyrics?: string;
    plainLyrics?: string;
    lyrics?: LyricLine[];
    lyricsMode?: 'synced' | 'plain' | 'none';
  } | null> {
    try {
      const res = await fetch('/api/spotflow/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enrich',
          fileName: params.fileName,
          title: params.title,
          artist: params.artist,
          apiKey: params.apiKey,
        }),
      });
      if (!res.ok || !isJsonResponse(res)) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async getR2Status(): Promise<{
    isConfigured: boolean;
    accountId: string;
    bucketName: string;
    publicDomain: string;
    missingVars?: string[];
    serverError?: string;
  }> {
    try {
      const res = await fetch('/api/r2/status');
      if (!res.ok) {
        return {
          isConfigured: false,
          accountId: '',
          bucketName: '',
          publicDomain: '',
          serverError: `API /api/r2/status trả về lỗi HTTP ${res.status}`,
        };
      }
      if (!isJsonResponse(res)) {
        return {
          isConfigured: false,
          accountId: '',
          bucketName: '',
          publicDomain: '',
          serverError: 'API /api/r2/status không trả về JSON hợp lệ',
        };
      }
      return await res.json();
    } catch (err) {
      return {
        isConfigured: false,
        accountId: '',
        bucketName: '',
        publicDomain: '',
        serverError: err instanceof Error ? err.message : 'Lỗi kết nối tới API server',
      };
    }
  },

  async testR2Connection(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/r2/test', {
      method: 'POST',
    });
    if (!isJsonResponse(res)) {
      throw new Error('Máy chủ Backend chưa sẵn sàng.');
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Kiểm tra kết nối thất bại.');
    }
    return data;
  },

  async uploadAudioToR2(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<{ audioUrl: string; key: string; size: number }> {
    const contentType = inferAudioContentType(file);
    onProgress?.(5);

    // 1. Try direct Presigned URL PUT to R2 (fastest when R2 Bucket CORS allows PUT)
    try {
      const presignRes = await fetch('/api/r2/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType,
        }),
      });

      if (presignRes.ok && isJsonResponse(presignRes)) {
        const { uploadUrl, audioUrl, key } = await presignRes.json();
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
          },
          body: file,
        });
        if (putRes.ok) {
          onProgress?.(100);
          return { audioUrl, key, size: file.size };
        }
      } else if (!presignRes.ok && isJsonResponse(presignRes)) {
        const errData = await presignRes.json().catch(() => ({}));
        if (presignRes.status === 400 && errData.error) {
          throw new Error(errData.error);
        }
      }
    } catch (err) {
      // If R2 env config is missing on server, surface that immediately
      if (
        err instanceof Error &&
        err.message.includes('Cloudflare R2 chưa được cấu hình')
      ) {
        throw err;
      }
      // Otherwise (e.g. R2 bucket CORS blocks cross-origin PUT -> TypeError: Failed to fetch),
      // transparently fall back to Soundly's same-origin server relay below.
      console.warn(
        '[Upload] Direct R2 PUT unavailable, falling back to server relay:',
        err
      );
    }

    // 2. Same-origin server relay fallback (bypasses R2 bucket CORS completely)
    if (file.size <= 3.5 * 1024 * 1024) {
      const res = await uploadViaServerProxy(file);
      onProgress?.(100);
      return res;
    }

    // 3. Chunked server relay for files > 3.5MB (2MB chunks stay safely under Vercel 4.5MB limit)
    return await uploadChunkedViaServerProxy(file, contentType, onProgress);
  },
};

function formatUploadNetworkError(err: unknown, fallbackMessage: string): Error {
  if (err instanceof Error) {
    const msg = err.message || '';
    if (
      msg === 'Failed to fetch' ||
      msg.includes('NetworkError') ||
      msg.includes('Load failed')
    ) {
      return new Error(
        'Không thể kết nối tới máy chủ Soundly để tải file nhạc lên. Vui lòng kiểm tra kết nối mạng hoặc thử lại.'
      );
    }
    return err;
  }
  return new Error(fallbackMessage);
}

async function uploadViaServerProxy(
  file: File
): Promise<{ audioUrl: string; key: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);

  let res: Response;
  try {
    res = await fetch('/api/r2/upload', {
      method: 'POST',
      body: formData,
    });
  } catch (err) {
    throw formatUploadNetworkError(err, 'Tải file âm thanh lên Cloudflare R2 thất bại.');
  }

  if (!isJsonResponse(res)) {
    throw new Error('Máy chủ lưu trữ không phản hồi định dạng hợp lệ.');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Tải file âm thanh lên Cloudflare R2 thất bại.');
  }

  return data;
}

async function uploadChunkedViaServerProxy(
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<{ audioUrl: string; key: string; size: number }> {
  const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB per chunk stays well under Vercel 4.5MB payload cap
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `up-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const chunkBuffer = await file.slice(start, end).arrayBuffer();

    let lastErr: unknown = null;
    let uploadedChunk = false;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(
          `/api/r2/upload-chunk?uploadId=${encodeURIComponent(uploadId)}&chunkIndex=${chunkIndex}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
            },
            body: chunkBuffer,
          }
        );

        if (!isJsonResponse(res)) {
          throw new Error(
            `Máy chủ lưu trữ không phản hồi định dạng hợp lệ (HTTP ${res.status}).`
          );
        }

        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error || `Lỗi tải phần ${chunkIndex + 1}/${totalChunks} lên R2.`
          );
        }

        uploadedChunk = true;
        break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!uploadedChunk) {
      throw formatUploadNetworkError(
        lastErr,
        `Tải phần ${chunkIndex + 1}/${totalChunks} lên Cloudflare R2 thất bại.`
      );
    }

    const pct = Math.min(92, Math.round(((chunkIndex + 1) / totalChunks) * 90));
    onProgress?.(pct);
  }

  onProgress?.(95);

  let completeRes: Response;
  try {
    completeRes = await fetch('/api/r2/complete-chunked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        totalChunks,
        fileName: file.name,
        contentType,
      }),
    });
  } catch (err) {
    throw formatUploadNetworkError(
      err,
      'Không thể ghép các phần tệp âm thanh trên Cloudflare R2.'
    );
  }

  if (!isJsonResponse(completeRes)) {
    throw new Error('Máy chủ không phản hồi định dạng hợp lệ khi hoàn tất tải lên.');
  }

  const completeData = await completeRes.json();
  if (!completeRes.ok) {
    throw new Error(
      completeData.error || 'Không thể hoàn tất tải tệp lên Cloudflare R2.'
    );
  }

  onProgress?.(100);
  return completeData;
}
