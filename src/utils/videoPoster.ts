import { useEffect, useState } from "react";

const cache = new Map<string, string | null>();

/** Grabs a still frame from a video URL so it can be shown as a cover instead of a blank/play-button tile. */
export function captureVideoFrame(src: string, at = 0.6): Promise<string | null> {
  if (cache.has(src)) return Promise.resolve(cache.get(src)!);
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous"; v.muted = true; v.playsInline = true; v.preload = "auto";
    let done = false;
    const finish = (r: string | null) => { if (done) return; done = true; cache.set(src, r); v.removeAttribute("src"); v.load(); resolve(r); };
    const timer = setTimeout(() => finish(null), 8000);
    v.addEventListener("error", () => { clearTimeout(timer); finish(null); });
    v.addEventListener("loadeddata", () => { try { v.currentTime = Math.min(at, (v.duration || at) / 2); } catch { finish(null); } });
    v.addEventListener("seeked", () => {
      clearTimeout(timer);
      try {
        const w = Math.min(640, v.videoWidth || 640); const h = Math.round(w * ((v.videoHeight || 360) / (v.videoWidth || 640)));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d")!.drawImage(v, 0, 0, w, h);
        finish(c.toDataURL("image/jpeg", 0.72));
      } catch { finish(null); }
    });
    v.src = src;
  });
}

export function useVideoPoster(src?: string | null, existing?: string | null): string | undefined {
  const [poster, setPoster] = useState<string | undefined>(existing || (src ? cache.get(src) ?? undefined : undefined));
  useEffect(() => {
    if (existing) { setPoster(existing); return; }
    if (!src) return;
    let dead = false;
    void captureVideoFrame(src).then((p) => { if (!dead && p) setPoster(p); });
    return () => { dead = true; };
  }, [src, existing]);
  return poster;
}
