import { Flame } from "lucide-react";
import { glow } from "../shared/ui";
import { TIER_STYLE, useStreak } from "./streaks";

/** Glowing streak counter shown next to a username. Renders nothing until the streak reaches 1. */
const StreakBadge = ({ userId, className = "" }: { userId?: string | null; className?: string }) => {
  const s = useStreak(userId);
  if (!s || s.current < 1) return null;
  const { color, label } = TIER_STYLE[s.tier];
  const c = s.tier === "none" ? "#a1a1aa" : color;
  return (
    <span
      title={`${s.current}-day streak${label ? ` · ${label} badge` : ""}${s.atRisk ? " · post today to keep it" : ""}`}
      className={`ml-1 inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-black/40 px-1.5 py-0.5 align-middle text-[10px] font-bold tabular-nums ${s.tier === "inferno" ? "animate-pulse" : ""} ${className}`}
      style={{ color: c, boxShadow: s.tier === "none" ? undefined : glow(c, 0.55, 10) }}
    >
      <Flame className="h-3 w-3" style={{ filter: `drop-shadow(0 0 4px ${c})` }} />{s.current}
    </span>
  );
};
export default StreakBadge;
