import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Music2, ExternalLink, Loader2, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { playSong, toggleMusic, seekMusic, stopMusic, useMusic } from "@/services/MusicEngine";
import { isSpotifyConnected, startSpotifyLogin, disconnectSpotify, initSpotifyPlayer, playOnSpotify, spotifyToggle, spotifySeek, spotifyNext, spotifyPrev, type SpState } from "@/services/SpotifyConnect";
import { toast } from "sonner";
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


const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Plays the selected item: full Spotify (Premium, connected) → full free stream (keeps playing in background) → Spotify preview embed. */
const NowPlaying = ({ item, onClose }: { item: Item; onClose: () => void }) => {
  const [engine, setEngine] = useState<"loading" | "spotify" | "audio" | "embed">("loading");
  const [note, setNote] = useState("");
  const [st, setSt] = useState<SpState>({ paused: true, position: 0, duration: 0 });
  const [spotifyStarted, setSpotifyStarted] = useState(false);
  const music = useMusic();

  const fallback = async () => {
    if (item.kind === "track") {
      stopMusic();
      if (await playSong(item.title, item.artist, item.artwork, `sp_${item.id}`)) { setEngine("audio"); return; }
    }
    setEngine("embed");
    setNote(item.kind === "track" ? "No full version found — playing Spotify's preview." : "Connect Spotify (Premium) to play full playlists and albums.");
  };

  useEffect(() => {
    let dead = false;
    setEngine("loading"); setNote(""); setSpotifyStarted(false); setSt({ paused: true, position: 0, duration: 0 });
    (async () => {
      if (isSpotifyConnected()) {
        try {
          await initSpotifyPlayer((s) => { if (!dead) setSt(s); });
          if (!dead) { setEngine("spotify"); setNote("Press play to start the full song on Spotify."); }
          return;
        } catch (e) {
          if (!dead) setNote((e instanceof Error ? e.message : "") === "account_error" ? "Spotify Premium is needed for full songs here — using the free full stream." : "");
        }
      }
      if (!dead) await fallback();
    })();
    return () => { dead = true; };
  }, [item.id, item.kind]);

  const toggle = () => {
    if (engine === "spotify") {
      if (spotifyStarted) { void spotifyToggle(); return; }
      stopMusic();
      void playOnSpotify(item.kind, item.id)
        .then(() => { setSpotifyStarted(true); setSt((state) => ({ ...state, paused: false })); setNote(""); })
        .catch(() => { setNote("Spotify couldn't start (Premium required) — using the free full stream."); void fallback(); });
      return;
    }
    toggleMusic();
  };
  const spot = engine === "spotify";
  const paused = spot ? st.paused : music.paused;
  const seek = (v: number) => { if (spot) spotifySeek(v * 1000); else seekMusic(v); };
  const pos = spot ? st.position / 1000 : music.pos;
  const dur = spot ? st.duration / 1000 : music.dur;

  return (
    <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
      className={`absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 rounded-3xl p-3 ${glass}`}>
      <div className="mb-2 flex items-center gap-3">
        {item.artwork && <img src={item.artwork} alt="" className="h-12 w-12 rounded-xl object-cover" />}
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="truncate text-xs text-white/60">{item.artist}</p></div>
        <button onClick={() => openLink(`https://open.spotify.com/${item.kind}/${item.id}`)} aria-label="Open in Spotify" className="rounded-full p-1.5 hover:bg-white/10"><ExternalLink className="h-4 w-4" /></button>
        <button onClick={onClose} aria-label="Close player" className="rounded-full p-1.5 hover:bg-white/10"><X className="h-4 w-4" /></button>
      </div>
      {engine === "loading" && <div className="flex items-center justify-center gap-2 py-4 text-xs text-white/60"><Loader2 className="h-4 w-4 animate-spin" />Finding the full song…</div>}
      {engine === "embed" && <SpotifyEmbed key={`${item.kind}-${item.id}`} trackId={item.id} kind={item.kind} />}
      {(spot || engine === "audio") && (
        <>
          <input type="range" min={0} max={Math.max(1, dur)} step={1} value={Math.min(pos, dur || 0)} onChange={e => seek(Number(e.target.value))} className="w-full accent-emerald-400" aria-label="Seek" />
          <div className="flex items-center justify-between text-[10px] text-white/50"><span>{fmt(pos)}</span><span>{fmt(dur)}</span></div>
          <div className="mt-1 flex items-center justify-center gap-5">
            {spot && <button onClick={() => void spotifyPrev()} aria-label="Previous"><SkipBack className="h-5 w-5" /></button>}
            <button onClick={toggle} aria-label={paused ? "Play" : "Pause"} className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400 text-black active:scale-95">{!spot && music.loading ? <Loader2 className="h-5 w-5 animate-spin" /> : paused ? <Play className="h-5 w-5 fill-current" /> : <Pause className="h-5 w-5 fill-current" />}</button>
            {spot && <button onClick={() => void spotifyNext()} aria-label="Next"><SkipForward className="h-5 w-5" /></button>}
          </div>
        </>
      )}
      {note && <p className="mt-1 text-center text-[10px] text-white/55">{note}</p>}
      {engine !== "loading" && <p className="mt-0.5 text-center text-[10px] text-emerald-300/70">{spot ? "Full song · Spotify Premium" : engine === "audio" ? "Full song · keeps playing in the background" : "Preview"}</p>}
    </motion.div>
  );
};

const PrimeMusicHub = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [kind, setKind] = useState<Kind>("track");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string>("Afrobeats");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Item | null>(null);
  const reqId = useRef(0);
  const [connected, setConnected] = useState(isSpotifyConnected());
  useEffect(() => { if (open) setConnected(isSpotifyConnected()); }, [open]);

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
            <button onClick={() => { if (connected) { disconnectSpotify(); setConnected(false); toast.success("Spotify disconnected"); } else void startSpotifyLogin().catch(() => toast.error("Spotify isn't configured yet.")); }} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${connected ? glass : "bg-emerald-400 text-black"}`}>{connected ? "Spotify ✓" : "Connect Spotify"}</button>
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

          <AnimatePresence>{now && <NowPlaying item={now} onClose={() => setNow(null)} />}</AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PrimeMusicHub;
