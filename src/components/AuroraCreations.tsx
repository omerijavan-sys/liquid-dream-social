import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Mic2, Pause, Play, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { encodeSong, renderSong, type SongSpec } from "@/features/aurora/songComposer";

const save = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "aurora";

const HORDE = "https://aihorde.net/api/v2";
const HH = { apikey: "0000000000", "Content-Type": "application/json", "Client-Agent": "primegram:1:support" };

/** Paints an image with the free AI Horde community network (no key, no daily cap). Returns a webp blob. */
async function paint(prompt: string, seed: number, onNote: (n: string) => void, signal: AbortSignal): Promise<Blob> {
  const post = await fetch(`${HORDE}/generate/async`, { method: "POST", signal, headers: HH, body: JSON.stringify({
    prompt: `${prompt.slice(0, 380)}, highly detailed, vibrant, professional`,
    params: { width: 512, height: 512, steps: 25, n: 1, sampler_name: "k_euler_a", cfg_scale: 7.5, seed: String(seed) },
    nsfw: false, censor_nsfw: true, r2: false, shared: false, slow_workers: true,
  }) });
  const job = await post.json();
  if (!job.id) throw new Error(job.message || "busy");
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    if (signal.aborted) throw new Error("cancelled");
    const c = await (await fetch(`${HORDE}/generate/check/${job.id}`, { signal })).json();
    if (c.faulted) throw new Error("faulted");
    if (c.done) {
      const st = await (await fetch(`${HORDE}/generate/status/${job.id}`, { signal })).json();
      const img: string | undefined = st.generations?.[0]?.img;
      if (!img) throw new Error("empty");
      if (/^https?:/.test(img)) return await (await fetch(img, { signal })).blob();
      const bin = atob(img); const u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
      return new Blob([u8], { type: "image/webp" });
    }
    onNote(c.queue_position > 0 ? `In line: ${c.queue_position} ahead of you…` : "Painting your image…");
  }
  throw new Error("timeout");
}

/** An image Aurora drew from the user's description. */
export const ImageCard = ({ prompt, seed }: { prompt: string; seed: number }) => {
  const [s, setS] = useState(seed);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [note, setNote] = useState("Painting your image…");
  const [src, setSrc] = useState<string | null>(null);
  const blob = useRef<Blob | null>(null);

  useEffect(() => {
    const ctl = new AbortController(); let url: string | null = null;
    setState("loading"); setNote("Painting your image…");
    paint(prompt, s, setNote, ctl.signal)
      .then((b) => { blob.current = b; url = URL.createObjectURL(b); setSrc(url); setState("ready"); })
      .catch(() => { if (!ctl.signal.aborted) setState("failed"); });
    return () => { ctl.abort(); if (url) URL.revokeObjectURL(url); };
  }, [prompt, s]);

  const again = () => setS((x) => x + 1);
  return (
    <div className="mt-2 w-full max-w-[19rem] overflow-hidden rounded-2xl border border-white/15 bg-black/30">
      <div className="relative aspect-square w-full bg-gradient-to-br from-violet-900/50 to-cyan-900/40">
        {state !== "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-xs text-white/70">
            {state === "loading" ? <><Loader2 className="h-5 w-5 animate-spin" />{note}</> : <>Couldn't paint that right now. <button className="underline" onClick={again}>Try again</button></>}
          </div>
        )}
        {state === "ready" && src && <img src={src} alt={prompt} className="h-full w-full object-cover" />}
      </div>
      {state === "ready" && (
        <div className="flex items-center gap-1 p-2 text-[11px] text-white/80">
          <button className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5" onClick={() => { if (blob.current) save(blob.current, `${slug(prompt)}.webp`); }}><Download className="h-3.5 w-3.5" />Save</button>
          <button className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5" onClick={async () => {
            try { const b = blob.current; if (!b) return; const f = new File([b], `${slug(prompt)}.webp`, { type: b.type || "image/webp" });
              if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], text: prompt }); else { save(b, f.name); toast.success("Saved. Post it from your gallery."); } } catch { /* cancelled */ }
          }}><Share2 className="h-3.5 w-3.5" />Share</button>
          <button className="ml-auto flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5" onClick={again}><RefreshCw className="h-3.5 w-3.5" />Another</button>
        </div>
      )}
    </div>
  );
};

/** A song Aurora wrote and produced: lyrics plus a synthesised backing track you can play, save and share. */
export const SongCard = ({ spec }: { spec: SongSpec }) => {
  const [buf, setBuf] = useState<AudioBuffer | null>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sing, setSing] = useState(true);
  const [pos, setPos] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAt = useRef(0);
  const timers = useRef<number[]>([]);
  const raf = useRef<number>();

  useEffect(() => {
    let dead = false;
    renderSong(spec).then((b) => { if (!dead) setBuf(b); }).catch(() => !dead && setFailed(true));
    return () => { dead = true; stop(); void ctxRef.current?.close().catch(() => undefined); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lines = spec.lyrics.split("\n").map((l) => l.trim()).filter((l) => l && !/^\[.*\]$/.test(l));

  const stop = () => {
    try { srcRef.current?.stop(); } catch { /* already stopped */ }
    srcRef.current = null; timers.current.forEach(clearTimeout); timers.current = [];
    window.speechSynthesis?.cancel(); if (raf.current) cancelAnimationFrame(raf.current); setPlaying(false);
  };
  const play = async () => {
    if (!buf) return;
    stop();
    const ctx = ctxRef.current ?? (ctxRef.current = new AudioContext()); await ctx.resume();
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.onended = () => stop(); src.start();
    srcRef.current = src; startedAt.current = ctx.currentTime; setPlaying(true);
    const tick = () => { setPos(Math.min(1, (ctx.currentTime - startedAt.current) / buf.duration)); raf.current = requestAnimationFrame(tick); }; tick();
    if (sing && "speechSynthesis" in window && lines.length) {
      // sing-along: read a lyric line every two bars, starting after the intro
      const bar = (60 / spec.bpm) * 4, first = bar * 2, gap = bar * 2;
      lines.forEach((l, i) => { const at = first + i * gap; if (at < buf.duration - bar) timers.current.push(window.setTimeout(() => { const u = new SpeechSynthesisUtterance(l); u.rate = 0.95; u.pitch = 1.1; u.volume = 0.9; window.speechSynthesis.speak(u); }, at * 1000)); });
    }
  };
  const file = async () => { if (!buf) throw new Error("not ready"); const { blob, ext } = await encodeSong(buf); return new File([blob], `${slug(spec.title)}.${ext}`, { type: blob.type }); };

  return (
    <div className="mt-2 w-full max-w-[20rem] overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-violet-950/70 to-indigo-950/60 p-3 text-white">
      <div className="flex items-center gap-3">
        <button onClick={() => (playing ? stop() : void play())} disabled={!buf} aria-label={playing ? "Pause" : "Play"} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-black disabled:opacity-50">
          {!buf && !failed ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{spec.title}</p>
          <p className="text-[11px] text-white/60">{failed ? "Couldn't produce this one" : !buf ? "Mixing your song…" : `${spec.style} · ${spec.bpm} BPM · ${spec.key} ${spec.mode}`}</p>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-500" style={{ width: `${pos * 100}%` }} /></div>
      {spec.lyrics && <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-white/85">{spec.lyrics}</pre>}
      {buf && (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
          <button onClick={() => setSing((v) => !v)} className={`flex items-center gap-1 rounded-full px-3 py-1.5 ${sing ? "bg-fuchsia-500/30" : "bg-white/10"}`}><Mic2 className="h-3.5 w-3.5" />Voice {sing ? "on" : "off"}</button>
          <button className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5" onClick={async () => { try { const f = await file(); save(f, f.name); } catch { toast.error("Couldn't save it"); } }}><Download className="h-3.5 w-3.5" />Save</button>
          <button className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5" onClick={async () => { try { const f = await file(); if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: spec.title, text: spec.lyrics.slice(0, 200) }); else { save(f, f.name); toast.success("Saved to your device"); } } catch { /* cancelled */ } }}><Share2 className="h-3.5 w-3.5" />Share</button>
        </div>
      )}
    </div>
  );
};
