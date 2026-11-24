import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * One video at a time, app-wide. Any <video> that starts playing pauses every other file-based video, so two decoders
 * never run together (the main cause of stutter on phones). Live/call streams (srcObject) and videos opted out with
 * data-exclusive="off" are left alone.
 */
let installed = false;
export const installSingleVideoGuard = () => {
  if (installed || typeof document === "undefined") return;
  installed = true;
  // "play" doesn't bubble, so listen in the capture phase on the document.
  document.addEventListener("play", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLVideoElement) || t.srcObject || t.dataset.exclusive === "off") return;
    document.querySelectorAll("video").forEach((v) => {
      if (v !== t && !v.paused && !v.srcObject && v.dataset.exclusive !== "off") v.pause();
    });
  }, true);
};

export interface ActiveVideoOptions { threshold?: number; rootMargin?: string; root?: Element | null }

/**
 * Tracks whether a card is the one on screen (>= threshold visible). When it scrolls away the video is paused
 * immediately; the returned `active` flag drives preload ("auto" only while active) and whether to keep the <video> mounted.
 */
export const useActiveVideo = (boxRef: RefObject<Element>, videoRef: RefObject<HTMLVideoElement>, opts: ActiveVideoOptions = {}) => {
  const [active, setActive] = useState(false);
  const { threshold = 0.65, rootMargin, root = null } = opts;
  const first = useRef(true);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      const on = entry.isIntersecting && entry.intersectionRatio >= threshold;
      setActive(on);
      if (!on) { const v = videoRef.current; if (v) { v.pause(); v.preload = "none"; } }
    }, { threshold: [0, threshold, 1], rootMargin, root });
    obs.observe(el); first.current = false;
    return () => obs.disconnect();
  }, [boxRef, videoRef, threshold, rootMargin, root]);
  return active;
};
