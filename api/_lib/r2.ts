import {
  S3Client,
  PutObjectCommand,
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
  return `https://${cfg.bucketName}.${cfg.accountId}.r2.cloudflarestorage.com/${key}`;
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
  fallbackName: string
): Promise<{ audioUrl: string; key: string; size: number }> {
  const res = await fetch(remoteUrl);
  if (!res.ok) {
    throw new Error(
      `Không thể tải tệp âm thanh từ nguồn ngoài (HTTP ${res.status}).`
    );
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = res.headers.get('content-type') || 'audio/mpeg';

  return uploadBufferToR2(buffer, fallbackName, contentType);
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

    if (!key.startsWith('tracks/')) {
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
