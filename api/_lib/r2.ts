import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  DeleteObjectCommand,
  GetBucketCorsCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  buildArtistSlugDictionaryFromTracks,
  isHyphenFilenameSlug,
  parseAndCleanSlugTrack,
  restoreVietnameseMetadataFromSlug,
} from './ai.js';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicDomain: string;
}

export interface R2StoredTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  genre: string;
  region?: 'vn' | 'us-uk' | 'kpop' | 'other';
  releaseYear: number;
  lyrics: Array<{ time: number; text: string }>;
  bpm?: number;
  mood?: string;
  plays?: number;
  aiClassified?: boolean;
  aiReason?: string;
  spotifyTrackId?: string;
  spotifyUrl?: string;
  r2AudioKey?: string;
  r2CoverKey?: string;
  id3Checked?: boolean;
  syncedLyrics?: string;
  plainLyrics?: string;
  lyricsMode?: 'synced' | 'plain' | 'none';
}

const CATALOG_OBJECT_KEY = 'catalog/tracks.json';
export const DEFAULT_COVER_URL =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';
const AUDIO_EXT_REGEX = /\.(mp3|wav|flac|m4a|ogg|aac|opus)$/i;

function cleanEnvValue(value?: string): string {
  return (value || '').trim().replace(/^["']|["']$/g, '').trim();
}

export function loadR2Config(): R2Config {
  return {
    accountId: cleanEnvValue(
      process.env.CLOUDFLARE_R2_ACCOUNT_ID ||
        process.env.R2_ACCOUNT_ID ||
        process.env.CLOUDFLARE_ACCOUNT_ID
    ),
    accessKeyId: cleanEnvValue(
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
    ),
    secretAccessKey: cleanEnvValue(
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
        process.env.R2_SECRET_ACCESS_KEY
    ),
    bucketName: cleanEnvValue(
      process.env.CLOUDFLARE_R2_BUCKET_NAME ||
        process.env.R2_BUCKET_NAME ||
        process.env.R2_BUCKET ||
        process.env.CLOUDFLARE_R2_BUCKET
    ),
    publicDomain: cleanEnvValue(
      process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN ||
        process.env.R2_PUBLIC_BASE_URL ||
        process.env.R2_PUBLIC_DOMAIN ||
        process.env.R2_PUBLIC_URL ||
        process.env.CLOUDFLARE_R2_PUBLIC_URL ||
        'https://pub-abe76365ee0b4bb69d5f0f51a5abc76d.r2.dev'
    ),
  };
}

export function getMissingR2EnvVars(config?: R2Config): string[] {
  const cfg = config || loadR2Config();
  const missing: string[] = [];
  if (!cfg.accountId) missing.push('CLOUDFLARE_R2_ACCOUNT_ID');
  if (!cfg.accessKeyId) missing.push('CLOUDFLARE_R2_ACCESS_KEY_ID');
  if (!cfg.secretAccessKey) missing.push('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
  if (!cfg.bucketName) missing.push('CLOUDFLARE_R2_BUCKET_NAME');
  return missing;
}

export function isR2Configured(config?: R2Config): boolean {
  const cfg = config || loadR2Config();
  return Boolean(
    cfg.accountId && cfg.accessKeyId && cfg.secretAccessKey && cfg.bucketName
  );
}

export function getR2Client(config?: R2Config): S3Client {
  const cfg = config || loadR2Config();
  if (!isR2Configured(cfg)) {
    const missing = getMissingR2EnvVars(cfg);
    throw new Error(
      `Cloudflare R2 chưa được thiết lập đủ biến môi trường trên server (Thiếu: ${missing.join(', ')}).`
    );
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
}

let corsConfiguredBucket: string | null = null;

export async function ensureR2BucketCors(config?: R2Config): Promise<boolean> {
  const cfg = config || loadR2Config();
  if (!isR2Configured(cfg)) return false;
  if (corsConfiguredBucket === cfg.bucketName) return true;

  try {
    const client = getR2Client(cfg);
    try {
      const existing = await client.send(
        new GetBucketCorsCommand({ Bucket: cfg.bucketName })
      );
      const hasValidRule = (existing.CORSRules || []).some(rule => {
        const origins = rule.AllowedOrigins || [];
        const methods = (rule.AllowedMethods || []).map(m => m.toUpperCase());
        return (
          origins.includes('*') &&
          methods.includes('PUT') &&
          methods.includes('GET')
        );
      });
      if (hasValidRule) {
        corsConfiguredBucket = cfg.bucketName;
        return true;
      }
    } catch {
      // Bucket may not have CORS configured yet; proceed to set it
    }

    await client.send(
      new PutBucketCorsCommand({
        Bucket: cfg.bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ['*'],
              AllowedMethods: ['GET', 'PUT', 'HEAD'],
              AllowedHeaders: ['*'],
              ExposeHeaders: [
                'ETag',
                'Content-Length',
                'Content-Range',
                'Accept-Ranges',
              ],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
    corsConfiguredBucket = cfg.bucketName;
    return true;
  } catch (err) {
    // Non-fatal: R2 API tokens with Object-only permissions cannot edit bucket CORS
    console.warn('[Cloudflare R2] Could not auto-configure bucket CORS:', err);
    return false;
  }
}

export async function testR2Connection(): Promise<{
  success: boolean;
  message: string;
}> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) {
    const missing = getMissingR2EnvVars(cfg);
    return {
      success: false,
      message: `Cloudflare R2 chưa đủ biến môi trường trên server. Thiếu: ${missing.join(', ')}`,
    };
  }

  try {
    const client = getR2Client(cfg);
    await client.send(
      new HeadBucketCommand({
        Bucket: cfg.bucketName,
      })
    );
    await ensureR2BucketCors(cfg);
    return {
      success: true,
      message: `Kết nối thành công tới Cloudflare R2 Bucket "${cfg.bucketName}"!`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Kết nối Cloudflare R2 thất bại: ${errorMsg}`,
    };
  }
}

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildSlugTimestampKey(
  folder: 'tracks' | 'covers',
  originalFileName: string,
  defaultExt: string
): string {
  const raw = (originalFileName || `file.${defaultExt}`).trim();
  const extMatch = raw.match(/\.([a-zA-Z0-9]{2,5})$/);
  const ext = (extMatch ? extMatch[1] : defaultExt).toLowerCase();
  const baseWithoutExt = raw.replace(/\.[^/.]+$/, '');
  const slug = sanitizeFileName(baseWithoutExt).slice(0, 100) || folder.slice(0, -1);
  return `${folder}/${slug}-${Date.now()}.${ext}`;
}

export function buildR2PublicUrl(cfg: R2Config, key: string): string {
  if (cfg.publicDomain) {
    const raw = cfg.publicDomain.replace(/\/+$/, '');
    const domain = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return `${domain}/${key}`;
  }
  return `/api/r2/stream?key=${encodeURIComponent(key)}`;
}

export async function createR2PresignedUploadUrl(
  originalFileName: string,
  contentType: string
): Promise<{ uploadUrl: string; audioUrl: string; key: string }> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) {
    const missing = getMissingR2EnvVars(cfg);
    throw new Error(
      `Cloudflare R2 chưa được cấu hình trên server (Thiếu: ${missing.join(', ')}).`
    );
  }

  await ensureR2BucketCors(cfg);
  const client = getR2Client(cfg);
  const key = buildSlugTimestampKey('tracks', originalFileName || 'audio.mp3', 'mp3');

  const command = new PutObjectCommand({
    Bucket: cfg.bucketName,
    Key: key,
    ContentType: contentType || 'audio/mpeg',
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });
  const audioUrl = buildR2PublicUrl(cfg, key);

  return { uploadUrl, audioUrl, key };
}

export async function uploadBufferToR2(
  buffer: Buffer,
  originalFileName: string,
  contentType: string
): Promise<{ audioUrl: string; key: string; size: number }> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) {
    const missing = getMissingR2EnvVars(cfg);
    throw new Error(
      `Cloudflare R2 chưa được cấu hình trong biến môi trường server (Thiếu: ${missing.join(', ')}).`
    );
  }

  const client = getR2Client(cfg);
  const key = buildSlugTimestampKey('tracks', originalFileName || 'audio.mp3', 'mp3');

  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'audio/mpeg',
    })
  );

  return {
    audioUrl: buildR2PublicUrl(cfg, key),
    key,
    size: buffer.length,
  };
}

function sanitizeUploadId(uploadId: string): string {
  return uploadId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

function buildTempChunkKey(safeUploadId: string, chunkIndex: number): string {
  return `tmp-uploads/${safeUploadId}/part-${String(chunkIndex).padStart(5, '0')}`;
}

export async function uploadTempChunkToR2(
  uploadId: string,
  chunkIndex: number,
  buffer: Buffer
): Promise<{ key: string; size: number }> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) {
    const missing = getMissingR2EnvVars(cfg);
    throw new Error(
      `Cloudflare R2 chưa được cấu hình trên server (Thiếu: ${missing.join(', ')}).`
    );
  }

  const safeId = sanitizeUploadId(uploadId);
  if (!safeId) {
    throw new Error('uploadId không hợp lệ.');
  }
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= 100) {
    throw new Error('chunkIndex không hợp lệ.');
  }
  if (!buffer || buffer.length === 0) {
    throw new Error('Dữ liệu chunk trống.');
  }

  const key = buildTempChunkKey(safeId, chunkIndex);
  const client = getR2Client(cfg);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'application/octet-stream',
    })
  );

  return { key, size: buffer.length };
}

export async function completeChunkedUploadToR2(params: {
  uploadId: string;
  totalChunks: number;
  fileName: string;
  contentType: string;
}): Promise<{ audioUrl: string; key: string; size: number }> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) {
    const missing = getMissingR2EnvVars(cfg);
    throw new Error(
      `Cloudflare R2 chưa được cấu hình trên server (Thiếu: ${missing.join(', ')}).`
    );
  }

  const safeId = sanitizeUploadId(params.uploadId || '');
  const totalChunks = Number(params.totalChunks);
  if (!safeId || !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 40) {
    throw new Error('Thông tin ghép file chunk không hợp lệ.');
  }

  const client = getR2Client(cfg);
  const chunkKeys = Array.from({ length: totalChunks }, (_, idx) =>
    buildTempChunkKey(safeId, idx)
  );

  try {
    const partBuffers: Buffer[] = new Array(totalChunks);
    const CONCURRENCY = 4;
    for (let offset = 0; offset < chunkKeys.length; offset += CONCURRENCY) {
      const batch = chunkKeys.slice(offset, offset + CONCURRENCY);
      const fetched = await Promise.all(
        batch.map(async (chunkKey, batchIdx) => {
          const res = await client.send(
            new GetObjectCommand({
              Bucket: cfg.bucketName,
              Key: chunkKey,
            })
          );
          const bytes = await res.Body?.transformToByteArray();
          if (!bytes || bytes.length === 0) {
            throw new Error(`Thiếu dữ liệu phần #${offset + batchIdx + 1} trên R2.`);
          }
          return Buffer.from(bytes);
        })
      );
      fetched.forEach((buf, batchIdx) => {
        partBuffers[offset + batchIdx] = buf;
      });
    }

    const combined = Buffer.concat(partBuffers);
    return await uploadBufferToR2(
      combined,
      params.fileName || `track-${Date.now()}.mp3`,
      params.contentType || 'audio/mpeg'
    );
  } finally {
    await Promise.allSettled(
      chunkKeys.map(chunkKey =>
        client.send(
          new DeleteObjectCommand({
            Bucket: cfg.bucketName,
            Key: chunkKey,
          })
        )
      )
    );
  }
}

export async function uploadRemoteUrlToR2(
  remoteUrl: string,
  fallbackName: string,
  headers?: Record<string, string>
): Promise<{ audioUrl: string; key: string; size: number; buffer: Buffer }> {
  const res = await fetch(remoteUrl, headers ? { headers } : undefined);
  if (!res.ok) {
    throw new Error(
      `Không thể tải tệp âm thanh từ nguồn ngoài (HTTP ${res.status}).`
    );
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = res.headers.get('content-type') || 'audio/mpeg';

  const uploaded = await uploadBufferToR2(buffer, fallbackName, contentType);
  return { ...uploaded, buffer };
}

export async function uploadImageBufferToR2(
  buffer: Buffer,
  originalFileName: string,
  contentType: string
): Promise<{ coverUrl: string; key: string; size: number }> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) {
    const missing = getMissingR2EnvVars(cfg);
    throw new Error(
      `Cloudflare R2 chưa được cấu hình trong biến môi trường server (Thiếu: ${missing.join(', ')}).`
    );
  }

  const client = getR2Client(cfg);
  const key = buildSlugTimestampKey('covers', originalFileName || 'cover.jpg', 'jpg');

  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'image/jpeg',
    })
  );

  return {
    coverUrl: buildR2PublicUrl(cfg, key),
    key,
    size: buffer.length,
  };
}

export async function uploadRemoteImageToR2(
  remoteUrl: string,
  fallbackName: string
): Promise<{ coverUrl: string; key: string; size: number }> {
  const res = await fetch(remoteUrl);
  if (!res.ok) {
    throw new Error(
      `Không thể tải ảnh bìa từ nguồn ngoài (HTTP ${res.status}).`
    );
  }
  const contentType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  if (!contentType.startsWith('image/')) {
    throw new Error(`Định dạng ảnh bìa không hợp lệ (${contentType}).`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0) {
    throw new Error('Ảnh bìa rỗng.');
  }

  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : 'jpg';
  const nameWithExt = /\.(jpe?g|png|webp)$/i.test(fallbackName)
    ? fallbackName
    : `${fallbackName}.${ext}`;

  return uploadImageBufferToR2(buffer, nameWithExt, contentType);
}

export async function deleteObjectFromR2(
  audioUrlOrKey: string
): Promise<boolean> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) return false;

  try {
    const key = extractR2Key(audioUrlOrKey);
    if (!key.startsWith('tracks/') && !key.startsWith('covers/')) {
      return false;
    }

    const client = getR2Client(cfg);
    await client.send(
      new DeleteObjectCommand({
        Bucket: cfg.bucketName,
        Key: key,
      })
    );
    console.log(`[Cloudflare R2] Successfully deleted object: ${key}`);
    return true;
  } catch (err) {
    console.warn(
      `[Cloudflare R2] Could not delete object ${audioUrlOrKey}:`,
      err
    );
    return false;
  }
}

function extractR2Key(audioUrlOrKey: string): string {
  if (!audioUrlOrKey) return '';
  if (audioUrlOrKey.startsWith('/api/r2/stream')) {
    try {
      const parsed = new URL(audioUrlOrKey, 'http://localhost');
      return (parsed.searchParams.get('key') || '').replace(/^\/+/, '');
    } catch {
      return '';
    }
  }
  if (
    audioUrlOrKey.startsWith('http://') ||
    audioUrlOrKey.startsWith('https://')
  ) {
    try {
      const parsed = new URL(audioUrlOrKey);
      if (parsed.pathname.includes('/api/r2/stream')) {
        return (parsed.searchParams.get('key') || '').replace(/^\/+/, '');
      }
      return parsed.pathname.replace(/^\/+/, '');
    } catch {
      return '';
    }
  }
  return audioUrlOrKey.replace(/^\/+/, '');
}

const MAX_STREAM_CHUNK_BYTES = 2 * 1024 * 1024; // 2MB per chunk stays safely under Vercel 4.5MB limit

function inferMimeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.opus')) return 'audio/opus';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

export async function getR2ObjectRange(
  rawKey: string,
  rangeHeader?: string
): Promise<{
  status: 200 | 206;
  buffer: Buffer;
  contentType: string;
  totalSize: number;
  start: number;
  end: number;
}> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) {
    throw new Error('Cloudflare R2 chưa được cấu hình.');
  }
  const key = rawKey.replace(/^\/+/, '');
  if (!key.startsWith('tracks/') && !key.startsWith('covers/')) {
    throw new Error('Forbidden object key.');
  }

  const client = getR2Client(cfg);
  const head = await client.send(
    new HeadObjectCommand({
      Bucket: cfg.bucketName,
      Key: key,
    })
  );

  const totalSize = Number(head.ContentLength || 0);
  const contentType =
    head.ContentType && head.ContentType !== 'application/octet-stream'
      ? head.ContentType
      : inferMimeFromKey(key);

  if (totalSize === 0) {
    return {
      status: 200,
      buffer: Buffer.alloc(0),
      contentType,
      totalSize: 0,
      start: 0,
      end: 0,
    };
  }

  let start = 0;
  let end = Math.min(totalSize - 1, MAX_STREAM_CHUNK_BYTES - 1);
  let isPartial = totalSize > MAX_STREAM_CHUNK_BYTES;

  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    isPartial = true;
    const [rawStart, rawEnd] = rangeHeader.replace(/^bytes=/, '').split('-');
    if (rawStart === '' && rawEnd) {
      const suffixLen = parseInt(rawEnd, 10);
      start = Math.max(0, totalSize - (Number.isFinite(suffixLen) ? suffixLen : MAX_STREAM_CHUNK_BYTES));
      end = totalSize - 1;
    } else {
      const parsedStart = parseInt(rawStart, 10);
      start = Number.isFinite(parsedStart) && parsedStart >= 0 ? parsedStart : 0;
      const parsedEnd = rawEnd ? parseInt(rawEnd, 10) : start + MAX_STREAM_CHUNK_BYTES - 1;
      const clampedEnd = Number.isFinite(parsedEnd)
        ? Math.min(totalSize - 1, parsedEnd)
        : totalSize - 1;
      end = Math.min(clampedEnd, start + MAX_STREAM_CHUNK_BYTES - 1);
    }
    if (start >= totalSize) {
      start = Math.max(0, totalSize - 1);
      end = totalSize - 1;
    }
  }

  const getRes = await client.send(
    new GetObjectCommand({
      Bucket: cfg.bucketName,
      Key: key,
      Range: `bytes=${start}-${end}`,
    })
  );

  const bytes = await getRes.Body?.transformToByteArray();
  const buffer = bytes ? Buffer.from(bytes) : Buffer.alloc(0);

  return {
    status: isPartial ? 206 : 200,
    buffer,
    contentType,
    totalSize,
    start,
    end: start + Math.max(0, buffer.length - 1),
  };
}

const IMAGE_EXT_REGEX = /\.(jpe?g|png|webp|avif)$/i;

function extractFileStemFromKey(key: string): string {
  const fileName = key.split('/').pop() || key;
  const withoutExt = fileName.replace(/\.[^/.]+$/, '');
  const withoutTimestampOrShortId = withoutExt
    .replace(/^\d{10,}-/, '')
    .replace(/-\d{10,}$/, '')
    .replace(/-[0-9a-f]{8}$/i, '');
  return withoutTimestampOrShortId.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugifyMusicToolKey(input: string): string {
  return (
    (input || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72) || 'track'
  );
}

let cachedSpotflowHistoryMap: Map<string, { title: string; artist: string; album?: string }> | null =
  null;
let cachedSpotflowHistoryAt = 0;

async function getSpotflowHistorySlugMap(): Promise<
  Map<string, { title: string; artist: string; album?: string }>
> {
  if (cachedSpotflowHistoryMap && Date.now() - cachedSpotflowHistoryAt < 180_000) {
    return cachedSpotflowHistoryMap;
  }
  const map = new Map<string, { title: string; artist: string; album?: string }>();
  try {
    const res = await fetch('https://musictool-ytsg.onrender.com/api/history', {
      signal: AbortSignal.timeout(1200),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        items?: Array<{ title?: string; artist?: string; album?: string }>;
      };
      for (const item of data.items || []) {
        const title = (item.title || '').trim();
        const artist = (item.artist || '').trim();
        if (!title) continue;
        const slugFull = slugifyMusicToolKey(`${artist ? `${artist}-` : ''}${title}`);
        const slugTitleOnly = slugifyMusicToolKey(title);
        const entry = {
          title,
          artist: artist || 'Nghệ sĩ chưa rõ',
          album: item.album && item.album !== 'Local Upload' ? item.album : undefined,
        };
        if (slugFull && !map.has(slugFull)) map.set(slugFull, entry);
        if (slugTitleOnly && !map.has(slugTitleOnly)) map.set(slugTitleOnly, entry);
      }
    }
  } catch {
    // non-fatal if Render is offline
  }
  cachedSpotflowHistoryMap = map;
  cachedSpotflowHistoryAt = Date.now();
  return map;
}

function normalizeStemKey(raw: string, stripD: boolean = false): string {
  let out = (raw || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripD) {
    out = out.replace(/\bd/g, '').replace(/\s+/g, ' ').trim();
  }
  return out;
}

function hasVietnameseDiacriticsOrProperCase(text?: string): boolean {
  if (!text) return false;
  if (/[^\u0000-\u007f]/.test(text)) return true;
  // Check if it has uppercase letters (not all-lowercase filename slug)
  return text !== text.toLowerCase();
}

function isLikelyRawSlugText(text?: string): boolean {
  if (!text || !text.trim()) return true;
  const t = text.trim();
  if (
    t === 'Nghệ sĩ chưa rõ' ||
    t === 'nghe si chua ro' ||
    t === 'Bài hát trên R2' ||
    t.includes('_') ||
    isHyphenFilenameSlug(t)
  ) {
    return true;
  }
  // All lowercase ASCII with spaces/dots is a raw filename slug
  return !/[^\u0000-\u007f]/.test(t) && t === t.toLowerCase();
}

function pickBetterText(a?: string, b?: string, fallback: string = ''): string {
  const cleanA = (a || '').trim();
  const cleanB = (b || '').trim();
  if (!cleanA) return cleanB || fallback;
  if (!cleanB) return cleanA || fallback;

  const aHasDiacritics = /[^\u0000-\u007f]/.test(cleanA);
  const bHasDiacritics = /[^\u0000-\u007f]/.test(cleanB);
  if (aHasDiacritics && !bHasDiacritics) return cleanA;
  if (bHasDiacritics && !aHasDiacritics) return cleanB;

  const aIsSlug = isLikelyRawSlugText(cleanA);
  const bIsSlug = isLikelyRawSlugText(cleanB);
  if (!aIsSlug && bIsSlug) return cleanA;
  if (!bIsSlug && aIsSlug) return cleanB;

  return cleanA;
}

function readSynchsafeIntR2(buf: Buffer, offset: number): number {
  return (
    ((buf[offset] & 0x7f) << 21) |
    ((buf[offset + 1] & 0x7f) << 14) |
    ((buf[offset + 2] & 0x7f) << 7) |
    (buf[offset + 3] & 0x7f)
  );
}

function decodeId3TextPayload(frameData: Buffer): string {
  if (!frameData || frameData.length <= 1) return '';
  const encoding = frameData[0];
  const payload = frameData.subarray(1);
  let text = '';

  if (encoding === 0) {
    const utf8 = payload.toString('utf8').replace(/\0+$/g, '').trim();
    text = utf8.includes('\ufffd')
      ? payload.toString('latin1').replace(/\0+$/g, '').trim()
      : utf8;
  } else if (encoding === 1) {
    if (payload.length >= 2 && payload[0] === 0xfe && payload[1] === 0xff) {
      const swapped = Buffer.alloc(payload.length - 2);
      for (let i = 2; i + 1 < payload.length; i += 2) {
        swapped[i - 2] = payload[i + 1];
        swapped[i - 1] = payload[i];
      }
      text = swapped.toString('utf16le');
    } else if (payload.length >= 2 && payload[0] === 0xff && payload[1] === 0xfe) {
      text = payload.subarray(2).toString('utf16le');
    } else {
      text = payload.toString('utf16le');
    }
  } else if (encoding === 2) {
    const swapped = Buffer.alloc(payload.length);
    for (let i = 0; i + 1 < payload.length; i += 2) {
      swapped[i] = payload[i + 1];
      swapped[i + 1] = payload[i];
    }
    text = swapped.toString('utf16le');
  } else {
    text = payload.toString('utf8');
  }

  return text.replace(/\0/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseId3TextFramesFromBuffer(buf: Buffer): {
  title?: string;
  artist?: string;
  album?: string;
  durationSec?: number;
  tagByteSize: number;
} {
  if (!buf || buf.length < 16 || buf.toString('ascii', 0, 3) !== 'ID3') {
    return { tagByteSize: 0 };
  }
  const majorVersion = buf[3];
  if (majorVersion < 2 || majorVersion > 4) {
    return { tagByteSize: 0 };
  }
  const tagSize = readSynchsafeIntR2(buf, 6);
  const tagByteSize = 10 + tagSize;
  const tagEnd = Math.min(buf.length, tagByteSize);
  const body = buf.subarray(10, tagEnd);

  let offset = 0;
  let title: string | undefined;
  let artist: string | undefined;
  let album: string | undefined;
  let durationSec: number | undefined;

  while (offset < body.length) {
    if (majorVersion === 2) {
      if (offset + 6 > body.length) break;
      const frameId = body.toString('ascii', offset, offset + 3);
      if (!/^[A-Z0-9]{3}$/.test(frameId)) break;
      const frameSize =
        (body[offset + 3] << 16) | (body[offset + 4] << 8) | body[offset + 5];
      offset += 6;
      if (frameSize <= 0 || offset + frameSize > body.length) break;
      const frameData = body.subarray(offset, offset + frameSize);
      offset += frameSize;

      if (frameId === 'TT2') title = decodeId3TextPayload(frameData) || title;
      else if (frameId === 'TP1') artist = decodeId3TextPayload(frameData) || artist;
      else if (frameId === 'TAL') album = decodeId3TextPayload(frameData) || album;
      else if (frameId === 'TLE') {
        const ms = parseInt(decodeId3TextPayload(frameData), 10);
        if (ms > 1000) durationSec = Math.round(ms / 1000);
      }
    } else {
      if (offset + 10 > body.length) break;
      const frameId = body.toString('ascii', offset, offset + 4);
      if (!/^[A-Z0-9]{4}$/.test(frameId)) break;
      const frameSize =
        majorVersion === 4
          ? readSynchsafeIntR2(body, offset + 4)
          : body.readUInt32BE(offset + 4);
      offset += 10;
      if (frameSize <= 0 || offset + frameSize > body.length) break;
      const frameData = body.subarray(offset, offset + frameSize);
      offset += frameSize;

      if (frameId === 'TIT2') title = decodeId3TextPayload(frameData) || title;
      else if (frameId === 'TPE1') artist = decodeId3TextPayload(frameData) || artist;
      else if (frameId === 'TALB') album = decodeId3TextPayload(frameData) || album;
      else if (frameId === 'TLEN') {
        const ms = parseInt(decodeId3TextPayload(frameData), 10);
        if (ms > 1000) durationSec = Math.round(ms / 1000);
      }
    }
    if (title && artist && album && durationSec) break;
  }

  return { title, artist, album, durationSec, tagByteSize };
}

function estimateMp3DurationFromSize(sizeBytes?: number, tagByteSize: number = 0): number {
  if (!sizeBytes || sizeBytes <= 50000) return 210;
  const audioBytes = Math.max(40000, sizeBytes - Math.min(tagByteSize, sizeBytes * 0.3));
  // SpotFlow downloads 320kbps MP3s (~40,000 bytes/sec). If file is smaller (<4.5MB), check if 128kbps (~16,000 bytes/sec).
  const secAt320 = Math.round(audioBytes / 40000);
  if (secAt320 >= 95 && secAt320 <= 600) {
    return secAt320;
  }
  const secAt128 = Math.round(audioBytes / 16000);
  if (secAt128 >= 95 && secAt128 <= 420) {
    return secAt128;
  }
  return Math.max(60, Math.min(600, secAt320));
}

function parseTrackMetaFromKey(
  key: string,
  artistDict?: Record<string, string>
): {
  title: string;
  artist: string;
  genreHint?: string;
} {
  const readable = extractFileStemFromKey(key);
  let rawArtist = 'Nghệ sĩ chưa rõ';
  let rawTitle = readable || 'Bài hát trên R2';

  if (readable.includes(' - ')) {
    const parts = readable.split(' - ');
    rawArtist = parts[0].trim() || 'Nghệ sĩ chưa rõ';
    rawTitle = parts.slice(1).join(' - ').trim() || readable;
  }

  const restored = parseAndCleanSlugTrack(rawTitle, rawArtist, artistDict);
  return {
    artist: restored.artist || rawArtist,
    title: restored.title || rawTitle,
    genreHint: restored.genreHint,
  };
}

let cachedR2Catalog: R2StoredTrack[] | null = null;
let cachedR2CatalogAt = 0;
let inFlightR2CatalogPromise: Promise<R2StoredTrack[]> | null = null;
const R2_CATALOG_CACHE_TTL_MS = 120_000;
const probedId3Keys = new Set<string>();

export function invalidateR2CatalogCache(): void {
  cachedR2Catalog = null;
  cachedR2CatalogAt = 0;
}

async function readR2CatalogManifest(
  client: S3Client,
  bucketName: string
): Promise<R2StoredTrack[]> {
  try {
    const res = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: CATALOG_OBJECT_KEY,
      })
    );
    const text = await res.Body?.transformToString('utf-8');
    if (!text) return [];
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as R2StoredTrack[]) : [];
  } catch {
    return [];
  }
}

export async function saveR2CatalogTracks(
  tracks: R2StoredTrack[]
): Promise<boolean> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) return false;

  try {
    const client = getR2Client(cfg);
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucketName,
        Key: CATALOG_OBJECT_KEY,
        Body: JSON.stringify(tracks),
        ContentType: 'application/json; charset=utf-8',
      })
    );
    cachedR2Catalog = tracks;
    cachedR2CatalogAt = Date.now();
    return true;
  } catch (err) {
    console.warn('[Cloudflare R2] Failed to save catalog manifest:', err);
    return false;
  }
}

function normalizeR2CompareText(raw?: string, stripD: boolean = false): string {
  let out = (raw || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripD) {
    out = out.replace(/\bd/g, '').replace(/\s+/g, ' ').trim();
  }
  return out;
}

function normalizeR2CoreTitle(rawTitle?: string, stripD: boolean = false): string {
  const cleaned = (rawTitle || '')
    .replace(/(?:\(|\[)?\b(?:feat\.?|ft\.?|featuring)\s+[^)\]]+(?:\)|\])?/gi, ' ')
    .replace(/\b(?:official\s+mv|official\s+video|official\s+audio|lyric\s+video|320kbps|128kbps)\b/gi, ' ')
    .replace(/\.(mp3|wav|flac|m4a|ogg|aac|opus)$/i, ' ')
    .replace(/^[0-9]{1,3}[\s._-]+/, '');
  return (
    normalizeR2CompareText(cleaned, stripD) ||
    normalizeR2CompareText(rawTitle, stripD)
  );
}

function extractR2ArtistTokens(rawArtist?: string, rawTitle?: string): string[] {
  const featMatches: string[] = [];
  const featRegex = /(?:\(|\[)?\b(?:feat\.?|ft\.?|featuring)\s+([^)\]]+)(?:\)|\])?/gi;
  let m: RegExpExecArray | null;
  const titleStr = rawTitle || '';
  while ((m = featRegex.exec(titleStr)) !== null) {
    if (m[1]) featMatches.push(m[1]);
  }
  const combined = [rawArtist || '', ...featMatches].join(', ');
  const placeholders = new Set(['nghe si chua ro', 'nghe si spotflow', 'unknown artist']);
  const tokens = combined
    .split(/(?:,|&|;|\/|\bx\b|\bvs\.?\b|\bfeat\.?\b|\bft\.?\b|\bwith\b|\band\b|\bva\b)/i)
    .map(p => normalizeR2CompareText(p))
    .filter(p => p.length > 0 && !placeholders.has(p));
  return Array.from(new Set(tokens)).sort();
}

function isStoredR2Audio(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('/api/r2/stream') ||
    url.includes('.r2.dev/') ||
    url.includes('.r2.cloudflarestorage.com/')
  );
}

function areR2TracksDuplicate(
  a: Pick<R2StoredTrack, 'id' | 'title' | 'artist' | 'audioUrl' | 'spotifyTrackId'>,
  b: Pick<R2StoredTrack, 'id' | 'title' | 'artist' | 'audioUrl' | 'spotifyTrackId'>
): boolean {
  if (a.id && b.id && a.id === b.id) return true;
  if (
    a.spotifyTrackId &&
    b.spotifyTrackId &&
    a.spotifyTrackId.trim() === b.spotifyTrackId.trim()
  ) {
    return true;
  }
  if (
    a.audioUrl &&
    b.audioUrl &&
    !a.audioUrl.startsWith('blob:') &&
    extractR2Key(a.audioUrl) &&
    extractR2Key(a.audioUrl) === extractR2Key(b.audioUrl)
  ) {
    return true;
  }

  const titleA = normalizeR2CoreTitle(a.title);
  const titleB = normalizeR2CoreTitle(b.title);
  const titleMatch =
    Boolean(titleA && titleB) &&
    (titleA === titleB ||
      (titleA.length >= 6 &&
        titleB.length >= 6 &&
        normalizeR2CoreTitle(a.title, true) === normalizeR2CoreTitle(b.title, true)));

  if (!titleMatch) return false;

  const artistsA = extractR2ArtistTokens(a.artist, a.title);
  const artistsB = extractR2ArtistTokens(b.artist, b.title);
  if (artistsA.length === 0 || artistsB.length === 0) return true;
  if (artistsA.join('|') === artistsB.join('|')) return true;

  for (const x of artistsA) {
    for (const y of artistsB) {
      if (x === y) return true;
      if (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))) {
        return true;
      }
    }
  }
  return false;
}

function mergeR2TrackPair(primary: R2StoredTrack, secondary: R2StoredTrack): R2StoredTrack {
  const primaryR2 = isStoredR2Audio(primary.audioUrl);
  const secondaryR2 = isStoredR2Audio(secondary.audioUrl);
  const bestAudio = primaryR2 || !secondaryR2 ? primary : secondary;
  const other = bestAudio === primary ? secondary : primary;

  const hasUsableLyrics = (t: R2StoredTrack) =>
    Boolean(t.syncedLyrics?.trim()) ||
    Boolean(t.plainLyrics?.trim()) ||
    (Array.isArray(t.lyrics) &&
      t.lyrics.length > 2 &&
      !t.lyrics.every(l => l.text.startsWith('Đang phát bản nhạc') || l.text.startsWith('Đang phát:')));

  const lyricsSource = hasUsableLyrics(bestAudio)
    ? bestAudio
    : hasUsableLyrics(other)
      ? other
      : bestAudio;

  const coverUrl =
    bestAudio.coverUrl && bestAudio.coverUrl !== DEFAULT_COVER_URL
      ? bestAudio.coverUrl
      : other.coverUrl && other.coverUrl !== DEFAULT_COVER_URL
        ? other.coverUrl
        : bestAudio.coverUrl || other.coverUrl || DEFAULT_COVER_URL;

  const bestTitle = pickBetterText(bestAudio.title, other.title, 'Bài hát');
  const bestArtist = pickBetterText(bestAudio.artist, other.artist, 'Nghệ sĩ chưa rõ');
  const bestAlbum =
    bestAudio.album && bestAudio.album !== 'Kho nhạc Cloudflare R2'
      ? bestAudio.album
      : other.album || bestAudio.album || 'Kho nhạc Soundly';
  const bestDuration =
    bestAudio.duration && bestAudio.duration !== 210
      ? bestAudio.duration
      : other.duration && other.duration !== 210
        ? other.duration
        : bestAudio.duration || other.duration || 210;
  const bestGenre =
    bestAudio.genre && bestAudio.genre !== 'Pop'
      ? bestAudio.genre
      : other.genre || bestAudio.genre || 'Pop';

  const bestId =
    !bestAudio.id.startsWith('r2-') || other.id.startsWith('r2-')
      ? bestAudio.id
      : other.id || bestAudio.id;

  return {
    ...other,
    ...bestAudio,
    id: bestId,
    title: bestTitle,
    artist: bestArtist,
    album: bestAlbum,
    genre: bestGenre,
    duration: bestDuration,
    audioUrl: bestAudio.audioUrl || other.audioUrl,
    coverUrl,
    plays: Math.max(Number(primary.plays) || 0, Number(secondary.plays) || 0),
    lyrics: lyricsSource.lyrics || bestAudio.lyrics,
    ...(lyricsSource.syncedLyrics || bestAudio.syncedLyrics
      ? { syncedLyrics: lyricsSource.syncedLyrics || bestAudio.syncedLyrics }
      : {}),
    ...(lyricsSource.plainLyrics || bestAudio.plainLyrics
      ? { plainLyrics: lyricsSource.plainLyrics || bestAudio.plainLyrics }
      : {}),
    ...(lyricsSource.lyricsMode || bestAudio.lyricsMode
      ? { lyricsMode: lyricsSource.lyricsMode || bestAudio.lyricsMode }
      : {}),
    ...(bestAudio.spotifyTrackId || other.spotifyTrackId
      ? { spotifyTrackId: bestAudio.spotifyTrackId || other.spotifyTrackId }
      : {}),
    ...(bestAudio.spotifyUrl || other.spotifyUrl
      ? { spotifyUrl: bestAudio.spotifyUrl || other.spotifyUrl }
      : {}),
    ...(bestAudio.r2AudioKey || other.r2AudioKey
      ? { r2AudioKey: bestAudio.r2AudioKey || other.r2AudioKey }
      : {}),
    ...(bestAudio.r2CoverKey || other.r2CoverKey
      ? { r2CoverKey: bestAudio.r2CoverKey || other.r2CoverKey }
      : {}),
  };
}

function areR2ArtistListsCompatible(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  if (a.join('|') === b.join('|')) return true;
  for (const x of a) {
    for (const y of b) {
      if (x === y) return true;
      if (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * O(N) hash-indexed deduplication for R2 catalog tracks.
 */
function deduplicateR2TrackList(tracks: R2StoredTrack[]): R2StoredTrack[] {
  const out: R2StoredTrack[] = [];
  const byId = new Map<string, number>();
  const bySpotifyId = new Map<string, number>();
  const byR2Key = new Map<string, number>();
  const byCoreTitle = new Map<string, number[]>();
  const byCoreTitleNoD = new Map<string, number[]>();
  const artistTokensByIndex: string[][] = [];

  const indexAt = (
    idx: number,
    t: R2StoredTrack,
    r2Key: string,
    coreTitle: string,
    coreTitleNoD: string,
    artists: string[]
  ) => {
    if (t.id) byId.set(t.id, idx);
    if (t.spotifyTrackId) bySpotifyId.set(t.spotifyTrackId.trim(), idx);
    if (r2Key) byR2Key.set(r2Key, idx);
    if (coreTitle) {
      const bucket = byCoreTitle.get(coreTitle);
      if (bucket) {
        if (!bucket.includes(idx)) bucket.push(idx);
      } else {
        byCoreTitle.set(coreTitle, [idx]);
      }
    }
    if (coreTitleNoD && coreTitleNoD.length >= 6) {
      const bucket = byCoreTitleNoD.get(coreTitleNoD);
      if (bucket) {
        if (!bucket.includes(idx)) bucket.push(idx);
      } else {
        byCoreTitleNoD.set(coreTitleNoD, [idx]);
      }
    }
    artistTokensByIndex[idx] = artists;
  };

  for (const t of tracks) {
    if (!t || !t.id) continue;
    const r2Key =
      t.audioUrl && !t.audioUrl.startsWith('blob:') ? extractR2Key(t.audioUrl) : '';
    const coreTitle = normalizeR2CoreTitle(t.title, false);
    const coreTitleNoD =
      coreTitle.length >= 6 ? normalizeR2CoreTitle(t.title, true) : '';
    const artists = extractR2ArtistTokens(t.artist, t.title);

    let dupIdx: number | undefined = byId.get(t.id);
    if (dupIdx === undefined && t.spotifyTrackId) {
      dupIdx = bySpotifyId.get(t.spotifyTrackId.trim());
    }
    if (dupIdx === undefined && r2Key) {
      dupIdx = byR2Key.get(r2Key);
    }
    if (dupIdx === undefined && coreTitle) {
      const candidates = byCoreTitle.get(coreTitle);
      if (candidates) {
        for (const candIdx of candidates) {
          if (areR2ArtistListsCompatible(artistTokensByIndex[candIdx], artists)) {
            dupIdx = candIdx;
            break;
          }
        }
      }
    }
    if (dupIdx === undefined && coreTitleNoD && coreTitleNoD.length >= 6) {
      const candidates = byCoreTitleNoD.get(coreTitleNoD);
      if (candidates) {
        for (const candIdx of candidates) {
          if (areR2ArtistListsCompatible(artistTokensByIndex[candIdx], artists)) {
            dupIdx = candIdx;
            break;
          }
        }
      }
    }

    if (dupIdx === undefined) {
      const newIdx = out.length;
      out.push(t);
      indexAt(newIdx, t, r2Key, coreTitle, coreTitleNoD, artists);
    } else {
      const merged = mergeR2TrackPair(out[dupIdx], t);
      out[dupIdx] = merged;
      const mKey =
        merged.audioUrl && !merged.audioUrl.startsWith('blob:')
          ? extractR2Key(merged.audioUrl)
          : '';
      const mTitle = normalizeR2CoreTitle(merged.title, false);
      const mTitleNoD =
        mTitle.length >= 6 ? normalizeR2CoreTitle(merged.title, true) : '';
      const mArtists = extractR2ArtistTokens(merged.artist, merged.title);
      indexAt(dupIdx, merged, mKey, mTitle, mTitleNoD, mArtists);
    }
  }
  return out;
}

async function listAllR2TrackObjects(
  client: S3Client,
  bucketName: string
): Promise<Array<{ key: string; lastModified?: Date; size?: number }>> {
  const listedTrackObjects: Array<{
    key: string;
    lastModified?: Date;
    size?: number;
  }> = [];
  let continuationToken: string | undefined;
  do {
    const listRes = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: 'tracks/',
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of listRes.Contents || []) {
      if (obj.Key && AUDIO_EXT_REGEX.test(obj.Key)) {
        listedTrackObjects.push({
          key: obj.Key,
          lastModified: obj.LastModified,
          size: obj.Size,
        });
      }
    }
    continuationToken = listRes.IsTruncated
      ? listRes.NextContinuationToken
      : undefined;
  } while (continuationToken);
  return listedTrackObjects;
}

async function listAllR2Covers(
  client: S3Client,
  cfg: R2Config
): Promise<{
  coverByStem: Map<string, string>;
  coverByDStrippedStem: Map<string, string>;
}> {
  const coverByStem = new Map<string, string>();
  const coverByDStrippedStem = new Map<string, string>();
  let coverToken: string | undefined;
  do {
    const coverRes = await client.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucketName,
        Prefix: 'covers/',
        ContinuationToken: coverToken,
      })
    );
    for (const obj of coverRes.Contents || []) {
      if (obj.Key && IMAGE_EXT_REGEX.test(obj.Key)) {
        const coverUrl = buildR2PublicUrl(cfg, obj.Key);
        const rawStem = extractFileStemFromKey(obj.Key);
        const stemNorm = normalizeStemKey(rawStem, false);
        const stemNoD = normalizeStemKey(rawStem, true);
        if (stemNorm && !coverByStem.has(stemNorm)) {
          coverByStem.set(stemNorm, coverUrl);
        }
        if (stemNoD && !coverByDStrippedStem.has(stemNoD)) {
          coverByDStrippedStem.set(stemNoD, coverUrl);
        }
        if (rawStem.includes(' - ')) {
          const titlePart = rawStem.split(' - ').slice(1).join(' - ').trim();
          const titleNorm = normalizeStemKey(titlePart, false);
          const titleNoD = normalizeStemKey(titlePart, true);
          if (titleNorm && !coverByStem.has(titleNorm)) {
            coverByStem.set(titleNorm, coverUrl);
          }
          if (titleNoD && !coverByDStrippedStem.has(titleNoD)) {
            coverByDStrippedStem.set(titleNoD, coverUrl);
          }
        }
      }
    }
    coverToken = coverRes.IsTruncated
      ? coverRes.NextContinuationToken
      : undefined;
  } while (coverToken);

  return { coverByStem, coverByDStrippedStem };
}

async function fetchR2CatalogTracksFresh(): Promise<R2StoredTrack[]> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) return [];

  try {
    const client = getR2Client(cfg);

    // Parallelize manifest read + tracks/ listing + covers/ listing
    const [manifestTracks, listedTrackObjects, { coverByStem, coverByDStrippedStem }] =
      await Promise.all([
        readR2CatalogManifest(client, cfg.bucketName),
        listAllR2TrackObjects(client, cfg.bucketName),
        listAllR2Covers(client, cfg),
      ]);

    const artistDict = buildArtistSlugDictionaryFromTracks(manifestTracks);

    const findMatchingCoverInR2 = (
      audioKey: string,
      title: string,
      artist: string
    ): string | undefined => {
      const candidates = [
        extractFileStemFromKey(audioKey),
        `${artist} - ${title}`,
        title,
      ];
      for (const cand of candidates) {
        const k1 = normalizeStemKey(cand, false);
        if (k1 && coverByStem.has(k1)) return coverByStem.get(k1);
        const k2 = normalizeStemKey(cand, true);
        if (k2 && coverByDStrippedStem.has(k2)) return coverByDStrippedStem.get(k2);
      }
      return undefined;
    };

    const sizeByTrackKey = new Map<string, number>();
    for (const item of listedTrackObjects) {
      if (typeof item.size === 'number' && item.size > 0) {
        sizeByTrackKey.set(item.key, item.size);
      }
    }

    const knownKeys = new Set(
      manifestTracks
        .flatMap(t => [t.r2AudioKey, extractR2Key(t.audioUrl)])
        .filter((k): k is string => Boolean(k))
    );
    const knownUrls = new Set(
      manifestTracks.map(t => t.audioUrl).filter(Boolean)
    );

    const missingObjects = listedTrackObjects
      .filter(item => {
        const publicUrl = buildR2PublicUrl(cfg, item.key);
        return !knownKeys.has(item.key) && !knownUrls.has(publicUrl);
      })
      .sort(
        (a, b) =>
          (b.lastModified?.getTime() || 0) - (a.lastModified?.getTime() || 0)
      );

    const hasSlugManifestTracks = manifestTracks.some(
      t => isLikelyRawSlugText(t.title) || isLikelyRawSlugText(t.artist)
    );
    const historySlugMap =
      missingObjects.length > 0 || hasSlugManifestTracks
        ? await getSpotflowHistorySlugMap()
        : new Map<string, { title: string; artist: string; album?: string }>();

    const lookupHistoryByKeyOrText = (
      audioKey: string,
      title: string,
      artist: string
    ): { title: string; artist: string; album?: string } | undefined => {
      if (historySlugMap.size === 0) return undefined;
      const rawStem = extractFileStemFromKey(audioKey);
      const candidates = [
        slugifyMusicToolKey(rawStem),
        slugifyMusicToolKey(`${artist ? `${artist}-` : ''}${title}`),
        slugifyMusicToolKey(title),
      ];
      for (const c of candidates) {
        if (c && historySlugMap.has(c)) {
          return historySlugMap.get(c);
        }
      }
      return undefined;
    };

    const isUsableId3Value = (val?: string): boolean => {
      if (!val) return false;
      const t = val.trim();
      if (!t || t.includes('\ufffd')) return false;
      if (isHyphenFilenameSlug(t) || t.includes('_')) return false;
      const lower = normalizeR2CompareText(t);
      return Boolean(
        lower &&
          lower !== 'nghe si chua ro' &&
          lower !== 'unknown artist' &&
          lower !== 'unknown' &&
          lower !== 'bai hat tren r2'
      );
    };

    const probeId3BatchForKeys = async (
      keys: string[],
      concurrency: number = 25
    ): Promise<
      Map<
        string,
        {
          title?: string;
          artist?: string;
          album?: string;
          durationSec?: number;
          tagByteSize: number;
        }
      >
    > => {
      const results = new Map<
        string,
        {
          title?: string;
          artist?: string;
          album?: string;
          durationSec?: number;
          tagByteSize: number;
        }
      >();
      for (let i = 0; i < keys.length; i += concurrency) {
        const batch = keys.slice(i, i + concurrency);
        await Promise.allSettled(
          batch.map(async key => {
            probedId3Keys.add(key);
            const res = await client.send(
              new GetObjectCommand({
                Bucket: cfg.bucketName,
                Key: key,
                Range: 'bytes=0-49151',
              }),
              { abortSignal: AbortSignal.timeout(2000) }
            );
            const bytes = await res.Body?.transformToByteArray();
            if (!bytes || bytes.length < 16) return;
            const id3 = parseId3TextFramesFromBuffer(Buffer.from(bytes));
            results.set(key, id3);
          })
        );
      }
      return results;
    };

    const applyId3ToTrack = (
      track: R2StoredTrack,
      id3: {
        title?: string;
        artist?: string;
        album?: string;
        durationSec?: number;
        tagByteSize: number;
      },
      audioKey: string
    ): boolean => {
      let changed = false;
      const wasAutoSlug =
        track.aiReason === 'Khôi phục tự động từ Cloudflare R2' ||
        !track.aiClassified ||
        isLikelyRawSlugText(track.title) ||
        !/[^\u0000-\u007f]/.test(track.title || '');

      if (
        isUsableId3Value(id3.title) &&
        id3.title &&
        (wasAutoSlug || hasVietnameseDiacriticsOrProperCase(id3.title)) &&
        id3.title.trim() !== track.title
      ) {
        track.title = id3.title.trim();
        changed = true;
      }

      const wasArtistMissingOrAuto =
        track.artist === 'Nghệ sĩ chưa rõ' ||
        isLikelyRawSlugText(track.artist) ||
        wasAutoSlug;

      if (
        isUsableId3Value(id3.artist) &&
        id3.artist &&
        (wasArtistMissingOrAuto || hasVietnameseDiacriticsOrProperCase(id3.artist)) &&
        id3.artist.trim() !== track.artist
      ) {
        track.artist = id3.artist.trim();
        changed = true;
      }

      if (
        isUsableId3Value(id3.album) &&
        id3.album &&
        (track.album === 'Kho nhạc Cloudflare R2' || !track.album)
      ) {
        track.album = id3.album.trim();
        changed = true;
      }

      if (id3.durationSec && id3.durationSec > 30 && track.duration !== id3.durationSec) {
        track.duration = id3.durationSec;
        changed = true;
      }

      if (!track.coverUrl || track.coverUrl === DEFAULT_COVER_URL) {
        const matchedCover = findMatchingCoverInR2(audioKey, track.title, track.artist);
        if (matchedCover) {
          track.coverUrl = matchedCover;
          changed = true;
        }
      }

      if (!track.id3Checked) {
        track.id3Checked = true;
        changed = true;
      }
      return changed;
    };

    // Immediately probe ID3 tags for newly uploaded R2 MP3s before saving manifest
    const missingId3Map =
      missingObjects.length > 0
        ? await probeId3BatchForKeys(
            missingObjects.slice(0, 400).map(item => item.key),
            25
          )
        : new Map();

    const recoveredTracks: R2StoredTrack[] = [];
    for (const item of missingObjects) {
      const publicUrl = buildR2PublicUrl(cfg, item.key);
      const meta = parseTrackMetaFromKey(item.key, artistDict);
      const histMatch = lookupHistoryByKeyOrText(item.key, meta.title, meta.artist);
      const id3 = missingId3Map.get(item.key);

      const finalTitle =
        (id3 && isUsableId3Value(id3.title) ? id3.title!.trim() : '') ||
        histMatch?.title ||
        meta.title;
      const finalArtist =
        (id3 && isUsableId3Value(id3.artist) ? id3.artist!.trim() : '') ||
        histMatch?.artist ||
        meta.artist;
      const finalAlbum =
        (id3 && isUsableId3Value(id3.album) ? id3.album!.trim() : '') ||
        histMatch?.album ||
        'Kho nhạc Cloudflare R2';
      const matchedCover =
        findMatchingCoverInR2(item.key, finalTitle, finalArtist) ||
        DEFAULT_COVER_URL;
      const estimatedDuration =
        (id3?.durationSec && id3.durationSec > 30 ? id3.durationSec : 0) ||
        estimateMp3DurationFromSize(item.size, id3?.tagByteSize || 0);
      const safeId = `r2-${item.key
        .replace(/^tracks\//, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 96)}`;
      recoveredTracks.push({
        id: safeId,
        title: finalTitle,
        artist: finalArtist,
        album: finalAlbum,
        audioUrl: publicUrl,
        coverUrl: matchedCover,
        duration: estimatedDuration,
        genre: meta.genreHint || 'Pop',
        releaseYear:
          item.lastModified?.getFullYear() || new Date().getFullYear(),
        bpm: 110,
        mood: 'Thư giãn',
        aiClassified: Boolean(meta.genreHint),
        aiReason: 'Khôi phục tự động từ Cloudflare R2',
        id3Checked: Boolean(id3),
        lyrics: [{ time: 5, text: `Đang phát: ${finalTitle}` }],
        plays: 0,
        r2AudioKey: item.key,
      });
    }

    let manifestUpdated = false;
    const healedManifest = manifestTracks.map(t => {
      const next = { ...t };
      const audioKey = next.r2AudioKey || extractR2Key(next.audioUrl);
      if (next.audioUrl && next.audioUrl.includes('.r2.cloudflarestorage.com/')) {
        if (audioKey) next.audioUrl = buildR2PublicUrl(cfg, audioKey);
      }
      if (next.coverUrl && next.coverUrl.includes('.r2.cloudflarestorage.com/')) {
        const k = next.r2CoverKey || extractR2Key(next.coverUrl);
        if (k) next.coverUrl = buildR2PublicUrl(cfg, k);
      }
      if (isLikelyRawSlugText(next.title) || isLikelyRawSlugText(next.artist)) {
        const histMatch = lookupHistoryByKeyOrText(audioKey || next.id, next.title, next.artist);
        if (histMatch && !isLikelyRawSlugText(histMatch.title)) {
          next.title = histMatch.title;
          next.artist = histMatch.artist;
          if (histMatch.album && next.album === 'Kho nhạc Cloudflare R2') {
            next.album = histMatch.album;
          }
          manifestUpdated = true;
        } else {
          const restored = restoreVietnameseMetadataFromSlug(
            next.title,
            next.artist,
            artistDict
          );
          if (restored.title !== next.title || restored.artist !== next.artist) {
            next.title = restored.title;
            next.artist = restored.artist;
            if (restored.genreHint && next.genre === 'Pop') {
              next.genre = restored.genreHint;
            }
            manifestUpdated = true;
          }
        }
      }
      if (isLikelyRawSlugText(next.artist) && audioKey && audioKey.startsWith('tracks/')) {
        const stem = extractFileStemFromKey(audioKey);
        const fromKey = parseAndCleanSlugTrack(stem, 'Nghệ sĩ chưa rõ', artistDict);
        if (fromKey.artist && fromKey.artist !== 'Nghệ sĩ chưa rõ') {
          next.artist = fromKey.artist;
          if (!/[^\u0000-\u007f]/.test(next.title) && fromKey.title) {
            next.title = fromKey.title;
          }
          if (fromKey.genreHint && next.genre === 'Pop') {
            next.genre = fromKey.genreHint;
          }
          manifestUpdated = true;
        }
      }
      if (!next.coverUrl || next.coverUrl === DEFAULT_COVER_URL) {
        const foundCover = findMatchingCoverInR2(
          audioKey || next.id,
          next.title,
          next.artist
        );
        if (foundCover) {
          next.coverUrl = foundCover;
          manifestUpdated = true;
        }
      }
      if ((!next.duration || next.duration === 210) && audioKey && sizeByTrackKey.has(audioKey)) {
        const est = estimateMp3DurationFromSize(sizeByTrackKey.get(audioKey));
        if (est !== 210) {
          next.duration = est;
          manifestUpdated = true;
        }
      }
      return next;
    });

    // Single O(N) pass deduplication
    const finalDeduped = deduplicateR2TrackList([...healedManifest, ...recoveredTracks]);

    // Probe unverified R2 tracks (prioritize newest tracks, unknown artists, and unaccented titles)
    const tracksNeedingId3Probe = finalDeduped
      .filter(t => {
        if (t.id3Checked) return false;
        if (!isStoredR2Audio(t.audioUrl) && !t.r2AudioKey) return false;
        const key = t.r2AudioKey || extractR2Key(t.audioUrl);
        if (!key || !key.startsWith('tracks/') || probedId3Keys.has(key)) return false;
        return (
          t.artist === 'Nghệ sĩ chưa rõ' ||
          isLikelyRawSlugText(t.title) ||
          isLikelyRawSlugText(t.artist) ||
          !/[^\u0000-\u007f]/.test(t.title || '')
        );
      })
      .reverse()
      .slice(0, 60);

    if (tracksNeedingId3Probe.length > 0) {
      const keyToTracks = new Map<string, R2StoredTrack[]>();
      for (const track of tracksNeedingId3Probe) {
        const key = track.r2AudioKey || extractR2Key(track.audioUrl);
        if (!key) continue;
        const list = keyToTracks.get(key) || [];
        list.push(track);
        keyToTracks.set(key, list);
      }
      const id3Map = await probeId3BatchForKeys(Array.from(keyToTracks.keys()), 20);
      for (const [key, id3] of id3Map.entries()) {
        const list = keyToTracks.get(key) || [];
        for (const track of list) {
          if (applyId3ToTrack(track, id3, key)) {
            manifestUpdated = true;
          }
        }
      }
    }

    cachedR2Catalog = finalDeduped;
    cachedR2CatalogAt = Date.now();

    if (manifestUpdated || recoveredTracks.length > 0) {
      void saveR2CatalogTracks(finalDeduped);
    }

    return finalDeduped;
  } catch (err) {
    console.warn('[Cloudflare R2] Failed to read catalog tracks:', err);
    return cachedR2Catalog || [];
  }
}

export async function backfillR2CatalogId3Metadata(
  maxTracks: number = 2000
): Promise<{ totalScanned: number; updatedCount: number }> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) {
    return { totalScanned: 0, updatedCount: 0 };
  }

  const client = getR2Client(cfg);
  const current = await getR2CatalogTracks(true);
  const candidates = current.filter(t => {
    if (t.id3Checked) return false;
    const key = t.r2AudioKey || extractR2Key(t.audioUrl);
    if (!key || !key.startsWith('tracks/')) return false;
    return (
      t.artist === 'Nghệ sĩ chưa rõ' ||
      isLikelyRawSlugText(t.title) ||
      isLikelyRawSlugText(t.artist) ||
      !/[^\u0000-\u007f]/.test(t.title || '')
    );
  }).slice(-maxTracks);

  let updatedCount = 0;
  const concurrency = 30;
  for (let i = 0; i < candidates.length; i += concurrency) {
    const batch = candidates.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async track => {
        const key = track.r2AudioKey || extractR2Key(track.audioUrl);
        if (!key) return;
        const res = await client.send(
          new GetObjectCommand({
            Bucket: cfg.bucketName,
            Key: key,
            Range: 'bytes=0-49151',
          }),
          { abortSignal: AbortSignal.timeout(2500) }
        );
        const bytes = await res.Body?.transformToByteArray();
        if (!bytes || bytes.length < 16) return;
        const id3 = parseId3TextFramesFromBuffer(Buffer.from(bytes));
        const hasValidTitle =
          Boolean(id3.title) &&
          !isHyphenFilenameSlug(id3.title!) &&
          !id3.title!.includes('_') &&
          !id3.title!.includes('\ufffd');
        const hasValidArtist =
          Boolean(id3.artist) &&
          !isHyphenFilenameSlug(id3.artist!) &&
          !id3.artist!.includes('_') &&
          !id3.artist!.includes('\ufffd') &&
          normalizeR2CompareText(id3.artist) !== 'nghe si chua ro';

        let changed = false;
        const wasAutoSlug =
          track.aiReason === 'Khôi phục tự động từ Cloudflare R2' ||
          !track.aiClassified ||
          isLikelyRawSlugText(track.title) ||
          !/[^\u0000-\u007f]/.test(track.title || '');

        if (hasValidTitle && id3.title && wasAutoSlug && id3.title.trim() !== track.title) {
          track.title = id3.title.trim();
          changed = true;
        }
        if (
          hasValidArtist &&
          id3.artist &&
          (wasAutoSlug || track.artist === 'Nghệ sĩ chưa rõ' || isLikelyRawSlugText(track.artist)) &&
          id3.artist.trim() !== track.artist
        ) {
          track.artist = id3.artist.trim();
          changed = true;
        }
        if (id3.album && track.album === 'Kho nhạc Cloudflare R2') {
          track.album = id3.album.trim();
          changed = true;
        }
        if (id3.durationSec && id3.durationSec > 30 && track.duration !== id3.durationSec) {
          track.duration = id3.durationSec;
          changed = true;
        }
        track.id3Checked = true;
        if (changed) updatedCount++;
      })
    );
  }

  if (candidates.length > 0) {
    const deduped = deduplicateR2TrackList(current);
    await saveR2CatalogTracks(deduped);
  }

  return { totalScanned: candidates.length, updatedCount };
}

export async function getR2CatalogTracks(
  forceRefresh: boolean = false
): Promise<R2StoredTrack[]> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) return [];

  if (
    !forceRefresh &&
    cachedR2Catalog &&
    Date.now() - cachedR2CatalogAt < R2_CATALOG_CACHE_TTL_MS
  ) {
    return cachedR2Catalog;
  }

  if (inFlightR2CatalogPromise) {
    return inFlightR2CatalogPromise;
  }

  inFlightR2CatalogPromise = fetchR2CatalogTracksFresh().finally(() => {
    inFlightR2CatalogPromise = null;
  });

  return inFlightR2CatalogPromise;
}

export async function upsertR2CatalogTracks(
  incomingTracks: R2StoredTrack[]
): Promise<R2StoredTrack[]> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) return incomingTracks;

  const client = getR2Client(cfg);
  const existing = await readR2CatalogManifest(client, cfg.bucketName);

  const merged = deduplicateR2TrackList([...incomingTracks, ...existing]);
  await saveR2CatalogTracks(merged);
  return merged;
}

export async function upsertR2CatalogTracksStrict(
  incomingTracks: R2StoredTrack[]
): Promise<R2StoredTrack[]> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) {
    const missing = getMissingR2EnvVars(cfg);
    throw new Error(
      `Database Cloudflare R2 chưa được cấu hình (Thiếu: ${missing.join(', ')}).`
    );
  }

  const client = getR2Client(cfg);
  const existing = await readR2CatalogManifest(client, cfg.bucketName);
  const merged = deduplicateR2TrackList([...incomingTracks, ...existing]);

  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucketName,
      Key: CATALOG_OBJECT_KEY,
      Body: JSON.stringify(merged),
      ContentType: 'application/json; charset=utf-8',
    })
  );
  cachedR2Catalog = merged;
  cachedR2CatalogAt = Date.now();

  return merged;
}

export async function batchUpdateR2CatalogTracks(
  updates: Array<{ id: string; patch: Partial<R2StoredTrack> }>
): Promise<number> {
  if (!Array.isArray(updates) || updates.length === 0) return 0;
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) return 0;

  const patchMap = new Map<string, Partial<R2StoredTrack>>();
  for (const item of updates) {
    if (item && item.id && item.patch) {
      patchMap.set(item.id, item.patch);
    }
  }
  if (patchMap.size === 0) return 0;

  const currentList = await getR2CatalogTracks();
  let updatedCount = 0;
  const nextList = currentList.map(track => {
    const patch = patchMap.get(track.id);
    if (!patch) return track;
    updatedCount++;
    return { ...track, ...patch };
  });

  if (updatedCount > 0) {
    await saveR2CatalogTracks(nextList);
  }
  return updatedCount;
}

export async function updateR2CatalogTrack(
  id: string,
  patch: Partial<R2StoredTrack>
): Promise<R2StoredTrack | null> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) return null;

  const client = getR2Client(cfg);
  const existing = await readR2CatalogManifest(client, cfg.bucketName);
  const idx = existing.findIndex(t => t.id === id);
  if (idx !== -1) {
    existing[idx] = { ...existing[idx], ...patch };
    await saveR2CatalogTracks(existing);
    return existing[idx];
  }

  const allR2 = await getR2CatalogTracks();
  const targetIdx = allR2.findIndex(t => t.id === id);
  if (targetIdx === -1) return null;

  allR2[targetIdx] = { ...allR2[targetIdx], ...patch };
  await saveR2CatalogTracks(allR2);
  return allR2[targetIdx];
}

export async function incrementR2CatalogTrackPlays(
  id: string
): Promise<number | null> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) return null;

  const client = getR2Client(cfg);
  const existing = await readR2CatalogManifest(client, cfg.bucketName);
  const idx = existing.findIndex(t => t.id === id);

  if (idx !== -1) {
    const nextPlays = Math.max(0, Number(existing[idx].plays) || 0) + 1;
    existing[idx] = { ...existing[idx], plays: nextPlays };
    await saveR2CatalogTracks(existing);
    return nextPlays;
  }

  const allR2 = await getR2CatalogTracks();
  const recovered = allR2.find(t => t.id === id);
  if (!recovered) return null;

  const nextPlays = Math.max(0, Number(recovered.plays) || 0) + 1;
  const updated = [{ ...recovered, plays: nextPlays }, ...existing];
  await saveR2CatalogTracks(updated);
  return nextPlays;
}

export async function deleteR2CatalogTrack(id: string): Promise<boolean> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) return false;

  const client = getR2Client(cfg);
  const existing = await readR2CatalogManifest(client, cfg.bucketName);
  let target = existing.find(t => t.id === id);
  const filtered = existing.filter(t => t.id !== id);
  if (filtered.length !== existing.length) {
    await saveR2CatalogTracks(filtered);
  }
  if (!target) {
    const allR2 = await getR2CatalogTracks();
    target = allR2.find(t => t.id === id);
  }
  if (cachedR2Catalog) {
    cachedR2Catalog = cachedR2Catalog.filter(t => t.id !== id);
    cachedR2CatalogAt = Date.now();
  }
  if (target?.r2AudioKey) {
    await deleteObjectFromR2(target.r2AudioKey);
  } else if (target?.audioUrl) {
    await deleteObjectFromR2(target.audioUrl);
  }
  if (target?.r2CoverKey) {
    await deleteObjectFromR2(target.r2CoverKey);
  } else if (target?.coverUrl) {
    await deleteObjectFromR2(target.coverUrl);
  }
  return true;
}
