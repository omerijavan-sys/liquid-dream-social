import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, CameraOff, Flag, Mic, MicOff, Send, ShieldAlert, SkipForward, Square, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useRandomVideoChat, type ReportReason } from "@/hooks/useRandomVideoChat";

const TAGS = ["Music", "Gaming", "Late Night Talk", "Tech", "Comedy", "Movies", "Sports", "Travel", "Fitness", "Art"];
const COUNTRIES: [string, string][] = [["KE", "Kenya"], ["UG", "Uganda"], ["TZ", "Tanzania"], ["NG", "Nigeria"], ["GH", "Ghana"], ["ZA", "South Africa"], ["ET", "Ethiopia"], ["EG", "Egypt"], ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["IN", "India"], ["AE", "UAE"], ["DE", "Germany"], ["FR", "France"], ["BR", "Brazil"], ["PH", "Philippines"], ["OT", "Other"]];
const flag = (cc: string) => (cc.length === 2 && cc !== "OT" ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : "🌍");
const countryName = (cc: string) => COUNTRIES.find(c => c[0] === cc)?.[1] ?? "Somewhere";
const ICEBREAKERS = ["Hey! Where are you from? 👋", "What's your favourite song right now? 🎵", "Rate your day 1–10?", "Tell me something fun about you", "Two truths and a lie?"];
const REASONS: [ReportReason, string][] = [["underage", "Looks underage"], ["harassment", "Harassment"], ["explicit_content", "Explicit content"], ["spam", "Spam / scam"]];
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const glass = "border border-white/15 bg-white/[0.06] backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_12px_40px_rgba(0,0,0,.5)]";

const AdultVideoChatPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [is18, setIs18] = useState(false);
  const [rules, setRules] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [country, setCountry] = useState(() => { const r = (navigator.language.split("-")[1] ?? "KE").toUpperCase(); return COUNTRIES.some(c => c[0] === r) ? r : "OT"; });
  const [autoNext, setAutoNext] = useState(true);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [reporting, setReporting] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!user) return;
    void supabase.from("user_blocks" as never).select("blocked_id").eq("blocker_id", user.id).then(({ data }) => setBlocked(new Set(((data ?? []) as { blocked_id: string }[]).map(r => r.blocked_id))));
  }, [user]);

  const chat = useRandomVideoChat({ userId: user?.id, tags, country, autoNext, blocked, onBlock: uid => setBlocked(b => new Set(b).add(uid)) });
  const { status, localStream, remoteStream, partner, messages, seconds, online, micOn, camOn, error } = chat;
  const localRef = useRef<HTMLVideoElement>(null); const remoteRef = useRef<HTMLVideoElement>(null); const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (localRef.current) localRef.current.srcObject = localStream; }, [localStream]);
  useEffect(() => { if (remoteRef.current) { remoteRef.current.srcObject = remoteStream; void remoteRef.current.play().catch(() => undefined); } }, [remoteStream]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  // Esc twice = Next
  const lastEsc = useRef(0);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || status === "idle") return;
      const now = Date.now(); if (now - lastEsc.current < 700) { lastEsc.current = 0; chat.next(); } else lastEsc.current = now;
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [status, chat]);

  const active = status !== "idle";
  const label = status === "searching" ? "Searching…" : status === "connecting" ? "Connecting…" : status === "live" ? `Live • ${clock(seconds)}` : status === "partner_left" ? "Partner disconnected — finding someone new…" : "Ready";
  const dot = status === "live" ? "bg-emerald-400" : status === "idle" ? "bg-white/40" : "bg-amber-400 animate-pulse";

  const doReport = async (r: ReportReason) => {
    setReporting(false);
    const ok = await chat.report(r);
    toast[ok ? "success" : "error"](ok ? "Reported and blocked — you won't be matched again. Finding someone new…" : "Disconnected, but the report couldn't be saved. Please try again later.");
  };
  const submit = () => { if (text.trim()) { chat.sendChat(text); setText(""); } };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#07070a] text-white" style={{ backgroundImage: "radial-gradient(ellipse at 15% 0%, rgba(190,18,60,.28), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(244,63,94,.14), transparent 55%)" }}>
      <header className="flex items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={() => { chat.stop(); navigate(-1); }} aria-label="Leave" className={`flex h-10 w-10 items-center justify-center rounded-full ${glass}`}><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1"><p className="truncate text-base font-bold">Random Video Chat</p>
          <p className="flex items-center gap-1.5 text-xs text-white/70"><span className={`h-2 w-2 rounded-full ${dot}`} />{label}</p></div>
        {active && <span className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ${glass}`}><Users className="h-3.5 w-3.5" />{online} searching</span>}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-2 lg:flex-row">
        <div className="grid min-h-0 flex-1 grid-rows-2 gap-3 lg:grid-cols-2 lg:grid-rows-1">
          {/* partner */}
          <div className={`relative overflow-hidden rounded-3xl ${glass}`}>
            <video ref={remoteRef} autoPlay playsInline className="h-full w-full object-cover" />
            {status !== "live" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 text-center">
                {active && status !== "partner_left" && <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-rose-500" />}
                <p className="px-6 text-sm font-semibold text-white/85">{!active ? "Press Start to meet someone new" : status === "partner_left" ? "Partner disconnected — finding someone new…" : status === "connecting" ? "Connecting…" : "Looking for someone to chat with…"}</p>
              </div>
            )}
            {partner && status !== "searching" && (
              <div className="absolute left-3 top-3 flex max-w-[75%] flex-wrap gap-1.5">
                <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold backdrop-blur">{flag(partner.country)} {countryName(partner.country)} · Stranger</span>
                {partner.shared.map(t => <span key={t} className="rounded-full bg-rose-600/80 px-2.5 py-1 text-[11px] font-semibold">#{t}</span>)}
              </div>
            )}
            {partner && (status === "live" || status === "connecting") && (
              <button onClick={() => setReporting(true)} className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600/85 px-3 py-1.5 text-xs font-bold backdrop-blur"><Flag className="h-3.5 w-3.5" />Report &amp; Block</button>
            )}
            {status === "live" && <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold backdrop-blur">Live • {clock(seconds)}</span>}
          </div>
          {/* me */}
          <div className={`relative overflow-hidden rounded-3xl ${glass}`}>
            <video ref={localRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            {!localStream && <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm text-white/70">Your camera appears here</div>}
            {localStream && !camOn && <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-white/70">Camera off</div>}
            <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold backdrop-blur">You · {flag(country)}</span>
          </div>
        </div>

        {/* text chat */}
        <aside className={`flex h-44 shrink-0 flex-col rounded-3xl p-3 lg:h-auto lg:w-80 ${glass}`}>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {messages.length === 0 && <p className="text-xs text-white/50">{status === "live" ? "Say hi! Try an icebreaker below." : "Chat appears here once you're connected."}</p>}
            {messages.map(m => <p key={m.id} className={`w-fit max-w-[88%] rounded-2xl px-3 py-1.5 text-sm ${m.me ? "ml-auto bg-rose-600/80" : "bg-white/12"}`}>{m.text}</p>)}
            <div ref={endRef} />
          </div>
          {status === "live" && <div className="my-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">{ICEBREAKERS.map(i => <button key={i} onClick={() => chat.sendChat(i)} className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px]">{i}</button>)}</div>}
          <div className="flex items-center gap-2">
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} disabled={status !== "live"} maxLength={400} placeholder={status === "live" ? "Type a message…" : "Waiting for a partner…"} className="min-w-0 flex-1 rounded-full bg-black/40 px-4 py-2 text-sm outline-none placeholder:text-white/40 disabled:opacity-50" />
            <button onClick={submit} disabled={status !== "live"} aria-label="Send" className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 disabled:opacity-40"><Send className="h-4 w-4" /></button>
          </div>
        </aside>
      </div>

      {/* controls */}
      <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {!active && (
          <div className={`mb-3 space-y-2.5 rounded-3xl p-3 ${glass}`}>
            <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-white/70">Interests (matched first)</p>
              <select value={country} onChange={e => setCountry(e.target.value)} aria-label="Your country" className="rounded-full bg-black/40 px-3 py-1 text-xs">{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{flag(c)} {n}</option>)}</select></div>
            <div className="flex flex-wrap gap-1.5">{TAGS.map(t => { const on = tags.includes(t); return <button key={t} onClick={() => setTags(x => on ? x.filter(y => y !== t) : x.length < 5 ? [...x, t] : x)} className={`rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-rose-600" : "bg-white/10"}`}>{t}</button>; })}</div>
          </div>
        )}
        {error && <p className="mb-2 rounded-2xl bg-red-500/20 p-3 text-xs leading-5 text-red-100">{error}</p>}
        <div className={`flex items-center justify-center gap-2.5 rounded-full p-2 ${glass}`}>
          <button onClick={chat.toggleMic} disabled={!active} aria-label="Toggle microphone" className={`flex h-12 w-12 items-center justify-center rounded-full disabled:opacity-40 ${micOn ? "bg-white/12" : "bg-red-500/60"}`}>{micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
          <button onClick={chat.toggleCam} disabled={!active} aria-label="Toggle camera" className={`flex h-12 w-12 items-center justify-center rounded-full disabled:opacity-40 ${camOn ? "bg-white/12" : "bg-red-500/60"}`}>{camOn ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}</button>
          <button onClick={() => { if (active) chat.next(); else if (accepted) void chat.start(); else setAccepted(false); }} className="flex h-12 min-w-[9rem] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-600 via-red-500 to-amber-400 px-6 text-sm font-extrabold text-black shadow-[0_8px_30px_rgba(244,63,94,.5)] active:scale-95">
            {active ? <><SkipForward className="h-5 w-5" />Next</> : "Start"}
          </button>
          <button onClick={chat.stop} disabled={!active} aria-label="Stop" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/12 disabled:opacity-40"><Square className="h-5 w-5" fill="currentColor" /></button>
        </div>
        <label className="mt-2 flex items-center justify-center gap-2 text-[11px] text-white/60"><input type="checkbox" checked={autoNext} onChange={e => setAutoNext(e.target.checked)} className="h-4 w-4 accent-rose-500" />Auto-find someone new when a partner leaves · press Esc twice for Next</label>
      </div>

      {/* Safety gate — shown before any camera access */}
      {!accepted && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-md space-y-4 rounded-3xl p-6 ${glass}`}>
            <div className="flex items-center gap-3"><ShieldAlert className="h-7 w-7 text-rose-400" /><div><p className="text-lg font-bold">Before you start</p><p className="text-xs text-white/60">Safety rules for random video chat</p></div></div>
            <ul className="space-y-1.5 text-xs leading-5 text-white/75">
              <li>• This is a <b>SFW</b> random chat: no nudity or sexual acts on camera.</li>
              <li>• No harassment, hate, threats, scams or pressuring anyone.</li>
              <li>• Never record, screenshot or share someone without their consent.</li>
              <li>• No one below the age of majority. Anyone who looks underage is reported and removed.</li>
              <li>• You can report &amp; block anyone instantly. Reports are reviewed by our team.</li>
            </ul>
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={is18} onChange={e => setIs18(e.target.checked)} className="mt-0.5 h-5 w-5 accent-rose-500" />I confirm I am of legal age (age of majority).</label>
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={rules} onChange={e => setRules(e.target.checked)} className="mt-0.5 h-5 w-5 accent-rose-500" />I agree to the <a href="/terms" target="_blank" rel="noreferrer" className="underline">Community Guidelines</a>.</label>
            <button disabled={!is18 || !rules} onClick={() => { setAccepted(true); void chat.start(); }} className="w-full rounded-full bg-gradient-to-r from-rose-600 via-red-500 to-amber-400 py-3 text-sm font-extrabold text-black disabled:opacity-40">Accept &amp; Start</button>
            <button onClick={() => navigate(-1)} className="w-full text-xs text-white/50">Not now</button>
          </div>
        </div>
      )}

      {reporting && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setReporting(false)}>
          <div onClick={e => e.stopPropagation()} className={`w-full max-w-sm space-y-2 rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl ${glass}`}>
            <p className="text-base font-bold">Report &amp; block this person</p>
            <p className="pb-1 text-xs text-white/60">You'll be disconnected right away and never matched with them again.</p>
            {REASONS.map(([r, l]) => <button key={r} onClick={() => void doReport(r)} className="w-full rounded-2xl bg-white/10 py-3 text-sm font-semibold active:bg-red-600/60">{l}</button>)}
            <button onClick={() => setReporting(false)} className="w-full py-2 text-xs text-white/50">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdultVideoChatPage;
