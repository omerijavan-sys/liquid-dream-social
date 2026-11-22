import { useSyncExternalStore } from "react";
import { findFullStream } from "./FullTrack";
import { spotifyStop } from "./SpotifyConnect";
import { getDownloadedUrl } from "./MusicDownloads";
import { Capacitor, registerPlugin } from "@capacitor/core";

/** Android only: the service plays direct song URLs itself, so music continues with the app closed or the screen off. */
const Native = registerPlugin<{
  playQueue(o: { items: { url: string; title: string; artist: string }[]; index: number; start?: number }): Promise<void>;
  appendQueue(o: { items: { url: string; title: string; artist: string }[] }): Promise<void>;
  control(o: { action: string }): Promise<void>;
  seek(o: { pos: number; play?: boolean }): Promise<void>;
  stop(): Promise<void>;
  addListener(ev: "native", f: (e: { index: number; pos: number; dur: number; playing: boolean; ended: boolean; error: boolean }) => void): Promise<unknown>;
}>("MusicService");
const canNative = () => Capacitor.getPlatform() === "android" && Capacitor.isNativePlatform();
let nativeMeta: EngineTrack[] = []; let nativeWired = false;

export interface EngineTrack { key: string; title: string; artist: string; artwork?: string | null; url?: string; yt?: string }
export interface EngineState { track: EngineTrack | null; paused: boolean; loading: boolean; error: string | null; pos: number; dur: number; hasQueue?: boolean; repeat: "off" | "all" | "one"; shuffle: boolean }

// ---- global queue: next / previous / shuffle / repeat work from anywhere (mini player, lock screen, hub) ----
export interface QItem { id: string; title: string; artist: string; artwork: string | null }
let queue: QItem[] = []; let qi = -1;
export const setQueue = (items: QItem[], index: number) => { queue = items; qi = index; set({ hasQueue: items.length > 1 }); };
export const clearQueue = () => { queue = []; qi = -1; set({ hasQueue: false }); };
export const queueItemById = (id: string) => queue.find(q => q.id === id) ?? null;
const playIndex = async (i: number) => {
  const q = queue[i]; if (!q) return;
  qi = i;
  const ok = await playSong(q.title, q.artist, q.artwork, `sp_${q.id}`);
  if (!ok) set({ error: "No full version of that song was found." });
};
const advanceQueue = (d: 1 | -1, auto: boolean) => {
  if (queue.length < 2) return;
  if (d === -1 && state.pos > 4) { seekMusic(0); return; } // like most players: restart first, then go back
  let n: number;
  if (state.shuffle) { do { n = Math.floor(Math.random() * queue.length); } while (n === qi); }
  else {
    n = qi + d;
    if (n >= queue.length || n < 0) { if (auto && state.repeat === "off") return; n = (n + queue.length) % queue.length; }
  }
  void playIndex(n);
};
export const nextTrack = () => advanceQueue(1, false);
export const prevTrack = () => advanceQueue(-1, false);

let state: EngineState = { repeat: "off", shuffle: false, track: null, paused: true, loading: false, error: null, pos: 0, dur: 0 };
const subs = new Set<() => void>();
const set = (p: Partial<EngineState>) => {
  // skip no-op updates so listeners (and the screens they drive) don't re-render for nothing
  let changed = false;
  for (const k in p) { if ((state as unknown as Record<string, unknown>)[k] !== (p as Record<string, unknown>)[k]) { changed = true; break; } }
  if (!changed) return;
  state = { ...state, ...p }; subs.forEach(f => f());
};
const setPos = (pos: number, dur: number) => { if (Math.abs(pos - state.pos) >= 0.9 || dur !== state.dur) set({ pos, dur }); };

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
  audio.addEventListener("timeupdate", () => setPos(audio!.currentTime, audio!.duration || 0));
  audio.addEventListener("ended", () => onEnded());
  audio.addEventListener("error", () => set({ loading: false, paused: true, error: "This track couldn't be played." }));
  return audio;
};

/** Song finished: repeat-one replays it, otherwise move on in the queue (the queue decides about wrapping). */
const onEnded = () => {
  if (state.repeat === "one") { seekMusic(0); if (mode === "native") void Native.seek({ pos: 0, play: true }); else if (mode === "yt") yt?.playVideo(); else void el().play().catch(() => undefined); return; }
  set({ paused: true, pos: 0 });
  advanceQueue(1, true);
};
export const cycleRepeat = () => set({ repeat: state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off" });
export const toggleShuffle = () => set({ shuffle: !state.shuffle });

const media = (t: EngineTrack | null) => {
  if (!("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  if (!t) { ms.metadata = null; return; }
  ms.metadata = new MediaMetadata({ title: t.title, artist: t.artist, artwork: t.artwork ? [{ src: t.artwork, sizes: "512x512" }] : [] });
  ms.setActionHandler("play", () => { if (mode === "native") void Native.control({ action: "toggle" }); else if (mode === "yt") yt?.playVideo(); else void el().play(); });
  ms.setActionHandler("pause", () => { if (mode === "native") void Native.control({ action: "toggle" }); else if (mode === "yt") yt?.pauseVideo(); else el().pause(); });
  ms.setActionHandler("seekto", (d) => { if (d.seekTime != null) seekMusic(d.seekTime); });
  ms.setActionHandler("stop", () => stopMusic());
  try { ms.setActionHandler("nexttrack", () => nextTrack()); ms.setActionHandler("previoustrack", () => prevTrack()); } catch { /* unsupported */ }
};

// ---- YouTube embedded player (full-length songs for everyone, audio only) ----
let mode: "audio" | "yt" | "native" = "audio";
let yt: any = null; let ytTimer: number | null = null; let ytPromise: Promise<any> | null = null;
const loadYT = () => (ytPromise ??= new Promise<any>((resolve, reject) => {
  const w = window as any;
  const make = () => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-9999px;top:0;width:200px;height:200px;pointer-events:none";
    const inner = document.createElement("div"); host.appendChild(inner); document.body.appendChild(host);
    new w.YT.Player(inner, { height: "200", width: "200", playerVars: { autoplay: 1, playsinline: 1, controls: 0, rel: 0, origin: location.origin }, events: {
      onReady: (e: any) => resolve(e.target),
      onStateChange: (e: any) => { const c = e.data; if (c === 1) set({ paused: false, loading: false }); else if (c === 2) set({ paused: true }); else if (c === 3) set({ loading: true }); else if (c === 0) onEnded(); },
      onError: () => set({ loading: false, paused: true, error: "This track couldn't be played." }),
    } });
  };
  if (w.YT?.Player) return make();
  const prev = w.onYouTubeIframeAPIReady; w.onYouTubeIframeAPIReady = () => { prev?.(); make(); };
  const sc = document.createElement("script"); sc.src = "https://www.youtube.com/iframe_api"; sc.onerror = () => { ytPromise = null; reject(new Error("yt")); }; document.body.appendChild(sc);
}));
const ytPoll = () => {
  if (ytTimer) return;
  ytTimer = window.setInterval(() => { if (mode === "yt" && yt) setPos(yt.getCurrentTime?.() ?? 0, yt.getDuration?.() ?? 0); }, 500);
};

export async function playYouTube(t: EngineTrack) {
  spotifyStop(); audio?.pause();
  set({ track: t, paused: true, loading: true, error: null, pos: 0, dur: 0 });
  mode = "yt"; media(t);
  try { yt = await loadYT(); yt.loadVideoById(t.yt); ytPoll(); }
  catch { set({ loading: false, error: "Couldn't start the player." }); }
}

const wireNative = () => {
  if (nativeWired) return; nativeWired = true;
  void Native.addListener("native", e => {
    if (mode !== "native") return;
    const m = nativeMeta[e.index];
    if (m && m.key !== state.track?.key) {
      set({ track: m, error: null });
      const qid = queue.findIndex(x => `sp_${x.id}` === m.key); if (qid >= 0) qi = qid;
      media(m);
    }
    set({ paused: !e.playing, loading: false });
    setPos(e.pos / 1000, e.dur / 1000);
    if (e.error) set({ error: "This track couldn't be played." });
    if (e.ended) onEnded();
  });
};

async function playNative(t: EngineTrack) {
  wireNative();
  audio?.pause(); if (yt) try { yt.pauseVideo(); } catch { /* ignore */ }
  mode = "native";
  set({ track: t, paused: true, loading: true, error: null, pos: 0, dur: 0 });
  media(t);
  nativeMeta = [t];
  try {
    await Native.playQueue({ items: [{ url: t.url!, title: t.title, artist: t.artist }], index: 0 });
  } catch { mode = "audio"; return false; }
  // line up the next songs too, so the playlist keeps going when the app is closed
  if (!state.shuffle && qi >= 0) {
    const mine = qi;
    void (async () => {
      const next = queue.slice(mine + 1, mine + 9);
      const found = await Promise.all(next.map(async q => {
        const k = `sp_${q.id}`;
        const url = (await getDownloadedUrl(k)) ?? (await findFullStream(q.title, q.artist));
        return url && /^(https?|file):/.test(url) ? { url, title: q.title, artist: q.artist, tr: { key: k, title: q.title, artist: q.artist, artwork: q.artwork, url } as EngineTrack } : null;
      }));
      const ok = found.filter((x): x is NonNullable<typeof x> => !!x);
      if (!ok.length || mode !== "native" || state.track?.key !== t.key && nativeMeta[0]?.key !== t.key) return;
      nativeMeta = [...nativeMeta, ...ok.map(x => x.tr)];
      await Native.appendQueue({ items: ok.map(x => ({ url: x.url, title: x.title, artist: x.artist })) }).catch(() => undefined);
    })();
  }
  return true;
}

export async function playUrl(t: EngineTrack) {
  spotifyStop();
  if (yt) try { yt.pauseVideo(); } catch { /* ignore */ }
  if (canNative() && t.url && /^(https?|file):/.test(t.url) && !t.key.startsWith("post|") && !t.key.startsWith("clip|")) {
    if (state.track?.key === t.key && mode === "native") { if (state.paused) void Native.control({ action: "toggle" }); return; }
    if (await playNative(t)) return;
  }
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
  const local = k.startsWith("sp_") ? await getDownloadedUrl(k) : null; // saved in the app → plays offline
  if (local) { await playUrl({ key: k, title, artist, artwork, url: local }); return true; }
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
/** Exact playback position right now (the shared state only refreshes about once a second). */
export const livePos = () => (mode === "audio" && audio ? audio.currentTime : mode === "yt" && yt ? (yt.getCurrentTime?.() ?? state.pos) : state.pos);

export const toggleMusic = () => {
  if (mode === "native") { void Native.control({ action: "toggle" }); return; }
  if (mode === "yt") { if (state.paused) yt?.playVideo(); else yt?.pauseVideo(); return; }
  const a = el(); if (a.paused) void a.play().catch(() => undefined); else a.pause();
};
export const seekMusic = (s: number) => { if (mode === "native") { void Native.seek({ pos: Math.round(s * 1000) }); return; } if (mode === "yt") yt?.seekTo(s, true); else el().currentTime = s; };
export const stopMusic = () => { if (mode === "native") { void Native.stop().catch(() => undefined); mode = "audio"; } audio?.pause(); if (audio) audio.removeAttribute("src"); try { yt?.stopVideo(); } catch { /* ignore */ } media(null); set({ track: null, paused: true, loading: false, pos: 0, dur: 0 }); };
export const getMusicState = () => state;
export const subscribeMusic = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useMusic = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state);
