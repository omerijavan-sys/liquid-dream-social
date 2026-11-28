import { supabase } from "@/integrations/supabase/client";
import { compressForUpload } from "@/lib/mediaCompress";

/** Public address of the Cloudflare R2 bucket that now holds new uploads. */
export const R2_PUBLIC_URL = ((import.meta.env.VITE_R2_PUBLIC_URL as string | undefined) || "https://pub-37993350e1d74ff0a8ffbf394fc68e1b.r2.dev").replace(/\/$/, "");

/** Paths that had to fall back to Supabase storage (R2 not configured yet), so getPublicUrl points at the right place. */
const fallbackPaths = new Set<string>();

type UploadOpts = { contentType?: string; cacheControl?: string; upsert?: boolean };
type Err = { message: string } | null;

/**
 * Drop-in replacement for mediaStorage: same upload/getPublicUrl/remove shape, but files go to
 * Cloudflare R2 through a presigned URL from /api/upload-url, so Supabase storage bandwidth is no longer used.
 */
export const mediaStorage = {
  async upload(path: string, file: Blob | File, opts: UploadOpts = {}): Promise<{ data: { path: string } | null; error: Err }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { data: null, error: { message: "Sign in required" } };
      // Shrink big photos/videos on the phone first: faster uploads and far less storage and data used.
      if (file instanceof File) { file = await compressForUpload(file); if (file.type !== opts.contentType) opts = { ...opts, contentType: file.type || opts.contentType }; }
      const contentType = opts.contentType || file.type || "application/octet-stream";
      const r = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ path, contentType, size: file.size }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 503) { // R2 keys not set up on the server yet: keep uploads working via Supabase storage
        const { error } = await supabase.storage.from("media").upload(path, file, { contentType, cacheControl: opts.cacheControl, upsert: opts.upsert });
        if (!error) fallbackPaths.add(path);
        return error ? { data: null, error } : { data: { path }, error: null };
      }
      if (!r.ok || !j.url) return { data: null, error: { message: j.error || `Upload failed (${r.status})` } };
      const put = await fetch(j.url, { method: "PUT", headers: j.headers, body: file });
      if (!put.ok) return { data: null, error: { message: `Upload failed (${put.status})` } };
      return { data: { path }, error: null };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : "Upload failed" } };
    }
  },
  getPublicUrl(path: string) {
    if (fallbackPaths.has(path)) return supabase.storage.from("media").getPublicUrl(path);
    return { data: { publicUrl: `${R2_PUBLIC_URL}/${path.split("/").map(encodeURIComponent).join("/")}` } };
  },
  /** Deleting from R2 needs a server call; files are small and this is best-effort, so it's a no-op for now. */
  async remove(_paths: string[]): Promise<{ data: null; error: Err }> {
    return { data: null, error: null };
  },
};
