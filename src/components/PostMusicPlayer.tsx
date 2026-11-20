import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Music2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import { searchGlobalMusic } from "@/services/GlobalMusicService";
import SpotifyEmbed, { spotifyIdOf } from "./SpotifyEmbed";

export interface PostMusic {
  title: string;
  artist?: string | null;
  art_url?: string | null;
  stream_url?: string | null;
  youtube_id?: string | null;
}

// One shared audio element app-wide so only one track plays at a time.
let sharedAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

const BAR_HEIGHTS = [10, 18, 26, 14, 22, 30, 16, 24, 12, 20, 28, 15, 22, 11, 19, 27];

const streamCache = new Map<string, string>();

const resolveStream = async (music: PostMusic): Promise<string | null> => {
  if (music.stream_url) return music.stream_url;
  const key = `${music.title}|${music.artist ?? ""}`;
  const cached = streamCache.get(key);
  if (cached) return cached;
  const clean = (v: string) => v.replace(/\(.*?\)|\[.*?\]/g, "").trim();
  const hits = await searchGlobalMusic(`${clean(music.title)} ${clean(music.artist ?? "")}`.trim(), 5);
  const url = hits[0]?.streamUrl ?? (await searchGlobalMusic(clean(music.title), 5))[0]?.streamUrl ?? null;
  if (url) streamCache.set(key, url);
  return url;
};

const PostMusicPlayer = ({ music }: { music: PostMusic }) => {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const activeKey = useRef<string>("");
  const location = useLocation();
  const lastPath = useRef(location.pathname);

  // Stop if another post's player takes over the shared audio element.
  useEffect(() => () => {
    if (sharedAudio && currentUrl && activeKey.current === currentUrl) sharedAudio.pause();
  }, []);

  const [found, setFound] = useState<string | null>(null);
  const spId = spotifyIdOf(music.youtube_id) ?? found;
  const [spOpen, setSpOpen] = useState(false);

  useEffect(() => {
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    sharedAudio?.pause();
    currentUrl = null;
    setPlaying(false);
    setSpOpen(false);
  }, [location.pathname]);

  const toggle = async () => {
    if (!spId && !music.stream_url) {
      setLoading(true);
      try {
        const clean = (v: string) => v.replace(/\(.*?\)|\[.*?\]/g, "").trim();
        const hits = await searchGlobalMusic(`${clean(music.title)} ${clean(music.artist ?? "")}`.trim(), 5);
        const sp = hits.find(h => h.id.startsWith("sp_"));
        if (sp) { setFound(sp.id.slice(3)); if (sharedAudio) sharedAudio.pause(); setSpOpen(true); setLoading(false); return; }
      } catch { /* fall back to stream */ }
      setLoading(false);
    }
    if (spId) {
      if (sharedAudio) sharedAudio.pause();
      setSpOpen(o => !o);
      return;
    }
    if (playing && sharedAudio && activeKey.current === currentUrl) {
      sharedAudio.pause();
      setPlaying(false);
      return;
    }
    setLoading(true);
    try {
      const url = await resolveStream(music);
      if (!url) { toast.error("No playable audio found for this track."); return; }
      if (sharedAudio) sharedAudio.pause();
      sharedAudio = new Audio(url);
      currentUrl = url;
      activeKey.current = url;
      sharedAudio.addEventListener("ended", () => setPlaying(false));
      sharedAudio.addEventListener("pause", () => setPlaying(false));
      sharedAudio.addEventListener("error", () => { setPlaying(false); toast.error("This track could not be played."); });
      await sharedAudio.play();
      setPlaying(true);
    } catch (error) {
      setPlaying(false);
      toast.error(error instanceof Error ? error.message : "This track could not be played.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-4 mb-3 relative z-10">
    {spId && spOpen && <div className="mb-2"><SpotifyEmbed trackId={spId} onFail={() => setSpOpen(false)} /><p className="mt-1 text-center text-[10px] text-muted-foreground">No sound? Tap play in the bar, or <a className="underline" target="_blank" rel="noreferrer" href={`https://open.spotify.com/track/${spId}`}>open in Spotify</a>.</p></div>}
    <div className="rounded-2xl border border-primary/30 bg-card/70 backdrop-blur-xl px-3 py-2.5 flex items-center gap-3">
      <button
        onClick={() => void toggle()}
        disabled={loading}
        aria-label={playing ? "Pause track" : "Play track"}
        className="depth-press w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0"
      >
        {(spId ? spOpen : playing) ? <Pause className="w-4 h-4 text-primary-foreground" /> : <Play className="w-4 h-4 text-primary-foreground" />}
      </button>
      {music.art_url ? (
        <img src={music.art_url} alt="" className="w-10 h-10 rounded-xl object-cover bg-secondary shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Music2 className="w-5 h-5 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{music.title}</p>
        <p className="text-caption text-muted-foreground truncate">{music.artist || "Primegram"}</p>
      </div>
      <div className="flex items-end gap-[3px] h-8 shrink-0" aria-hidden="true">
        {BAR_HEIGHTS.map((h, i) => (
          <motion.span
            key={i}
            className="w-[3px] rounded-full bg-primary/80 origin-bottom"
            style={{ height: h }}
            animate={playing ? { scaleY: [0.35, 1, 0.55, 0.9, 0.4] } : { scaleY: 0.4 }}
            transition={
              playing
                ? { duration: 1.1, repeat: Infinity, delay: i * 0.07, ease: "easeInOut" }
                : { duration: 0.2 }
            }
          />
        ))}
      </div>
    </div>
    </div>
  );
};

export default PostMusicPlayer;
