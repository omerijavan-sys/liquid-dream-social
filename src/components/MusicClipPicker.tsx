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
  const maxStart = Math.max(0, Math.floor(dur - len));

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

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">Choose the part that plays</span>
        <span className="text-muted-foreground">{fmt(start)} – {fmt(start + len)}</span>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={toggleMusic} aria-label={m.paused ? "Preview" : "Pause preview"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {mine && m.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mine && !m.paused ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
        </button>
        <input
          type="range" min={0} max={maxStart} step={1} value={Math.min(start, maxStart)}
          onChange={(e) => onChange(Number(e.target.value), len)}
          onPointerUp={() => seekMusic(start)} onTouchEnd={() => seekMusic(start)} onKeyUp={() => seekMusic(start)}
          className="w-full accent-primary" aria-label="Start of the section"
        />
      </div>
      <div className="flex gap-2">
        {LENGTHS.map((l) => (
          <button key={l} type="button" onClick={() => onChange(Math.min(start, Math.max(0, Math.floor(dur - l))), l)}
            className={`rounded-full px-3 py-1 text-xs ${len === l ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-foreground"}`}>{l}s</button>
        ))}
      </div>
    </div>
  );
};
export default MusicClipPicker;
