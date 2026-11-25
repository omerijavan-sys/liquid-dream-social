import { useEffect, useMemo, useState } from "react";
import VideoThumb from "@/components/VideoThumb";
import { toast } from "sonner";
import { BadgeDollarSign, BarChart3, Sparkles, Eye, Heart, MessageCircle, Users, Film } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface ReelRow { id: string; caption: string | null; thumbnail_url: string | null; video_url: string; likes_count: number | null; views_count: number | null; created_at: string; source_post_id: string | null }
interface PostRow { id: string; caption: string | null; media_url: string | null; media_type: string | null; likes_count: number | null; views_count: number | null; created_at: string }

const AURA = { like: 5, comment: 10, view: 1, reelLike: 6 };
const LEVELS = [
  { min: 0, name: "Spark", color: "from-slate-400 to-slate-500" },
  { min: 200, name: "Glow", color: "from-sky-400 to-blue-500" },
  { min: 1000, name: "Radiant", color: "from-violet-400 to-fuchsia-500" },
  { min: 5000, name: "Blazing", color: "from-amber-400 to-orange-500" },
  { min: 20000, name: "Legend", color: "from-yellow-300 to-amber-500" },
];
export const levelFor = (n: number) => [...LEVELS].reverse().find(l => n >= l.min) ?? LEVELS[0];

const GLOWS = ["", "rgba(56,189,248,.55)", "rgba(217,70,239,.6)", "rgba(251,146,60,.7)", "rgba(250,204,21,.85)"];
/** Box-shadow for the profile picture. The higher the aura level, the stronger the glow (Spark has none). */
export const auraGlowStyle = (aura: number): React.CSSProperties => {
  const i = LEVELS.indexOf(levelFor(aura));
  if (i <= 0) return {};
  const c = GLOWS[i];
  return { boxShadow: `0 0 ${10 + i * 6}px ${2 + i}px ${c}, 0 0 ${24 + i * 12}px ${i * 2}px ${c.replace(/[\d.]+\)$/, ".25)")}` };
};

/** Aura points + global rank for a user (cheap server-side calculation). */
export function useAuraRank(userId: string | undefined) {
  const [v, setV] = useState<{ aura: number; rank: number; total: number } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let dead = false;
    void (supabase.rpc as any)("aura_rank", { _user: userId }).then(({ data }: { data: { aura: number; rank: number; total_users: number }[] | null }) => {
      const r = data?.[0]; if (!dead && r) setV({ aura: Number(r.aura), rank: r.rank, total: r.total_users });
    });
    return () => { dead = true; };
  }, [userId]);
  return v;
}

function useProfileStats(userId: string, enabled: boolean) {
  const [state, setState] = useState<{ loading: boolean; posts: PostRow[]; reels: ReelRow[]; comments: Record<string, number>; reelComments: Record<string, number>; reelCount: number; reelLikes: number; reelViews: number; followers: number; following: number }>({
    loading: true, posts: [], reels: [], comments: {}, reelComments: {}, reelCount: 0, reelLikes: 0, reelViews: 0, followers: 0, following: 0,
  });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const [{ data: posts }, { data: reels }, f1, f2] = await Promise.all([
        supabase.from("posts").select("id, caption, media_url, media_type, likes_count, views_count, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
        supabase.from("reels").select("id, caption, thumbnail_url, video_url, likes_count, views_count, created_at, source_post_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
      ]);
      const list = (posts ?? []) as unknown as PostRow[];
      const comments: Record<string, number> = {};
      if (list.length) {
        const { data: c } = await supabase.from("post_comments").select("post_id").in("post_id", list.map(p => p.id));
        for (const row of c ?? []) comments[row.post_id] = (comments[row.post_id] ?? 0) + 1;
      }
      // Reels made automatically from a video post are the same content, so only stand-alone reels are counted on top of posts.
      const r = ((reels ?? []) as unknown as ReelRow[]).filter(x => !x.source_post_id);
      const reelComments: Record<string, number> = {};
      if (r.length) {
        const { data: rc } = await supabase.from("reel_comments").select("reel_id").in("reel_id", r.map(x => x.id));
        for (const row of rc ?? []) reelComments[row.reel_id] = (reelComments[row.reel_id] ?? 0) + 1;
      }
      if (cancelled) return;
      setState({
        loading: false, posts: list, comments, reels: r, reelComments,
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

type Item = { key: string; kind: "post" | "reel"; id: string; caption: string | null; thumb: string | null; video: string | null; likes: number; views: number; comments: number; aura: number; created_at: string };

function useItems(s: ReturnType<typeof useProfileStats>): Item[] {
  return useMemo(() => {
    const posts: Item[] = s.posts.map(p => {
      const likes = p.likes_count ?? 0, views = p.views_count ?? 0, comments = s.comments[p.id] ?? 0;
      return { key: `p${p.id}`, kind: "post", id: p.id, caption: p.caption, thumb: p.media_type === "video" ? ((p as any).thumbnail_url ?? null) : p.media_url, video: p.media_type === "video" ? p.media_url : null, likes, views, comments, aura: likes * AURA.like + comments * AURA.comment + views * AURA.view, created_at: p.created_at };
    });
    const reels: Item[] = s.reels.map(r => {
      const likes = r.likes_count ?? 0, views = r.views_count ?? 0, comments = s.reelComments[r.id] ?? 0;
      return { key: `r${r.id}`, kind: "reel", id: r.id, caption: r.caption, thumb: r.thumbnail_url, video: r.video_url, likes, views, comments, aura: likes * AURA.reelLike + comments * AURA.comment + views, created_at: r.created_at };
    });
    return [...posts, ...reels];
  }, [s]);
}

/** Money the creator earned in the last 30 days (tips, subscriptions and referral rewards). Owner only. */
function useEarnings(userId: string, enabled: boolean) {
  const [e, setE] = useState<{ tips: number; other: number; referral: number; loading: boolean }>({ tips: 0, other: 0, referral: 0, loading: true });
  useEffect(() => {
    if (!enabled) return;
    let dead = false;
    void (async () => {
      try {
        const since = new Date(Date.now() - 30 * 86400_000).toISOString();
        const [{ data: tx }, { data: wt }, { data: ref }] = await Promise.all([
          supabase.from("transactions").select("creator_net_kes, payment_type").eq("creator_id", userId).eq("status", "success").gte("created_at", since),
          supabase.from("wallet_transactions").select("amount").eq("user_id", userId).eq("type", "receive").gte("created_at", since),
          (supabase.rpc as any)("my_referral_earnings"), // eslint-disable-line @typescript-eslint/no-explicit-any
        ]);
        const net = (tx ?? []).filter(t => t.payment_type !== "topup");
        const tipNet = net.filter(t => t.payment_type === "tip").reduce((n, t) => n + Number(t.creator_net_kes), 0);
        const otherNet = net.filter(t => t.payment_type !== "tip").reduce((n, t) => n + Number(t.creator_net_kes), 0);
        const walletTips = (wt ?? []).reduce((n, t) => n + Number(t.amount), 0);
        if (!dead) setE({ tips: tipNet + walletTips, other: otherNet, referral: Number((ref as { last30?: number } | null)?.last30 ?? 0), loading: false });
      } catch { if (!dead) setE(x => ({ ...x, loading: false })); }
    })();
    return () => { dead = true; };
  }, [userId, enabled]);
  return e;
}

/** The hour of day (local) when this creator's posts earn the most likes on average. */
function bestHour(items: Item[]): { label: string; n: number } | null {
  if (items.length < 5) return null;
  const by = new Map<number, { likes: number; n: number }>();
  for (const it of items) { const h = new Date(it.created_at).getHours(); const b = by.get(h) ?? { likes: 0, n: 0 }; b.likes += it.likes; b.n += 1; by.set(h, b); }
  let best: number | null = null, bestAvg = -1;
  for (const [h, b] of by) { const avg = b.likes / b.n; if (avg > bestAvg) { bestAvg = avg; best = h; } }
  if (best === null || bestAvg <= 0) return null;
  const ampm = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
  return { label: `${ampm(best)}–${ampm((best + 1) % 24)}`, n: by.get(best)!.n };
}

const Thumb = ({ it }: { it: Item }) => (
  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-secondary">
    {it.thumb ? <img src={it.thumb} alt="" className="h-full w-full object-cover" /> : it.video ? <VideoThumb src={it.video} /> : null}
    {it.kind === "reel" && <Film className="absolute bottom-0.5 right-0.5 h-3 w-3 text-white drop-shadow" />}
  </div>
);

export const AuraDialog = ({ userId, open, onOpenChange }: { userId: string; open: boolean; onOpenChange: (o: boolean) => void }) => {
  const s = useProfileStats(userId, open);
  const rank = useAuraRank(open ? userId : undefined);
  const [board, setBoard] = useState<{ user_id: string; username: string | null; display_name: string | null; avatar_url: string | null; aura: number }[]>([]);
  useEffect(() => {
    if (!open) return;
    void (supabase.rpc as any)("aura_leaderboard", { _limit: 5 }).then(({ data }: { data: typeof board | null }) => setBoard(data ?? []));
  }, [open]);
  const items = useItems(s);
  const ranked = useMemo(() => [...items].sort((a, b) => b.aura - a.aura), [items]);
  const total = ranked.reduce((n, p) => n + p.aura, 0);
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
              <p className="text-xs uppercase tracking-widest opacity-80">Aura points</p>
              <p className="text-4xl font-extrabold">{total.toLocaleString()}</p>
              <p className="text-sm font-semibold">{level.name}{next ? ` · ${(next.min - total).toLocaleString()} to ${next.name}` : " · Max level"}</p>
            </div>
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Aura rank</p>
              <p className="text-3xl font-extrabold text-foreground">{rank ? `#${rank.rank.toLocaleString()}` : "…"}<span className="ml-2 text-sm font-medium text-muted-foreground">{rank ? `of ${rank.total.toLocaleString()} creators` : ""}</span></p>
              {board.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground">Top aura on Primegram</p>
                  {board.map((b, i) => (
                    <div key={b.user_id} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${b.user_id === userId ? "bg-primary/20" : ""}`}>
                      <span className="w-5 text-center font-bold text-primary">{i + 1}</span>
                      <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-secondary">{b.avatar_url && <img src={b.avatar_url} alt="" className="h-full w-full object-cover" />}</span>
                      <span className="min-w-0 flex-1 truncate text-foreground">{b.username || b.display_name || "user"}</span>
                      <span className="font-semibold text-foreground">{Number(b.aura).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Posts earn {AURA.like} aura per like, reels {AURA.reelLike}; every comment is {AURA.comment} and every viewer is {AURA.view}. When your aura levels up, your profile picture glows.</p>
            <div className="space-y-2">
              {ranked.length === 0 && <p className="text-sm text-muted-foreground">No posts yet. Post something to start earning aura.</p>}
              {ranked.map((p, i) => (
                <div key={p.key} className="flex items-center gap-3 rounded-xl border border-border/40 p-2">
                  <span className="w-6 text-center text-sm font-bold text-primary">#{i + 1}</span>
                  <Thumb it={p} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{p.kind === "reel" ? "Reel · " : ""}{p.caption || (p.kind === "reel" ? "Untitled reel" : "Untitled post")}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (p.aura / max) * 100)}%` }} /></div>
                    <p className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground"><span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{p.views.toLocaleString()} viewers</span><span>{p.likes} likes</span><span>{p.comments} comments</span></p>
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
  const items = useItems(s);
  const earn = useEarnings(userId, open && isOwner);
  const best = useMemo(() => bestHour(items), [items]);
  const totals = useMemo(() => {
    const likes = s.posts.reduce((n, p) => n + (p.likes_count ?? 0), 0) + s.reelLikes;
    const views = s.posts.reduce((n, p) => n + (p.views_count ?? 0), 0) + s.reelViews;
    const comments = Object.values(s.comments).reduce((n, c) => n + c, 0) + Object.values(s.reelComments).reduce((n, c) => n + c, 0);
    const interactions = likes + comments;
    return { likes, views, comments, engagement: views ? (interactions / views) * 100 : 0 };
  }, [s]);
  const days = useMemo(() => {
    const out: Array<{ label: string; likes: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      out.push({ label: String(d.getDate()), likes: items.filter(p => { const t = new Date(p.created_at); return t >= d && t < next; }).length });
    }
    return out;
  }, [items]);
  const maxDay = Math.max(1, ...days.map(d => d.likes));
  const byViews = [...items].sort((a, b) => b.views - a.views).slice(0, 30);
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
              <Stat icon={Film} label="Posts + reels" value={`${s.posts.length + s.reels.length} (${s.reels.length} reels)`} />
              <Stat icon={BarChart3} label="Engagement rate" value={`${totals.engagement.toFixed(1)}%`} />
            </div>
            {isOwner && !earn.loading && (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3">
                <p className="text-xs font-semibold text-emerald-300">Earnings, last 30 days</p>
                <p className="mt-0.5 text-lg font-bold text-foreground">KES {(earn.tips + earn.other + earn.referral).toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground">Tips KES {earn.tips.toLocaleString()} · Subscriptions KES {earn.other.toLocaleString()} · Referrals KES {earn.referral.toLocaleString()}</p>
              </div>
            )}
            {best && <p className="rounded-xl bg-primary/10 p-3 text-xs text-foreground">Best time to post: <strong>{best.label}</strong>. Your posts around then get the most likes.</p>}
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Posts and reels in the last 14 days</p>
              <div className="flex h-20 items-end gap-1">
                {days.map((d, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-primary/80" style={{ height: `${(d.likes / maxDay) * 100}%`, minHeight: d.likes ? 4 : 2, opacity: d.likes ? 1 : 0.25 }} />
                    <span className="text-[9px] text-muted-foreground">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {byViews.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Viewers per post and reel</p>
                <div className="space-y-1.5">
                  {byViews.map(p => (
                    <div key={p.key} className="flex items-center gap-2.5 rounded-xl border border-border/40 p-2">
                      <Thumb it={p} />
                      <p className="min-w-0 flex-1 truncate text-sm text-foreground">{p.kind === "reel" ? "Reel · " : ""}{p.caption || (p.kind === "reel" ? "Untitled reel" : "Untitled post")}</p>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-foreground"><Eye className="h-3.5 w-3.5 text-primary" />{p.views.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
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
