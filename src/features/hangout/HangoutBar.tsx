import { useState } from "react";
import { BarChart3, ChevronDown, Headphones, MessageCircleQuestion, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { glass, glow, table } from "../shared/ui";
import PromptCard from "./PromptCard";
import { EMOJIS, useHangout } from "./useHangout";

type Compose = null | "qa" | "poll" | "listen";

/** Lightweight bar pinned under a group chat's header: anonymous Q&A, polls, Listening Together and live emoji reactions. */
const HangoutBar = ({ groupId, myName }: { groupId: string; myName: string }) => {
  const { user } = useAuth();
  const { prompts, listeners, bursts, tick, react, changed, listen } = useHangout(groupId, myName);
  const [open, setOpen] = useState(false);
  const [compose, setCompose] = useState<Compose>(null);
  const [body, setBody] = useState(""); const [o1, setO1] = useState(""); const [o2, setO2] = useState("");
  const [song, setSong] = useState({ title: "", artist: "" });
  const reset = () => { setCompose(null); setBody(""); setO1(""); setO2(""); setSong({ title: "", artist: "" }); };

  const create = async () => {
    if (!user) return;
    const b = body.trim(); if (!b) return;
    const row: Record<string, unknown> = { group_id: groupId, author_id: user.id, kind: compose, body: b.slice(0, 200) };
    if (compose === "poll") { if (!o1.trim() || !o2.trim()) { toast.error("A poll needs two options"); return; } row.options = [o1.trim().slice(0, 60), o2.trim().slice(0, 60)]; }
    const { error } = await table("hangout_prompts").insert(row);
    if (error) { toast.error("Couldn't post that"); return; }
    reset(); setOpen(true); changed();
  };
  const startListening = async () => {
    if (!song.title.trim()) return;
    await listen({ title: song.title.trim().slice(0, 120), artist: song.artist.trim().slice(0, 120) });
    reset(); toast.success("Listening Together is on 🎧");
  };
  const mine = listeners.find((l) => l.user_id === user?.id)?.track ?? null;
  const others = listeners.filter((l) => l.track && l.user_id !== user?.id);
  const inp = "min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs outline-none";

  return (
    <div className={`${glass} relative z-10 border-x-0 border-t-0 bg-black/40 text-white`}>
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 scrollbar-none">
        <button onClick={() => setCompose(compose === "qa" ? null : "qa")} className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold"><MessageCircleQuestion className="h-3.5 w-3.5 text-violet-300" />Ask</button>
        <button onClick={() => setCompose(compose === "poll" ? null : "poll")} className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold"><BarChart3 className="h-3.5 w-3.5 text-cyan-300" />Poll</button>
        <button onClick={() => (mine ? void listen(null) : setCompose(compose === "listen" ? null : "listen"))} className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold ${mine ? "bg-emerald-400/20 text-emerald-200" : "bg-white/10"}`} style={mine ? { boxShadow: glow("#34d399", 0.4, 10) } : undefined}><Headphones className="h-3.5 w-3.5" />{mine ? "Stop listening" : "Listen"}</button>
        <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />
        {EMOJIS.map((e) => <button key={e} onClick={() => react(e)} aria-label={`React ${e}`} className="shrink-0 rounded-full px-1.5 py-0.5 text-lg active:scale-125">{e}</button>)}
        <button onClick={() => setOpen(!open)} aria-label="Show prompts" className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px]">{prompts.length > 0 && <span className="rounded-full bg-violet-500 px-1.5 text-[10px] font-bold">{prompts.length}</span>}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} /></button>
      </div>

      {(mine || others.length > 0) && (
        <div className="space-y-0.5 px-3 pb-2 text-[11px] text-emerald-200/90">
          {mine && <p>🎧 You're listening to <b>{mine.title}</b>{mine.artist ? ` · ${mine.artist}` : ""}</p>}
          {others.map((l) => (
            <p key={l.user_id} className="flex items-center gap-2">🎧 {l.name} is listening to <b className="truncate">{l.track!.title}</b>
              {!mine && <button onClick={() => void listen(l.track)} className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold">Join</button>}</p>
          ))}
        </div>
      )}

      {compose && (
        <div className="space-y-2 px-3 pb-3">
          <div className="flex items-center justify-between"><p className="text-[11px] font-semibold text-white/60">{compose === "qa" ? "Ask the group anonymously" : compose === "poll" ? "Quick 2-option poll" : "What are you listening to?"}</p><button onClick={reset} aria-label="Cancel"><X className="h-4 w-4 text-white/60" /></button></div>
          {compose === "listen" ? (
            <div className="flex gap-2"><input value={song.title} onChange={(e) => setSong({ ...song, title: e.target.value })} placeholder="Song" className={inp} /><input value={song.artist} onChange={(e) => setSong({ ...song, artist: e.target.value })} placeholder="Artist" className={inp} /><button onClick={() => void startListening()} className="rounded-xl bg-emerald-400 px-3 text-xs font-bold text-black">Go</button></div>
          ) : (
            <>
              <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={compose === "qa" ? "Ask anything…" : "Poll question"} maxLength={200} className={`${inp} w-full`} />
              {compose === "poll" && <div className="flex gap-2"><input value={o1} onChange={(e) => setO1(e.target.value)} placeholder="Option A" maxLength={60} className={inp} /><input value={o2} onChange={(e) => setO2(e.target.value)} placeholder="Option B" maxLength={60} className={inp} /></div>}
              <button onClick={() => void create()} disabled={!body.trim()} className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-2 text-xs font-bold disabled:opacity-40">Post to group</button>
            </>
          )}
        </div>
      )}

      {open && (
        <div className="max-h-[45vh] space-y-2 overflow-y-auto px-3 pb-3">
          {prompts.length === 0 && <p className="py-2 text-center text-xs text-white/45">No live prompts. Ask something or start a poll.</p>}
          {prompts.map((p) => <PromptCard key={p.id} p={p} tick={tick} onChanged={changed} />)}
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] h-64 overflow-hidden" aria-hidden>
        {bursts.map((b) => <span key={b.id} className="absolute bottom-0 text-3xl" style={{ left: `${b.x}%`, animation: "pg-float 2.2s ease-out forwards" }}>{b.emoji}</span>)}
        <style>{`@keyframes pg-float{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-230px) scale(1.3);opacity:0}}@media (prefers-reduced-motion:reduce){@keyframes pg-float{0%,100%{opacity:0}30%{opacity:1}}}`}</style>
      </div>
    </div>
  );
};
export default HangoutBar;
