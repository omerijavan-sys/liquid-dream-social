import { useEffect, useMemo, useState } from "react";
import VideoThumb from "@/components/VideoThumb";
import { toast } from "sonner";
import { BadgeDollarSign, BarChart3, Sparkles, Eye, Heart, MessageCircle, Users, Film } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface PostRow { id: string; caption: string | null; media_url: string | null; media_type: string | null; likes_count: number | null; views_count: number | null; created_at: string }

const AURA = { like: 5, comment: 10, view: 1, reelLike: 6 };
const LEVELS = [
  { min: 0, name: "Spark", color: "from-slate-400 to-slate-500" },
  { min: 200, name: "Glow", color: "from-sky-400 to-blue-500" },
  { min: 1000, name: "Radiant", color: "from-violet-400 to-fuchsia-500" },
  { min: 5000, name: "Blazing", color: "from-amber-400 to-orange-500" },
  { min: 20000, name: "Legend", color: "from-yellow-300 to-amber-500" },
];
const levelFor = (n: number) => [...LEVELS].reverse().find(l => n >= l.min) ?? LEVELS[0];

function useProfileStats(userId: string, enabled: boolean) {
  const [state, setState] = useState<{ loading: boolean; posts: PostRow[]; comments: Record<string, number>; reelCount: number; reelLikes: number; reelViews: number; followers: number; following: number }>({
    loading: true, posts: [], comments: {}, reelCount: 0, reelLikes: 0, reelViews: 0, followers: 0, following: 0,
  });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const [{ data: posts }, { data: reels }, f1, f2] = await Promise.all([
        supabase.from("posts").select("id, caption, media_url, media_type, likes_count, views_count, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
        supabase.from("reels").select("id, likes_count, views_count").eq("user_id", userId).limit(200),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
      ]);
      const list = (posts ?? []) as unknown as PostRow[];
      const comments: Record<string, number> = {};
      if (list.length) {
        const { data: c } = await supabase.from("post_comments").select("post_id").in("post_id", list.map(p => p.id));
        for (const row of c ?? []) comments[row.post_id] = (comments[row.post_id] ?? 0) + 1;
      }
      const r = (reels ?? []) as unknown as Array<{ likes_count: number | null; views_count: number | null }>;
      if (cancelled) return;
      setState({
        loading: false, posts: list, comments,
        reelCount: r.length,
        reelLikes: r.reduce((s, x) => s + (x.likes_count ?? 0), 0),
        reelViews: r.reduce((s, x) => s + (x.views_count ?? 0), 0),
        followers: f1.count ?? 0, following: f2.count ?? 0,
      });
    })();
    return () => { cancelled = true; };
  }, [userId, enabled]);
  return state;
}

export const AuraDialog = ({ userId, open, onOpenChange }: { userId: string; open: boolean; onOpenChange: (o: boolean) => void }) => {
  const s = useProfileStats(userId, open);
  const ranked = useMemo(() => s.posts.map(p => {
    const likes = p.likes_count ?? 0, views = p.views_count ?? 0, comments = s.comments[p.id] ?? 0;
    return { ...p, likes, views, comments, aura: likes * AURA.like + comments * AURA.comment + views * AURA.view };
  }).sort((a, b) => b.aura - a.aura), [s]);
  const total = ranked.reduce((n, p) => n + p.aura, 0) + s.reelLikes * AURA.reelLike + s.reelViews;
  const level = levelFor(total);
  const next = LEVELS.find(l => l.min > total);
  const max = ranked[0]?.aura || 1;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Aura</DialogTitle>
        {s.loading ? <p className="py-8 text-center text-sm text-muted-foreground">Calculating aura…</p> : (
          <div className="space-y-4">
            <div className={`rounded-2xl bg-gradient-to-br ${level.color} p-4 text-white`}>
              <p className="text-xs uppercase tracking-widest opacity-80">Total aura</p>
              <p className="text-4xl font-extrabold">{total.toLocaleString()}</p>
              <p className="text-sm font-semibold">{level.name}{next ? ` · ${(next.min - total).toLocaleString()} to ${next.name}` : " · Max level"}</p>
            </div>
            <p className="text-xs text-muted-foreground">Each post earns {AURA.like} aura per like, {AURA.comment} per comment and {AURA.view} per view. Reels count too.</p>
            <div className="space-y-2">
              {ranked.length === 0 && <p className="text-sm text-muted-foreground">No posts yet. Post something to start earning aura.</p>}
              {ranked.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border/40 p-2">
                  <span className="w-6 text-center text-sm font-bold text-primary">#{i + 1}</span>
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    {p.media_url && p.media_type !== "video" && <img src={p.media_url} alt="" className="h-full w-full object-cover" />}
                    {p.media_url && p.media_type === "video" && <VideoThumb src={p.media_url} poster={(p as any).thumbnail_url} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{p.caption || "Untitled post"}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (p.aura / max) * 100)}%` }} /></div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{p.likes} likes · {p.comments} comments · {p.views} views</p>
                  </div>
                  <span className="text-sm font-bold text-foreground">{p.aura.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const AnalyticsDialog = ({ userId, isOwner, open, onOpenChange }: { userId: string; isOwner: boolean; open: boolean; onOpenChange: (o: boolean) => void }) => {
  const s = useProfileStats(userId, open);
  const totals = useMemo(() => {
    const likes = s.posts.reduce((n, p) => n + (p.likes_count ?? 0), 0) + s.reelLikes;
    const views = s.posts.reduce((n, p) => n + (p.views_count ?? 0), 0) + s.reelViews;
    const comments = Object.values(s.comments).reduce((n, c) => n + c, 0);
    const interactions = likes + comments;
    return { likes, views, comments, engagement: views ? (interactions / views) * 100 : 0 };
  }, [s]);
  const days = useMemo(() => {
    const out: Array<{ label: string; likes: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      out.push({ label: String(d.getDate()), likes: s.posts.filter(p => { const t = new Date(p.created_at); return t >= d && t < next; }).length });
    }
    return out;
  }, [s]);
  const maxDay = Math.max(1, ...days.map(d => d.likes));
  const top = [...s.posts].sort((a, b) => (b.views_count ?? 0) - (a.views_count ?? 0)).slice(0, 3);
  const Stat = ({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) => (
    <div className="rounded-xl border border-border/40 p-3"><Icon className="mb-1 h-4 w-4 text-primary" /><p className="text-lg font-bold text-foreground">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Analytics</DialogTitle>
        {s.loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading analytics…</p> : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Stat icon={Eye} label="Total views" value={totals.views.toLocaleString()} />
              <Stat icon={Heart} label="Total likes" value={totals.likes.toLocaleString()} />
              <Stat icon={MessageCircle} label="Comments" value={totals.comments.toLocaleString()} />
              <Stat icon={Users} label="Followers" value={s.followers.toLocaleString()} />
              <Stat icon={Film} label="Reels" value={String(s.reelCount)} />
              <Stat icon={BarChart3} label="Engagement rate" value={`${totals.engagement.toFixed(1)}%`} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Posts in the last 14 days</p>
              <div className="flex h-20 items-end gap-1">
                {days.map((d, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-primary/80" style={{ height: `${(d.likes / maxDay) * 100}%`, minHeight: d.likes ? 4 : 2, opacity: d.likes ? 1 : 0.25 }} />
                    <span className="text-[9px] text-muted-foreground">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {top.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Top posts by views</p>
                {top.map(p => <p key={p.id} className="truncate text-sm text-foreground">{(p.views_count ?? 0).toLocaleString()} views · {p.caption || "Untitled post"}</p>)}
              </div>
            )}
            {!isOwner && <p className="text-[11px] text-muted-foreground">Earnings and payouts are only visible to the account owner.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

/** Owner sets their monthly fan-subscription price; others see it on the public profile. */
export const CreatorPlanDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const [price, setPrice] = useState("");
  const [current, setCurrent] = useState<number | null>(null);
  const [subs, setSubs] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data } = await supabase.from("creator_profiles").select("monthly_price").eq("user_id", uid).maybeSingle();
      setCurrent(data?.monthly_price ?? null);
      setPrice(data?.monthly_price ? String(data.monthly_price) : "");
      const { count } = await supabase.from("creator_subscriptions").select("id", { count: "exact", head: true }).eq("creator_id", uid).eq("status", "active").gt("expires_at", new Date().toISOString());
      setSubs(count ?? 0);
    })();
  }, [open]);
  const save = async (value: number) => {
    setBusy(true);
    const { error } = await supabase.rpc("creator_set_price" as any, { _price: value } as any);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setCurrent(value > 0 ? value : null);
    toast.success(value > 0 ? `Fans can now subscribe for KES ${value.toLocaleString()}/month` : "Subscriptions turned off");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="flex items-center gap-2"><BadgeDollarSign className="h-5 w-5 text-primary" /> Fan subscription</DialogTitle>
        <p className="text-sm text-muted-foreground">Set what fans pay each month (KES 10 – 50,000). You keep 95% and it lands in your wallet.</p>
        <input type="number" inputMode="numeric" min={10} max={50000} value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 300" className="w-full rounded-2xl bg-secondary/60 px-4 py-3 outline-none" />
        <p className="text-xs text-muted-foreground">{current ? `Current price: KES ${current.toLocaleString()} · ${subs} active subscriber${subs === 1 ? "" : "s"}` : "Subscriptions are currently off."}</p>
        <div className="flex gap-2">
          <button disabled={busy || !Number(price)} onClick={() => void save(Math.round(Number(price)))} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{current ? "Update price" : "Turn on"}</button>
          {current && <button disabled={busy} onClick={() => void save(0)} className="rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold">Turn off</button>}
        </div>
      </DialogContent>
    </Dialog>
  );
};
