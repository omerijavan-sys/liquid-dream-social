import { toast } from "sonner";

/** Longest side allowed for uploaded photos / videos. Phones shoot far more than a feed ever shows. */
const MAX_IMAGE_SIDE = 1920;
const MAX_VIDEO_SIDE = 1280;
const SKIP_VIDEO_UNDER = 6 * 1024 * 1024; // already small enough
const SKIP_IMAGE_UNDER = 900 * 1024;

/** Re-encodes big JPEG/WebP photos in the browser. Returns the original file if nothing is gained. */
export async function compressImage(file: File): Promise<File> {
  try {
    if (!/^image\/(jpeg|webp)$/.test(file.type) || file.size < SKIP_IMAGE_UNDER) return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h); bmp.close?.();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size * 0.95) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}

/**
 * Re-encodes a video to H.264/AAC MP4 at up to 1280px using the device's hardware encoder (WebCodecs).
 * Typically 5-10x smaller. Falls back to the original file whenever the browser can't do it or it fails.
 */
export async function compressVideo(file: File): Promise<File> {
  const toastId = `compress-${Date.now()}`;
  try {
    if (file.size < SKIP_VIDEO_UNDER || typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return file;
    const { Input, Output, Conversion, ALL_FORMATS, BlobSource, BufferTarget, Mp4OutputFormat, QUALITY_MEDIUM } = await import("mediabunny");
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track) return file;
    const w = track.displayWidth, h = track.displayHeight;
    const scale = Math.min(1, MAX_VIDEO_SIDE / Math.max(w, h));
    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input, output,
      video: { width: Math.round((w * scale) / 2) * 2, codec: "avc", quality: QUALITY_MEDIUM },
      audio: { codec: "aac" },
    });
    if (!conversion.isValid) return file;
    toast.loading("Optimising video…", { id: toastId });
    conversion.onProgress = (p: number) => toast.loading(`Optimising video… ${Math.round(p * 100)}%`, { id: toastId });
    await conversion.execute();
    const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer;
    if (!buffer || buffer.byteLength === 0 || buffer.byteLength >= file.size * 0.9) return file;
    return new File([buffer], file.name.replace(/\.\w+$/, "") + ".mp4", { type: "video/mp4" });
  } catch (e) {
    console.warn("video compression skipped", e);
    return file;
  } finally { toast.dismiss(toastId); }
}

export async function compressForUpload(file: File): Promise<File> {
  if (file.type.startsWith("video/")) return compressVideo(file);
  if (file.type.startsWith("image/")) return compressImage(file);
  return file;
}
