import { pickVideoMime, videoExt } from "@/utils/media";
/**
 * In-browser video composer: plays photos and videos one after another onto a canvas (with filters, trims and silent-part cuts)
 * and records the result as a single video. Runs in real time, so progress is reported while it works.
 */
export type Seg = {
  file: File;
  kind: "image" | "video";
  /** CSS filter string, e.g. "contrast(1.2) saturate(1.3)" or "none". */
  css: string;
  /** Seconds ranges of the source to keep (trim + auto-cut). Omitted = whole clip. */
  ranges?: [number, number][];
  /** How long a photo stays on screen. */
  secs?: number;
};

const loadVideo = (url: string) => new Promise<HTMLVideoElement>((res, rej) => {
  const v = document.createElement("video");
  v.playsInline = true; v.preload = "auto"; v.src = url;
  v.onloadeddata = () => res(v); v.onerror = () => rej(new Error("Couldn't read a video"));
});
const loadImage = (url: string) => new Promise<HTMLImageElement>((res, rej) => {
  const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Couldn't read a photo")); i.src = url;
});

/** Finds the parts of a video that have sound (drops long silences). Returns the whole clip if it can't tell. */
export async function detectKeepRanges(file: File, duration: number): Promise<[number, number][]> {
  const whole: [number, number][] = [[0, duration]];
  if (file.size > 200 * 1024 * 1024) return whole;
  try {
    const ac = new AudioContext();
    const buf = await ac.decodeAudioData(await file.arrayBuffer());
    void ac.close();
    const data = buf.getChannelData(0), win = Math.floor(buf.sampleRate * 0.1);
    const rms: number[] = [];
    for (let i = 0; i + win <= data.length; i += win) { let s = 0; for (let j = 0; j < win; j += 4) s += data[i + j] * data[i + j]; rms.push(Math.sqrt(s / (win / 4))); }
    if (rms.length < 10) return whole;
    const sorted = [...rms].sort((a, b) => a - b);
    const floor = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
    const peak = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const thr = Math.max(0.008, floor * 1.8, peak * 0.12);
    let out: [number, number][] = [];
    let start = -1;
    rms.forEach((v, i) => {
      if (v >= thr && start < 0) start = i;
      if ((v < thr || i === rms.length - 1) && start >= 0) { out.push([start * 0.1, (v < thr ? i : i + 1) * 0.1]); start = -1; }
    });
    // join gaps under 0.8s, pad edges, drop blips
    const merged: [number, number][] = [];
    for (const r of out) { const last = merged[merged.length - 1]; if (last && r[0] - last[1] < 0.8) last[1] = r[1]; else merged.push([...r]); }
    out = merged.map(([a, b]) => [Math.max(0, a - 0.2), Math.min(duration, b + 0.25)] as [number, number]).filter(([a, b]) => b - a >= 0.6);
    const kept = out.reduce((n, [a, b]) => n + (b - a), 0);
    return out.length && kept < duration * 0.97 ? out : whole;
  } catch { return whole; }
}

export async function composeVideo(segs: Seg[], opts: { width: number; height: number; onProgress?: (pct: number) => void }): Promise<File> {
  const { width, height } = opts;
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx || typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") throw new Error("This device can't edit videos in the app.");

  const urls = segs.map((s) => URL.createObjectURL(s.file));
  const ac = new AudioContext();
  const dest = ac.createMediaStreamDestination();
  const out = canvas.captureStream(30);
  dest.stream.getAudioTracks().forEach((t) => out.addTrack(t));
  const mime = pickVideoMime();
  const rec = new MediaRecorder(out, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });

  const total = segs.reduce((n, s) => n + (s.kind === "image" ? (s.secs ?? 3) : (s.ranges ?? [[0, 1]]).reduce((m, [a, b]) => m + (b - a), 0)), 0) || 1;
  let done = 0;
  const report = (extra: number) => opts.onProgress?.(Math.min(99, Math.round(((done + extra) / total) * 100)));

  const draw = (src: CanvasImageSource, sw: number, sh: number, css: string) => {
    ctx.filter = "none"; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, width, height);
    const r = sw / sh, cr = width / height;
    ctx.filter = css;
    if (Math.abs(r - cr) / cr > 0.35) {
      // very different shape: blurred copy behind, whole picture in front
      ctx.filter = `${css === "none" ? "" : css + " "}blur(28px) brightness(.55)`;
      const s = Math.max(width / sw, height / sh); ctx.drawImage(src, (width - sw * s) / 2, (height - sh * s) / 2, sw * s, sh * s);
      ctx.filter = css;
      const f = Math.min(width / sw, height / sh); ctx.drawImage(src, (width - sw * f) / 2, (height - sh * f) / 2, sw * f, sh * f);
    } else {
      const s = Math.max(width / sw, height / sh); ctx.drawImage(src, (width - sw * s) / 2, (height - sh * s) / 2, sw * s, sh * s);
    }
    ctx.filter = "none";
  };

  try {
    await ac.resume().catch(() => undefined);
    rec.start(500);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (s.kind === "image") {
        const img = await loadImage(urls[i]);
        const ms = (s.secs ?? 3) * 1000, t0 = performance.now();
        await new Promise<void>((res) => { const tick = () => { const el = performance.now() - t0; draw(img, img.naturalWidth, img.naturalHeight, s.css); report(el / 1000); if (el >= ms) res(); else requestAnimationFrame(tick); }; tick(); });
        done += s.secs ?? 3;
      } else {
        const v = await loadVideo(urls[i]);
        try { const src = ac.createMediaElementSource(v); src.connect(dest); } catch { /* no audio */ }
        const ranges = s.ranges?.length ? s.ranges : [[0, v.duration] as [number, number]];
        for (const [a, b] of ranges) {
          v.currentTime = a;
          await new Promise<void>((r) => { v.onseeked = () => r(); setTimeout(r, 1500); });
          await v.play();
          await new Promise<void>((res) => {
            const tick = () => {
              draw(v, v.videoWidth, v.videoHeight, s.css); report(v.currentTime - a);
              if (v.currentTime >= b - 0.03 || v.ended) { v.pause(); res(); } else requestAnimationFrame(tick);
            };
            tick();
          });
          done += b - a;
        }
      }
    }
    rec.stop(); await stopped;
    const outType = (rec.mimeType || mime || "video/webm").split(";")[0];
    const blob = new Blob(chunks, { type: outType });
    if (blob.size < 1000) throw new Error("Editing produced an empty video.");
    return new File([blob], `edit-${Date.now()}.${videoExt(outType)}`, { type: outType });
  } finally {
    if (rec.state !== "inactive") { try { rec.stop(); } catch { /* ignore */ } }
    urls.forEach((u) => URL.revokeObjectURL(u));
    void ac.close();
  }
}
