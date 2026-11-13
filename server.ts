import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  INITIAL_TRACKS,
  INITIAL_PLAYLISTS,
  INITIAL_GENRES,
  SPOTIFY_GENRE_NAMES,
} from './src/data/mockTracks';
import { Track, Playlist, LyricLine } from './src/types/music';
import multer from 'multer';
import {
  loadR2Config,
  isR2Configured,
  getMissingR2EnvVars,
  testR2Connection,
  createR2PresignedUploadUrl,
  uploadBufferToR2,
  uploadRemoteUrlToR2,
  deleteObjectFromR2,
} from './server-r2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADED_TRACKS_FILE = path.join(__dirname, 'saved_uploaded_tracks.json');

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ClassifyInputTrack {
  id: string;
  title: string;
  artist?: string;
  fileName?: string;
  album?: string;
  duration?: number;
}

interface ClassifiedTrackResult {
  id: string;
  genre: string;
  mood: string;
  bpm: number;
  suggestedTitle: string;
  suggestedArtist: string;
  reason: string;
}

function fallbackClassify(items: ClassifyInputTrack[]): ClassifiedTrackResult[] {
  return items.map(item => {
    const rawName = item.fileName || item.title || 'Bài hát không tên';
    const clean = rawName.replace(/\.[^/.]+$/, '');
    let artist = item.artist && item.artist !== 'Chờ AI nhận diện...' ? item.artist : 'Nghệ sĩ chưa rõ';
    let title = clean;

    if (clean.includes('-')) {
      const parts = clean.split('-');
      if (parts.length >= 2) {
        const potentialArtist = parts[0].replace(/^[0-9.\s]+/, '').trim();
        const potentialTitle = parts.slice(1).join('-').trim();
        if (potentialArtist) artist = potentialArtist;
        if (potentialTitle) title = potentialTitle;
      }
    }

    const lower = (title + ' ' + artist).toLowerCase();
    let genre = 'Pop';
    if (lower.includes('rap') || lower.includes('hiphop') || lower.includes('trap')) genre = 'Hip-Hop';
    else if (lower.includes('lofi') || lower.includes('chill') || lower.includes('sleep')) genre = 'Lo-Fi';
    else if (lower.includes('acoustic') || lower.includes('guitar')) genre = 'Acoustic';
    else if (lower.includes('rock') || lower.includes('metal')) genre = 'Rock';
    else if (lower.includes('edm') || lower.includes('remix') || lower.includes('dance') || lower.includes('house')) genre = 'Dance / Electronic';
    else if (lower.includes('r&b') || lower.includes('soul') || lower.includes('rnb')) genre = 'R&B';
    else if (lower.includes('jazz')) genre = 'Jazz';
    else if (lower.includes('classical') || lower.includes('piano')) genre = 'Classical';
    else if (lower.includes('indie') || lower.includes('folk')) genre = 'Indie';

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
}

async function classifyBatchWithGemini(
  items: ClassifyInputTrack[]
): Promise<ClassifiedTrackResult[]> {
  const ai = getGeminiClient();
  if (!ai) {
    return fallbackClassify(items);
  }

  try {
    const allowedGenresList = SPOTIFY_GENRE_NAMES.join(', ');

    const prompt = `Bạn là chuyên gia phân loại âm nhạc (Music Curator AI).
Hãy phân tích danh sách bài hát bên dưới dựa trên tên tệp (fileName), tiêu đề hiện tại và nghệ sĩ để phân loại chính xác thể loại nhạc và tách chuẩn xác tên tác giả/nghệ sĩ và tên bài hát.
LƯU Ý QUAN TRỌNG:
- Định dạng tên file thường là "Nghệ sĩ - Tên bài hát". Phải tách đúng: suggestedArtist là Nghệ sĩ, suggestedTitle là Tên bài hát (không được nhầm lẫn ngược lại).
- Nếu tên file chỉ có 1 vế, hãy phân tích kỹ để gán đúng nghệ sĩ và tên bài hát.

DANH SÁCH THỂ LOẠI CHUẨN BẮT BUỘC (chỉ chọn 1 trong các giá trị sau cho trường genre):
[${allowedGenresList}]

Yêu cầu cho từng bài hát:
1. "id": Giữ nguyên id gốc của bài hát.
2. "genre": Chọn chính xác 1 thể loại phù hợp nhất trong danh sách ở trên.
3. "suggestedArtist": Tên nghệ sĩ/tác giả (trích xuất chuẩn từ tên file hoặc tiêu đề).
4. "suggestedTitle": Tên bài hát sạch đẹp (loại bỏ tên nghệ sĩ, ký tự rác như [Official MV], (320kbps), .mp3).
5. "mood": Tâm trạng ngắn gọn bằng tiếng Việt (ví dụ: "Sôi động", "Sâu lắng", "Thư giãn", "Lãng mạn").
6. "bpm": Ước lượng nhịp BPM (số nguyên từ 60 đến 180).
7. "reason": Giải thích ngắn gọn 1 câu bằng tiếng Việt lý do chọn thể loại này.

Danh sách bài hát cần phân loại:
${JSON.stringify(items, null, 2)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a precise Spotify music genre classifier and metadata parser. Always return valid JSON matching the schema and strictly pick genres from the provided allowlist.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              genre: { type: Type.STRING },
              mood: { type: Type.STRING },
              bpm: { type: Type.INTEGER },
              suggestedTitle: { type: Type.STRING },
              suggestedArtist: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ['id', 'genre', 'mood', 'bpm', 'suggestedTitle', 'suggestedArtist', 'reason'],
          },
        },
      },
    });

    const rawText = (response.text ?? '[]').trim();
    const parsed = JSON.parse(rawText) as ClassifiedTrackResult[];

    return parsed.map(item => {
      const matchedGenre =
        SPOTIFY_GENRE_NAMES.find(g => g.toLowerCase() === (item.genre || '').toLowerCase()) || 'Pop';
      return {
        ...item,
        genre: matchedGenre,
        bpm: Number.isFinite(item.bpm) ? item.bpm : 110,
        suggestedTitle: item.suggestedTitle || 'Bài hát',
        suggestedArtist: item.suggestedArtist || 'Nghệ sĩ chưa rõ',
      };
    });
  } catch (err) {
    console.warn('Gemini AI classification encountered error, using smart fallback:', err);
    return fallbackClassify(items);
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // Load persisted uploaded tracks from disk
  let uploadedTracks: Track[] = [];
  try {
    if (fs.existsSync(UPLOADED_TRACKS_FILE)) {
      const raw = fs.readFileSync(UPLOADED_TRACKS_FILE, 'utf8');
      uploadedTracks = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not load saved uploaded tracks from disk:', e);
  }

  let tracks: Track[] = [...uploadedTracks, ...INITIAL_TRACKS];
  const playlists: Playlist[] = [...INITIAL_PLAYLISTS];

  function persistTracks() {
    try {
      // Save custom uploaded tracks (exclude initial mock tracks)
      const customTracks = tracks.filter(t => !INITIAL_TRACKS.some(it => it.id === t.id));
      fs.writeFileSync(UPLOADED_TRACKS_FILE, JSON.stringify(customTracks, null, 2), 'utf8');
    } catch (e) {
      console.warn('Could not persist uploaded tracks to disk:', e);
    }
  }

  // API Endpoints
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 60 * 1024 * 1024 }, // 60MB max per audio file
  });

  // GET /api/r2/status - Check Cloudflare R2 connection status
  app.get('/api/r2/status', (_req, res) => {
    const config = loadR2Config();
    const configured = isR2Configured(config);
    const missingVars = getMissingR2EnvVars(config);
    res.json({
      isConfigured: configured,
      accountId: config.accountId ? `${config.accountId.slice(0, 6)}...` : '',
      bucketName: config.bucketName,
      publicDomain: config.publicDomain,
      missingVars,
    });
  });

  // POST /api/r2/config - R2 is configured via environment variables only
  app.post('/api/r2/config', async (_req, res) => {
    const config = loadR2Config();
    if (!isR2Configured(config)) {
      const missing = getMissingR2EnvVars(config);
      return res.status(400).json({
        success: false,
        isConfigured: false,
        error: `Cloudflare R2 được cấu hình qua biến môi trường server. Thiếu: ${missing.join(', ')}.`,
      });
    }
    const testResult = await testR2Connection();
    res.json({
      success: testResult.success,
      message: testResult.message,
      isConfigured: true,
    });
  });

  // POST /api/r2/test - Test Cloudflare R2 connection
  app.post('/api/r2/test', async (_req, res) => {
    const config = loadR2Config();
    if (!isR2Configured(config)) {
      const missing = getMissingR2EnvVars(config);
      return res.status(400).json({
        success: false,
        error: `Cloudflare R2 chưa đủ biến môi trường trên server. Thiếu: ${missing.join(', ')}`,
      });
    }
    const result = await testR2Connection();
    res.status(result.success ? 200 : 500).json(result);
  });

  // POST /api/r2/presign - Generate Presigned PUT URL for direct browser-to-R2 upload
  app.post('/api/r2/presign', async (req, res) => {
    try {
      const { fileName, contentType } = req.body || {};
      const result = await createR2PresignedUploadUrl(
        String(fileName || `track-${Date.now()}.mp3`),
        String(contentType || 'audio/mpeg')
      );
      res.json({ success: true, ...result });
    } catch (err: unknown) {
      console.error('Cloudflare R2 presign error:', err);
      const message = err instanceof Error ? err.message : 'Không thể tạo URL tải lên Cloudflare R2.';
      res.status(500).json({ error: message });
    }
  });

  // POST /api/r2/upload - Direct multipart audio upload to Cloudflare R2
  app.post('/api/r2/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Không tìm thấy tệp âm thanh để tải lên.' });
      }

      const config = loadR2Config();
      if (!isR2Configured(config)) {
        const missing = getMissingR2EnvVars(config);
        return res.status(400).json({
          error: `Cloudflare R2 chưa đủ biến môi trường trên server. Thiếu: ${missing.join(', ')}`,
        });
      }

      const result = await uploadBufferToR2(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype || 'audio/mpeg'
      );

      res.json({
        success: true,
        audioUrl: result.audioUrl,
        key: result.key,
        size: result.size,
      });
    } catch (err: unknown) {
      console.error('Cloudflare R2 upload error:', err);
      const message = err instanceof Error ? err.message : 'Tải tệp lên Cloudflare R2 thất bại.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/tracks', (req, res) => {
    const { q, genre } = req.query;
    let results = [...tracks];

    if (genre && typeof genre === 'string' && genre !== 'all') {
      results = results.filter(t => t.genre.toLowerCase() === genre.toLowerCase());
    }

    if (q && typeof q === 'string' && q.trim()) {
      const query = q.toLowerCase().trim();
      results = results.filter(
        t =>
          t.title.toLowerCase().includes(query) ||
          t.artist.toLowerCase().includes(query) ||
          t.album.toLowerCase().includes(query) ||
          t.genre.toLowerCase().includes(query)
      );
    }

    res.json(results);
  });

  app.get('/api/tracks/:id', (req, res) => {
    const track = tracks.find(t => t.id === req.params.id);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }
    res.json(track);
  });

  app.post('/api/ai/classify-batch', async (req, res) => {
    try {
      const { tracks: inputTracks } = req.body;
      if (!Array.isArray(inputTracks) || inputTracks.length === 0) {
        return res.status(400).json({ error: 'Danh sách bài hát để phân loại không hợp lệ.' });
      }

      const sanitized: ClassifyInputTrack[] = inputTracks.map((t, idx) => ({
        id: String(t.id || `item-${idx}`),
        title: String(t.title || t.fileName || 'Bài hát không tên'),
        artist: t.artist ? String(t.artist) : '',
        fileName: t.fileName ? String(t.fileName) : '',
        album: t.album ? String(t.album) : '',
        duration: typeof t.duration === 'number' ? t.duration : undefined,
      }));

      const classifications = await classifyBatchWithGemini(sanitized);
      res.json({ classifications });
    } catch (err: unknown) {
      console.error('AI Classification error:', err);
      const message = err instanceof Error ? err.message : 'Lỗi khi gọi AI phân loại nhạc.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/tracks/batch', async (req, res) => {
    const { tracks: incomingTracks } = req.body;
    if (!Array.isArray(incomingTracks) || incomingTracks.length === 0) {
      return res.status(400).json({ error: 'Tracks array is required' });
    }

    const addedTracks: Track[] = incomingTracks.map((item, index) => {
      // Parse custom lyrics if provided as text string or array
      let formattedLyrics: LyricLine[] = [];
      if (typeof item.lyricsText === 'string' && item.lyricsText.trim()) {
        const lines = item.lyricsText.split('\n').filter((l: string) => l.trim().length > 0);
        formattedLyrics = lines.map((line: string, lIdx: number) => ({
          time: lIdx * 6,
          text: line.trim(),
        }));
      } else if (Array.isArray(item.lyrics) && item.lyrics.length > 0) {
        formattedLyrics = item.lyrics;
      } else {
        formattedLyrics = [
          { time: 5, text: `Đang phát bản nhạc: ${item.title || 'Bài hát'}` },
          { time: 20, text: `Thể loại: ${item.genre || 'Pop'}` },
        ];
      }

      const newTrack: Track = {
        id: item.id || `uploaded-${Date.now()}-${index}`,
        title: (item.title || 'Bài hát không tên').trim(),
        artist: (item.artist || 'Nghệ sĩ chưa rõ').trim(),
        album: (item.album || 'Kho nhạc Soundly').trim(),
        audioUrl: item.audioUrl,
        coverUrl:
          item.coverUrl ||
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
        duration: item.duration || 210,
        genre: item.genre || 'Pop',
        releaseYear: new Date().getFullYear(),
        bpm: item.bpm || 110,
        mood: item.mood || 'Thư giãn',
        aiClassified: Boolean(item.aiClassified),
        aiReason: item.aiReason || 'Tải lên bởi quản trị viên',
        lyrics: formattedLyrics,
        plays: 0,
      };
      return newTrack;
    });

    tracks.unshift(...addedTracks);
    persistTracks();
    res.status(201).json({ count: addedTracks.length, tracks: addedTracks });
  });

  app.patch('/api/tracks/:id', (req, res) => {
    const { id } = req.params;
    const idx = tracks.findIndex(t => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Track not found' });
    }
    const { title, artist, genre, mood, bpm, aiClassified, aiReason, lyrics } = req.body;
    tracks[idx] = {
      ...tracks[idx],
      ...(title !== undefined ? { title } : {}),
      ...(artist !== undefined ? { artist } : {}),
      ...(genre !== undefined ? { genre } : {}),
      ...(mood !== undefined ? { mood } : {}),
      ...(bpm !== undefined ? { bpm } : {}),
      ...(aiClassified !== undefined ? { aiClassified } : {}),
      ...(aiReason !== undefined ? { aiReason } : {}),
      ...(lyrics !== undefined ? { lyrics } : {}),
    };
    persistTracks();
    res.json(tracks[idx]);
  });

  app.delete('/api/tracks/:id', async (req, res) => {
    const { id } = req.params;
    const targetTrack = tracks.find(t => t.id === id);
    if (!targetTrack) {
      return res.status(404).json({ error: 'Track not found' });
    }
    tracks = tracks.filter(t => t.id !== id);
    persistTracks();
    if (targetTrack.audioUrl) {
      await deleteObjectFromR2(targetTrack.audioUrl);
    }
    res.json({ success: true, deletedId: id });
  });

  app.get('/api/playlists', (_req, res) => {
    res.json(playlists);
  });

  app.post('/api/playlists', (req, res) => {
    const { title, description, coverUrl, trackIds } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Playlist title is required' });
    }

    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      title: title.trim(),
      description: (description || 'Danh sách phát cá nhân').trim(),
      coverUrl:
        coverUrl ||
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
      trackIds: Array.isArray(trackIds) ? trackIds : [],
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    playlists.push(newPlaylist);
    res.status(201).json(newPlaylist);
  });

  app.get('/api/genres', (_req, res) => {
    const dynamicGenres = INITIAL_GENRES.map(g => ({
      ...g,
      trackCount: tracks.filter(t => t.genre.toLowerCase() === g.name.toLowerCase()).length,
    }));
    res.json(dynamicGenres);
  });

  app.get('/api/lyrics/:id', (req, res) => {
    const track = tracks.find(t => t.id === req.params.id);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }
    res.json({ trackId: track.id, lyrics: track.lyrics || [] });
  });

  // Helper to parse synced lyrics string into LyricLine[]
  function parseSpotflowLyrics(syncedText?: string, plainText?: string): LyricLine[] {
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

  // POST /api/spotflow/sync - Sync tracks from SpotFlow MP3 external API
  app.post('/api/spotflow/sync', async (req, res) => {
    try {
      const { spotflowUrl, apiKey, saveToR2 } = req.body;
      if (!spotflowUrl || !apiKey) {
        return res.status(400).json({ error: 'Vui lòng cung cấp URL của SpotFlow và API Key.' });
      }

      const trimmedUrl = String(spotflowUrl).trim().replace(/\/+$/, '');
      const withProtocol = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
      const endpoint = withProtocol.toLowerCase().endsWith('/api/external/tracks')
        ? withProtocol
        : `${withProtocol}/api/external/tracks`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-API-Key': String(apiKey).trim(),
          'Authorization': `Bearer ${String(apiKey).trim()}`,
          'Accept': 'application/json',
        },
      });

      const rawBody = await response.text();

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Không thể kết nối tới SpotFlow MP3 (HTTP ${response.status} tại ${endpoint}). Kiểm tra lại URL hoặc API Key.`,
        });
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        return res.status(502).json({
          error: `SpotFlow trả về HTML/văn bản thay vì JSON tại ${endpoint}. Hãy kiểm tra đúng REST API Endpoint hoặc đợi server SpotFlow khởi động xong.`,
        });
      }

      type SpotflowItem = {
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
      };

      const data: SpotflowItem[] | null = Array.isArray(parsed)
        ? (parsed as SpotflowItem[])
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { tracks?: unknown }).tracks)
          ? (parsed as { tracks: SpotflowItem[] }).tracks
          : parsed && typeof parsed === 'object' && Array.isArray((parsed as { data?: unknown }).data)
            ? (parsed as { data: SpotflowItem[] }).data
            : null;

      if (!data) {
        return res.status(400).json({ error: 'Định dạng phản hồi từ SpotFlow không hợp lệ (cần là mảng bài hát JSON).' });
      }

      const r2Config = loadR2Config();
      const shouldSaveToR2 = isR2Configured(r2Config) && saveToR2 !== false;

      const syncedTracks: Track[] = await Promise.all(
        data.map(async (item, idx) => {
          const trackId = `spotflow-${item.jobId || Date.now()}-${idx}`;
          const lyrics = parseSpotflowLyrics(item.syncedLyrics, item.plainLyrics);
          let audioUrl = item.downloadUrl || '';
          if (audioUrl && !/^https?:\/\//i.test(audioUrl)) {
            try {
              audioUrl = new URL(audioUrl, endpoint).toString();
            } catch {
              // keep original
            }
          }
          let coverUrl = item.coverUrl || '';
          if (coverUrl && !/^https?:\/\//i.test(coverUrl)) {
            try {
              coverUrl = new URL(coverUrl, endpoint).toString();
            } catch {
              // keep original
            }
          }

          if (shouldSaveToR2 && audioUrl) {
            try {
              const r2Upload = await uploadRemoteUrlToR2(
                audioUrl,
                `${item.artist || 'artist'} - ${item.title || 'song'}.mp3`
              );
              audioUrl = r2Upload.audioUrl;
            } catch (r2Err) {
              console.warn('Could not mirror SpotFlow file to Cloudflare R2, using direct url:', r2Err);
            }
          }

          return {
            id: trackId,
            title: (item.title || 'Bài hát SpotFlow').trim(),
            artist: (item.artist || 'Nghệ sĩ SpotFlow').trim(),
            album: (item.album || 'SpotFlow MP3 Download').trim(),
            audioUrl,
            coverUrl:
              coverUrl ||
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

      tracks.unshift(...syncedTracks);
      persistTracks();

      res.json({
        success: true,
        count: syncedTracks.length,
        tracks: syncedTracks,
      });
    } catch (err: unknown) {
      console.error('Spotflow sync error:', err);
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối SpotFlow MP3.';
      res.status(500).json({ error: msg });
    }
  });

  // POST /api/webhooks/spotflow - Webhook receiver for SpotFlow MP3 auto-push
  app.post('/api/webhooks/spotflow', (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.downloadUrl || !item.title) {
        return res.status(400).json({ error: 'Webhook payload không hợp lệ.' });
      }

      const trackId = `spotflow-wh-${item.jobId || Date.now()}`;
      const lyrics = parseSpotflowLyrics(item.syncedLyrics, item.plainLyrics);

      const newTrack: Track = {
        id: trackId,
        title: (item.title || 'Bài hát mới').trim(),
        artist: (item.artist || 'Nghệ sĩ chưa rõ').trim(),
        album: (item.album || 'SpotFlow Webhook').trim(),
        audioUrl: item.downloadUrl,
        coverUrl:
          item.coverUrl ||
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
        duration: 210,
        genre: 'Pop',
        releaseYear: new Date().getFullYear(),
        bpm: 110,
        mood: 'Tươi mới',
        aiClassified: true,
        aiReason: 'Đẩy tự động qua Webhook SpotFlow MP3',
        lyrics,
        plays: 0,
      };

      tracks.unshift(newTrack);
      persistTracks();

      res.json({ success: true, trackId: newTrack.id });
    } catch (err) {
      console.error('Webhook error:', err);
      res.status(500).json({ error: 'Lỗi xử lý webhook' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Soundly] Server running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
