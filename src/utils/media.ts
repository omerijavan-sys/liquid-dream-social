export const isVideoMedia = (url: string) => /\.(mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i.test(url);
export const CAMERA_CONSTRAINTS = { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 } };
export const VIDEO_BITRATE = 8_000_000;
/**
 * Recorder formats, best first for smooth playback everywhere: H.264 MP4 (hardware decoding, plays on every phone and
 * in iOS Safari), then VP8 (light on weak CPUs), then VP9/WebM.
 */
const RECORDER_MIMES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"];
export const pickVideoMime = (): string | undefined =>
  typeof MediaRecorder === "undefined" ? undefined : RECORDER_MIMES.find((m) => MediaRecorder.isTypeSupported(m));
export const videoExt = (mime: string) => (mime.includes("mp4") ? "mp4" : "webm");
/** Files are named with a timestamp and never change, so devices and the CDN may keep them for a year. */
export const UPLOAD_CACHE = "31536000";

/** Spread on every <video>: inline playback on old iOS/Android WebViews. */
export const INLINE_VIDEO_ATTRS = { playsInline: true, "webkit-playsinline": "true" } as const;

/** Upload guardrails. Raw files are compressed afterwards, so the raw limit is generous; the final file must stay streamable. */
export const MAX_RAW_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_FINAL_VIDEO_BYTES = 60 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 180;

const readBytes = async (f: Blob, from: number, len: number) => new Uint8Array(await f.slice(from, from + len).arrayBuffer());
const ascii = (b: Uint8Array, from: number, len: number) => String.fromCharCode(...b.slice(from, from + len));

/** Returns an error message, or null when the file is acceptable. */
export const validateVideoFile = (f: File): string | null => {
  if (!f.type.startsWith("video/")) return "Please choose a video file";
  if (f.size > MAX_RAW_VIDEO_BYTES) return `This video is ${(f.size / 1048576).toFixed(0)} MB. The limit is ${MAX_RAW_VIDEO_BYTES / 1048576} MB, please trim it first`;
  return null;
};

/**
 * Final check before upload, after compression. Android WebView and iOS decode H.264/AAC MP4 in hardware, so MP4 is the
 * only format we call "safe"; WebM still uploads but we flag it. Returns { error } to block, { warn } to continue.
 */
export const checkUploadable = async (f: File): Promise<{ error?: string; warn?: string }> => {
  if (f.size > MAX_FINAL_VIDEO_BYTES) return { error: `This video is still ${(f.size / 1048576).toFixed(0)} MB after optimizing. Keep it under ${MAX_FINAL_VIDEO_BYTES / 1048576} MB (try a shorter clip)` };
  if (f.type.includes("mp4") || /\.(mp4|m4v|mov)$/i.test(f.name)) {
    try {
      const head = await readBytes(f, 0, 12);
      if (ascii(head, 4, 4) !== "ftyp") return { warn: "This MP4 may not play on every phone." };
    } catch { /* unreadable header: let the upload proceed */ }
    return {};
  }
  return { warn: "This video isn't MP4 (H.264), so it may stutter on some Android phones." };
};
