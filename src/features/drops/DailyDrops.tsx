import { useState } from "react";
import { Lock, Mic, Music2, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { glass, glow } from "../shared/ui";
import DropComposer from "./DropComposer";
import StreakBadge from "./StreakBadge";
import { type Drop, type Person, promptOfTheDay, useDrops } from "./useDrops";
import { TIER_STYLE } from "./streaks";

const Avatar = ({ p, size = 56, blur = false }: { p?: Person; size?: number; blur?: boolean }) => (
  <div className="flex items-center justify-center overflow-hidden rounded-full bg-foreground/10 text-lg font-bold" style={{ width: size, height: size }}>
    {p?.avatar_url ? <img src={p.avatar_url} alt="" className={`h-full w-full object-cover ${blur ? "blur-md scale-110" : ""}`} /> : <span className={blur ? "blur-sm" : ""}>{(p?.display_name || p?.username || "?")[0]?.toUpperCase()}</span>}
  </div>
);

const nextGoal = (n: number) => [3, 7, 30].find((g) => n < g) ?? null;

/** Feed module: today's prompt, my streak, and friends' drops (blurred until I post mine). */
const DailyDrops = () => {
  const { drops, people, mine, streak, loading, afterPost } = useDrops();
  const [composer, setComposer] = useState(false);
  const [view, setView] = useState<Drop | null>(null);
  const navigate = useNavigate();
  const locked = !mine;
  const tier = streak?.tier ?? "none";
  const accent = tier === "none" ? "#a78bfa" : TIER_STYLE[tier].color;

  return (
    <section className={`${glass} mx-4 mb-4 rounded-3xl bg-gradient-to-br from-violet-500/25 via-fuchsia-500/15 to-sky-500/10 backdrop-blur-xl p-4 text-foreground`} style={{ boxShadow: glow(accent, 0.18, 30) }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: accent }}>Daily Drop</p>
          <p className="truncate text-sm font-semibold">{promptOfTheDay()}</p>
          {streak && streak.current > 0 && <p className="mt-0.5 text-[11px] text-foreground/60">{streak.current}-day streak{streak.atRisk && !mine ? " · post today to keep it 🔥" : ""}{nextGoal(streak.current) ? ` · ${nextGoal(streak.current)! - streak.current} to ${nextGoal(streak.current)}-day badge` : " · max badge 🏆"}</p>}
          {streak && streak.current > 0 && nextGoal(streak.current) && <div className="mt-1.5 h-1 w-40 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (streak.current / nextGoal(streak.current)!) * 100)}%`, background: accent }} /></div>}
        </div>
        <button onClick={() => setComposer(true)} disabled={!!mine} className="flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50" style={!mine ? { boxShadow: glow("#a78bfa", 0.6, 18) } : undefined}>
          {mine ? "Dropped ✓" : <><Plus className="h-3.5 w-3.5" />Drop</>}
        </button>
      </div>

      <div className="mt-3 flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {loading && <p className="py-4 text-xs text-foreground/50">Loading drops…</p>}
        {!loading && drops.length === 0 && <p className="py-3 text-xs text-foreground/55">No drops from friends yet today. Follow people to see theirs.</p>}
        {drops.map((d) => {
          const p = people[d.user_id];
          return (
            <button key={d.id} onClick={() => (locked ? setComposer(true) : setView(d))} className="flex w-16 shrink-0 flex-col items-center gap-1" aria-label={locked ? "Locked drop. Post yours to unlock" : `Open ${p?.username ?? "friend"}'s drop`}>
              <div className="relative rounded-full p-[2px]" style={{ background: d.mutual ? "linear-gradient(135deg,#a78bfa,#f472b6)" : "rgba(255,255,255,.2)" }}>
                <div className="rounded-full bg-[#09090B] p-[2px]"><Avatar p={p} blur={locked} /></div>
                {locked && <span className="absolute inset-0 flex items-center justify-center"><Lock className="h-4 w-4 text-foreground drop-shadow" /></span>}
              </div>
              <span className={`w-full truncate text-center text-[10px] ${locked ? "blur-[3px]" : "text-foreground/80"}`}>{p?.username || p?.display_name || "friend"}</span>
            </button>
          );
        })}
      </div>
      {locked && drops.length > 0 && <p className="mt-1 text-center text-[11px] text-foreground/60">🔒 Post your drop to unlock your friends'</p>}

      {composer && createPortal(<DropComposer onClose={() => setComposer(false)} onPosted={() => void afterPost()} />, document.body)}
      {view && createPortal(
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/85 p-5" onClick={() => setView(null)}>
          <div onClick={(e) => e.stopPropagation()} className={`${glass} w-full max-w-sm space-y-3 rounded-3xl bg-[#0b0b16]/90 backdrop-blur-2xl p-4 text-white`}>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(`/profile/${view.user_id}`)} className="flex items-center gap-2 text-left"><Avatar p={people[view.user_id]} size={36} /><span className="text-sm font-bold">{people[view.user_id]?.username || people[view.user_id]?.display_name}</span></button>
              <StreakBadge userId={view.user_id} /><button onClick={() => setView(null)} className="ml-auto" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            {view.kind === "photo" && view.media_url && <img src={view.media_url} alt="Friend's drop" className="max-h-[60vh] w-full rounded-2xl object-cover" />}
            {view.kind === "voice" && view.media_url && <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-4"><Mic className="h-6 w-6 text-rose-300" /><audio controls autoPlay src={view.media_url} className="h-9 min-w-0 flex-1" /></div>}
            {view.kind === "song" && (
              <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-4"><Music2 className="h-8 w-8 text-violet-300" /><div className="min-w-0"><p className="truncate font-bold">{view.song_title}</p><p className="truncate text-xs text-white/60">{view.song_artist}</p>
                {view.song_url && <a href={view.song_url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-300 underline">Listen</a>}</div></div>
            )}
            {view.caption && <p className="text-sm text-white/80">{view.caption}</p>}
          </div>
        </div>, document.body)}
    </section>
  );
};
export default DailyDrops;
