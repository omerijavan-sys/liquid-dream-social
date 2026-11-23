import { useEffect, useRef, useState } from "react";
import { Music2, Pause, Play } from "lucide-react";
import { glow, rgb } from "../shared/ui";
import { FONTS, useAesthetics } from "./aesthetics";

/** Shows someone's status + pinned track in their accent colour and bio font (public profile / own profile). */
const PublicVibe = ({ userId, bio }: { userId: string; bio?: string | null }) => {
  const { a, loaded } = useAesthetics(userId);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audio.current?.pause(); }, []);
  if (!loaded || (!a.status_text && !a.pinned_title && a.font === "sans" && a.accent === "#a78bfa" && a.ring === "none")) return null;
  const toggle = () => {
    if (!a.pinned_audio_url) return;
    if (!audio.current) { audio.current = new Audio(a.pinned_audio_url); audio.current.onended = () => setPlaying(false); }
    if (playing) { audio.current.pause(); setPlaying(false); } else { void audio.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  };
  return (
    <div className="mt-2 space-y-2 rounded-2xl border border-white/10 p-3 backdrop-blur-xl" style={{ background: `rgba(255,255,255,${a.glass_opacity / 100})`, boxShadow: glow(a.accent, 0.2, 20), fontFamily: FONTS[a.font].css }}>
      {bio && <p className="text-sm text-white/90" style={{ fontFamily: FONTS[a.font].css }}>{bio}</p>}
      {a.status_text && <p className="inline-block rounded-full px-3 py-1 text-xs" style={{ background: `rgba(${rgb(a.accent)},.18)`, color: a.accent }}>{a.status_text}</p>}
      {a.pinned_title && (
        <div className="flex items-center gap-2 text-white">
          <Music2 className="h-4 w-4 shrink-0" style={{ color: a.accent }} />
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{a.pinned_title}</p>{a.pinned_artist && <p className="truncate text-[10px] text-white/60">{a.pinned_artist}</p>}</div>
          {a.pinned_audio_url && <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: a.accent, color: "#000" }}>{playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>}
        </div>
      )}
    </div>
  );
};
export default PublicVibe;
