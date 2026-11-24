import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { deviceTz, rpc, table } from "../shared/ui";
import { invalidateStreak, type StreakInfo, fetchStreak } from "./streaks";

export interface Drop {
  id: string; user_id: string; drop_date: string; kind: "photo" | "voice" | "song";
  media_url: string | null; caption: string | null; duration_s: number | null;
  song_title: string | null; song_artist: string | null; song_art_url: string | null; song_url: string | null;
  created_at: string; locked: boolean; mutual: boolean;
}
export interface Person { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null }

/** Daily prompts rotate by day so everybody sees the same one. */
const PROMPTS = [
  "What does your day look like right now?", "Show us your view 👀", "Say hi in 5 seconds 🎙️", "What's stuck in your head today?",
  "Your outfit check ✨", "Something that made you smile", "Snack of the day 🍿", "Where are you hiding right now?", "Your current mood in one pic",
];
export const promptOfTheDay = () => PROMPTS[Math.floor(Date.now() / 86_400_000) % PROMPTS.length];

export const useDrops = () => {
  const { user } = useAuth();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [mine, setMine] = useState<Drop | null>(null);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
    const [{ data: friends }, { data: latest }, st] = await Promise.all([
      rpc<Drop[]>("get_friend_drops", { _limit: 40 }),
      table("daily_drops").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
      fetchStreak(user.id),
    ]);
    const list = friends ?? [];
    setDrops(list);
    setStreak(st);
    // "today" is decided by the server in my own timezone; compare against the same zone here.
    const tz = (await table("profiles").select("tz").eq("user_id", user.id).maybeSingle()).data?.tz ?? deviceTz();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
    const last = (latest?.[0] ?? null) as Drop | null;
    setMine(last && last.drop_date === today ? last : null);
    const ids = [...new Set(list.map((d) => d.user_id))];
    if (ids.length) {
      const { data: ps } = await table("profiles").select("user_id, username, display_name, avatar_url").in("user_id", ids);
      setPeople(Object.fromEntries(((ps ?? []) as Person[]).map((p) => [p.user_id, p])));
    }
    } catch { /* keep the card usable even if a lookup fails */ } finally { setLoading(false); }
  }, [user]);

  // Keep the profile's timezone in sync with the device so streak days roll over at the user's own midnight.
  useEffect(() => {
    if (!user) return;
    const tz = deviceTz();
    void table("profiles").select("tz").eq("user_id", user.id).maybeSingle().then(({ data }: { data: { tz: string } | null }) => {
      if (data && data.tz !== tz) void table("profiles").update({ tz }).eq("user_id", user.id).then(() => load());
    });
  }, [user, load]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    const vis = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [load]);

  const afterPost = useCallback(async () => { if (user) invalidateStreak(user.id); await load(); }, [user, load]);
  return { drops, people, mine, streak, loading, reload: load, afterPost };
};
