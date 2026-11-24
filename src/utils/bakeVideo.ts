import { pickVideoMime } from "@/utils/media";
/**
 * Burns a colour filter into a video by replaying it onto a canvas and recording the result (runs in real time).
 * Returns the original file if the browser can't do it or the clip is too long to wait for.
 */
export async function bakeVideoFilter(src: File, css: string, onProgress?: (pct: number) => void, opts: { maxSide?: number; bitrate?: number; onlyIfHeavy?: boolean } = {}): Promise<File> {
  const compress = opts.onlyIfHeavy !== undefined;
  if ((css === "none" && !compress) || typeof MediaRecorder === "undefined") return src;
  const url = URL.createObjectURL(src);
  try {
    const video = document.createElement("video");
    video.src = url; video.playsInline = true; video.preload = "auto"; video.crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => { video.onloadedmetadata = () => res(); video.onerror = () => rej(new Error("load")); });
    const dur = video.duration;
    if (!Number.isFinite(dur) || dur > 180) return src;
    const w = video.videoWidth || 720, h = video.videoHeight || 1280;
    const maxSide = opts.maxSide ?? 1280;
    if (opts.onlyIfHeavy && src.size < 10_000_000 && Math.max(w, h) <= maxSide) return src; // already light
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof canvas.captureStream !== "function") return src;
    if (css !== "none") ctx.filter = css;

    const out = canvas.captureStream(30);
    let ac: AudioContext | null = null;
    try {
      ac = new AudioContext();
      const source = ac.createMediaElementSource(video);
      const dest = ac.createMediaStreamDestination();
      source.connect(dest); // not connected to the speakers, so baking is silent
      dest.stream.getAudioTracks().forEach((t) => out.addTrack(t));
    } catch { /* no audio track available */ }

    const mime = pickVideoMime();
    const rec = new MediaRecorder(out, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: opts.bitrate ?? 5_000_000, audioBitsPerSecond: 128000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>((res) => { rec.onstop = () => res(); });
    let raf = 0;
    const paint = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      onProgress?.(Math.min(99, Math.round((video.currentTime / dur) * 100)));
      raf = requestAnimationFrame(paint);
    };
    rec.start(500);
    await ac?.resume().catch(() => undefined);
    await video.play();
    paint();
    await new Promise<void>((res) => { video.onended = () => res(); setTimeout(res, (dur + 5) * 1000); });
    cancelAnimationFrame(raf);
    rec.stop(); await done;
    void ac?.close();
    const mp4 = !!mime?.startsWith("video/mp4");
    const blob = new Blob(chunks, { type: mp4 ? "video/mp4" : "video/webm" });
    if (blob.size < 1000 || (compress && blob.size >= src.size)) return src; // never make it bigger
    return new File([blob], `video-${Date.now()}.${mp4 ? "mp4" : "webm"}`, { type: blob.type });
  } catch {
    return src;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Burns a colour filter into a photo and returns a JPEG. */
export async function bakeImageFilter(src: File, css: string): Promise<File> {
  if (css === "none") return src;
  const url = URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d"); if (!ctx) return src;
    ctx.filter = css; ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    return blob ? new File([blob], `story-${Date.now()}.jpg`, { type: "image/jpeg" }) : src;
  } catch { return src; } finally { URL.revokeObjectURL(url); }
}

/** Shrinks heavy phone videos (big files or above 720p) to ~720p / 2.5 Mbps so they stream and decode smoothly. Light clips are returned untouched. */
export const compressVideo = (src: File, onProgress?: (pct: number) => void) =>
  bakeVideoFilter(src, "none", onProgress, { maxSide: 1280, bitrate: 2_500_000, onlyIfHeavy: true });
