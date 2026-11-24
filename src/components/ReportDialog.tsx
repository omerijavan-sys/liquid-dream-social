import { useState } from "react";
import { createPortal } from "react-dom";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const REASONS = ["Spam", "Nudity or sexual content", "Harassment or bullying", "Violence or threats", "Scam or fraud", "Hate speech", "Underage user", "Something else"];

/** Report a post / reel / user with a reason and an optional comment (500 characters). */
const ReportDialog = ({ open, onClose, targetType, targetId }: { open: boolean; onClose: () => void; targetType: "post" | "reel" | "user" | "comment"; targetId: string | undefined }) => {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const close = () => { setReason(""); setDetails(""); onClose(); };
  const submit = async () => {
    if (!user || !targetId) { toast.error("Sign in to report"); return; }
    if (!reason) { toast.error("Pick a reason"); return; }
    setBusy(true);
    const { error } = await supabase.from("reports").insert({ reporter_id: user.id, target_type: targetType, target_id: targetId, reason, details: details.trim() || null } as never);
    setBusy(false);
    if (error) { toast.error("Couldn't send the report"); return; }
    toast.success("Thanks — the Primegram team will review it");
    close();
  };
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={close}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl border border-white/15 bg-[#0b0b16]/95 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white backdrop-blur-2xl sm:rounded-3xl">
        <div className="flex items-center gap-2"><Flag className="h-5 w-5 text-red-400" /><p className="text-lg font-bold">Report {targetType}</p></div>
        <p className="text-xs text-white/60">What's wrong? Your report is private.</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
          {REASONS.map((r) => (
            <button key={r} role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${reason === r ? "border-red-400 bg-red-500/25 text-white" : "border-white/15 bg-white/5 text-white/75"}`}>{r}</button>
          ))}
        </div>
        <div>
          <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 500))} rows={3} placeholder="Add a comment (optional) — what happened?" aria-label="Comment" className="w-full resize-none rounded-2xl bg-white/10 px-4 py-3 text-sm outline-none ring-1 ring-white/15 placeholder:text-white/40" />
          <p className="mt-1 text-right text-[11px] text-white/40">{details.length}/500</p>
        </div>
        <div className="flex gap-2">
          <button onClick={close} className="flex-1 rounded-2xl bg-white/10 py-3 text-sm font-semibold">Cancel</button>
          <button onClick={() => void submit()} disabled={busy || !reason} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-sm font-bold disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Send report</button>
        </div>
      </div>
    </div>, document.body);
};
export default ReportDialog;
