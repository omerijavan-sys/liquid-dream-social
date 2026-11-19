import { useSyncExternalStore } from "react";
import { findFullStream } from "./FullTrack";
import { spotifyStop } from "./SpotifyConnect";

export interface EngineTrack { key: string; title: string; artist: string; artwork?: string | null; url?: string; yt?: string }
export interface EngineState { track: EngineTrack | null; paused: boolean; loading: boolean; error: string | null; pos: number; dur: number; hasQueue?: boolean }

let queueH: { next?: () => void; prev?: () => void } | null = null;
export const setQueueHandlers = (h: { next?: () => void; prev?: () => void } | null) => { queueH = h; set({ hasQueue: !!h }); };
export const nextTrack = () => queueH?.next?.();
export const prevTrack = () => queueH?.prev?.();

let state: EngineState = { track: null, paused: true, loading: false, error: null, pos: 0, dur: 0 };
const subs = new Set<() => void>();
const set = (p: Partial<EngineState>) => { state = { ...state, ...p }; subs.forEach(f => f()); };

let audio: HTMLAudioElement | null = null;
const el = (): HTMLAudioElement => {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "auto";
  audio.setAttribute("playsinline", "true");
  audio.addEventListener("play", () => set({ paused: false, loading: false }));
  audio.addEventListener("pause", () => set({ paused: true }));
  audio.addEventListener("waiting", () => set({ loading: true }));
  audio.addEventListener("playing", () => set({ loading: false, paused: false }));
  audio.addEventListener("timeupdate", () => set({ pos: audio!.currentTime, dur: audio!.duration || 0 }));
  audio.addEventListener("ended", () => { set({ paused: true, pos: 0 }); queueH?.next?.(); });
  audio.addEventListener("error", () => set({ loading: false, paused: true, error: "This track couldn't be played." }));
  return audio;
};

const media = (t: EngineTrack | null) => {
  if (!("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  if (!t) { ms.metadata = null; return; }
  ms.metadata = new MediaMetadata({ title: t.title, artist: t.artist, artwork: t.artwork ? [{ src: t.artwork, sizes: "512x512" }] : [] });
  ms.setActionHandler("play", () => { if (mode === "yt") yt?.playVideo(); else void el().play(); });
  ms.setActionHandler("pause", () => { if (mode === "yt") yt?.pauseVideo(); else el().pause(); });
  ms.setActionHandler("seekto", (d) => { if (d.seekTime != null) seekMusic(d.seekTime); });
  ms.setActionHandler("stop", () => stopMusic());
  try { ms.setActionHandler("nexttrack", () => queueH?.next?.()); ms.setActionHandler("previoustrack", () => queueH?.prev?.()); } catch { /* unsupported */ }
};

// ---- YouTube embedded player (full-length songs for everyone, audio only) ----
let mode: "audio" | "yt" = "audio";
let yt: any = null; let ytTimer: number | null = null; let ytPromise: Promise<any> | null = null;
const loadYT = () => (ytPromise ??= new Promise<any>((resolve, reject) => {
  const w = window as any;
  const make = () => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-9999px;top:0;width:200px;height:200px;pointer-events:none";
    const inner = document.createElement("div"); host.appendChild(inner); document.body.appendChild(host);
    new w.YT.Player(inner, { height: "200", width: "200", playerVars: { autoplay: 1, playsinline: 1, controls: 0, rel: 0, origin: location.origin }, events: {
      onReady: (e: any) => resolve(e.target),
      onStateChange: (e: any) => { const c = e.data; if (c === 1) set({ paused: false, loading: false }); else if (c === 2) set({ paused: true }); else if (c === 3) set({ loading: true }); else if (c === 0) { set({ paused: true, pos: 0 }); queueH?.next?.(); } },
      onError: () => set({ loading: false, paused: true, error: "This track couldn't be played." }),
    } });
  };
  if (w.YT?.Player) return make();
  const prev = w.onYouTubeIframeAPIReady; w.onYouTubeIframeAPIReady = () => { prev?.(); make(); };
  const sc = document.createElement("script"); sc.src = "https://www.youtube.com/iframe_api"; sc.onerror = () => { ytPromise = null; reject(new Error("yt")); }; document.body.appendChild(sc);
}));
const ytPoll = () => {
  if (ytTimer) return;
  ytTimer = window.setInterval(() => { if (mode === "yt" && yt) set({ pos: yt.getCurrentTime?.() ?? 0, dur: yt.getDuration?.() ?? 0 }); }, 500);
};

export async function playYouTube(t: EngineTrack) {
  spotifyStop(); audio?.pause();
  set({ track: t, paused: true, loading: true, error: null, pos: 0, dur: 0 });
  mode = "yt"; media(t);
  try { yt = await loadYT(); yt.loadVideoById(t.yt); ytPoll(); }
  catch { set({ loading: false, error: "Couldn't start the player." }); }
}

export async function playUrl(t: EngineTrack) {
  spotifyStop();
  if (yt) try { yt.pauseVideo(); } catch { /* ignore */ }
  mode = "audio";
  const a = el();
  if (state.track?.key === t.key && a.src) { if (a.paused) await a.play().catch(() => undefined); return; }
  set({ track: t, paused: true, loading: true, error: null, pos: 0, dur: 0 });
  a.src = t.url!;
  media(t);
  try { await a.play(); } catch { set({ loading: false, error: "Tap play to start." }); }
}

/** Finds a full-length version of a song (free stream, else embedded YouTube) and plays it. Returns false if none found. */
export async function playSong(title: string, artist: string, artwork?: string | null, key?: string): Promise<boolean> {
  const k = key ?? `${title}|${artist}`;
  if (state.track?.key === k) { toggleIfPaused(); return true; }
  set({ loading: true, error: null });
  const url = await findFullStream(title, artist);
  if (url) { await playUrl({ key: k, title, artist, artwork, url }); return true; }
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const clean = (v: string) => v.replace(/\(.*?\)|\[.*?\]|feat\.?.*/gi, "").trim();
    const { data } = await supabase.functions.invoke("yt-find", { body: { q: `${clean(title)} ${clean(artist.split(",")[0])} official audio` } });
    if (data?.id) { await playYouTube({ key: k, title, artist, artwork, yt: data.id }); return true; }
  } catch { /* fall through */ }
  set({ loading: false });
  return false;
}

const toggleIfPaused = () => { if (state.paused) toggleMusic(); };
export const toggleMusic = () => {
  if (mode === "yt") { if (state.paused) yt?.playVideo(); else yt?.pauseVideo(); return; }
  const a = el(); if (a.paused) void a.play().catch(() => undefined); else a.pause();
};
export const seekMusic = (s: number) => { if (mode === "yt") yt?.seekTo(s, true); else el().currentTime = s; };
export const stopMusic = () => { audio?.pause(); if (audio) audio.removeAttribute("src"); try { yt?.stopVideo(); } catch { /* ignore */ } media(null); set({ track: null, paused: true, loading: false, pos: 0, dur: 0 }); };
export const getMusicState = () => state;
export const useMusic = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state);
