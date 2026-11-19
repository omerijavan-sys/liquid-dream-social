import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Music2, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SpotifyEmbed from "./SpotifyEmbed";
import { openLink } from "@/utils/openLink";

/** Kept for older callers that import the default chart list; real music now comes from Spotify. */
export const tracks: Array<{ title: string; artist: string; youtubeId: string }> = [];

type Kind = "track" | "playlist" | "album";
interface Item { id: string; title: string; artist: string; artwork: string | null; kind: Kind }

const GENRES = ["Afrobeats", "Amapiano", "Gengetone", "Bongo Flava", "Hip Hop", "R&B", "Gospel", "Pop", "Reggae", "Rock", "Lo-fi", "Workout"];
const TABS: Array<{ id: Kind; label: string }> = [
  { id: "track", label: "Songs" },
  { id: "playlist", label: "Playlists" },
  { id: "album", label: "Albums" },
];

const glass = "border border-white/15 bg-white/[0.07] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.18)]";

const PrimeMusicHub = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [kind, setKind] = useState<Kind>("track");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string>("Afrobeats");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Item | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const term = query.trim().length >= 2 ? query.trim() : genre;
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true); setError(null);
      const { data, error: err } = await supabase.functions.invoke("spotify-search", { body: { q: term, type: kind, limit: 24 } });
      if (id !== reqId.current) return;
      setLoading(false);
      if (err || data?.error || !Array.isArray(data?.items)) {
        setItems([]);
        setError(data?.error === "Spotify is not configured" ? "Spotify isn't connected yet." : "Couldn't reach Spotify. Check your connection and try again.");
        return;
      }
      setItems((data.items as Item[]).map(i => ({ ...i, kind })));
    }, query ? 400 : 0);
    return () => clearTimeout(t);
  }, [open, query, genre, kind]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#07060d] text-white"
        >
          {/* liquid glass backdrop */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/30 blur-3xl" />
            <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-violet-600/30 blur-3xl" />
            <div className="absolute -bottom-24 left-1/4 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
          </div>

          <div className="relative z-10 flex items-center gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
            <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${glass}`}><Music2 className="h-5 w-5 text-emerald-300" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold leading-tight">Prime Music</h2>
              <p className="text-[11px] text-white/60">Powered by Spotify</p>
            </div>
            <button onClick={onClose} aria-label="Close music" className={`flex h-10 w-10 items-center justify-center rounded-full ${glass}`}><X className="h-5 w-5" /></button>
          </div>

          <div className="relative z-10 space-y-3 px-4">
            <div className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 ${glass}`}>
              <Search className="h-4 w-4 text-white/60" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search songs, artists, playlists…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/40" />
              {query && <button onClick={() => setQuery("")} aria-label="Clear"><X className="h-4 w-4 text-white/60" /></button>}
            </div>
            <div className="flex gap-2">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setKind(t.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${kind === t.id ? "bg-emerald-400 text-black" : glass}`}>{t.label}</button>
              ))}
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {GENRES.map(g => (
                <button key={g} onClick={() => { setGenre(g); setQuery(""); }}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition ${!query && genre === g ? "bg-white text-black font-semibold" : glass}`}>{g}</button>
              ))}
            </div>
          </div>

          <div className={`relative z-10 mt-3 flex-1 overflow-y-auto px-4 ${now ? "pb-[26rem]" : "pb-8"}`}>
            {loading && <div className="flex items-center justify-center gap-2 py-10 text-sm text-white/60"><Loader2 className="h-4 w-4 animate-spin" />Loading from Spotify…</div>}
            {!loading && error && <div className={`rounded-2xl p-4 text-center text-sm text-white/80 ${glass}`}>{error}</div>}
            {!loading && !error && items.length === 0 && <div className={`rounded-2xl p-4 text-center text-sm text-white/60 ${glass}`}>Nothing found. Try another search.</div>}
            {!loading && !error && (
              <div className={kind === "track" ? "space-y-2" : "grid grid-cols-2 gap-3"}>
                {items.map(it => kind === "track" ? (
                  <button key={it.id} onClick={() => setNow(it)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition active:scale-[0.99] ${glass} ${now?.id === it.id ? "ring-1 ring-emerald-400/70" : ""}`}>
                    {it.artwork ? <img src={it.artwork} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <span className="h-12 w-12 shrink-0 rounded-xl bg-white/10" />}
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{it.title}</span><span className="block truncate text-xs text-white/60">{it.artist}</span></span>
                  </button>
                ) : (
                  <button key={it.id} onClick={() => setNow(it)} className={`overflow-hidden rounded-2xl text-left transition active:scale-[0.98] ${glass} ${now?.id === it.id ? "ring-1 ring-emerald-400/70" : ""}`}>
                    {it.artwork ? <img src={it.artwork} alt="" loading="lazy" className="aspect-square w-full object-cover" /> : <div className="aspect-square w-full bg-white/10" />}
                    <div className="p-2.5"><p className="truncate text-sm font-semibold">{it.title}</p><p className="truncate text-[11px] text-white/60">{it.artist}</p></div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <AnimatePresence>
            {now && (
              <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
                className={`absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 rounded-3xl p-3 ${glass}`}>
                <div className="mb-2 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs text-white/70">Now playing · <span className="font-semibold text-white">{now.title}</span></p>
                  <button onClick={() => openLink(`https://open.spotify.com/${now.kind}/${now.id}`)} aria-label="Open in Spotify" className="rounded-full p-1.5 hover:bg-white/10"><ExternalLink className="h-4 w-4" /></button>
                  <button onClick={() => setNow(null)} aria-label="Close player" className="rounded-full p-1.5 hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
                <SpotifyEmbed key={`${now.kind}-${now.id}`} trackId={now.id} kind={now.kind} />
                <p className="mt-1 text-center text-[10px] text-white/50">Tap play in the Spotify player. Sign in to Spotify there for full songs; otherwise you hear a preview.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PrimeMusicHub;
