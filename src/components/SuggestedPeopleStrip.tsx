import { useEffect, useState } from "react";
import { BadgeCheck, UserPlus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { rpc, table } from "@/features/shared/ui";

type Person = { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null; is_verified: boolean; is_official: boolean; followers: number };
const FEW_FOLLOWS = 5;
const DISMISS_KEY = "primegram:peopleStripDismissedAt";

/** "People to follow" on Home for accounts that follow only a few people, so the feed fills up. */
const SuggestedPeopleStrip = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [people, setPeople] = useState<Person[]>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    try { const t = Number(localStorage.getItem(DISMISS_KEY) || 0); if (Date.now() - t < 3 * 86400_000) return; } catch { /* storage unavailable */ }
    let dead = false;
    void (async () => {
      try {
        const { count } = await table("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", user.id);
        if ((count ?? 0) >= FEW_FOLLOWS) return;
        const { data } = await rpc<Person[]>("suggested_people", { _limit: 10 });
        if (!dead && data && data.length) setPeople(data);
      } catch { /* optional module */ }
    })();
    return () => { dead = true; };
  }, [user]);

  const follow = async (p: Person) => {
    if (!user || followed.has(p.user_id)) return;
    setFollowed((s) => new Set(s).add(p.user_id));
    const { error } = await table("follows").insert({ follower_id: user.id, following_id: p.user_id });
    if (error) { setFollowed((s) => { const n = new Set(s); n.delete(p.user_id); return n; }); toast.error("Couldn't follow. Try again."); }
  };
  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* storage unavailable */ } setPeople([]); };

  if (!people.length) return null;
  return (
    <section className="mb-4">
      <div className="mx-4 mb-2 flex items-center gap-1.5">
        <UserPlus className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold">People to follow</h2>
        <button onClick={dismiss} aria-label="Hide suggestions" className="ml-auto rounded-full p-1 text-muted-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-none">
        {people.map((p) => (
          <div key={p.user_id} className="liquid-glass flex w-32 shrink-0 flex-col items-center gap-1.5 rounded-2xl p-3 text-center">
            <button onClick={() => navigate(`/profile/${p.user_id}`)} aria-label={`Open ${p.username ?? "profile"}`} className="h-14 w-14 overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white">
              {p.avatar_url ? <img src={p.avatar_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : (p.display_name || p.username || "?").charAt(0).toUpperCase()}
            </button>
            <p className="flex w-full items-center justify-center gap-0.5 truncate text-xs font-bold text-foreground"><span className="truncate">{p.display_name || p.username}</span>{(p.is_verified || p.is_official) && <BadgeCheck className="h-3 w-3 shrink-0 text-sky-400" />}</p>
            <p className="text-[10px] text-muted-foreground">{p.followers} follower{p.followers === 1 ? "" : "s"}</p>
            <button onClick={() => void follow(p)} disabled={followed.has(p.user_id)} className={`w-full rounded-full py-1 text-xs font-bold ${followed.has(p.user_id) ? "bg-white/15 text-foreground" : "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"}`}>{followed.has(p.user_id) ? "Following" : "Follow"}</button>
          </div>
        ))}
      </div>
    </section>
  );
};
export default SuggestedPeopleStrip;
