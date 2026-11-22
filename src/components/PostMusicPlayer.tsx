import { useEffect, useRef, type RefObject } from "react";
import { Music2, Volume2, VolumeX } from "lucide-react";
import { searchGlobalMusic } from "@/services/GlobalMusicService";
import { getMusicState, livePos, setMusicVolume, playSong, playUrl, seekMusic, stopMusic, toggleMusic, useMusic } from "@/services/MusicEngine";

export interface PostMusic {
  title: string;
  artist?: string | null;
  art_url?: string | null;
  stream_url?: string | null;
  youtube_id?: string | null;
  start?: number | null;
  len?: number | null;
  volume?: number | null;
}

/** Instagram-style music line shown under the profile name, with a small play/pause button. */
const PostMusicPlayer = ({ music, autoStart = false, videoRef, paused = false }: { music: PostMusic; autoStart?: boolean; videoRef?: RefObject<HTMLVideoElement | null>; paused?: boolean }) => {
  const m = useMusic();
  const key = `post|${music.title}|${music.artist ?? ""}`;
  const mine = m.track?.key === key;
  const on = mine && !m.paused;
  const rootRef = useRef<HTMLDivElement>(null);
  const userPaused = useRef(false);
  const visible = useRef(false);
  const start0 = music.start ?? 0;
  const len0 = music.len ?? 30;
  const seeked = useRef(false);
  const alive = useRef(true);
  const stopIfStale = () => {
    if ((!alive.current || !visible.current) && getMusicState().track?.key === key) stopMusic();
  };

  useEffect(() => {
    if (!mine || m.paused) { if (!mine) seeked.current = false; return; }
    if (!seeked.current && start0 > 0) { seekMusic(start0); seeked.current = true; return; }
    seeked.current = true;
    if (m.pos >= start0 + len0) seekMusic(start0);
  }, [mine, m.paused, m.pos]); // eslint-disable-line react-hooks/exhaustive-deps

  const autoPaused = useRef(false);
  // Video posts: the song only starts once the picture is really playing, and then follows the video
  // (pauses when it buffers, restarts when it loops, and is nudged back whenever it drifts).
  useEffect(() => {
    if (!videoRef || !mine) return;
    const id = window.setInterval(() => {
      const v = videoRef.current; if (!v) return;
      const st = getMusicState();
      const running = !v.paused && !v.ended && v.readyState >= 3;
      if (!running) { if (!st.paused && !userPaused.current) { toggleMusic(); autoPaused.current = true; } return; }
      if (autoPaused.current && st.paused && !userPaused.current) { autoPaused.current = false; toggleMusic(); return; }
      if (st.paused) return;
      const target = start0 + (v.currentTime % Math.max(1, len0));
      if (Math.abs(livePos() - target) > 0.3) seekMusic(target);
    }, 400);
    return () => window.clearInterval(id);
  }, [videoRef, mine, start0, len0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (mine) setMusicVolume(music.volume ?? 1); }, [mine, music.volume]);
  // Story viewer: holding/pausing the picture pauses the song too.
  useEffect(() => {
    if (!mine) return;
    const st = getMusicState();
    if (paused && !st.paused) { toggleMusic(); autoPaused.current = true; }
    else if (!paused && st.paused && autoPaused.current && !userPaused.current) { autoPaused.current = false; toggleMusic(); }
  }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    if (!alive.current) return;
    if (videoRef) {
      for (let i = 0; i < 40 && alive.current; i++) {
        const v = videoRef.current;
        if (v && !v.paused && v.readyState >= 3) break;
        await new Promise(r => window.setTimeout(r, 150));
      }
      if (!alive.current || !visible.current) return;
    }
    try {
      setMusicVolume(music.volume ?? 1);
      const artist = music.artist ?? "";
      if (music.stream_url) { await playUrl({ key, title: music.title, artist, artwork: music.art_url, url: music.stream_url }); return; }
      if (await playSong(music.title, artist, music.art_url, key)) return;
      const clean = (value: string) => value.replace(/\(.*?\)|\[.*?\]/g, "").trim();
      const hit = (await searchGlobalMusic(`${clean(music.title)} ${clean(artist)}`.trim(), 5)).find(item => item.streamUrl);
      if (hit) await playUrl({ key, title: music.title, artist, artwork: music.art_url ?? hit.artwork, url: hit.streamUrl });
    } catch { /* Keep scrolling quiet if a track cannot be loaded. */ }
    finally { stopIfStale(); }
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (autoStart) return; // story viewer is always on screen; don't let a first "not visible" report silence it
      visible.current = entry.isIntersecting;
      const state = getMusicState();
      if (entry.isIntersecting) {
        const otherPlaying = state.track && !state.track.key.startsWith("post|") && !state.paused;
        if (!userPaused.current && !otherPlaying) void start();
      } else if (state.track?.key === key) stopMusic();
    }, { threshold: 0.7 });
    obs.observe(el);
    alive.current = true;
    // Stories: the viewer was opened by a tap, so start straight away instead of waiting on scroll visibility.
    if (autoStart) { visible.current = true; window.setTimeout(() => { if (alive.current && !userPaused.current) void start(); }, 150); }
    const onVis = () => { if (document.hidden && getMusicState().track?.key === key) stopMusic(); };
    document.addEventListener("visibilitychange", onVis);
    const watchdog = window.setInterval(() => {
      const state = getMusicState();
      if (state.track?.key !== key) return;
      const node = rootRef.current;
      let shown = false;
      if (node && node.isConnected) {
        const rect = node.getBoundingClientRect();
        shown = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight && node.getClientRects().length > 0;
      }
      if (!shown) stopMusic();
    }, 600);
    return () => {
      window.clearInterval(watchdog);
      alive.current = false; visible.current = false;
      obs.disconnect(); document.removeEventListener("visibilitychange", onVis);
      if (getMusicState().track?.key === key) stopMusic();
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = () => {
    if (mine) { userPaused.current = !m.paused; toggleMusic(); }
    else { userPaused.current = false; void start(); }
  };

  return (
    <div ref={rootRef} className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Music2 className="h-3 w-3 shrink-0" />
      <span className="min-w-0 truncate">{music.title}{music.artist ? ` · ${music.artist}` : ""}</span>
      <button type="button" onClick={event => { event.stopPropagation(); tap(); }} aria-label={on ? "Mute song" : "Play song"} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground active:scale-90">
        {on ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
      </button>
    </div>
  );
};

export default PostMusicPlayer;
