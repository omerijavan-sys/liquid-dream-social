import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BadgeDollarSign, Send, Shuffle, UserRound, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const panel = "rounded-3xl border border-rose-400/25 bg-black/60 p-4 backdrop-blur-2xl";
const field = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-foreground outline-none";

type Alias = { user_id: string; alias: string; bio: string | null };

/** The private 18+ username. It is the only name other 18+ members see. */
export function useMyAlias() {
  const { user } = useAuth();
  const [alias, setAlias] = useState<Alias | null | undefined>(undefined);
  const reload = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("adult_profiles" as any).select("user_id, alias, bio").eq("user_id", user.id).maybeSingle();
    setAlias((data as any) ?? null);
  }, [user]);
  useEffect(() => { void reload(); }, [reload]);
  return { alias, reload };
}

export const AdultMeetTab = () => {
  const navigate = useNavigate();
  return (
    <div className={`${panel} space-y-4 text-center`}>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-500/15"><Shuffle className="h-8 w-8 text-rose-300" /></div>
      <div><p className="text-lg font-bold text-foreground">18+ Meet</p><p className="mt-1 text-sm text-muted-foreground">Random video or voice chat with other age-verified adults. Tap Next any time to skip.</p></div>
      <Button className="w-full gap-2 bg-rose-600 text-white hover:bg-rose-500" onClick={() => navigate("/meet?mode=adult")}><Video className="h-4 w-4" />Start video chat</Button>
      <Button variant="secondary" className="w-full" onClick={() => navigate("/meet?mode=adult&audio=1")}>Voice only</Button>
    </div>
  );
};

export const AliasSetup = ({ onDone }: { onDone: () => void }) => {
  const [alias, setAlias] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const save = async () => {
    const a = alias.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(a)) { toast.error("Use 3–24 letters, numbers or underscores"); return; }
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("adult_profiles" as any).insert({ user_id: user.id, alias: a, bio: bio.trim() || null } as any);
    setBusy(false);
    if (error) { toast.error(error.code === "23505" ? "That private username is taken" : error.message); return; }
    toast.success("Private username created"); onDone();
  };
  return (
    <div className={`${panel} space-y-3`}>
      <p className="font-semibold text-foreground">Pick your private username</p>
      <p className="text-xs text-muted-foreground">This name is separate from your main profile. Other 18+ members only see it — never your main username.</p>
      <input value={alias} onChange={e => setAlias(e.target.value)} placeholder="private_username" maxLength={24} className={field} />
      <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Short bio (optional)" maxLength={300} className={`${field} h-20 resize-none`} />
      <Button disabled={busy} onClick={() => void save()} className="w-full bg-rose-600 text-white hover:bg-rose-500">Create</Button>
    </div>
  );
};

type Thread = { peer: string; alias: string; last: string; at: string; unread: number };

export const AdultMessagesTab = ({ openWith, onClearOpen }: { openWith?: string | null; onClearOpen?: () => void }) => {
  const { user } = useAuth();
  const { alias, reload } = useMyAlias();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<{ id: string; alias: string } | null>(null);
  const [msgs, setMsgs] = useState<{ id: string; sender_id: string; content: string; created_at: string }[]>([]);
  const [text, setText] = useState("");
  const [find, setFind] = useState("");
  const [results, setResults] = useState<Alias[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("adult_messages" as any).select("sender_id, receiver_id, content, created_at, read_at").or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order("created_at", { ascending: false }).limit(200);
    const rows = (data ?? []) as any[];
    const map = new Map<string, Thread>();
    for (const r of rows) {
      const peer = r.sender_id === user.id ? r.receiver_id : r.sender_id;
      const t = map.get(peer) ?? { peer, alias: "", last: r.content, at: r.created_at, unread: 0 };
      if (r.receiver_id === user.id && !r.read_at) t.unread++;
      map.set(peer, t);
    }
    const ids = [...map.keys()];
    const { data: al } = ids.length ? await supabase.from("adult_profiles" as any).select("user_id, alias").in("user_id", ids) : { data: [] as any[] };
    const am = new Map(((al ?? []) as any[]).map(a => [a.user_id, a.alias]));
    setThreads([...map.values()].map(t => ({ ...t, alias: am.get(t.peer) ?? "member" })));
  }, [user]);
  useEffect(() => { void loadThreads(); }, [loadThreads]);

  const openChat = useCallback(async (id: string, name?: string) => {
    let a = name;
    if (!a) { const { data } = await supabase.from("adult_profiles" as any).select("alias").eq("user_id", id).maybeSingle(); a = (data as any)?.alias ?? "member"; }
    setActive({ id, alias: a! });
  }, []);
  useEffect(() => { if (openWith) { void openChat(openWith); onClearOpen?.(); } }, [openWith, openChat, onClearOpen]);

  useEffect(() => {
    if (!active || !user) return;
    const load = async () => {
      const { data } = await supabase.from("adult_messages" as any).select("id, sender_id, content, created_at")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${active.id}),and(sender_id.eq.${active.id},receiver_id.eq.${user.id})`).order("created_at", { ascending: true }).limit(200);
      setMsgs((data ?? []) as any);
      void supabase.from("adult_messages" as any).update({ read_at: new Date().toISOString() } as any).eq("sender_id", active.id).eq("receiver_id", user.id).is("read_at", null);
    };
    void load();
    const ch = supabase.channel(`adult-chat-${active.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "adult_messages" }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [active, user]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    if (!active || !user || !text.trim()) return;
    const content = text.trim(); setText("");
    const { error } = await supabase.from("adult_messages" as any).insert({ sender_id: user.id, receiver_id: active.id, content } as any);
    if (error) { toast.error("Couldn't send — both people must be age-verified"); setText(content); }
  };

  useEffect(() => {
    const q = find.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("adult_profiles" as any).select("user_id, alias, bio").ilike("alias", `%${q}%`).neq("user_id", user?.id ?? "").limit(10);
      setResults((data ?? []) as any);
    }, 250);
    return () => clearTimeout(t);
  }, [find, user?.id]);

  if (alias === undefined) return <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>;
  if (alias === null) return <AliasSetup onDone={() => void reload()} />;

  if (active) return (
    <div className={`${panel} flex h-[60dvh] flex-col p-0`}>
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3"><button onClick={() => { setActive(null); void loadThreads(); }} aria-label="Back"><ArrowLeft className="h-5 w-5" /></button><UserRound className="h-5 w-5 text-rose-300" /><p className="font-semibold">@{active.alias}</p></div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {msgs.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Say hi 👋</p>}
        {msgs.map(m => <p key={m.id} className={`w-fit max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.sender_id === user?.id ? "ml-auto bg-rose-600 text-white" : "bg-white/10 text-foreground"}`}>{m.content}</p>)}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 border-t border-white/10 p-3">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && void send()} placeholder="Message…" maxLength={2000} className={field} />
        <Button size="icon" onClick={() => void send()} aria-label="Send" className="bg-rose-600 text-white hover:bg-rose-500"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <input value={find} onChange={e => setFind(e.target.value)} placeholder="Find a private username…" className={field} />
      {results.map(r => <button key={r.user_id} onClick={() => void openChat(r.user_id, r.alias)} className={`${panel} flex w-full items-center gap-3 p-3 text-left`}><UserRound className="h-5 w-5 text-rose-300" /><span className="flex-1"><span className="block text-sm font-semibold">@{r.alias}</span>{r.bio && <span className="block truncate text-xs text-muted-foreground">{r.bio}</span>}</span></button>)}
      {threads.length === 0 && !results.length ? <p className="py-8 text-center text-sm text-muted-foreground">No private messages yet. Search a private username or tap the message icon on a creator's post.</p>
        : threads.map(t => <button key={t.peer} onClick={() => void openChat(t.peer, t.alias)} className={`${panel} flex w-full items-center gap-3 p-3 text-left`}><UserRound className="h-5 w-5 text-rose-300" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">@{t.alias}</span><span className="block truncate text-xs text-muted-foreground">{t.last}</span></span>{t.unread > 0 && <span className="rounded-full bg-rose-600 px-2 text-xs text-white">{t.unread}</span>}</button>)}
    </div>
  );
};

type MySub = { creator_id: string; amount: number; expires_at: string; alias?: string };

export const AdultMeTab = () => {
  const { user } = useAuth();
  const { alias, reload } = useMyAlias();
  const [price, setPrice] = useState("");
  const [current, setCurrent] = useState<number | null>(null);
  const [subs, setSubs] = useState<MySub[]>([]);
  const [fans, setFans] = useState(0);
  const [bio, setBio] = useState("");
  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: cp }, { data: ms }, { count }] = await Promise.all([
      supabase.from("creator_profiles").select("monthly_price").eq("user_id", user.id).maybeSingle(),
      supabase.from("creator_subscriptions").select("creator_id, amount, expires_at").eq("subscriber_id", user.id).eq("status", "active").gt("expires_at", new Date().toISOString()),
      supabase.from("creator_subscriptions").select("id", { count: "exact", head: true }).eq("creator_id", user.id).eq("status", "active").gt("expires_at", new Date().toISOString()),
    ]);
    setCurrent(cp?.monthly_price ?? null); setPrice(cp?.monthly_price ? String(cp.monthly_price) : ""); setFans(count ?? 0);
    const ids = (ms ?? []).map(m => m.creator_id);
    const { data: al } = ids.length ? await supabase.from("adult_profiles" as any).select("user_id, alias").in("user_id", ids) : { data: [] as any[] };
    const am = new Map(((al ?? []) as any[]).map(a => [a.user_id, a.alias]));
    setSubs((ms ?? []).map(m => ({ ...m, alias: am.get(m.creator_id) })));
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setBio(alias?.bio ?? ""); }, [alias]);

  if (alias === undefined) return null;
  if (alias === null) return <AliasSetup onDone={() => void reload()} />;
  return (
    <div className="space-y-3">
      <section className={panel}>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Private username</p>
        <p className="text-lg font-bold text-foreground">@{alias.alias}</p>
        <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={300} placeholder="Bio" className={`${field} mt-2 h-16 resize-none`} />
        <Button size="sm" variant="secondary" className="mt-2" onClick={async () => { const { error } = await supabase.from("adult_profiles" as any).update({ bio: bio.trim() || null } as any).eq("user_id", user!.id); if (error) toast.error(error.message); else { toast.success("Saved"); void reload(); } }}>Save bio</Button>
      </section>
      <section className={panel}>
        <p className="flex items-center gap-2 font-semibold text-foreground"><BadgeDollarSign className="h-5 w-5 text-rose-300" />Fan subscription price</p>
        <p className="mt-1 text-xs text-muted-foreground">KES per month, 10 – 50,000. You keep 95% in your wallet. {current ? `${fans} active fan${fans === 1 ? "" : "s"}.` : "Currently off."}</p>
        <div className="mt-2 flex gap-2">
          <input type="number" min={10} max={50000} value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 500" className={field} />
          <Button className="bg-rose-600 text-white hover:bg-rose-500" onClick={async () => { const { error } = await supabase.rpc("creator_set_price" as any, { _price: Math.round(Number(price)) } as any); if (error) toast.error(error.message); else { toast.success("Price saved"); void load(); } }}>Save</Button>
          {current && <Button variant="secondary" onClick={async () => { await supabase.rpc("creator_set_price" as any, { _price: 0 } as any); toast.success("Subscriptions off"); void load(); }}>Off</Button>}
        </div>
      </section>
      <section className={panel}>
        <p className="font-semibold text-foreground">My subscriptions</p>
        {subs.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">You're not subscribed to anyone.</p> : subs.map(s => (
          <div key={s.creator_id} className="mt-2 flex items-center gap-2 text-sm"><span className="flex-1">{s.alias ? `@${s.alias}` : "Creator"} · KES {s.amount.toLocaleString()} · until {new Date(s.expires_at).toLocaleDateString()}</span>
            <Button size="sm" variant="destructive" onClick={async () => { if (!window.confirm("Unsubscribe? No refund for the current month.")) return; const { error } = await supabase.rpc("creator_unsubscribe" as any, { _creator_id: s.creator_id } as any); if (error) toast.error(error.message); else { toast.success("Unsubscribed"); void load(); } }}>Unsubscribe</Button></div>
        ))}
      </section>
    </div>
  );
};
