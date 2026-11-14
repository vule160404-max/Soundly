import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  INITIAL_TRACKS,
  INITIAL_PLAYLISTS,
  INITIAL_GENRES,
} from './src/data/mockTracks';
import { Track, Playlist, LyricLine } from './src/types/music';
import {
  deduplicateTracksList,
  healTrackVietnameseDisplay,
} from './src/utils/trackDedupe';
import multer from 'multer';
import {
  loadR2Config,
  isR2Configured,
  getMissingR2EnvVars,
  testR2Connection,
  createR2PresignedUploadUrl,
  uploadBufferToR2,
  uploadTempChunkToR2,
  completeChunkedUploadToR2,
  deleteObjectFromR2,
  getR2CatalogTracks,
  upsertR2CatalogTracks,
  upsertR2CatalogTracksStrict,
  updateR2CatalogTrack,
  batchUpdateR2CatalogTracks,
  incrementR2CatalogTrackPlays,
  deleteR2CatalogTrack,
  getR2ObjectRange,
  backfillR2CatalogId3Metadata,
} from './server-r2';
import crypto from 'node:crypto';
import {
  ALLOWED_SPOTFLOW_API_KEYS,
  DEFAULT_SPOTFLOW_API_KEY,
  ExistingTrackLookup,
  SpotflowIncomingItem,
  enrichTrackMetadataFromSpotflow,
  fetchSpotflowTracksFromServer,
  ingestSpotflowTracks,
  isValidSpotflowKeyFormat,
} from './api/_lib/spotflow';
import { fetchSpotifyCollectionMetadata } from './api/_lib/spotifyAlbum';
import {
  classifyBatchWithGemini,
  ClassifyInputTrack,
} from './api/_lib/ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADED_TRACKS_FILE = path.join(__dirname, 'saved_uploaded_tracks.json');

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // Load persisted uploaded tracks from disk
  let uploadedTracks: Track[] = [];
  try {
    if (fs.existsSync(UPLOADED_TRACKS_FILE)) {
      const raw = fs.readFileSync(UPLOADED_TRACKS_FILE, 'utf8');
      uploadedTracks = (JSON.parse(raw) as Track[]).map(t => healTrackVietnameseDisplay(t));
    }
  } catch (e) {
    console.warn('Could not load saved uploaded tracks from disk:', e);
  }

  let tracks: Track[] = [...uploadedTracks, ...INITIAL_TRACKS].map(t =>
    healTrackVietnameseDisplay(t)
  );
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

  // POST /api/r2/upload-chunk - Upload <= 2MB raw binary chunk for large files bypassing CORS/body limits
  app.post(
    '/api/r2/upload-chunk',
    express.raw({ type: '*/*', limit: '4mb' }),
    async (req, res) => {
      try {
        const config = loadR2Config();
        if (!isR2Configured(config)) {
          const missing = getMissingR2EnvVars(config);
          return res.status(400).json({
            error: `Cloudflare R2 chưa đủ biến môi trường trên server. Thiếu: ${missing.join(', ')}`,
          });
        }

        const uploadId = String(req.query.uploadId || '').trim();
        const chunkIndex = Number.parseInt(String(req.query.chunkIndex ?? '-1'), 10);
        const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

        if (!uploadId || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
          return res.status(400).json({ error: 'Thiếu uploadId hoặc chunkIndex hợp lệ.' });
        }
        if (buffer.length === 0) {
          return res.status(400).json({ error: 'Dữ liệu chunk trống.' });
        }

        const result = await uploadTempChunkToR2(uploadId, chunkIndex, buffer);
        res.json({ success: true, chunkIndex, ...result });
      } catch (err: unknown) {
        console.error('Cloudflare R2 chunk upload error:', err);
        const message =
          err instanceof Error ? err.message : 'Tải phần dữ liệu lên Cloudflare R2 thất bại.';
        res.status(500).json({ error: message });
      }
    }
  );

  // POST /api/r2/complete-chunked - Assemble uploaded chunks into final audio track on R2
  app.post('/api/r2/complete-chunked', async (req, res) => {
    try {
      const config = loadR2Config();
      if (!isR2Configured(config)) {
        const missing = getMissingR2EnvVars(config);
        return res.status(400).json({
          error: `Cloudflare R2 chưa đủ biến môi trường trên server. Thiếu: ${missing.join(', ')}`,
        });
      }

      const { uploadId, totalChunks, fileName, contentType } = req.body || {};
      const result = await completeChunkedUploadToR2({
        uploadId: String(uploadId || ''),
        totalChunks: Number(totalChunks),
        fileName: String(fileName || `track-${Date.now()}.mp3`),
        contentType: String(contentType || 'audio/mpeg'),
      });

      res.json({
        success: true,
        audioUrl: result.audioUrl,
        key: result.key,
        size: result.size,
      });
    } catch (err: unknown) {
      console.error('Cloudflare R2 complete chunked error:', err);
      const message =
        err instanceof Error ? err.message : 'Không thể ghép tệp âm thanh trên Cloudflare R2.';
      res.status(500).json({ error: message });
    }
  });

  // GET /api/r2/stream - Byte-range stream proxy for R2 objects (tracks/ and covers/)
  app.get('/api/r2/stream', async (req, res) => {
    try {
      const key = String(req.query.key || '').trim();
      if (!key) {
        return res.status(400).json({ error: 'Missing R2 object key' });
      }
      const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
      const result = await getR2ObjectRange(key, rangeHeader);

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Length', String(result.buffer.length));
      if (result.status === 206) {
        res.setHeader('Content-Range', `bytes ${result.start}-${result.end}/${result.totalSize}`);
      }
      res.status(result.status).send(result.buffer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to stream R2 object';
      const status = msg.includes('Forbidden') ? 403 : 404;
      res.status(status).json({ error: msg });
    }
  });

  app.post('/api/r2/heal-id3', async (req, res) => {
    try {
      const limit = Math.min(3000, Math.max(10, Number(req.body?.limit) || 2000));
      const result = await backfillR2CatalogId3Metadata(limit);
      res.json({ success: true, ...result });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to backfill ID3 metadata',
      });
    }
  });

  app.get('/api/tracks', async (req, res) => {
    const { q, genre } = req.query;
    let results: Track[] = [...tracks];

    if (isR2Configured()) {
      const r2Tracks = await getR2CatalogTracks();
      results = [...results, ...(r2Tracks as unknown as Track[])];
    }
    results = deduplicateTracksList(results).deduped;

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

    const includeLyrics = req.query.includeLyrics === '1';
    const payload = includeLyrics
      ? results
      : results.map(({ syncedLyrics: _s, plainLyrics: _p, lyrics: _l, ...rest }) => ({
          ...rest,
          lyrics: [],
        }));

    res.json(payload);
  });

  app.get('/api/tracks/:id', async (req, res) => {
    let track = tracks.find(t => t.id === req.params.id);
    if (!track && isR2Configured()) {
      const r2Tracks = await getR2CatalogTracks();
      track = r2Tracks.find(t => t.id === req.params.id) as unknown as Track | undefined;
    }
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

    tracks = deduplicateTracksList([...addedTracks, ...tracks]).deduped;
    persistTracks();
    if (isR2Configured()) {
      await upsertR2CatalogTracks(addedTracks);
    }
    res.status(201).json({ count: addedTracks.length, tracks: addedTracks });
  });

  app.post('/api/tracks/spotify-album', async (req, res) => {
    try {
      const rawUrl = String(req.body?.url || req.body?.spotifyUrl || '').trim();
      if (!rawUrl) {
        return res.status(400).json({
          error: 'Vui lòng nhập đường dẫn (link) Album hoặc Playlist từ Spotify.',
        });
      }
      const collection = await fetchSpotifyCollectionMetadata(rawUrl);
      res.json(collection);
    } catch (err) {
      console.error('Error parsing Spotify album/playlist:', err);
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể lấy thông tin Album từ Spotify.',
      });
    }
  });

  app.post('/api/tracks/play', async (req, res) => {
    try {
      const trackId = String(req.body?.trackId || req.body?.id || '').trim();
      if (!trackId) {
        return res.status(400).json({ error: 'trackId is required' });
      }

      let memPlays: number | null = null;
      const idx = tracks.findIndex(t => t.id === trackId);
      if (idx !== -1) {
        memPlays = Math.max(0, Number(tracks[idx].plays) || 0) + 1;
        tracks[idx] = { ...tracks[idx], plays: memPlays };
        persistTracks();
      }

      const r2Plays = isR2Configured()
        ? await incrementR2CatalogTrackPlays(trackId)
        : null;

      const resolvedPlays = Math.max(memPlays ?? 0, r2Plays ?? 0);
      if (idx !== -1 && resolvedPlays > (memPlays ?? 0)) {
        tracks[idx] = { ...tracks[idx], plays: resolvedPlays };
        persistTracks();
      }

      res.json({
        success: true,
        id: trackId,
        plays: r2Plays !== null || memPlays !== null ? resolvedPlays : null,
      });
    } catch (err: unknown) {
      console.error('Play increment error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to record play.',
      });
    }
  });

  app.patch('/api/tracks/batch-update', async (req, res) => {
    try {
      const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
      if (updates.length === 0) {
        return res.status(400).json({ error: 'updates array is required' });
      }
      const patchMap = new Map<string, Partial<Track>>();
      for (const item of updates) {
        if (item && typeof item.id === 'string' && item.patch && typeof item.patch === 'object') {
          patchMap.set(item.id, item.patch as Partial<Track>);
        }
      }

      let memUpdated = 0;
      tracks = tracks.map(t => {
        const p = patchMap.get(t.id);
        if (!p) return t;
        memUpdated++;
        return { ...t, ...p };
      });
      if (memUpdated > 0) persistTracks();

      const r2Updated = isR2Configured()
        ? await batchUpdateR2CatalogTracks(
            Array.from(patchMap.entries()).map(([id, patch]) => ({ id, patch }))
          )
        : 0;

      res.json({ success: true, updatedCount: Math.max(memUpdated, r2Updated) });
    } catch (err: unknown) {
      console.error('Batch update error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Batch update failed',
      });
    }
  });

  app.patch('/api/tracks/:id', async (req, res) => {
    const { id } = req.params;
    const idx = tracks.findIndex(t => t.id === id);
    const { title, artist, genre, mood, bpm, aiClassified, aiReason, lyrics } = req.body;
    const patch = {
      ...(title !== undefined ? { title } : {}),
      ...(artist !== undefined ? { artist } : {}),
      ...(genre !== undefined ? { genre } : {}),
      ...(mood !== undefined ? { mood } : {}),
      ...(bpm !== undefined ? { bpm } : {}),
      ...(aiClassified !== undefined ? { aiClassified } : {}),
      ...(aiReason !== undefined ? { aiReason } : {}),
      ...(lyrics !== undefined ? { lyrics } : {}),
    };

    if (idx !== -1) {
      tracks[idx] = { ...tracks[idx], ...patch };
      persistTracks();
    }

    const r2Updated = isR2Configured() ? await updateR2CatalogTrack(id, patch) : null;
    if (idx === -1 && !r2Updated) {
      return res.status(404).json({ error: 'Track not found' });
    }
    res.json(idx !== -1 ? tracks[idx] : r2Updated);
  });

  app.delete('/api/tracks/:id', async (req, res) => {
    const { id } = req.params;
    const targetTrack = tracks.find(t => t.id === id);
    if (targetTrack) {
      tracks = tracks.filter(t => t.id !== id);
      persistTracks();
      if (targetTrack.audioUrl) {
        await deleteObjectFromR2(targetTrack.audioUrl);
      }
    }
    if (isR2Configured()) {
      await deleteR2CatalogTrack(id);
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

  app.get('/api/lyrics/:id', async (req, res) => {
    let track = tracks.find(t => t.id === req.params.id);
    if (!track && isR2Configured()) {
      const r2Tracks = await getR2CatalogTracks();
      track = r2Tracks.find(t => t.id === req.params.id) as unknown as Track | undefined;
    }
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }
    res.json({
      trackId: track.id,
      lyrics: track.lyrics || [],
      syncedLyrics: track.syncedLyrics,
      plainLyrics: track.plainLyrics,
      lyricsMode: track.lyricsMode,
    });
  });

  function applyIngestedTracksToMemory(added: Track[], updated: Track[]) {
    for (const upd of updated) {
      const idx = tracks.findIndex(t => t.id === upd.id);
      if (idx !== -1) {
        tracks[idx] = { ...tracks[idx], ...upd };
      } else {
        tracks.unshift(upd);
      }
    }
    if (added.length > 0) {
      const existingIds = new Set(tracks.map(t => t.id));
      const newOnes = added.filter(t => !existingIds.has(t.id));
      tracks.unshift(...newOnes);
    }
    persistTracks();
  }

  // POST /api/spotflow/sync - Sync tracks or enrich metadata from SpotFlow MP3 external API
  app.post('/api/spotflow/sync', async (req, res) => {
    try {
      const body = req.body || {};
      if (body.action === 'enrich') {
        const enriched = await enrichTrackMetadataFromSpotflow({
          fileName: body.fileName ? String(body.fileName) : undefined,
          title: body.title ? String(body.title) : undefined,
          artist: body.artist ? String(body.artist) : undefined,
          apiKey: body.apiKey ? String(body.apiKey) : DEFAULT_SPOTFLOW_API_KEY,
          saveCoverToR2: true,
        });
        return res.json({ ok: true, ...enriched });
      }

      const { spotflowUrl, apiKey, saveToR2, existingTracks: clientHints } = body;

      const { endpoint, effectiveApiKey, items: data } =
        await fetchSpotflowTracksFromServer({
          spotflowUrl: spotflowUrl ? String(spotflowUrl) : undefined,
          apiKey: apiKey ? String(apiKey) : undefined,
        });

      const r2Configured = isR2Configured();
      const r2Existing = r2Configured ? await getR2CatalogTracks() : [];

      const existingCombined: ExistingTrackLookup[] = [...r2Existing];
      const seenIds = new Set(r2Existing.map(t => t.id));
      for (const t of tracks) {
        if (!INITIAL_TRACKS.some(it => it.id === t.id) && !seenIds.has(t.id)) {
          existingCombined.push(t);
          seenIds.add(t.id);
        }
      }
      if (Array.isArray(clientHints)) {
        for (const hint of clientHints as ExistingTrackLookup[]) {
          if (hint && hint.id && !seenIds.has(hint.id)) {
            existingCombined.push(hint);
            seenIds.add(hint.id);
          }
        }
      }

      const result = await ingestSpotflowTracks({
        items: data,
        baseEndpoint: endpoint,
        apiKey: effectiveApiKey,
        saveToR2: saveToR2 !== false,
        existingTracks: existingCombined,
        sourceLabel: 'SpotFlow MP3',
      });

      applyIngestedTracksToMemory(result.addedTracks as Track[], result.updatedTracks as Track[]);
      if (result.tracks.length > 0 && r2Configured) {
        await upsertR2CatalogTracks(result.tracks);
      }

      res.json({
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
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối SpotFlow MP3.';
      res.status(500).json({ error: msg });
    }
  });

  // GET & POST /api/webhooks/spotflow - Webhook receiver for SpotFlow MP3 auto-push (Direct R2 & Fallback)
  app.get('/api/webhooks/spotflow', (_req, res) => {
    const configuredSecret = (
      process.env.SPOTFLOW_WEBHOOK_SECRET ||
      process.env.SPOTFLOW_API_KEY ||
      DEFAULT_SPOTFLOW_API_KEY
    ).trim();
    res.json({
      ok: true,
      status: 'ready',
      endpoint: '/api/webhooks/spotflow',
      webhookSecretConfigured: Boolean(configuredSecret),
    });
  });

  app.post('/api/webhooks/spotflow', async (req, res) => {
    try {
      const configuredSecret = (
        process.env.SPOTFLOW_WEBHOOK_SECRET ||
        process.env.SPOTFLOW_API_KEY ||
        DEFAULT_SPOTFLOW_API_KEY
      ).trim();
      const rawApiKey = String(req.headers['x-api-key'] || '').trim();
      const authHeader = String(req.headers['authorization'] || '').trim();
      const bearerKey = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
      const providedKey = rawApiKey || bearerKey;

      const allowedKeys = Array.from(
        new Set([configuredSecret, DEFAULT_SPOTFLOW_API_KEY, ...ALLOWED_SPOTFLOW_API_KEYS].filter(Boolean))
      );
      const isValidKey =
        Boolean(providedKey) &&
        (allowedKeys.some(expected => {
          const a = Buffer.from(providedKey, 'utf8');
          const b = Buffer.from(expected, 'utf8');
          return a.length === b.length && crypto.timingSafeEqual(a, b);
        }) ||
          isValidSpotflowKeyFormat(providedKey));

      if (!isValidKey) {
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized: Header X-API-Key không hợp lệ.',
        });
      }

      const payload = req.body || {};
      if (payload.event === 'ping_test' || payload.test === true) {
        return res.status(200).json({
          ok: true,
          success: true,
          ignored: true,
          event: payload.event || 'ping_test',
          message: 'SpotFlow webhook ping_test received.',
        });
      }

      const rawTrack: SpotflowIncomingItem | null =
        payload.track && typeof payload.track === 'object'
          ? payload.track
          : payload.title || payload.downloadUrl || payload.r2AudioUrl || payload.audioUrl
            ? payload
            : null;

      if (!rawTrack) {
        return res.status(400).json({
          ok: false,
          error: 'Webhook payload không hợp lệ (thiếu đối tượng track).',
        });
      }

      const effectiveStorage = String(rawTrack.storage || payload.storage || '').trim();
      const trackItem: SpotflowIncomingItem = {
        ...rawTrack,
        ...(effectiveStorage ? { storage: effectiveStorage } : {}),
      };

      const isDirectR2 =
        effectiveStorage.toLowerCase() === 'r2' ||
        Boolean(trackItem.r2AudioUrl && trackItem.r2AudioUrl.trim());

      const resolvedDirectAudioUrl = (trackItem.r2AudioUrl || trackItem.audioUrl || '').trim();
      const resolvedFallbackAudioUrl = (trackItem.downloadUrl || trackItem.audioUrl || '').trim();

      if (isDirectR2 && !resolvedDirectAudioUrl) {
        return res.status(400).json({
          ok: false,
          error: 'Thiếu audioUrl (r2AudioUrl / audioUrl) trong dữ liệu bài hát.',
        });
      }

      if (!isDirectR2 && !resolvedFallbackAudioUrl) {
        return res.status(400).json({
          ok: false,
          error: 'Thiếu downloadUrl hoặc audioUrl trong dữ liệu bài hát.',
        });
      }

      const r2Configured = isR2Configured();
      const r2Existing = r2Configured ? await getR2CatalogTracks() : [];
      const existingCombined: ExistingTrackLookup[] = [...r2Existing];
      const seenIds = new Set(r2Existing.map(t => t.id));
      for (const t of tracks) {
        if (!INITIAL_TRACKS.some(it => it.id === t.id) && !seenIds.has(t.id)) {
          existingCombined.push(t);
          seenIds.add(t.id);
        }
      }

      const result = await ingestSpotflowTracks({
        items: [trackItem],
        apiKey: providedKey || configuredSecret,
        saveToR2: true,
        existingTracks: existingCombined,
        sourceLabel: 'Webhook SpotFlow',
      });

      if (result.failedAudioCount > 0 || result.tracks.length === 0) {
        return res.status(422).json({
          ok: false,
          error:
            result.failedAudioMessages[0] ||
            'Không thể xử lý hoặc lưu tệp âm thanh cho bài hát.',
        });
      }

      const processedTrack = result.tracks[0];
      if (!processedTrack || !processedTrack.audioUrl) {
        return res.status(400).json({
          ok: false,
          error: 'Thiếu audioUrl hợp lệ sau khi xử lý bài hát.',
        });
      }

      applyIngestedTracksToMemory(result.addedTracks as Track[], result.updatedTracks as Track[]);
      if (r2Configured) {
        await upsertR2CatalogTracksStrict(result.tracks);
      }

      res.status(200).json({
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
    } catch (err) {
      console.error('Webhook error:', err);
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Lỗi lưu Database khi xử lý webhook',
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
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
