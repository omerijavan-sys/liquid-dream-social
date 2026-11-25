import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shuffle, BadgeCheck, Coins, Heart, Store, Target, Music2, Lock, Bot, Globe, Loader2, Search, X, Play, Pause, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TIERS, TIP_AMOUNTS } from "@/lib/extreme";
import CreatorTipButton from "@/components/CreatorTipButton";
import MatchTab from "@/components/MatchTab";
import { getGlobalTrendingMusic, searchGlobalMusic, type GlobalMusicTrack } from "@/services/GlobalMusicService";

const card = "rounded-2xl border border-amber-300/20 bg-[#0b0c0f]/75 p-4 shadow-[0_10px_30px_rgba(0,0,0,.24)] backdrop-blur-xl";
const err = (e: any) => toast.error(e?.message || "Something went wrong");

type Profile = { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null };

const useBalance = () => {
  const [bal, setBal] = useState<number | null>(null);
  const refresh = async () => { const { data } = await supabase.rpc("wallet_my_balance"); setBal(Number(data ?? 0)); };
  useEffect(() => { refresh(); }, []);
  return { bal, refresh };
};

const PeoplePicker = ({ onPick, label }: { onPick: (p: Profile) => void; label: string }) => {
  const [q, setQ] = useState(""); const [res, setRes] = useState<Profile[]>([]);
  const { user } = useAuth();
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("user_id,username,display_name,avatar_url")
        .ilike("username", `%${q.trim()}%`).neq("user_id", user?.id ?? "").limit(6);
      setRes(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, user?.id]);
  return (
    <div className="space-y-2">
      <Input placeholder={label} value={q} onChange={(e) => setQ(e.target.value)} />
      {res.map((p) => (
        <button key={p.user_id} onClick={() => { onPick(p); setQ(""); }} className="w-full flex items-center gap-3 rounded-xl bg-secondary/60 p-2 text-left hover:bg-secondary">
          <img src={p.avatar_url || "/favicon.png"} className="w-8 h-8 rounded-full object-cover" alt="" />
          <span className="text-sm">@{p.username}</span>
        </button>
      ))}
    </div>
  );
};

const VerifiedTab = ({ balance, refresh }: { balance: number | null; refresh: () => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tier, setTier] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const load = () => user && supabase.rpc("prime_tier", { _user_id: user.id }).then(({ data }) => setTier((data as string) ?? null));
  useEffect(() => { load(); }, [user]);
  const sub = async (tierId: string) => {
    const selectedTier = TIERS.find((item) => item.id === tierId);
    if (!selectedTier || balance === null || balance < selectedTier.price) {
      toast.error(balance === null ? "Wallet balance is still loading" : "Add funds to your wallet before subscribing");
      return;
    }
    setSubscribing(tierId);
    try {
      const { error } = await supabase.rpc("prime_subscribe", { _tier: tierId });
      if (error) throw error;
      toast.success("Subscription paid from your wallet and active for 30 days");
      void load();
      refresh();
    } catch (error) {
      err(error);
    } finally {
      setSubscribing(null);
    }
  };
  return (
    <div className="space-y-3">
      {tier && <p className="text-sm">Current tier: <b className={`capitalize ${TIERS.find(t => t.id === tier)?.color ?? "text-[#F5B800]"}`}>{tier.replace("_", " ")}</b></p>}
      <div className={`${card} flex items-center justify-between gap-3 border-amber-200/30`}>
        <p className="text-sm text-white/75">Wallet balance: <b className="text-amber-100">{balance === null ? "Loading…" : `${balance.toLocaleString()} KES`}</b></p>
        <Button size="sm" variant="secondary" onClick={() => navigate("/wallet")}>Top up wallet</Button>
      </div>
      {TIERS.map((t) => (
        <div key={t.id} className={`relative min-h-[132px] overflow-hidden ${card} ${t.id === "gold" ? "border-amber-300/55 shadow-[0_0_28px_rgba(234,179,8,.13)]" : ""} ${t.id === "all_access" ? "border-amber-300/60 bg-gradient-to-br from-amber-200/[0.08] via-[#0b0c0f]/80 to-fuchsia-500/[0.08]" : ""}`}>
          <div className="relative z-10 flex min-h-[96px] items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 font-bold text-white"><BadgeCheck className={`h-4 w-4 ${t.color}`} />{t.name}</p>
              <p className="mt-1 text-sm text-white/65">{t.perks}</p>
              {t.id === "all_access" && <p className="mt-1 text-xs text-amber-200/80">One prepaid month · no automatic renewal</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="rounded-full border border-amber-200/50 bg-black/55 px-3 py-1.5 text-xs font-semibold text-amber-100 shadow-[0_0_14px_rgba(234,179,8,.13)]">
                {t.price.toLocaleString()} KES/mo
              </span>
              <Button
                variant="outline"
                className="rounded-full border-amber-200/35 bg-black/35 px-3 text-xs text-amber-100 hover:bg-amber-200/10 hover:text-white disabled:opacity-40"
                disabled={subscribing !== null || balance === null || balance < t.price}
                onClick={() => void sub(t.id)}
                title={balance === null ? "Wallet balance is loading" : balance < t.price ? "Insufficient wallet balance" : `Subscribe to ${t.name}`}
              >
                {subscribing === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Subscribe"}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const TipTab = ({ refresh }: { refresh: () => void }) => {
  const [to, setTo] = useState<Profile | null>(null);
  const tip = async (a: number) => { if (!to) return; const { data, error } = await supabase.rpc("prime_tip", { _recipient: to.user_id, _amount: a }); if (error) return err(error); toast.success(`@${to.username} received ${data} KES`); refresh(); };
  return (
    <div className={`${card} space-y-3`}>
      {to ? <p>Tipping <b className="text-primary">@{to.username}</b> <button className="text-xs underline ml-2" onClick={() => setTo(null)}>change</button></p> : <PeoplePicker label="Search a creator" onPick={setTo} />}
      <div className="grid grid-cols-3 gap-2">{TIP_AMOUNTS.map((a) => <Button key={a} variant="secondary" disabled={!to} onClick={() => tip(a)}>{a} KES</Button>)}</div>
      <p className="text-xs text-muted-foreground">Creator keeps 95%; Primegram takes 5%.</p>
    </div>
  );
};

const CrushTab = ({ refresh }: { refresh: () => void }) => {
  const [list, setList] = useState<any[]>([]);
  const load = () => supabase.rpc("my_crushes").then(({ data }) => setList(data ?? []));
  useEffect(() => { load(); }, []);
  const send = async (p: Profile) => { const { error } = await supabase.from("crushes").insert({ target_id: p.user_id } as any); if (error) return toast.error(error.code === "23505" ? "You already dropped a crush on them" : error.message); toast.success(`Anonymous crush sent to @${p.username} 💘`); };
  const reveal = async (id: string) => { const { data, error } = await supabase.rpc("crush_reveal", { _crush_id: id }); if (error) return err(error); toast.success(`It's @${data}!`); load(); refresh(); };
  return (
    <Tabs defaultValue="matches" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="matches">Vibe Match</TabsTrigger>
        <TabsTrigger value="crushes">Secret Crushes</TabsTrigger>
      </TabsList>
      <TabsContent value="matches"><MatchTab /></TabsContent>
      <TabsContent value="crushes">
        <div className="space-y-4">
          <div className={card}><p className="font-bold mb-2">Drop a crush (free)</p><PeoplePicker label="Who's your crush?" onPick={send} /></div>
          <div className={card}>
            <p className="font-bold mb-2">{list.length} people crush on you</p>
            {list.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                {c.revealed ? <span>💘 @{c.sender_username}</span> : <span className="flex items-center gap-1 text-muted-foreground"><Lock className="w-4 h-4" />Secret admirer</span>}
                {!c.revealed && <Button size="sm" onClick={() => reveal(c.id)}>Reveal · 30 KES</Button>}
              </div>
            ))}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
};

const GarageTab = () => {
  const { user } = useAuth(); const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]); const [tier, setTier] = useState<string | null>(null);
  const [f, setF] = useState({ title: "", price: "", category: "kicks", description: "" });
  const load = () => supabase.from("market_listings").select("*").order("created_at", { ascending: false }).limit(50).then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); if (user) supabase.rpc("prime_tier", { _user_id: user.id }).then(({ data }) => setTier((data as string) ?? null)); }, [user]);
  const post = async () => {
    const { error } = await supabase.from("market_listings").insert({ title: f.title.trim(), price: Number(f.price), category: f.category, description: f.description.trim() || null } as any);
    if (error) return err(error); setF({ title: "", price: "", category: "kicks", description: "" }); toast.success("Listed in the Garage"); load();
  };
  const dm = (sellerId: string) => { if (!tier) return toast.error("Get Prime Blue to DM sellers"); navigate(`/messages?to=${sellerId}`); };
  return (
    <div className="space-y-4">
      <div className={`${card} space-y-2`}>
        <p className="font-bold">Sell something</p>
        <Input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <div className="flex gap-2">
          <Input placeholder="Price KES" type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          <select className="rounded-md bg-background border border-input px-2 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {["kicks", "tech", "wheels", "thrift", "other"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <Input placeholder="Description (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Button disabled={f.title.trim().length < 2 || !f.price} onClick={post}>List item</Button>
      </div>
      {items.map((i) => (
        <div key={i.id} className={`${card} flex items-center justify-between gap-3`}>
          <div className="min-w-0"><p className="font-semibold truncate">{i.title}</p><p className="text-xs text-muted-foreground capitalize">{i.category} · {Number(i.price).toLocaleString()} KES</p></div>
          {i.seller_id === user?.id
            ? <Button size="sm" variant="secondary" onClick={async () => { await supabase.from("market_listings").delete().eq("id", i.id); load(); }}>Remove</Button>
            : <Button size="sm" onClick={() => dm(i.seller_id)}>{tier ? "DM seller" : <><Lock className="w-3 h-3 mr-1" />Blue only</>}</Button>}
        </div>
      ))}
    </div>
  );
};

const BountyTab = ({ refresh }: { refresh: () => void }) => {
  const { user } = useAuth(); const [amt, setAmt] = useState("500"); const [list, setList] = useState<any[]>([]);
  const load = () => supabase.from("bounties").select("*").eq("active", true).order("created_at", { ascending: false }).limit(20).then(({ data }) => setList(data ?? []));
  useEffect(() => { load(); }, []);
  const create = async () => { const { error } = await supabase.rpc("bounty_create", { _deposit: Number(amt) }); if (error) return err(error); toast.success("Bounty funded — new followers get paid"); load(); refresh(); };
  return (
    <div className="space-y-4">
      <div className={`${card} space-y-2`}>
        <p className="font-bold">Fund a follower bounty</p>
        <p className="text-sm text-muted-foreground">Your deposit is held in escrow. Each new follower earns 9 KES, Primegram keeps 1 KES (10%).</p>
        <div className="flex gap-2"><Input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} /><Button onClick={create}>Deposit</Button></div>
      </div>
      {list.map((b) => (
        <div key={b.id} className={card}>
          <p className="font-semibold">{b.creator_id === user?.id ? "Your bounty" : "Follow & earn 9 KES"}</p>
          <p className="text-xs text-muted-foreground">{Number(b.remaining).toLocaleString()} KES left · {b.followers_paid} followers paid</p>
        </div>
      ))}
    </div>
  );
};

interface UploadedTrack { id: string; user_id: string; title: string; artist: string | null; audio_url: string; cover_url: string | null; duration: number | null; plays: number; created_at: string }

const SoundsTab = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<UploadedTrack[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("music_tracks" as never).select("*").order("created_at", { ascending: false }).limit(60);
    if (query.trim().length >= 2) q = q.or(`title.ilike.%${query.trim()}%,artist.ilike.%${query.trim()}%`);
    const { data } = await q;
    const rows = (data ?? []) as UploadedTrack[];
    setTracks(rows);
    const ids = [...new Set(rows.map(r => r.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, username, display_name").in("user_id", ids);
      setNames(Object.fromEntries((profs ?? []).map(p => [p.user_id, p.display_name || p.username || "Creator"])));
    }
    setLoading(false);
  };
  useEffect(() => { const t = setTimeout(() => { void load(); }, query ? 300 : 0); return () => clearTimeout(t); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const readDuration = (f: File) => new Promise<number | null>((resolve) => {
    const a = new Audio(); a.preload = "metadata"; a.src = URL.createObjectURL(f);
    a.onloadedmetadata = () => { resolve(Number.isFinite(a.duration) ? Math.round(a.duration) : null); URL.revokeObjectURL(a.src); };
    a.onerror = () => resolve(null);
  });

  const upload = async () => {
    if (!user) { toast.error("Sign in to upload music"); return; }
    if (!file || !title.trim()) { toast.error("Add a title and choose an audio file"); return; }
    if (!file.type.startsWith("audio/")) { toast.error("Choose an audio file (mp3, m4a, wav…)"); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("Audio must be under 25 MB"); return; }
    setUploading(true);
    try {
      const base = `${user.id}/music/${Date.now()}`;
      const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
      const { error: upErr } = await supabase.storage.from("media").upload(`${base}.${ext}`, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const audio_url = supabase.storage.from("media").getPublicUrl(`${base}.${ext}`).data.publicUrl;
      let cover_url: string | null = null;
      if (cover) {
        const cext = (cover.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const { error: cErr } = await supabase.storage.from("media").upload(`${base}_cover.${cext}`, cover, { contentType: cover.type });
        if (!cErr) cover_url = supabase.storage.from("media").getPublicUrl(`${base}_cover.${cext}`).data.publicUrl;
      }
      const duration = await readDuration(file);
      const { error } = await supabase.from("music_tracks" as never).insert({ user_id: user.id, title: title.trim(), artist: artist.trim() || null, audio_url, cover_url, duration } as never);
      if (error) throw error;
      toast.success("Your track is live 🎶");
      setTitle(""); setArtist(""); setFile(null); setCover(null); setShowUpload(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  };

  const remove = async (t: UploadedTrack) => {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    const { error } = await supabase.from("music_tracks" as never).delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    setTracks(prev => prev.filter(x => x.id !== t.id));
  };

  const preview = async (t: UploadedTrack) => {
    const audio = audioRef.current; if (!audio) return;
    if (previewingId === t.id) { audio.pause(); setPreviewingId(null); return; }
    audio.pause(); audio.src = t.audio_url; audio.load();
    try { await audio.play(); setPreviewingId(t.id); void supabase.rpc("music_play" as never, { _id: t.id } as never); }
    catch (e) { setPreviewingId(null); toast.error(e instanceof Error ? e.message : "This track could not be played."); }
  };

  const useSound = (t: UploadedTrack) => {
    audioRef.current?.pause(); setPreviewingId(null);
    navigate("/create", { state: { track: { title: t.title, artist: t.artist || names[t.user_id] || "", artUrl: t.cover_url, streamUrl: t.audio_url } } });
  };

  return (
    <div className="space-y-3">
      <audio ref={audioRef} hidden onEnded={() => setPreviewingId(null)} onError={() => { setPreviewingId(null); toast.error("This track could not be played."); }} />
      <div className={`${card} space-y-3`}>
        <div className="flex items-center gap-2">
          <Music2 className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Community Sounds</p>
            <p className="text-xs text-muted-foreground">Music uploaded by Primegram creators. Upload your own, and fans can tip you. Only upload music you own or have the rights to.</p>
          </div>
          <Button size="sm" onClick={() => setShowUpload(v => !v)}><Upload className="mr-1 h-4 w-4" />Upload</Button>
        </div>
        {showUpload && (
          <div className="space-y-2 rounded-2xl border border-border bg-secondary/30 p-3">
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Track title" maxLength={120} />
            <Input value={artist} onChange={e => setArtist(e.target.value)} placeholder="Artist name (optional)" maxLength={80} />
            <label className="block text-xs text-muted-foreground">Audio file (mp3, m4a, wav — max 25 MB)
              <input type="file" accept="audio/*" onChange={e => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
            </label>
            <label className="block text-xs text-muted-foreground">Cover image (optional)
              <input type="file" accept="image/*" onChange={e => setCover(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
            </label>
            <Button className="w-full" disabled={uploading} onClick={() => void upload()}>{uploading ? "Uploading…" : "Publish track"}</Button>
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search community tracks or artists" className="pl-9 pr-10" />
          {query && <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-muted-foreground" /></button>}
        </div>
      </div>
      {loading ? (
        <div className={`${card} flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground`}><Loader2 className="h-4 w-4 animate-spin" />Loading sounds…</div>
      ) : tracks.length === 0 ? (
        <div className={`${card} text-center text-sm text-muted-foreground`}>No tracks yet. Be the first to upload one!</div>
      ) : tracks.map((t) => (
        <div key={t.id} className={`${card} flex items-center gap-3`}>
          {t.cover_url
            ? <img src={t.cover_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" loading="lazy" />
            : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Music2 className="h-5 w-5 text-primary" /></span>}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{t.title}</p>
            <p className="truncate text-xs text-muted-foreground">{t.artist || names[t.user_id] || "Creator"} · by {names[t.user_id] || "Creator"} · {t.plays} plays</p>
          </div>
          <Button size="icon" variant="secondary" aria-label={`${previewingId === t.id ? "Stop" : "Play"} ${t.title}`} onClick={() => void preview(t)}>
            {previewingId === t.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          {user?.id !== t.user_id && <CreatorTipButton creatorId={t.user_id} creatorName={names[t.user_id] || "creator"} trackId={t.id} compact />}
          <Button size="sm" onClick={() => useSound(t)}>Use</Button>
          {user?.id === t.user_id && <Button size="icon" variant="ghost" aria-label="Delete track" onClick={() => void remove(t)}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      ))}
    </div>
  );
};

const tabs = [
  { v: "random", l: "Random", i: Shuffle }, { v: "verified", l: "Verified", i: BadgeCheck }, { v: "tips", l: "Tips", i: Coins },
  { v: "crush", l: "Crush", i: Heart }, { v: "bots", l: "AI Bots", i: Bot },
  { v: "garage", l: "Garage", i: Store }, { v: "bounty", l: "Bounty", i: Target }, { v: "sounds", l: "Sounds", i: Music2 },
];

export default function ExtremePage() {
  const navigate = useNavigate(); const { bal, refresh } = useBalance();
  const requestedTab = new URLSearchParams(location.search).get("tab");
  const defaultTab = tabs.some(({ v }) => v === requestedTab) ? requestedTab! : "random";
  return (
    <div className="prime-extreme min-h-screen pb-28">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-amber-200/20 bg-[#070809]/90 px-3 py-2.5 backdrop-blur-xl">
        <button onClick={() => navigate(-1)} aria-label="Back" className="text-amber-100"><ArrowLeft className="h-4 w-4" /></button>
        <h1 className="text-sm font-black tracking-wide text-amber-300">PRIME EXTREME</h1>
        <button onClick={() => navigate("/wallet")} className="ml-auto rounded-full border border-amber-200/50 bg-black/50 px-3 py-1 text-xs font-semibold text-amber-100 shadow-[0_0_12px_rgba(234,179,8,.18)]">{bal === null ? "…" : `${bal.toLocaleString()} KES`}</button>
      </header>
      <Tabs defaultValue={defaultTab} className="px-2 pt-2">
        <TabsList className="prime-extreme-tabs flex h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0.5">
          {tabs.map(({ v, l, i: I }) => <TabsTrigger key={v} value={v} className="min-w-max flex-1 gap-1 rounded-full border border-amber-200/30 bg-black/45 px-3 py-1.5 text-[11px] text-white/80 data-[state=active]:border-amber-100/70 data-[state=active]:bg-amber-400 data-[state=active]:text-[#17120a] data-[state=active]:shadow-[0_0_14px_rgba(234,179,8,.36)]"><I className="h-3 w-3" />{l}</TabsTrigger>)}
        </TabsList>
        <div className="mt-4">
          <TabsContent value="random">
            <div className={`${card} space-y-3`}>
              <div className="flex items-center gap-2 font-bold"><Shuffle className="h-5 w-5 text-primary" /> Random video chat</div>
              <p className="text-sm text-muted-foreground">Meet new people instantly. Pick your interests, tap Next to skip, report or block anyone.</p>
              <Button className="w-full" onClick={() => navigate("/random")}>Start video chat</Button>
              <Button variant="secondary" className="w-full" onClick={() => navigate("/meet")}>Quick Meet (video or voice)</Button>
            </div>
          </TabsContent>
          <TabsContent value="verified"><VerifiedTab balance={bal} refresh={refresh} /></TabsContent>
          <TabsContent value="tips"><TipTab refresh={refresh} /></TabsContent>
          <TabsContent value="crush"><CrushTab refresh={refresh} /></TabsContent>
          <TabsContent value="bots">
            <div className={`${card} space-y-3`}>
              <div className="flex items-center gap-2 font-bold"><Bot className="h-5 w-5 text-primary" /> Chat with AI agents</div>
              <p className="text-sm text-muted-foreground">Choose a clearly labeled AI companion for creative ideas, study help, or friendly conversation.</p>
              <Button className="w-full" onClick={() => navigate("/bots")}>Explore AI bots</Button>
            </div>
          </TabsContent>
          <TabsContent value="garage"><GarageTab /></TabsContent>
          <TabsContent value="bounty"><BountyTab refresh={refresh} /></TabsContent>
          <TabsContent value="sounds"><SoundsTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
