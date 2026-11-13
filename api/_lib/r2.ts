import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
  releaseYear: number;
  lyrics: Array<{ time: number; text: string }>;
  bpm?: number;
  mood?: string;
  plays?: number;
  aiClassified?: boolean;
  aiReason?: string;
  spotifyTrackId?: string;
  spotifyUrl?: string;
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
      process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID
    ),
    accessKeyId: cleanEnvValue(
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
    ),
    secretAccessKey: cleanEnvValue(
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
        process.env.R2_SECRET_ACCESS_KEY
    ),
    bucketName: cleanEnvValue(
      process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME
    ),
    publicDomain: cleanEnvValue(
      process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN ||
        process.env.R2_PUBLIC_DOMAIN ||
        process.env.R2_PUBLIC_URL
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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.-]/g, '_')
    .replace(/_+/g, '_');
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

  const client = getR2Client(cfg);
  const cleanName = sanitizeFileName(originalFileName || 'audio.mp3');
  const key = `tracks/${Date.now()}-${cleanName}`;

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
  const cleanName = sanitizeFileName(originalFileName);
  const key = `tracks/${Date.now()}-${cleanName}`;

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
  const cleanName = sanitizeFileName(originalFileName || 'cover.jpg');
  const key = `covers/${Date.now()}-${cleanName}`;

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
    let key = audioUrlOrKey;
    if (
      audioUrlOrKey.startsWith('http://') ||
      audioUrlOrKey.startsWith('https://')
    ) {
      const parsed = new URL(audioUrlOrKey);
      key = parsed.pathname.replace(/^\/+/, '');
    }

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

function parseTrackMetaFromKey(key: string): { title: string; artist: string } {
  const fileName = key.split('/').pop() || key;
  const withoutTimestamp = fileName.replace(/^\d{10,}-/, '');
  const withoutExt = withoutTimestamp.replace(/\.[^/.]+$/, '');
  const readable = withoutExt.replace(/_/g, ' ').trim();

  if (readable.includes(' - ')) {
    const parts = readable.split(' - ');
    return {
      artist: parts[0].trim() || 'Nghệ sĩ chưa rõ',
      title: parts.slice(1).join(' - ').trim() || readable,
    };
  }
  return {
    artist: 'Nghệ sĩ chưa rõ',
    title: readable || 'Bài hát trên R2',
  };
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
        Body: JSON.stringify(tracks, null, 2),
        ContentType: 'application/json; charset=utf-8',
      })
    );
    return true;
  } catch (err) {
    console.warn('[Cloudflare R2] Failed to save catalog manifest:', err);
    return false;
  }
}

export async function getR2CatalogTracks(): Promise<R2StoredTrack[]> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) return [];

  try {
    const client = getR2Client(cfg);
    const manifestTracks = await readR2CatalogManifest(client, cfg.bucketName);

    // Also scan tracks/ prefix in R2 to recover any audio files uploaded before manifest existed
    const listedKeys: Array<{ key: string; lastModified?: Date }> = [];
    let continuationToken: string | undefined;
    do {
      const listRes = await client.send(
        new ListObjectsV2Command({
          Bucket: cfg.bucketName,
          Prefix: 'tracks/',
          ContinuationToken: continuationToken,
        })
      );
      for (const obj of listRes.Contents || []) {
        if (obj.Key && AUDIO_EXT_REGEX.test(obj.Key)) {
          listedKeys.push({
            key: obj.Key,
            lastModified: obj.LastModified,
          });
        }
      }
      continuationToken = listRes.IsTruncated
        ? listRes.NextContinuationToken
        : undefined;
    } while (continuationToken);

    const knownKeys = new Set(
      manifestTracks.map(t => extractR2Key(t.audioUrl)).filter(Boolean)
    );
    const knownUrls = new Set(
      manifestTracks.map(t => t.audioUrl).filter(Boolean)
    );

    const recoveredTracks: R2StoredTrack[] = [];
    for (const item of listedKeys.sort(
      (a, b) =>
        (b.lastModified?.getTime() || 0) - (a.lastModified?.getTime() || 0)
    )) {
      const publicUrl = buildR2PublicUrl(cfg, item.key);
      if (knownKeys.has(item.key) || knownUrls.has(publicUrl)) continue;
      const meta = parseTrackMetaFromKey(item.key);
      const safeId = `r2-${item.key
        .replace(/^tracks\//, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 96)}`;
      recoveredTracks.push({
        id: safeId,
        title: meta.title,
        artist: meta.artist,
        album: 'Kho nhạc Cloudflare R2',
        audioUrl: publicUrl,
        coverUrl: DEFAULT_COVER_URL,
        duration: 210,
        genre: 'Pop',
        releaseYear:
          item.lastModified?.getFullYear() || new Date().getFullYear(),
        bpm: 110,
        mood: 'Thư giãn',
        aiClassified: false,
        aiReason: 'Khôi phục tự động từ Cloudflare R2',
        lyrics: [{ time: 5, text: `Đang phát: ${meta.title}` }],
        plays: 0,
      });
    }

    const healedManifest = manifestTracks.map(t => {
      const next = { ...t };
      if (next.audioUrl && next.audioUrl.includes('.r2.cloudflarestorage.com/')) {
        const k = extractR2Key(next.audioUrl);
        if (k) next.audioUrl = buildR2PublicUrl(cfg, k);
      }
      if (next.coverUrl && next.coverUrl.includes('.r2.cloudflarestorage.com/')) {
        const k = extractR2Key(next.coverUrl);
        if (k) next.coverUrl = buildR2PublicUrl(cfg, k);
      }
      return next;
    });

    return [...healedManifest, ...recoveredTracks];
  } catch (err) {
    console.warn('[Cloudflare R2] Failed to read catalog tracks:', err);
    return [];
  }
}

export async function upsertR2CatalogTracks(
  incomingTracks: R2StoredTrack[]
): Promise<R2StoredTrack[]> {
  const cfg = loadR2Config();
  if (!isR2Configured(cfg)) return incomingTracks;

  const client = getR2Client(cfg);
  const existing = await readR2CatalogManifest(client, cfg.bucketName);

  // Deduplicate incoming by id (keeping latest entry)
  const dedupedIncoming: R2StoredTrack[] = [];
  const seenIncoming = new Set<string>();
  for (const t of incomingTracks) {
    if (!t.id || seenIncoming.has(t.id)) continue;
    seenIncoming.add(t.id);
    dedupedIncoming.push(t);
  }

  const incomingIds = new Set(dedupedIncoming.map(t => t.id));
  const merged = [
    ...dedupedIncoming,
    ...existing.filter(t => !incomingIds.has(t.id)),
  ];

  await saveR2CatalogTracks(merged);
  return merged;
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
  if (idx === -1) return null;

  existing[idx] = { ...existing[idx], ...patch };
  await saveR2CatalogTracks(existing);
  return existing[idx];
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
  if (target?.audioUrl) {
    await deleteObjectFromR2(target.audioUrl);
  }
  if (target?.coverUrl) {
    await deleteObjectFromR2(target.coverUrl);
  }
  return true;
}
