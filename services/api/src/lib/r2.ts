import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function generateUploadUrl(
  folder: string,
  fileType: string
): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
  // generate a unique filename
  const extension = fileType.split("/")[1]; // "image/jpeg" → "jpeg"
  const key = `${folder}/${crypto.randomUUID()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: fileType,
  });

  // presigned URL expires in 60 seconds
  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 60 });

  // the public URL where the file will be accessible after upload
  const fileUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

  return { uploadUrl, fileUrl, key };
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
  });
  await r2Client.send(command);
}