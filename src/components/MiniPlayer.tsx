import { Pause, Play, X, Music2, Loader2 } from "lucide-react";
import { useMusic, toggleMusic, stopMusic } from "@/services/MusicEngine";

/** Floating mini player: keeps music controllable on every screen while it plays in the background. */
const MiniPlayer = () => {
  const m = useMusic();
  if (!m.track) return null;
  return (
    <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-black/70 p-2 pr-3 text-white shadow-2xl backdrop-blur-2xl">
      {m.track.artwork ? <img src={m.track.artwork} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Music2 className="h-5 w-5" /></span>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{m.track.title}</p>
        <p className="truncate text-[11px] text-white/60">{m.error ?? m.track.artist}</p>
      </div>
      <button onClick={toggleMusic} aria-label={m.paused ? "Play" : "Pause"} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black active:scale-95">
        {m.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : m.paused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
      </button>
      <button onClick={stopMusic} aria-label="Close player" className="text-white/60"><X className="h-4 w-4" /></button>
    </div>
  );
};
export default MiniPlayer;
