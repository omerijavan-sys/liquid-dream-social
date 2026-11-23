import { useCallback, useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { glass, glow, rpc, table } from "../shared/ui";
import type { Prompt } from "./useHangout";

interface Answer { id: string; answer: string; created_at: string; mine: boolean }
interface PollRow { choice: number; votes: number; mine: boolean }

/** Anonymous Q&A (answers never carry a user id) or a 2-option poll. `tick` makes it refetch when anyone acts. */
const PromptCard = ({ p, tick, onChanged }: { p: Prompt; tick: number; onChanged: () => void }) => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [poll, setPoll] = useState<PollRow[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (p.kind === "qa") setAnswers((await rpc<Answer[]>("hangout_answers_for", { _prompt: p.id })).data ?? []);
    else setPoll((await rpc<PollRow[]>("hangout_poll_results", { _prompt: p.id })).data ?? []);
  }, [p.id, p.kind]);
  useEffect(() => { void load(); }, [load, tick]);

  const answer = async () => {
    const a = text.trim(); if (!a || !user || busy) return;
    setBusy(true);
    const { error } = await table("hangout_answers").insert({ prompt_id: p.id, user_id: user.id, answer: a.slice(0, 280) });
    setBusy(false);
    if (error) { toast.error("Couldn't send your answer"); return; }
    setText(""); onChanged(); void load();
  };
  const vote = async (choice: 0 | 1) => {
    if (!user || busy) return;
    setBusy(true);
    const { error } = await table("hangout_votes").upsert({ prompt_id: p.id, user_id: user.id, choice }, { onConflict: "prompt_id,user_id" });
    setBusy(false);
    if (error) { toast.error("Couldn't register your vote"); return; }
    onChanged(); void load();
  };

  const total = poll.reduce((s, r) => s + Number(r.votes), 0);
  const mine = poll.find((r) => r.mine)?.choice;
  return (
    <div className={`${glass} space-y-2 rounded-2xl p-3`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">{p.kind === "qa" ? "Anonymous question" : "Quick poll"}</p>
      <p className="text-sm font-semibold">{p.body}</p>
      {p.kind === "poll" && p.options && (
        <div className="space-y-1.5">
          {p.options.map((o, i) => {
            const r = poll.find((x) => x.choice === i); const pct = total ? Math.round((Number(r?.votes ?? 0) / total) * 100) : 0;
            return (
              <button key={i} onClick={() => void vote(i as 0 | 1)} className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm" style={mine === i ? { borderColor: "#a78bfa", boxShadow: glow("#a78bfa", 0.4, 12) } : undefined}>
                <span className="absolute inset-y-0 left-0 bg-violet-500/30 transition-all" style={{ width: `${pct}%` }} />
                <span className="relative flex justify-between"><span>{o}</span><span className="tabular-nums text-white/70">{mine !== undefined || total ? `${pct}%` : ""}</span></span>
              </button>
            );
          })}
          <p className="text-right text-[10px] text-white/45">{total} vote{total === 1 ? "" : "s"}</p>
        </div>
      )}
      {p.kind === "qa" && (
        <>
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {answers.length === 0 && <p className="text-xs text-white/45">No answers yet. Be the first — nobody sees who you are.</p>}
            {answers.map((a) => <p key={a.id} className="rounded-xl bg-white/5 px-3 py-1.5 text-xs">{a.answer}{a.mine && <span className="ml-1 text-[10px] text-violet-300">(you)</span>}</p>)}
          </div>
          <div className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void answer(); }} placeholder="Answer anonymously…" maxLength={280} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs outline-none" />
            <button onClick={() => void answer()} disabled={!text.trim() || busy} aria-label="Send answer" className="rounded-xl bg-violet-500 px-3 disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
          </div>
        </>
      )}
    </div>
  );
};
export default PromptCard;
