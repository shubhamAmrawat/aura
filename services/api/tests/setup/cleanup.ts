import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { sql } from "./db";

// Only these two shapes are ever accepted — anything else throws before touching the DB.
const SAFE_PATTERN = /^aura-test\+[a-z0-9-]*%@example\.com$/;

function r2(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

async function deleteR2Prefix(client: S3Client, prefix: string): Promise<number> {
  let deleted = 0;
  let token: string | undefined;
  do {
    const list = await client.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME!, Prefix: prefix, ContinuationToken: token,
    }));
    const keys = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (keys.length) {
      await client.send(new DeleteObjectsCommand({
        Bucket: process.env.R2_BUCKET_NAME!, Delete: { Objects: keys },
      }));
      deleted += keys.length;
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}

/**
 * Delete every test user matching `emailPattern` and everything they own:
 * DB rows (children first) + R2 objects under avatars/ covers/ wallpapers/<userId>/.
 */
export async function cleanupTestData(emailPattern: string) {
  if (!SAFE_PATTERN.test(emailPattern)) {
    throw new Error(`Unsafe cleanup pattern refused: ${emailPattern}`);
  }

  const users = await sql<{ id: string }[]>`SELECT id FROM users WHERE email LIKE ${emailPattern}`;
  const ids = users.map((u) => u.id);

  const counts = await sql.begin(async (tx) => {
    const c: Record<string, number> = {};
    if (ids.length) {
      const wp = await tx<{ id: string }[]>`SELECT id FROM wallpapers WHERE uploader_id = ANY(${ids}::uuid[])`;
      const wpIds = wp.map((w) => w.id);
      const col = await tx<{ id: string }[]>`SELECT id FROM collections WHERE user_id = ANY(${ids}::uuid[])`;
      const colIds = col.map((x) => x.id);

      c.collection_wallpapers = (await tx`
        DELETE FROM collection_wallpapers
        WHERE collection_id = ANY(${colIds}::uuid[]) OR wallpaper_id = ANY(${wpIds}::uuid[])`).count;
      c.collection_covers_nulled = (await tx`
        UPDATE collections SET cover_wallpaper_id = NULL
        WHERE cover_wallpaper_id = ANY(${wpIds}::uuid[])`).count;
      c.likes = (await tx`
        DELETE FROM likes WHERE user_id = ANY(${ids}::uuid[]) OR wallpaper_id = ANY(${wpIds}::uuid[])`).count;
      c.downloads = (await tx`
        DELETE FROM downloads WHERE user_id = ANY(${ids}::uuid[]) OR wallpaper_id = ANY(${wpIds}::uuid[])`).count;
      c.collections = (await tx`DELETE FROM collections WHERE id = ANY(${colIds}::uuid[])`).count;
      c.reviews_nulled = (await tx`
        UPDATE wallpapers SET reviewed_by = NULL WHERE reviewed_by = ANY(${ids}::uuid[])`).count;
      c.admin_actions = (await tx`
        DELETE FROM admin_actions
        WHERE admin_id = ANY(${ids}::uuid[])
           OR target_id = ANY(${[...ids, ...wpIds]}::text[])`).count;
      c.wallpapers = (await tx`DELETE FROM wallpapers WHERE id = ANY(${wpIds}::uuid[])`).count;
      c.users = (await tx`DELETE FROM users WHERE id = ANY(${ids}::uuid[])`).count;
    }
    // OTPs can exist without a user (e.g. send-otp tests that never sign up)
    c.otps = (await tx`DELETE FROM otps WHERE email LIKE ${emailPattern}`).count;
    return c;
  });

  let r2Deleted = 0;
  if (ids.length) {
    const client = r2();
    for (const id of ids) {
      for (const folder of ["avatars", "covers", "wallpapers"]) {
        r2Deleted += await deleteR2Prefix(client, `${folder}/${id}/`);
      }
    }
  }
  return { ...counts, r2Objects: r2Deleted };
}
