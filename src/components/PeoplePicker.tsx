import { useEffect, useState } from "react";
import { Check, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Person { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null }

/** Search people (or pick from who you follow) and select several. */
const PeoplePicker = ({ selected, onToggle, exclude = [] }: { selected: Set<string>; onToggle: (p: Person) => void; exclude?: string[] }) => {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    if (!user) return;
    let dead = false;
    const t = setTimeout(async () => {
      const term = q.trim().replace(/[%,]/g, " ");
      let list: Person[] = [];
      if (term.length >= 2) {
        const { data } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).neq("user_id", user.id).limit(20);
        list = (data ?? []) as Person[];
      } else {
        const { data: f } = await supabase.from("follows").select("following_id").eq("follower_id", user.id).limit(40);
        const ids = (f ?? []).map((x) => x.following_id);
        if (ids.length) { const { data } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", ids); list = (data ?? []) as Person[]; }
      }
      if (!dead) setPeople(list.filter((p) => !exclude.includes(p.user_id)));
    }, 250);
    return () => { dead = true; clearTimeout(t); };
  }, [q, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3"><Search className="h-4 w-4 text-white/50" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-white/40" /></div>
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {people.length === 0 && <p className="py-4 text-center text-xs text-white/50">{q.trim().length >= 2 ? "No one found" : "Follow people or search by name"}</p>}
        {people.map((p) => (
          <button key={p.user_id} onClick={() => onToggle(p)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/10">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm font-semibold">{p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : (p.display_name || p.username || "U")[0].toUpperCase()}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm">{p.display_name || p.username}</span><span className="block truncate text-xs text-white/50">@{p.username}</span></span>
            {selected.has(p.user_id) && <Check className="h-4 w-4 text-emerald-400" />}
          </button>
        ))}
      </div>
    </div>
  );
};
export default PeoplePicker;
