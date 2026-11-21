import { useState } from "react";
import { Pause, Play, X, Music2, Loader2, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, ChevronLeft } from "lucide-react";
import { useMusic, toggleMusic, stopMusic, nextTrack, prevTrack, cycleRepeat, toggleShuffle } from "@/services/MusicEngine";

/** Floating mini player: keeps music controllable on every screen while it plays in the background. */
const MiniPlayer = () => {
  const m = useMusic();
  const [hidden, setHidden] = useState(false);
  if (!m.track || (m.track.key.startsWith("post|") || m.track.key.startsWith("clip|"))) return null; // post music plays silently, no tab
  if (hidden) {
    return (
      <button onClick={() => setHidden(false)} aria-label="Show player" className="fixed bottom-[calc(8.5rem+env(safe-area-inset-bottom))] left-0 z-[60] flex h-11 w-11 items-center justify-center rounded-r-full border border-l-0 border-white/20 bg-black/70 text-white shadow-xl backdrop-blur-2xl active:scale-95">
        {m.track.artwork ? <img src={m.track.artwork} alt="" className={`h-8 w-8 rounded-full object-cover ${m.paused ? "" : "animate-[spin_6s_linear_infinite]"}`} /> : <Music2 className="h-5 w-5" />}
      </button>
    );
  }
  return (
    <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-black/70 p-2 pr-3 text-white shadow-2xl backdrop-blur-2xl">
      {m.track.artwork ? <img src={m.track.artwork} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Music2 className="h-5 w-5" /></span>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{m.track.title}</p>
        <p className="truncate text-[11px] text-white/60">{m.error ?? m.track.artist}</p>
      </div>
      <button onClick={toggleShuffle} aria-label="Shuffle" className={m.shuffle ? "text-emerald-300" : "text-white/50"}><Shuffle className="h-4 w-4" /></button>
      {m.hasQueue && <button onClick={prevTrack} aria-label="Previous song" className="text-white/80"><SkipBack className="h-4 w-4" /></button>}
      <button onClick={toggleMusic} aria-label={m.paused ? "Play" : "Pause"} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black active:scale-95">
        {m.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : m.paused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
      </button>
      {m.hasQueue && <button onClick={nextTrack} aria-label="Next song" className="text-white/80"><SkipForward className="h-4 w-4" /></button>}
      <button onClick={cycleRepeat} aria-label="Repeat" className={m.repeat === "off" ? "text-white/50" : "text-emerald-300"}>{m.repeat === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}</button>
      <button onClick={() => setHidden(true)} aria-label="Hide player" className="text-white/60"><ChevronLeft className="h-4 w-4" /></button>
      <button onClick={stopMusic} aria-label="Close player" className="text-white/60"><X className="h-4 w-4" /></button>
    </div>
  );
};
export default MiniPlayer;
