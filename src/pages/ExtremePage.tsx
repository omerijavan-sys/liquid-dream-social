import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Coins, Heart, Store, Target, Music2, Lock, ShieldAlert, Bot, Globe, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TIERS, TIP_AMOUNTS } from "@/lib/extreme";
import AdultTab from "@/components/AdultTab";
import MatchTab from "@/components/MatchTab";
import { getGlobalTrendingMusic, searchGlobalMusic, type GlobalMusicTrack } from "@/services/GlobalMusicService";

const card = "rounded-2xl border border-primary/30 bg-card/70 backdrop-blur-xl p-4 shadow-[0_0_30px_-12px_hsl(var(--primary)/0.6)]";
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

const VerifiedTab = ({ refresh }: { refresh: () => void }) => {
  const { user } = useAuth(); const [tier, setTier] = useState<string | null>(null);
  const load = () => user && supabase.rpc("prime_tier", { _user_id: user.id }).then(({ data }) => setTier((data as string) ?? null));
  useEffect(() => { load(); }, [user]);
  const sub = async (t: string) => { const { error } = await supabase.rpc("prime_subscribe", { _tier: t }); if (error) return err(error); toast.success("You're Prime Verified for 30 days"); load(); refresh(); };
  return (
    <div className="space-y-3">
      {tier && <p className="text-sm">Current tier: <b className="text-primary capitalize">{tier}</b></p>}
      {TIERS.map((t) => (
        <div key={t.id} className={`${card} ${t.id === "all_access" ? "border-primary/60 bg-gradient-to-br from-primary/10 via-card/70 to-fuchsia-500/10 shadow-[0_0_34px_-10px_hsl(var(--primary)/.8)]" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <div><p className="font-bold flex items-center gap-1"><BadgeCheck className={`w-4 h-4 ${t.color}`} />{t.name}</p><p className="text-sm text-muted-foreground">{t.perks}</p>{t.id === "all_access" && <p className="mt-1 text-xs text-primary">One prepaid month · no automatic renewal</p>}</div>
            <Button onClick={() => sub(t.id)}>{t.price.toLocaleString()} KES/mo</Button>
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

const SoundsTab = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<GlobalMusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const found = query.trim().length >= 2
          ? await searchGlobalMusic(query, 30)
          : await getGlobalTrendingMusic(30);
        if (!cancelled) setTracks(found);
      } catch (reason) {
        if (!cancelled) {
          setTracks([]);
          setError(reason instanceof Error ? reason.message : "Global music is unavailable right now.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query.trim().length >= 2 ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const attachTrackToPost = (track: GlobalMusicTrack) => {
    navigate("/create", {
      state: {
        track: {
          title: track.title,
          artist: track.artist,
          artUrl: track.artwork,
          streamUrl: track.streamUrl,
        },
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className={`${card} space-y-3`}>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Worldwide Sounds</p>
            <p className="text-xs text-muted-foreground">Search Audius’s global independent-music catalogue. Availability and rights are managed by the source.</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search any track, artist, or genre worldwide" className="pl-9 pr-10" />
          {query && <button onClick={() => setQuery("")} aria-label="Clear music search" className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-muted-foreground" /></button>}
        </div>
        <div className="flex flex-wrap gap-2">
          {["Afrobeats", "Amapiano", "Latin", "K-pop", "Arabic", "Reggae", "South Asian", "Electronic"].map(genre => (
            <button key={genre} onClick={() => setQuery(genre)} className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${query.toLowerCase() === genre.toLowerCase() ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"}`}>{genre}</button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className={`${card} flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground`}><Loader2 className="h-4 w-4 animate-spin" />Loading worldwide sounds…</div>
      ) : error ? (
        <div role="alert" className={`${card} text-sm text-destructive`}>{error}</div>
      ) : tracks.length === 0 ? (
        <div className={`${card} text-center text-sm text-muted-foreground`}>No tracks found. Try another artist or style.</div>
      ) : tracks.map((track, index) => (
        <div key={track.id} className={`${card} flex items-center gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_0_24px_-12px_hsl(var(--primary)/.8)]`}>
          {track.artwork
            ? <img src={track.artwork} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" loading="lazy" />
            : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Music2 className="h-5 w-5 text-primary" /></span>}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{index + 1}. {track.title}</p>
            <p className="truncate text-xs text-muted-foreground">{track.artist}{track.duration ? ` · ${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, "0")}` : ""}</p>
          </div>
          <Button size="sm" onClick={() => attachTrackToPost(track)}>Use sound</Button>
        </div>
      ))}
    </div>
  );
};

const tabs = [
  { v: "verified", l: "Verified", i: BadgeCheck }, { v: "tips", l: "Tips", i: Coins },
  { v: "crush", l: "Crush", i: Heart }, { v: "adult", l: "18+", i: ShieldAlert }, { v: "bots", l: "AI Bots", i: Bot },
  { v: "garage", l: "Garage", i: Store }, { v: "bounty", l: "Bounty", i: Target }, { v: "sounds", l: "Sounds", i: Music2 },
];

export default function ExtremePage() {
  const navigate = useNavigate(); const { bal, refresh } = useBalance();
  const requestedTab = new URLSearchParams(location.search).get("tab");
  const defaultTab = tabs.some(({ v }) => v === requestedTab) ? requestedTab! : "verified";
  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-background/80 backdrop-blur-xl border-b border-primary/20">
        <button onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="font-black tracking-wide text-primary">PRIME EXTREME</h1>
        <button onClick={() => navigate("/wallet")} className="ml-auto rounded-full border border-primary/40 px-3 py-1 text-sm">{bal === null ? "…" : `${bal.toLocaleString()} KES`}</button>
      </header>
      <Tabs defaultValue={defaultTab} className="px-4 pt-4">
        <TabsList className="w-full flex overflow-x-auto justify-start bg-card/60 h-auto p-1">
          {tabs.map(({ v, l, i: I }) => <TabsTrigger key={v} value={v} className="flex-1 gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><I className="w-3.5 h-3.5" />{l}</TabsTrigger>)}
        </TabsList>
        <div className="mt-4">
          <TabsContent value="verified"><VerifiedTab refresh={refresh} /></TabsContent>
          <TabsContent value="tips"><TipTab refresh={refresh} /></TabsContent>
          <TabsContent value="crush"><CrushTab refresh={refresh} /></TabsContent>
          <TabsContent value="adult"><AdultTab /></TabsContent>
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
