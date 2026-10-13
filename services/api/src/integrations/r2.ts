import { env } from "../config/env";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function generateUploadUrl(
  folder: string,
  fileType: string,
  ownerId?: string,
  opts: { expiresIn?: number; contentLength?: number } = {}
): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
  const key = buildObjectKey(folder, fileType, ownerId);

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: fileType,
    // Signed into the URL when given: R2 refuses a body of any other size
    ...(opts.contentLength ? { ContentLength: opts.contentLength } : {}),
  });

  // presigned URL expires in 5 minutes unless the caller asks for longer
  const uploadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: opts.expiresIn ?? 300,
    ...(opts.contentLength ? { signableHeaders: new Set(["content-length", "content-type"]) } : {}),
  });

  // the public URL where the file will be accessible after upload
  const fileUrl = `${env.R2_PUBLIC_URL}/${key}`;

  return { uploadUrl, fileUrl, key };
}

export function buildObjectKey(folder: string, fileType: string, ownerId?: string): string {
  const extension = fileType.split("/")[1];
  const ownerPrefix = ownerId ? `${ownerId}/` : "";
  return `${folder}/${ownerPrefix}${crypto.randomUUID()}.${extension}`;
}

export async function uploadFileToKey(
  key: string,
  body: Uint8Array | Buffer,
  fileType: string,
  cacheControl?: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: fileType,
    Body: body,
    ...(cacheControl ? { CacheControl: cacheControl } : {}),
  });
  await r2Client.send(command);
  return `${env.R2_PUBLIC_URL}/${key}`;
}

// The bucket's old public dev address (rows saved before cdn.aurora-walls.com).
const LEGACY_PUBLIC_HOST = "pub-7a9b0809a66e45e99632a890f4327988.r2.dev";

/**
 * R2 object key for a public URL that points at our bucket, or null.
 * Accepts the current R2_PUBLIC_URL and the legacy r2.dev address.
 */
export function keyFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const { hostname, pathname, protocol } = new URL(url);
    if (protocol !== "https:") return null;
    const own = env.R2_PUBLIC_URL ? new URL(env.R2_PUBLIC_URL).hostname : null;
    if (hostname !== own && hostname !== LEGACY_PUBLIC_HOST) return null;
    const key = decodeURIComponent(pathname.replace(/^\/+/, ""));
    return key || null;
  } catch {
    return null;
  }
}

/** Read an object from the bucket (avoids the public CDN, which may block server clients). */
export async function getFileBytes(key: string): Promise<Buffer> {
  const res = await r2Client.send(new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME!, Key: key }));
  if (!res.Body) throw new Error(`Empty object: ${key}`);
  return Buffer.from(await res.Body.transformToByteArray());
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: env.R2_BUCKET_NAME!,
    Key: key,
  });
  await r2Client.send(command);
}