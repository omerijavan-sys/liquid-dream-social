import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * POST /api/upload-url  { path, contentType, size }  (Authorization: Bearer <Supabase access token>)
 * Verifies the caller with Supabase Auth, then returns a short-lived presigned PUT URL for Cloudflare R2.
 * The path must start with the caller's own user id, the same rule the old Supabase storage policy enforced.
 * R2 keys live only in Vercel env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
 */
const SB_URL = process.env.VITE_SUPABASE_URL || "https://nrtvvddlnreqskzqksss.supabase.co";
const SB_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const MAX_BYTES = 300 * 1024 * 1024;
const CACHE = "public, max-age=31536000";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

export async function POST(request: Request): Promise<Response> {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return json({ error: "Storage is not configured" }, 503);

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in required" }, 401);
  const who = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!who || !who.ok) return json({ error: "Invalid session" }, 401);
  const user = (await who.json()) as { id?: string; is_anonymous?: boolean };
  if (!user.id || user.is_anonymous) return json({ error: "Sign in required" }, 401);

  let body: { path?: string; contentType?: string; size?: number };
  try { body = await request.json(); } catch { return json({ error: "Bad request" }, 400); }
  const path = String(body.path || "");
  const contentType = String(body.contentType || "application/octet-stream");
  const size = Number(body.size);
  if (!path.startsWith(`${user.id}/`) || path.includes("..") || !/^[A-Za-z0-9._\-/]{3,300}$/.test(path)) return json({ error: "Invalid path" }, 400);
  if (!/^(image|video|audio)\//.test(contentType)) return json({ error: "Unsupported file type" }, 400);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) return json({ error: "File too large (max 300 MB)" }, 413);

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: path, ContentType: contentType, ContentLength: size, CacheControl: CACHE }),
    { expiresIn: 600 },
  );
  return json({ url, headers: { "Content-Type": contentType, "Cache-Control": CACHE } });
}
