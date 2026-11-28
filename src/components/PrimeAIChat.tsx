import { mediaStorage } from "@/lib/mediaStorage";
import { authHeader } from "@/utils/authFetch";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Mic, MicOff, Paperclip, Share2, Volume2, VolumeX, Image as ImageIcon, Music2, FileText, Loader2 } from "lucide-react";
import AuroraAura from "./AuroraAura";
import { setWakeEnabled, wakeEnabled } from "./AuroraWake";
import { Capacitor } from "@capacitor/core";
import { listen, speakAurora, stopSpeaking, canListen, type Listener } from "@/lib/auroraSpeech";
import { ImageCard, SongCard } from "./AuroraCreations";
import { parseSongSpec, type SongSpec } from "@/features/aurora/songComposer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";


const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prime-ai-chat`;

type Attachment = { kind: "image" | "video" | "audio" | "file"; url: string; name: string; dataUrl?: string };
type Creation = { kind: "image"; prompt: string; seed: number } | { kind: "song"; spec: SongSpec };
type Msg = { role: "user" | "assistant"; content: string; attachments?: Attachment[]; creation?: Creation };
type Mode = "chat" | "image" | "song";

const IMAGE_INTENT = /\b(?:create|generate|draw|make|paint|design|imagine)\s+(?:me\s+)?(?:an?\s+|some\s+)?(?:image|picture|photo|artwork|art|illustration|logo|wallpaper|poster|cover)\b\s*(?:of|for|showing|with|about)?\s*(.*)/i;
const SONG_INTENT = /\b(?:create|write|make|compose|produce|generate)\s+(?:me\s+)?(?:an?\s+)?(?:\w+\s+)?(?:song|beat|track|tune|jingle)\b\s*(?:about|on|for|called|named|with)?\s*(.*)/i;
const SONG_PROMPT = `You are a songwriter and music producer. Reply with ONLY one JSON object, no prose, no code fences, with keys: title (string), lyrics (string, 2 verses and a chorus, lines separated by \\n, section tags like [Chorus] allowed), bpm (number 70-150), key (one of C,C#,D,Eb,E,F,F#,G,Ab,A,Bb,B), mode ("major" or "minor"), style (one of afrobeat,pop,lofi,trap,rnb,gospel,dance), progression (array of 4 scale degrees 1-7). Song request: `;

const toDataUrl = (file: File, max = 1280) => new Promise<string>((resolve, reject) => {
  const img = new Image();
  const src = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(src);
    resolve(c.toDataURL("image/jpeg", 0.8));
  };
  img.onerror = () => reject(new Error("Couldn't read that image"));
  img.src = src;
});

/** What the model receives: images as vision parts, other media as named references. */
const apiMessage = (m: Msg) => {
  if (!m.attachments?.length) return { role: m.role, content: m.content };
  const parts: Array<Record<string, unknown>> = [];
  const notes = m.attachments.filter(a => !a.dataUrl).map(a => `[Attached ${a.kind}: ${a.name} — ${a.url}]`).join(" ");
  parts.push({ type: "text", text: `${m.content} ${notes}`.trim() || "What is this?" });
  for (const a of m.attachments) if (a.dataUrl) parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
  return { role: m.role, content: parts };
};

const COMMAND_REGISTRY: Record<string, string> = {
  music: "/",
  sports: "/sports",
  movies: "/movies",
  reels: "/reels",
  profile: "/profile",
  messages: "/messages",
  wallet: "/wallet",
  settings: "/settings",
  search: "/search",
  create: "/create",
  home: "/",
};

const PrimeAIChat = ({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen?: () => void }) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [wake, setWake] = useState(wakeEnabled);
  const flipWake = async () => {
    const v = !wake;
    if (v) { try { if (!Capacitor.isNativePlatform()) { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t => t.stop()); } } catch { toast.error("Allow the microphone to use Hey Aurora"); return; } toast.success("Say “Hey Aurora” while Primegram is open"); }
    setWake(v); setWakeEnabled(v);
  };
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceIntensity, setVoiceIntensity] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>();
  const navigate = useNavigate();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Global 'P' key listener to trigger Aurora
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        if (!open) {
          // Chat is closed, open it first
          onOpen?.();
          setTimeout(() => toggleVoiceInput(), 500);
        } else {
          // Chat is open, trigger voice input directly
          toggleVoiceInput();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, listening]);

  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setVoiceIntensity(avg / 255);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  };

  const stopAudioAnalysis = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setVoiceIntensity(0);
  };

  const checkForCommands = (text: string) => {
    const lower = text.toLowerCase();
    for (const [keyword, path] of Object.entries(COMMAND_REGISTRY)) {
      if (lower.includes(`navigate to ${keyword}`) || lower.includes(`opening ${keyword}`) || lower.includes(`going to ${keyword}`)) {
        setTimeout(() => { onClose(); navigate(path); }, 1500);
        return true;
      }
    }
    return false;
  };

  const [voiceOn, setVoiceOn] = useState(() => { try { return localStorage.getItem("aurora_voice") === "1"; } catch { return false; } });
  const toggleVoiceOut = () => { const v = !voiceOn; setVoiceOn(v); try { localStorage.setItem("aurora_voice", v ? "1" : "0"); } catch { /* ignore */ } if (!v) { stopSpeaking(); setSpeaking(false); } };
  const askedByVoice = useRef(false); // typed chats stay silent; spoken questions get spoken answers
  const speak = (text: string) => {
    if (!voiceOn && !askedByVoice.current) return;
    void speakAurora(text, () => setSpeaking(true)).catch(() => undefined).finally(() => setSpeaking(false));
  };
  const listenRef = useRef<Listener | null>(null);

  const toggleVoiceInput = () => {
    if (listening) { listenRef.current?.stop(); setListening(false); stopAudioAnalysis(); return; }
    if (!canListen()) { toast.error("Voice input isn't supported here"); return; }
    stopSpeaking();
    setListening(true);
    if (!Capacitor.isNativePlatform()) startAudioAnalysis();
    void listen({
      onPartial: (t) => setInput(t),
      onFinal: (t) => { askedByVoice.current = true; setInput(t); setListening(false); stopAudioAnalysis(); setTimeout(() => sendRef.current?.(t), 150); },
      onError: (e) => { if (e === "not-allowed" || e === "service-not-allowed") toast.error("Allow microphone access for Primegram"); },
      onEnd: () => { setListening(false); stopAudioAnalysis(); },
    }).then((l) => { listenRef.current = l; });
  };

  const attach = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      const next: Attachment[] = [];
      for (const f of Array.from(files).slice(0, 4)) {
        if (f.size > 50 * 1024 * 1024) { toast.error(`${f.name} is over 50 MB`); continue; }
        const kind: Attachment["kind"] = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : f.type.startsWith("audio/") ? "audio" : "file";
        let url = URL.createObjectURL(f);
        if (uid) {
          const path = `${uid}/ai/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const { error } = await mediaStorage.upload(path, f, { contentType: f.type || undefined });
          if (!error) url = mediaStorage.getPublicUrl(path).data.publicUrl;
        }
        next.push({ kind, url, name: f.name, dataUrl: kind === "image" ? await toDataUrl(f) : undefined });
      }
      setPending(p => [...p, ...next].slice(0, 4));
    } catch (e: any) { toast.error(e.message || "Couldn't attach file"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; if (docRef.current) docRef.current.value = ""; }
  };

  const askOnce = async (prompt: string) => {
    const resp = await fetch(CHAT_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: await authHeader() }, body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }) });
    if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || `Error ${resp.status}`); }
    const reader = resp.body?.getReader(); if (!reader) throw new Error("No stream");
    const dec = new TextDecoder(); let buf = "", out = "";
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith("data: ")) continue;
        try { out += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content ?? ""; } catch { /* partial */ }
      }
    }
    return out;
  };

  /** Image / song requests, from the mode chips or natural phrases. Returns true when handled. */
  const create = async (text: string): Promise<boolean> => {
    const im = IMAGE_INTENT.exec(text); const sm = SONG_INTENT.exec(text);
    const kind: Mode = mode !== "chat" ? mode : sm && !im ? "song" : im ? "image" : "chat";
    if (kind === "chat") return false;
    const subject = (mode !== "chat" ? text : (kind === "image" ? im?.[1] : sm?.[1]) || text).trim() || text;
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setInput(""); setLoading(true);
    try {
      if (kind === "image") {
        setMessages(prev => [...prev, { role: "assistant", content: "Here you go ✨", creation: { kind: "image", prompt: subject, seed: Math.floor(Math.random() * 1e6) } }]);
      } else {
        const raw = await askOnce(SONG_PROMPT + subject);
        const spec = parseSongSpec(raw, subject.slice(0, 40) || "Aurora Song");
        setMessages(prev => [...prev, { role: "assistant", content: `I wrote and produced “${spec.title}” for you 🎶`, creation: { kind: "song", spec } }]);
      }
    } catch (e: any) { toast.error(e.message || "Couldn't create that"); }
    finally { setLoading(false); }
    return true;
  };

  const shareReply = async (text: string) => {
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); }
    } catch { /* cancelled */ }
  };

  const sendRef = useRef<((t?: string) => void) | null>(null);
  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (override === undefined) askedByVoice.current = false;
    if ((!text && !pending.length) || loading) return;
    const lower = text.toLowerCase();
    
    if (!pending.length && await create(text)) return;
    // Check for Aurora commands
    const isAurora = lower.includes("aurora");
    for (const [keyword, path] of Object.entries(COMMAND_REGISTRY)) {
      if ((isAurora && lower.includes(keyword)) || lower.includes(`open ${keyword}`) || lower.includes(`go to ${keyword}`) || lower === keyword) {
        onClose();
        navigate(path);
        toast.success(`Opening ${keyword}...`);
        setInput("");
        return;
      }
    }
    if (isAurora && lower.includes("play music")) {
      onClose();
      toast.success("Opening Music Hub...");
      setInput("");
      return;
    }

    const userMsg: Msg = { role: "user", content: text, attachments: pending.length ? pending : undefined };
    setInput("");
    setPending([]);
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: await authHeader() },
        body: JSON.stringify({ messages: [...messages, userMsg].slice(-20).map(apiMessage) }),
      });
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || `Error ${resp.status}`); }
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              const final = assistantSoFar;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: final } : m));
                return [...prev, { role: "assistant", content: final }];
              });
            }
          } catch {}
        }
      }
      if (assistantSoFar) {
        speak(assistantSoFar);
        checkForCommands(assistantSoFar);
      }
    } catch (e: any) { toast.error(e.message || "AI error"); }
    finally { setLoading(false); }
  };

  sendRef.current = (t) => { void send(t); };
  const aState = listening ? "listening" : speaking ? "speaking" : loading ? "thinking" : "idle";
  const chips: { m: Mode; label: string; icon: typeof ImageIcon }[] = [{ m: "chat", label: "Chat", icon: Sparkles }, { m: "image", label: "Create image", icon: ImageIcon }, { m: "song", label: "Create song", icon: Music2 }];
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#07061a] text-white"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.35),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.22),transparent_55%)]" />
          <div className="safe-area-top relative z-10 flex items-center justify-between px-4 pt-3">
            <button onClick={toggleVoiceOut} aria-label={voiceOn ? "Mute Aurora's voice" : "Unmute Aurora's voice"} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur">{voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-white/50" />}</button>
            <h2 className="bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-lg font-black tracking-[0.35em] text-transparent">AURORA</h2>
            <button onClick={() => { stopSpeaking(); onClose(); }} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur"><X className="h-4 w-4" /></button>
          </div>

          <div className="relative z-10 flex flex-1 flex-col overflow-y-auto px-4 pb-2">
            <div className={`flex flex-col items-center transition-all ${messages.length ? "py-2" : "py-6"}`}>
              <AuroraAura size={messages.length ? 84 : 190} level={voiceIntensity} state={aState} />
              <p className="mt-2 text-xs text-white/60">{listening ? "Listening…" : speaking ? "Speaking…" : loading ? "Creating…" : messages.length ? "" : "Ask me anything, or have me make something"}</p>
            </div>
            {messages.length === 0 && (
              <div className="mb-3 flex flex-wrap justify-center gap-2">
                {["Create an image of a neon Nairobi skyline", "Write a song about summer love", "Open Sports", "Make a lofi beat for studying"].map(cmd => (
                  <button key={cmd} onClick={() => setInput(cmd)} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs backdrop-blur active:scale-95">{cmd}</button>
                ))}
              </div>
            )}
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white" : "border border-white/10 bg-white/10 backdrop-blur"}`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                    ) : msg.content}
                    {msg.creation?.kind === "image" && <ImageCard prompt={msg.creation.prompt} seed={msg.creation.seed} />}
                    {msg.creation?.kind === "song" && <SongCard spec={msg.creation.spec} />}
                    {msg.attachments?.map((a, k) => (
                      <div key={k} className="mt-2">
                        {a.kind === "image" ? <img src={a.url} alt={a.name} className="max-h-48 rounded-xl" />
                          : a.kind === "video" ? <video src={a.url} controls preload="none" className="max-h-48 rounded-xl" />
                          : a.kind === "audio" ? <audio src={a.url} controls className="max-w-full" />
                          : <a href={a.url} target="_blank" rel="noreferrer" className="text-xs underline">{a.name}</a>}
                      </div>
                    ))}
                    {msg.role === "assistant" && msg.content && !msg.creation && (
                      <button onClick={() => void shareReply(msg.content)} aria-label="Share reply" className="mt-1 flex items-center gap-1 text-[10px] text-white/50"><Share2 className="h-3 w-3" />Share</button>
                    )}
                  </div>
                </div>
              ))}
              {loading && (messages[messages.length - 1]?.role === "user" || mode === "song") && (
                <div className="flex justify-start"><div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white/70"><Loader2 className="h-4 w-4 animate-spin" />{mode === "song" ? "Composing…" : "Thinking…"}</div></div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="safe-area-bottom relative z-10 px-3 pb-3 pt-1">
            <div className="mb-2 flex gap-2 overflow-x-auto">
              {chips.map(c => (
                <button key={c.m} onClick={() => setMode(c.m)} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${mode === c.m ? "border-transparent bg-gradient-to-r from-cyan-400 to-fuchsia-500 font-semibold text-black" : "border-white/15 bg-white/10"}`}><c.icon className="h-3.5 w-3.5" />{c.label}</button>
              ))}
              <button onClick={() => void flipWake()} className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${wake ? "border-transparent bg-green-400 font-semibold text-black" : "border-white/15 bg-white/10"}`}><Mic className="h-3.5 w-3.5" />Hey Aurora {wake ? "on" : "off"}</button>
            </div>
            {pending.length > 0 && (
              <div className="mb-2 flex gap-2 overflow-x-auto">
                {pending.map((a, k) => (
                  <div key={k} className="relative shrink-0 rounded-xl bg-white/10 px-2 py-1 text-[10px]">
                    {a.kind === "image" ? <img src={a.url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : `${a.kind}: ${a.name.slice(0, 14)}`}
                    <button onClick={() => setPending(p => p.filter((_, i) => i !== k))} aria-label="Remove attachment" className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
            {/* photo/video only, so the Android app shows its own gallery instead of the system Files browser */}
            <input ref={fileRef} type="file" multiple accept="image/*,video/*" hidden onChange={e => void attach(e.target.files)} />
            <input ref={docRef} type="file" multiple accept="audio/*,application/pdf,text/*" hidden onChange={e => void attach(e.target.files)} />
            <div className="flex items-center gap-2 rounded-[1.75rem] border border-white/15 bg-white/10 p-1.5 backdrop-blur-xl">
              <button onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Add photo or video" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 disabled:opacity-40">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}</button>
              <button onClick={() => docRef.current?.click()} disabled={uploading} aria-label="Add audio or document" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 disabled:opacity-40"><FileText className="h-4 w-4" /></button>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && void send()} placeholder={listening ? "Listening…" : mode === "image" ? "Describe the image…" : mode === "song" ? "What's the song about?" : "Ask Aurora…"} className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/40" />
              <button onClick={toggleVoiceInput} aria-label="Voice" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${listening ? "bg-green-500 text-black" : "bg-white/10"}`}>{listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
              <button onClick={() => void send()} disabled={loading || (!input.trim() && !pending.length)} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-black disabled:opacity-40"><Send className="h-4 w-4" /></button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PrimeAIChat;
