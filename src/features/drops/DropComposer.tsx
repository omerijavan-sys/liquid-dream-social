import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Mic, Music2, Square, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { glass, glow, table, uploadMedia } from "../shared/ui";
import { promptOfTheDay } from "./useDrops";

type Kind = "photo" | "voice" | "song";
const MAX_VOICE_S = 5;

/** Bottom sheet for today's drop: photo, 5-second voice note or Song of the Day. */
const DropComposer = ({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) => {
  const { user } = useAuth();
  const [kind, setKind] = useState<Kind>("photo");
  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [voice, setVoice] = useState<{ blob: Blob; secs: number } | null>(null);
  const [rec, setRec] = useState<number | null>(null); // elapsed tenths of a second while recording
  const [song, setSong] = useState({ title: "", artist: "", url: "" });
  const [busy, setBusy] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const preview = photo ? URL.createObjectURL(photo) : null;
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); recorder.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  const stopRec = () => { if (recorder.current?.state === "recording") recorder.current.stop(); };
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); const chunks: Blob[] = []; const t0 = Date.now();
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        setRec(null);
        setVoice({ blob: new Blob(chunks, { type: mr.mimeType || "audio/webm" }), secs: Math.min(MAX_VOICE_S, Math.round((Date.now() - t0) / 100) / 10) });
      };
      recorder.current = mr; mr.start(); setVoice(null); setRec(0);
      timer.current = setInterval(() => {
        const el = Math.round((Date.now() - t0) / 100);
        setRec(el);
        if (el >= MAX_VOICE_S * 10) stopRec(); // hard stop at 5 seconds
      }, 100);
    } catch { toast.error("Allow microphone access to record a voice drop."); }
  };

  const ready = kind === "photo" ? !!photo : kind === "voice" ? !!voice : song.title.trim().length > 0;
  const post = async () => {
    if (!user || !ready || busy) return;
    setBusy(true);
    try {
      const row: Record<string, unknown> = { user_id: user.id, kind, caption: caption.trim() || null };
      if (kind === "photo" && photo) row.media_url = await uploadMedia(user.id, "drops", photo, (photo.name.split(".").pop() || "jpg").toLowerCase());
      if (kind === "voice" && voice) { row.media_url = await uploadMedia(user.id, "drops", voice.blob, voice.blob.type.includes("mp4") ? "m4a" : "webm"); row.duration_s = Math.min(voice.secs, MAX_VOICE_S); }
      if (kind === "song") {
        row.song_title = song.title.trim(); row.song_artist = song.artist.trim() || null;
        const u = song.url.trim(); if (/^https:\/\//i.test(u)) row.song_url = u;
      }
      const { error } = await table("daily_drops").insert(row);
      if (error) throw new Error(error.code === "23505" ? "You already dropped today. Come back tomorrow!" : error.message);
      toast.success("Dropped! Friends' drops are unlocked 🔓");
      onPosted(); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't post your drop"); }
    finally { setBusy(false); }
  };

  const tab = (k: Kind, Icon: typeof Camera, label: string) => (
    <button key={k} onClick={() => setKind(k)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold ${kind === k ? "bg-white/15 text-white" : "text-white/55"}`}><Icon className="h-3.5 w-3.5" />{label}</button>
  );
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`${glass} w-full max-w-md space-y-3 rounded-t-3xl bg-[#09090B]/90 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white`}>
        <div className="flex items-center justify-between"><div><p className="text-lg font-bold">Today's Drop</p><p className="text-xs text-white/60">{promptOfTheDay()}</p></div><button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button></div>
        <div className="flex gap-1 rounded-2xl bg-white/5 p-1">{tab("photo", Camera, "Photo")}{tab("voice", Mic, "Voice 5s")}{tab("song", Music2, "Song")}</div>

        {kind === "photo" && (
          <label className="flex h-44 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/20 bg-white/5">
            {preview ? <img src={preview} alt="Your drop" className="h-full w-full object-cover" /> : <span className="text-sm text-white/60">Tap to take or choose a photo</span>}
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
        )}
        {kind === "voice" && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-6">
            <button onClick={rec === null ? () => void startRec() : stopRec} aria-label={rec === null ? "Record" : "Stop"} className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500" style={{ boxShadow: glow("#f43f5e", rec === null ? 0.4 : 0.9, 26) }}>
              {rec === null ? <Mic className="h-7 w-7" /> : <Square className="h-6 w-6" />}
            </button>
            <p className="text-sm tabular-nums text-white/70">{rec !== null ? `${(rec / 10).toFixed(1)}s / ${MAX_VOICE_S}s` : voice ? `Recorded ${voice.secs.toFixed(1)}s — tap to re-record` : `Tap to record (max ${MAX_VOICE_S}s)`}</p>
            {voice && <audio controls src={URL.createObjectURL(voice.blob)} className="h-8 w-56" />}
          </div>
        )}
        {kind === "song" && (
          <div className="space-y-2">
            <input value={song.title} onChange={(e) => setSong({ ...song, title: e.target.value.slice(0, 120) })} placeholder="Song title" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none" />
            <input value={song.artist} onChange={(e) => setSong({ ...song, artist: e.target.value.slice(0, 120) })} placeholder="Artist" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none" />
            <input value={song.url} onChange={(e) => setSong({ ...song, url: e.target.value })} placeholder="Link (optional, https://…)" inputMode="url" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none" />
          </div>
        )}
        <input value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 140))} placeholder="Add a caption (optional)" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none" />
        <button disabled={!ready || busy || rec !== null} onClick={() => void post()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3 text-sm font-bold disabled:opacity-40" style={ready ? { boxShadow: glow("#a78bfa", 0.55, 22) } : undefined}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}Post my drop
        </button>
      </div>
    </div>
  );
};
export default DropComposer;
