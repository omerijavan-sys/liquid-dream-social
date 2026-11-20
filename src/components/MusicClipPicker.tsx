import { useEffect } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { getMusicState, playSong, playUrl, seekMusic, stopMusic, toggleMusic, useMusic } from "@/services/MusicEngine";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const LENGTHS = [15, 30, 45, 60];

/** Lets the poster choose which part of the song plays on the post (start point + length) and preview it. */
const MusicClipPicker = ({ track, start, len, onChange }: {
  track: { title: string; artist: string; artUrl?: string | null; streamUrl?: string | null };
  start: number; len: number; onChange: (start: number, len: number) => void;
}) => {
  const m = useMusic();
  const key = `clip|${track.title}|${track.artist}`;
  const mine = m.track?.key === key;
  const dur = mine && m.dur > 0 ? m.dur : 240;

  useEffect(() => {
    void (async () => {
      if (track.streamUrl) await playUrl({ key, title: track.title, artist: track.artist, artwork: track.artUrl, url: track.streamUrl });
      else await playSong(track.title, track.artist, track.artUrl, key);
      if (start > 0) seekMusic(start);
    })();
    return () => { if (getMusicState().track?.key === key) stopMusic(); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // loop the chosen section while previewing
  useEffect(() => { if (mine && !m.paused && m.pos >= start + len) seekMusic(start); }, [m.pos, mine, m.paused, start, len]);

  const end = Math.min(dur, start + len);
  const MIN = 5, MAX = 60;
  const setStart = (v: number) => { const ns = Math.max(0, Math.min(v, end - MIN)); onChange(ns, Math.min(MAX, end - ns)); };
  const setEnd = (v: number) => { const ne = Math.min(dur, Math.max(v, start + MIN)); onChange(start, Math.min(MAX, ne - start)); };
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / dur) * 100))}%`;
  const thumb = "pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-md [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-8 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-md [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary";
  const nudge = (which: "s" | "e", d: number) => { if (which === "s") setStart(start + d); else setEnd(end + d); seekMusic(which === "s" ? Math.max(0, start + d) : start); };

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">Trim the part that plays</span>
        <span className="text-muted-foreground">{fmt(start)} – {fmt(end)} · {Math.round(end - start)}s</span>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={toggleMusic} aria-label={m.paused ? "Preview" : "Pause preview"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {mine && m.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mine && !m.paused ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
        </button>
        <div className="relative h-8 flex-1">
          <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded bg-foreground/15" />
          <div className="absolute top-1/2 h-3 -translate-y-1/2 rounded bg-primary/60" style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }} />
          {mine && <div className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-white" style={{ left: pct(m.pos) }} />}
          <input type="range" min={0} max={dur} step={1} value={start} aria-label="Trim start" className={thumb}
            onChange={(e) => setStart(Number(e.target.value))} onPointerUp={() => seekMusic(start)} onTouchEnd={() => seekMusic(start)} />
          <input type="range" min={0} max={dur} step={1} value={end} aria-label="Trim end" className={thumb}
            onChange={(e) => setEnd(Number(e.target.value))} onPointerUp={() => seekMusic(start)} onTouchEnd={() => seekMusic(start)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Start</span>
        <button type="button" onClick={() => nudge("s", -1)} className="rounded-full bg-foreground/10 px-2 py-1">−1s</button>
        <button type="button" onClick={() => nudge("s", 1)} className="rounded-full bg-foreground/10 px-2 py-1">+1s</button>
        <span className="ml-2 text-muted-foreground">End</span>
        <button type="button" onClick={() => nudge("e", -1)} className="rounded-full bg-foreground/10 px-2 py-1">−1s</button>
        <button type="button" onClick={() => nudge("e", 1)} className="rounded-full bg-foreground/10 px-2 py-1">+1s</button>
      </div>
      <div className="flex gap-2">
        {LENGTHS.map((l) => (
          <button key={l} type="button" onClick={() => onChange(Math.min(start, Math.max(0, Math.floor(dur - l))), l)}
            className={`rounded-full px-3 py-1 text-xs ${Math.round(end - start) === l ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-foreground"}`}>{l}s</button>
        ))}
      </div>
    </div>
  );
};
export default MusicClipPicker;
