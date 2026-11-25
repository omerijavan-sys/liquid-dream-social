import { useEffect, useState } from "react";
import { ArrowLeft, Crown, Eye, Heart, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getBlockedIds } from "@/utils/blocks";
import LiquidBackground from "@/components/LiquidBackground";

type Row = { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null; score: number; likes: number; views: number; items: number };
const MEDAL = ["from-yellow-300 to-amber-500", "from-slate-200 to-slate-400", "from-orange-300 to-orange-600"];
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));

/** Weekly Top Creators: ranked by likes and views on what they posted in the last 7 days. */
const TopCreatorsPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const [{ data }, blocked] = await Promise.all([(supabase.rpc as any)("top_creators_week", { _limit: 30 }), getBlockedIds()]); // eslint-disable-line @typescript-eslint/no-explicit-any
        setRows(((data ?? []) as Row[]).filter((r) => !blocked.has(r.user_id)).slice(0, 20));
      } catch { setRows([]); }
    })();
  }, []);
  return (
    <div className="relative min-h-screen bg-background">
      <LiquidBackground />
      <div className="liquid-glass-elevated safe-area-top relative z-10">
        <div className="flex items-center gap-3 px-5 py-4">
          <button onClick={() => navigate(-1)} aria-label="Back" className="depth-press"><ArrowLeft className="h-5 w-5 text-foreground" /></button>
          <Trophy className="h-5 w-5 text-amber-400" />
          <span className="text-base font-bold text-foreground">Top Creators</span>
          <span className="ml-auto text-[11px] text-muted-foreground">This week</span>
        </div>
      </div>
      <div className="relative z-10 space-y-2 px-4 pb-24 pt-4">
        <p className="text-xs text-muted-foreground">Ranked by likes and views on what creators posted in the last 7 days. Post and reel more to climb.</p>
        {rows === null && Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />)}
        {rows?.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">No rankings yet this week. Be the first to post.</p>}
        {rows?.map((r, i) => (
          <button key={r.user_id} onClick={() => navigate(`/profile/${r.user_id}`)} className="liquid-glass flex w-full items-center gap-3 rounded-2xl p-3 text-left">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${i < 3 ? `bg-gradient-to-br ${MEDAL[i]} text-black` : "bg-white/10 text-foreground"}`}>{i === 0 ? <Crown className="h-4 w-4" /> : i + 1}</span>
            {r.avatar_url ? <img src={r.avatar_url} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-full object-cover" /> : <span className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">{r.display_name || r.username || "Creator"}</span>
              <span className="flex items-center gap-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><Heart className="h-3 w-3" />{k(r.likes)}</span><span className="flex items-center gap-1"><Eye className="h-3 w-3" />{k(r.views)}</span><span>{r.items} post{r.items === 1 ? "" : "s"}</span></span>
            </span>
            <span className="text-right"><span className="block text-sm font-extrabold text-foreground">{k(r.score)}</span><span className="text-[10px] text-muted-foreground">pts</span></span>
          </button>
        ))}
      </div>
    </div>
  );
};
export default TopCreatorsPage;
