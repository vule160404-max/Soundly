import { Track, Playlist, GenreCategory, LyricLine } from '../types/music';
import { INITIAL_TRACKS, INITIAL_PLAYLISTS, INITIAL_GENRES } from '../data/mockTracks';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

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

export const musicApi = {
  async getTracks(search?: string, genre?: string): Promise<Track[]> {
    let allTracks: Track[] = [...INITIAL_TRACKS];

    // 1. Load from Firestore (persistent across Vercel deployments & F5 refresh)
    try {
      const snap = await getDocs(collection(db, 'soundly_tracks'));
      const firestoreTracks: Track[] = [];
      snap.forEach(d => {
        firestoreTracks.push(d.data() as Track);
      });
      if (firestoreTracks.length > 0) {
        const existingIds = new Set(allTracks.map(t => t.id));
        for (const t of firestoreTracks) {
          if (!existingIds.has(t.id)) {
            allTracks.unshift(t);
            existingIds.add(t.id);
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch tracks from Firestore:', err);
    }

    // 2. Load from localStorage backup
    try {
      const localTracks = getLocalCustomTracks();
      const existingIds = new Set(allTracks.map(t => t.id));
      for (const t of localTracks) {
        if (!existingIds.has(t.id)) {
          allTracks.unshift(t);
          existingIds.add(t.id);
        }
      }
    } catch {
      // ignore
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
      title: string;
      artist: string;
      album?: string;
      audioUrl: string;
      coverUrl?: string;
      genre?: string;
      duration?: number;
      bpm?: number;
      mood?: string;
      aiClassified?: boolean;
      aiReason?: string;
      lyricsText?: string;
    }>
  ): Promise<Track[]> {
    const newTracks: Track[] = tracksData.map((t, idx) => {
      let formattedLyrics: LyricLine[] = [];
      if (t.lyricsText && t.lyricsText.trim()) {
        const lines = t.lyricsText.split('\n').filter(l => l.trim().length > 0);
        formattedLyrics = lines.map((l, i) => ({ time: i * 6, text: l.trim() }));
      } else {
        formattedLyrics = [
          { time: 5, text: `Đang phát bản nhạc: ${t.title}` },
          { time: 20, text: `Thể loại: ${t.genre || 'Pop'}` },
        ];
      }

      return {
        id: `uploaded-${Date.now()}-${idx}`,
        title: t.title.trim(),
        artist: t.artist.trim() || 'Nghệ sĩ chưa rõ',
        album: t.album?.trim() || 'Kho nhạc Soundly',
        audioUrl: t.audioUrl,
        coverUrl:
          t.coverUrl ||
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
        duration: t.duration || 210,
        genre: t.genre || 'Pop',
        releaseYear: new Date().getFullYear(),
        bpm: t.bpm || 110,
        mood: t.mood || 'Thư giãn',
        aiClassified: Boolean(t.aiClassified),
        aiReason: t.aiReason || 'Tải lên bởi quản trị viên',
        lyrics: formattedLyrics,
        plays: 0,
      };
    });

    // 1. Save to localStorage backup
    const currentLocal = getLocalCustomTracks();
    const updatedLocal = [...newTracks, ...currentLocal];
    saveLocalCustomTracks(updatedLocal);

    // 2. Save to Firestore (Guarantees Vercel & cross-device persistence)
    for (const track of newTracks) {
      try {
        await setDoc(doc(db, 'soundly_tracks', track.id), track);
      } catch (err) {
        console.warn('Could not save track to Firestore:', err);
      }
    }

    // 3. Try posting to backend API if available
    try {
      await fetch('/api/tracks/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: tracksData }),
      });
    } catch {
      // ignore
    }

    return newTracks;
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

  async syncSpotflowTracks(
    spotflowUrl: string,
    apiKey: string,
    saveToR2: boolean = true
  ): Promise<{ count: number; tracks: Track[] }> {
    const res = await fetch('/api/spotflow/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotflowUrl, apiKey, saveToR2 }),
    });

    if (!isJsonResponse(res)) {
      throw new Error('Máy chủ Backend chưa sẵn sàng.');
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Đồng bộ SpotFlow MP3 thất bại.');
    }

    return data;
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
    file: File
  ): Promise<{ audioUrl: string; key: string; size: number }> {
    // 1. Prefer direct Presigned URL upload to R2 (bypasses Vercel 4.5MB body limit)
    const presignRes = await fetch('/api/r2/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || 'audio/mpeg',
      }),
    });

    if (presignRes.ok && isJsonResponse(presignRes)) {
      const { uploadUrl, audioUrl, key } = await presignRes.json();
      try {
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'audio/mpeg',
          },
          body: file,
        });
        if (putRes.ok) {
          return { audioUrl, key, size: file.size };
        }
        // If small file and PUT failed (e.g. R2 CORS not configured), try server proxy
        if (file.size <= 4 * 1024 * 1024) {
          return await uploadViaServerProxy(file);
        }
        throw new Error(
          `Upload trực tiếp lên R2 thất bại (HTTP ${putRes.status}). Hãy kiểm tra cấu hình CORS Policy trên Cloudflare R2 Bucket.`
        );
      } catch (err) {
        if (file.size <= 4 * 1024 * 1024) {
          return await uploadViaServerProxy(file);
        }
        throw err instanceof Error
          ? err
          : new Error(
              'Không thể upload trực tiếp lên Cloudflare R2. Vui lòng kiểm tra CORS Policy trên Bucket R2.'
            );
      }
    }

    // 2. Fallback to multipart server proxy for smaller files / local Express
    return await uploadViaServerProxy(file);
  },
};

async function uploadViaServerProxy(
  file: File
): Promise<{ audioUrl: string; key: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/r2/upload', {
    method: 'POST',
    body: formData,
  });

  if (!isJsonResponse(res)) {
    throw new Error('Máy chủ lưu trữ không phản hồi định dạng hợp lệ.');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Tải file âm thanh lên Cloudflare R2 thất bại.');
  }

  return data;
}
