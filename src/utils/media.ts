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
