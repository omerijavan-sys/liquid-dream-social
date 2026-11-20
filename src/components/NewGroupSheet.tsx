import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PeoplePicker, { type Person } from "@/components/PeoplePicker";
import { THEMES } from "@/utils/chatThemes";

const NewGroupSheet = ({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) => {
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("gold");
  const [picked, setPicked] = useState<Map<string, Person>>(new Map());
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return toast.error("Give the group a name");
    setBusy(true);
    const { data, error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)("create_group", { _name: name.trim(), _members: [...picked.keys()], _theme: theme });
    setBusy(false);
    if (error) return toast.error(error.message);
    onCreated(data as string);
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90%] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl border border-white/15 bg-black/85 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white backdrop-blur-2xl">
        <div className="flex items-center justify-between"><p className="text-lg font-bold">New group</p><button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button></div>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Group name" className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-white/40" />
        <div><p className="mb-1 text-xs text-white/60">Theme</p>
          <div className="flex gap-2 overflow-x-auto pb-1">{THEMES.map((t) => <button key={t.id} onClick={() => setTheme(t.id)} aria-label={t.name} className={`h-10 w-10 shrink-0 rounded-full border-2 ${theme === t.id ? "border-white" : "border-transparent"}`} style={{ background: t.mine }} />)}</div></div>
        <div><p className="mb-1 text-xs text-white/60">Add people ({picked.size})</p>
          <PeoplePicker selected={new Set(picked.keys())} onToggle={(p) => setPicked((prev) => { const n = new Map(prev); if (n.has(p.user_id)) n.delete(p.user_id); else n.set(p.user_id, p); return n; })} /></div>
        <button onClick={() => void create()} disabled={busy} className="w-full rounded-2xl bg-emerald-400 py-3 text-sm font-bold text-black disabled:opacity-50">{busy ? "Creating…" : "Create group"}</button>
      </div>
    </div>
  );
};
export default NewGroupSheet;
