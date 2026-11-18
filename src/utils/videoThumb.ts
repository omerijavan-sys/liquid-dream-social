import { supabase } from "@/integrations/supabase/client";

/** Grab a still frame from a video file to use as a cover picture. */
export async function captureVideoThumb(file: File | Blob, at = 0.4): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), 8000);
      video.onloadeddata = () => { clearTimeout(t); resolve(); };
      video.onerror = () => { clearTimeout(t); reject(new Error("load")); };
    });
    const target = Math.min(at, (video.duration || 1) / 2);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = target;
      setTimeout(resolve, 3000);
    });
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 1280;
    const scale = Math.min(1, 720 / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext("2d")?.drawImage(video, 0, 0, c.width, c.height);
    return await new Promise<Blob | null>((resolve) => c.toBlob((b) => resolve(b), "image/jpeg", 0.8));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Captures and uploads a cover; returns its public URL (or null when it can't be made). */
export async function uploadVideoCover(userId: string, file: File | Blob): Promise<string | null> {
  const blob = await captureVideoThumb(file);
  if (!blob) return null;
  const path = `${userId}/cover_${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: "image/jpeg" });
  if (error) return null;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}
