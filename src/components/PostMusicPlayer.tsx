import { useEffect, useRef, useState } from "react";
import { Music2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { searchGlobalMusic } from "@/services/GlobalMusicService";
import { getMusicState, playSong, playUrl, seekMusic, toggleMusic, useMusic } from "@/services/MusicEngine";

export interface PostMusic {
  title: string;
  artist?: string | null;
  art_url?: string | null;
  stream_url?: string | null;
  youtube_id?: string | null;
  start?: number | null;
  len?: number | null;
}

/** Instagram-style music line shown under the profile name, with a small play/pause button. */
const PostMusicPlayer = ({ music }: { music: PostMusic }) => {
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

  // jump to the poster's chosen section, and loop just that section
  useEffect(() => {
    if (!mine || m.paused) { if (!mine) seeked.current = false; return; }
    if (!seeked.current && start0 > 0) { seekMusic(start0); seeked.current = true; return; }
    seeked.current = true;
    if (m.pos >= start0 + len0) seekMusic(start0);
  }, [mine, m.paused, m.pos]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    try {
      const artist = music.artist ?? "";
      if (music.stream_url) { await playUrl({ key, title: music.title, artist, artwork: music.art_url, url: music.stream_url }); return; }
      if (await playSong(music.title, artist, music.art_url, key)) return;
      const clean = (v: string) => v.replace(/\(.*?\)|\[.*?\]/g, "").trim();
      const hit = (await searchGlobalMusic(`${clean(music.title)} ${clean(artist)}`.trim(), 5)).find(h => h.streamUrl);
      if (hit) await playUrl({ key, title: music.title, artist, artwork: music.art_url ?? hit.artwork, url: hit.streamUrl });
    } catch { /* silent: Instagram-style, no error spam while scrolling */ }
  };

  // Plays by itself while the post is on screen, stops when you scroll away.
  useEffect(() => {
    const el = rootRef.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
      const st = getMusicState();
      if (e.isIntersecting) {
        const otherPlaying = st.track && !st.track.key.startsWith("post|") && !st.paused;
        if (!userPaused.current && !otherPlaying) void start();
      } else if (st.track?.key === key && !st.paused) toggleMusic();
    }, { threshold: 0.7 });
    obs.observe(el);
    return () => { obs.disconnect(); if (getMusicState().track?.key === key && !getMusicState().paused) toggleMusic(); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = () => {
    if (mine) { userPaused.current = !m.paused; toggleMusic(); }
    else { userPaused.current = false; void start(); }
  };

  return (
    <div ref={rootRef} className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Music2 className="h-3 w-3 shrink-0" />
      <span className="min-w-0 truncate">{music.title}{music.artist ? ` · ${music.artist}` : ""}</span>
      <button type="button" onClick={(e) => { e.stopPropagation(); tap(); }} aria-label={on ? "Mute song" : "Play song"} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground active:scale-90">
        {on ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
      </button>
    </div>
  );
};

export default PostMusicPlayer;
