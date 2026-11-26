import { useEffect, useState } from "react";
import { Flame, Heart, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { captureVideoFrame } from "@/utils/videoPoster";

type Item = { id: string; video_url: string | null; thumbnail_url: string | null; caption: string | null; likes_count: number; views_count: number; user_id: string };
const FEW_FOLLOWS = 5;
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));

/** "Trending in Kenya": the week's most-liked reels, so a brand-new account never opens to an empty feed. */
const TrendingStrip = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [frames, setFrames] = useState<Record<string, string>>({});
  // Reels with no saved cover get a still frame grabbed from the video, one at a time to keep data use low.
  useEffect(() => {
    let dead = false;
    void (async () => {
      for (const r of items) {
        if (dead) return;
        if (r.thumbnail_url || !r.video_url) continue;
        const f = await captureVideoFrame(r.video_url);
        if (f && !dead) setFrames((cur) => ({ ...cur, [r.id]: f }));
      }
    })();
    return () => { dead = true; };
  }, [items]);
  useEffect(() => {
    if (!user) return;
    let dead = false;
    void (async () => {
      try {
        const { count } = await supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", user.id);
        if ((count ?? 0) >= FEW_FOLLOWS) return;
        const since = new Date(Date.now() - 14 * 86400_000).toISOString();
        const { data } = await supabase.from("reels")
          .select("id, video_url, thumbnail_url, caption, likes_count, views_count, user_id")
          .is("source_post_id", null).eq("visibility", "public").gte("created_at", since)
          .order("likes_count", { ascending: false }).order("views_count", { ascending: false }).limit(12);
        const rows = (data ?? []) as Item[];
        if (dead || rows.length < 3) return;
        const ids = [...new Set(rows.map((r) => r.user_id))];
        const { data: ps } = await supabase.from("profiles").select("user_id, username, display_name").in("user_id", ids);
        if (dead) return;
        setNames(Object.fromEntries((ps ?? []).map((p) => [p.user_id, p.display_name || p.username || "Creator"])));
        setItems(rows);
      } catch { /* optional module: stay hidden on any failure */ }
    })();
    return () => { dead = true; };
  }, [user]);
  if (!items.length) return null;
  return (
    <section className="mb-4">
      <div className="mx-4 mb-2 flex items-center gap-1.5">
        <Flame className="h-4 w-4 text-orange-400" />
        <h2 className="text-sm font-bold">Trending in Kenya</h2>
        <button onClick={() => navigate("/top")} className="ml-auto text-xs font-semibold text-amber-300">Top creators</button><button onClick={() => navigate("/reels")} className="ml-3 text-xs font-semibold text-primary">See all</button>
      </div>
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-none">
        {items.map((r) => (
          <button key={r.id} onClick={() => navigate(`/reels?id=${r.id}`)} aria-label={`Trending reel by ${names[r.user_id] ?? "creator"}`}
            className="relative h-48 w-32 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/50 to-fuchsia-600/40 text-left">
            {(r.thumbnail_url || frames[r.id]) && <img src={(r.thumbnail_url || frames[r.id])!} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8 text-white">
              <span className="block truncate text-[11px] font-bold">{names[r.user_id] ?? "Creator"}</span>
              <span className="mt-0.5 flex items-center gap-2 text-[10px] text-white/80"><span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{k(r.likes_count)}</span><span className="flex items-center gap-0.5"><Play className="h-3 w-3" />{k(r.views_count)}</span></span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};
export default TrendingStrip;
