import { useState } from "react";
import { Music2, Pause, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { searchGlobalMusic } from "@/services/GlobalMusicService";
import { playSong, playUrl, toggleMusic, useMusic } from "@/services/MusicEngine";

export interface PostMusic {
  title: string;
  artist?: string | null;
  art_url?: string | null;
  stream_url?: string | null;
  youtube_id?: string | null;
}

/** Instagram-style music line shown under the profile name, with a small play/pause button. */
const PostMusicPlayer = ({ music }: { music: PostMusic }) => {
  const m = useMusic();
  const [busy, setBusy] = useState(false);
  const key = `post|${music.title}|${music.artist ?? ""}`;
  const mine = m.track?.key === key;
  const playing = mine && !m.paused;

  const start = async () => {
    if (mine) { toggleMusic(); return; }
    setBusy(true);
    try {
      const artist = music.artist ?? "";
      if (music.stream_url) { await playUrl({ key, title: music.title, artist, artwork: music.art_url, url: music.stream_url }); return; }
      if (await playSong(music.title, artist, music.art_url, key)) return;
      const clean = (v: string) => v.replace(/\(.*?\)|\[.*?\]/g, "").trim();
      const hit = (await searchGlobalMusic(`${clean(music.title)} ${clean(artist)}`.trim(), 5)).find(h => h.streamUrl);
      if (hit) await playUrl({ key, title: music.title, artist, artwork: music.art_url ?? hit.artwork, url: hit.streamUrl });
      else toast.error("No playable audio found for this track.");
    } catch { toast.error("This track could not be played."); } finally { setBusy(false); }
  };

  return (
    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Music2 className={`h-3 w-3 shrink-0 ${playing ? "text-primary animate-pulse" : ""}`} />
      <span className="min-w-0 truncate">{music.title}{music.artist ? ` · ${music.artist}` : ""}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); void start(); }}
        aria-label={playing ? "Pause song" : "Play song"}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground active:scale-90"
      >
        {busy || (mine && m.loading) ? <Loader2 className="h-3 w-3 animate-spin" /> : playing ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
      </button>
    </div>
  );
};

export default PostMusicPlayer;
