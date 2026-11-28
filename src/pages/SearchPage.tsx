import { useState, useEffect } from "react";
import { dropDeadMedia, postMediaUrls } from "@/lib/oldMedia";
import VideoThumb from "@/components/VideoThumb";
import { motion } from "framer-motion";
import { Search, UserPlus, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import GlassTabBar from "@/components/GlassTabBar";
import TopNavBar from "@/components/TopNavBar";
import { readContentPrefs } from "@/components/SettingsExtras";
import { getBlockedIds } from "@/utils/blocks";

const HISTORY_KEY = "primegram-search-history";
const readHistory = (): string[] => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; } };

const SearchPage = () => {
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  const [results, setResults] = useState<any[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    supabase.from("follows").select("following_id").eq("follower_id", user.id).then(({ data }) => {
      if (data) setFollowing(new Set(data.map(f => f.following_id)));
    });
    // Show suggested people right away, before any search.
    supabase.from("profiles").select("*").neq("user_id", user.id).order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setResults(data || []));
  }, [user]);

  const prefs = readContentPrefs();
  const [mode, setMode] = useState<"people" | "posts">(prefs.searchScope === "posts" ? "posts" : "people");
  const [history, setHistory] = useState<string[]>(readHistory);
  const [postResults, setPostResults] = useState<any[]>([]);

  useEffect(() => {
    let qb = supabase.from("posts").select("*").neq("media_type", "story");
    if (readContentPrefs().safeSearch) qb = qb.eq("is_adult", false);
    qb.order("created_at", { ascending: false }).limit(60)
      .then(async ({ data }) => setPostResults(await dropDeadMedia(data || [], postMediaUrls)));
  }, []);

  // Suggestions while typing: people whose username or name starts with (or contains) what was typed.
  type Sug = { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null };
  const [sugs, setSugs] = useState<Sug[]>([]);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const q = query.trim().replace(/[%,()]/g, "").toLowerCase();
    if (!q || !user) { setSugs([]); return; }
    let dead = false;
    const t = window.setTimeout(() => {
      void (async () => {
        const [{ data }, blocked] = await Promise.all([
          supabase.from("profiles").select("user_id, username, display_name, avatar_url").or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).neq("user_id", user.id).limit(20),
          getBlockedIds(),
        ]);
        if (dead) return;
        const rank = (s: Sug) => ((s.username ?? "").toLowerCase().startsWith(q) ? 0 : (s.display_name ?? "").toLowerCase().startsWith(q) ? 1 : 2);
        setSugs(((data ?? []) as Sug[]).filter(s => !blocked.has(s.user_id)).sort((a, b) => rank(a) - rank(b)).slice(0, 6));
      })();
    }, 180);
    return () => { dead = true; window.clearTimeout(t); };
  }, [query, user]);

  const search = async (override?: string) => {
    const q = (override ?? query).trim().replace(/[%,()]/g, "");
    if (!q) return;
    if (override) setQuery(override);
    setFocused(false);
    if (readContentPrefs().saveSearchHistory) {
      const next = [q, ...readHistory().filter(h => h.toLowerCase() !== q.toLowerCase())].slice(0, 8);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      setHistory(next);
    }
    const [{ data }, { data: posts }] = await Promise.all([
      supabase.from("profiles").select("*").or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).limit(20),
      (readContentPrefs().safeSearch
        ? supabase.from("posts").select("*").neq("media_type", "story").eq("is_adult", false)
        : supabase.from("posts").select("*").neq("media_type", "story")
      ).ilike("caption", `%${q}%`).order("created_at", { ascending: false }).limit(60),
    ]);
    setResults(data || []);
    setPostResults(await dropDeadMedia(posts || [], postMediaUrls));
  };

  const toggleFollow = async (targetId: string) => {
    if (!user) return;
    if (following.has(targetId)) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
      setFollowing(prev => { const n = new Set(prev); n.delete(targetId); return n; });
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });
      setFollowing(prev => new Set(prev).add(targetId));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNavBar />
      <main className="pt-16 pb-24 px-4">
        <div className="liquid-glass rounded-2xl flex items-center gap-3 px-4 py-3 mb-4 relative z-10">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setFocused(true); }}
            onFocus={() => setFocused(true)}
            onKeyDown={e => e.key === "Enter" && void search()}
            autoComplete="off" enterKeyHint="search"
            placeholder="Search users..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {focused && query.trim() && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-background/95 shadow-2xl backdrop-blur-xl">
              {sugs.map(s => (
                <button key={s.user_id} onMouseDown={e => e.preventDefault()} onClick={() => { setFocused(false); navigate(`/profile/${s.user_id}`); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-sm font-semibold text-primary">
                    {s.avatar_url ? <img src={s.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : (s.display_name || s.username || "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{s.display_name || s.username}</span>{s.username && <span className="block truncate text-xs text-muted-foreground">@{s.username}</span>}</span>
                </button>
              ))}
              <button onMouseDown={e => e.preventDefault()} onClick={() => void search()} className="flex w-full items-center gap-3 border-t border-white/10 px-4 py-2.5 text-left text-sm text-primary hover:bg-white/5">
                <Search className="h-4 w-4" /> Search for "{query.trim()}"
              </button>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {history.map(h => <button key={h} onClick={() => void search(h)} className="rounded-full liquid-glass-subtle px-3 py-1 text-xs text-foreground">{h}</button>)}
            <button onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); }} className="px-2 text-xs text-muted-foreground">Clear</button>
          </div>
        )}
        <div className="flex gap-2 mb-4">
          {(["people", "posts"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize ${mode === m ? "bg-primary text-primary-foreground" : "liquid-glass-subtle text-foreground"}`}>{m}</button>
          ))}
        </div>

        {mode === "posts" && (
          postResults.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-16">No posts found</p>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {postResults.map(p => (
                <div key={p.id} className="aspect-square relative bg-muted overflow-hidden" title={p.caption || ""}>
                  {p.media_url ? (p.media_type === "video" ? <VideoThumb src={p.media_url} poster={p.thumbnail_url} /> : <img src={p.media_url} alt={p.caption || ""} className="w-full h-full object-cover" loading="lazy" />)
                    : <div className="w-full h-full p-2 text-xs text-foreground flex items-center">{p.caption}</div>}
                </div>
              ))}
            </div>
          )
        )}

        {mode === "people" && results.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">Search for people to follow</p>
          </div>
        )}

        <div className="space-y-2">
          {mode === "people" && results.filter(r => r.user_id !== user?.id).map((profile, i) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="liquid-glass rounded-2xl p-4 flex items-center gap-3 relative z-10"
            >
              <button onClick={() => navigate(`/profile/${profile.user_id}`)} aria-label={`Open ${profile.username || "user"}'s profile`} className="w-11 h-11 shrink-0 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden text-primary font-semibold">
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (profile.display_name || "U")[0].toUpperCase()}
              </button>
              <button onClick={() => navigate(`/profile/${profile.user_id}`)} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-foreground truncate">{profile.display_name || "User"}</p>
                <p className="text-caption text-muted-foreground">@{profile.username || "user"}</p>
              </button>
              <button
                onClick={() => toggleFollow(profile.user_id)}
                className={`depth-press px-4 py-2 rounded-xl text-xs font-semibold ${following.has(profile.user_id) ? "liquid-glass-subtle text-foreground" : "bg-primary text-primary-foreground"}`}
              >
                {following.has(profile.user_id) ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              </button>
            </motion.div>
          ))}
        </div>
      </main>
      <GlassTabBar />
    </div>
  );
};

export default SearchPage;
