import { useEffect, useState } from "react";
import { table } from "../shared/ui";

export type Tier = "none" | "spark" | "blaze" | "inferno";
export interface StreakInfo { current: number; longest: number; tier: Tier; atRisk: boolean }

export const TIER_STYLE: Record<Tier, { color: string; label: string }> = {
  none: { color: "#71717a", label: "" },
  spark: { color: "#fbbf24", label: "3-day" },
  blaze: { color: "#fb7185", label: "7-day" },
  inferno: { color: "#22d3ee", label: "30-day" },
};

const cache = new Map<string, { at: number; p: Promise<StreakInfo | null> }>();
const TTL = 60_000;

/** Reads the "live" view, which already resets a streak to 0 once a full local day has been missed. */
export const fetchStreak = (userId: string): Promise<StreakInfo | null> => {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL) return hit.p;
  const p = (async () => {
    const { data } = await table("user_streaks_live").select("current_streak, longest_streak, tier, at_risk").eq("user_id", userId).maybeSingle();
    return data ? { current: data.current_streak as number, longest: data.longest_streak as number, tier: data.tier as Tier, atRisk: !!data.at_risk } : null;
  })().catch(() => null);
  cache.set(userId, { at: Date.now(), p });
  return p;
};
export const invalidateStreak = (userId: string) => cache.delete(userId);

export const useStreak = (userId?: string | null) => {
  const [s, setS] = useState<StreakInfo | null>(null);
  useEffect(() => { let dead = false; if (userId) void fetchStreak(userId).then((x) => { if (!dead) setS(x); }); return () => { dead = true; }; }, [userId]);
  return s;
};
