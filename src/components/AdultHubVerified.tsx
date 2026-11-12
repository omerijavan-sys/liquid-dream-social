import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Eye, EyeOff, Heart, Lock, Play, ShieldCheck, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import CreatorTipButton from "@/components/CreatorTipButton";
import { Button } from "@/components/ui/button";

type AdultPost = {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  views_count: number;
};

type Creator = { user_id: string; username: string | null; display_name: string | null; monthly_price: number };

const AdultHubVerified = () => {
  const { user } = useAuth();
  const [verified, setVerified] = useState<boolean | null>(null);
  const [dob, setDob] = useState({ d: "", m: "", y: "" });
  const [consent, setConsent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [posts, setPosts] = useState<AdultPost[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [blurSensitive, setBlurSensitive] = useState(true);
  const [filter, setFilter] = useState<"all" | "photo" | "video">("all");

  useEffect(() => {
    if (!user) { setVerified(false); return; }
    let cancelled = false;
    supabase.from("profiles").select("adult_verified_at").eq("user_id", user.id).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (error) toast.error("Couldn’t check age verification");
      setVerified(Boolean(data?.adult_verified_at));
    });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user || !verified) { setPosts([]); setCreators([]); return; }
    let cancelled = false;
    const load = async () => {
      const [{ data: postData, error: postError }, { data: creatorData, error: creatorError }] = await Promise.all([
        supabase.from("posts").select("id,user_id,caption,media_url,media_type,views_count").eq("is_adult", true).order("created_at", { ascending: false }).limit(60),
        supabase.from("creator_profiles").select("user_id,monthly_price").limit(60),
      ]);
      if (cancelled) return;
      if (postError) toast.error("Couldn’t load the verified feed");
      if (creatorError) toast.error("Couldn’t load creator plans");
      setPosts((postData ?? []) as AdultPost[]);
      const creatorIds = (creatorData ?? []).map(item => item.user_id);
      const { data: profileData } = creatorIds.length
        ? await supabase.from("profiles").select("user_id,username,display_name").in("user_id", creatorIds)
        : { data: [] };
      const profiles = new Map((profileData ?? []).map(profile => [profile.user_id, profile]));
      setCreators((creatorData ?? []).map(item => ({
        user_id: item.user_id,
        monthly_price: item.monthly_price,
        username: profiles.get(item.user_id)?.username ?? null,
        display_name: profiles.get(item.user_id)?.display_name ?? null,
      })));
    };
    void load();
    return () => { cancelled = true; };
  }, [user, verified]);

  const verify = async () => {
    const { d, m, y } = dob;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (!d || !m || !y || date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) {
      toast.error("Enter a valid date of birth"); return;
    }
    if (!consent) { toast.error("Confirm you are 18 or older to continue"); return; }
    setChecking(true);
    try {
      const { data, error } = await supabase.rpc("verify_adult", { _dob: `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` });
      if (error) throw error;
      if (!data) { toast.error("You must be 18 or older to enter"); return; }
      setVerified(true);
      toast.success("18+ access verified");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Age verification failed"); }
    finally { setChecking(false); }
  };

  const visiblePosts = useMemo(() => posts.filter(post => filter === "all" || (filter === "video" ? post.media_type === "video" : post.media_type !== "video")), [posts, filter]);
  const years = Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - 18 - i));
  const selectClass = "flex-1 rounded-xl border border-white/10 bg-black/40 px-2 py-2.5 text-sm text-foreground";

  if (verified === null) return <div className="p-8 text-center text-sm text-muted-foreground">Checking secure access…</div>;
  if (!verified) return (
    <div className="overflow-hidden rounded-3xl border border-rose-400/30 bg-black/70 p-6 shadow-[0_0_50px_rgba(255,0,51,.16)] backdrop-blur-2xl">
      <div className="mb-5 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15"><ShieldCheck className="h-6 w-6 text-rose-300" /></div><div><p className="font-bold text-white">18+ Verified Access Only</p><p className="text-xs text-white/55">Confirm your age before viewing mature creator content.</p></div></div>
      <div className="mb-3 flex gap-2">{[["d", "Day"], ["m", "Month"], ["y", "Year"]].map(([key, label]) => <select key={key} className={selectClass} value={dob[key as keyof typeof dob]} onChange={e => setDob({ ...dob, [key]: e.target.value })} aria-label={label}><option value="">{label}</option>{(key === "y" ? years : Array.from({ length: key === "d" ? 31 : 12 }, (_, i) => String(i + 1))).map(value => <option key={value} value={value}>{value}</option>)}</select>)}</div>
      <label className="mb-4 flex gap-2 text-xs text-white/60"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 accent-rose-500" /> I confirm I am 18 or older and want to access mature content.</label>
      <Button onClick={verify} disabled={checking} className="w-full gap-2 bg-rose-600 text-white hover:bg-rose-500"><Lock className="h-4 w-4" />{checking ? "Checking…" : "Verify & Enter"}</Button>
      <p className="mt-3 text-center text-[11px] text-white/40">Verification is stored on your account. No face image is collected by this screen.</p>
    </div>
  );

  return <div className="space-y-4">
    <section className="rounded-3xl border border-rose-400/25 bg-black/70 p-4 shadow-[0_0_35px_rgba(255,0,51,.12)] backdrop-blur-2xl">
      <div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/15"><Sparkles className="h-5 w-5 text-rose-300" /></div><div className="min-w-0 flex-1"><p className="font-bold text-white">Verified Creator Hub</p><p className="text-xs text-white/55">Wallet-powered tips and creator memberships.</p></div><button onClick={() => setBlurSensitive(value => !value)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/75" aria-label={blurSensitive ? "Show sensitive previews" : "Blur sensitive previews"}>{blurSensitive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] text-white/55"><div className="rounded-2xl bg-white/5 p-3"><Heart className="mx-auto mb-1 h-4 w-4 text-rose-300" />Tips from wallet</div><div className="rounded-2xl bg-white/5 p-3"><Users className="mx-auto mb-1 h-4 w-4 text-rose-300" />Fan clubs</div><div className="rounded-2xl bg-white/5 p-3"><Lock className="mx-auto mb-1 h-4 w-4 text-rose-300" />Private access</div></div>
    </section>
    <div className="flex gap-2">{(["all", "photo", "video"] as const).map(value => <Button key={value} size="sm" variant={filter === value ? "default" : "secondary"} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "photo" ? "Photos" : "Videos"}</Button>)}</div>
    {visiblePosts.length === 0 ? <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-sm text-white/50">No verified creator posts yet.</div> : <div className="grid grid-cols-2 gap-2">{visiblePosts.map((post, index) => <motion.article key={post.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .03 }} className="overflow-hidden rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="relative aspect-square bg-black/50">{post.media_url && (post.media_type === "video" ? <video src={post.media_url} muted preload="metadata" className={`h-full w-full object-cover ${blurSensitive ? "blur-lg" : ""}`} /> : <img src={post.media_url} alt="Verified creator content" loading="lazy" className={`h-full w-full object-cover ${blurSensitive ? "blur-lg" : ""}`} />)}<div className="absolute inset-0 flex items-center justify-center bg-black/10">{post.media_type === "video" && <Play className="h-8 w-8 text-white" />}</div></div>
      <div className="space-y-2 p-2"><p className="line-clamp-2 text-xs text-white/70">{post.caption || "Exclusive verified content"}</p><CreatorTipButton creatorId={post.user_id} /><CreatorSubscriptionButton creatorId={post.user_id} creator={creators.find(item => item.user_id === post.user_id)} /></div>
    </motion.article>)}</div>}
    <p className="flex items-center justify-center gap-1 text-center text-[11px] text-white/40"><Check className="h-3 w-3 text-emerald-300" /> All purchases use the authenticated Prime Wallet ledger.</p>
  </div>;
};

const CreatorSubscriptionButton = ({ creatorId, creator }: { creatorId: string; creator?: Creator }) => {
  const [loading, setLoading] = useState(false);
  if (!creator) return null;
  const subscribe = async () => {
    setLoading(true);
    const { error } = await supabase.rpc("creator_subscribe", { _creator_id: creatorId });
    setLoading(false);
    if (error) toast.error(error.message); else toast.success(`Subscribed for KES ${creator.monthly_price.toLocaleString()}`);
  };
  return <button onClick={() => void subscribe()} disabled={loading} className="flex w-full items-center justify-center gap-1 rounded-xl border border-rose-300/25 bg-rose-500/10 px-2 py-2 text-[10px] font-semibold text-rose-100 disabled:opacity-50"><Users className="h-3 w-3" />{loading ? "Processing…" : `Subscribe · KES ${creator.monthly_price.toLocaleString()}`}</button>;
};

export default AdultHubVerified;
