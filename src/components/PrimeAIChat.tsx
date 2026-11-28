import { mediaStorage } from "@/lib/mediaStorage";
import { authHeader } from "@/utils/authFetch";
import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Mic, MicOff, Volume2, Paperclip, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";

const PrimeOrb = lazy(() => import("./PrimeOrb"));

const FloatingOrb = lazy(() => import("./FloatingOrb"));

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prime-ai-chat`;

type Attachment = { kind: "image" | "video" | "audio" | "file"; url: string; name: string; dataUrl?: string };
type Msg = { role: "user" | "assistant"; content: string; attachments?: Attachment[] };

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

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const plain = text.replace(/[#*_`~\[\]()]/g, "");
    const utterance = new SpeechSynthesisUtterance(plain);
    utterance.rate = 1;
    utterance.pitch = 1.1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoiceInput = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input not supported"); return; }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      stopAudioAnalysis();
      return;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
      stopAudioAnalysis();
      // Auto-send voice commands
      setTimeout(() => {
        const lower = transcript.toLowerCase();
        // Check for "Aurora" prefix commands
        if (lower.includes("aurora")) {
          for (const [keyword, path] of Object.entries(COMMAND_REGISTRY)) {
            if (lower.includes(keyword)) {
              onClose();
              navigate(path);
              toast.success(`Opening ${keyword}...`);
              return;
            }
          }
        }
      }, 300);
    };
    recognition.onerror = () => { setListening(false); stopAudioAnalysis(); };
    recognition.onend = () => { setListening(false); stopAudioAnalysis(); };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    startAudioAnalysis();
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
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const shareReply = async (text: string) => {
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); }
    } catch { /* cancelled */ }
  };

  const send = async () => {
    if ((!input.trim() && !pending.length) || loading) return;
    const lower = input.toLowerCase();
    
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

    const userMsg: Msg = { role: "user", content: input.trim(), attachments: pending.length ? pending : undefined };
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed inset-4 bottom-24 z-[60] liquid-glass-elevated rounded-3xl flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-3 relative z-10">
            <div className="flex items-center gap-3">
              <Suspense fallback={<Sparkles className="w-8 h-8 text-primary animate-pulse" />}>
                <PrimeOrb intensity={listening ? voiceIntensity : speaking ? 0.3 : 0} />
              </Suspense>
              <div>
                <span className="text-headline text-foreground text-sm">Aurora</span>
                <p className="text-caption text-muted-foreground">Press 'P' for voice</p>
                {speaking && <p className="text-xs text-primary animate-pulse">Speaking...</p>}
                {listening && <p className="text-xs text-green-400 animate-pulse">Listening...</p>}
              </div>
            </div>
            <button onClick={() => { window.speechSynthesis.cancel(); onClose(); }} className="depth-press w-8 h-8 rounded-full liquid-glass-subtle flex items-center justify-center">
              <X className="w-4 h-4 text-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-3 relative z-10">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm mt-6">
                <p className="text-base font-medium text-foreground mb-2">Hey! I'm Aurora 🤖</p>
                <p className="text-xs mb-1">Your AI assistant. Try voice commands:</p>
                <p className="text-xs text-primary mb-3">"Aurora, play music" • "Aurora, open Sports"</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {["Aurora, open Sports", "Aurora, play music", "Go to Profile"].map(cmd => (
                    <button key={cmd} onClick={() => setInput(cmd)} className="depth-press px-3 py-1.5 rounded-xl liquid-glass-subtle text-xs text-foreground relative z-10">
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "liquid-glass-subtle text-foreground relative z-10"}`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                  ) : msg.content}
                  {msg.attachments?.map((a, k) => (
                    <div key={k} className="mt-2">
                      {a.kind === "image" ? <img src={a.url} alt={a.name} className="max-h-48 rounded-xl" />
                        : a.kind === "video" ? <video src={a.url} controls preload="none" className="max-h-48 rounded-xl" />
                        : a.kind === "audio" ? <audio src={a.url} controls className="max-w-full" />
                        : <a href={a.url} target="_blank" rel="noreferrer" className="underline text-xs">{a.name}</a>}
                    </div>
                  ))}
                  {msg.role === "assistant" && msg.content && (
                    <button onClick={() => void shareReply(msg.content)} aria-label="Share reply" className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Share2 className="h-3 w-3" />Share</button>
                  )}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="liquid-glass-subtle rounded-2xl px-4 py-2.5 text-sm text-muted-foreground relative z-10">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-4 py-3 relative z-10">
            {pending.length > 0 && (
              <div className="mb-2 flex gap-2 overflow-x-auto">
                {pending.map((a, k) => (
                  <div key={k} className="relative shrink-0 rounded-xl liquid-glass-subtle px-2 py-1 text-[10px] text-foreground">
                    {a.kind === "image" ? <img src={a.url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : `${a.kind}: ${a.name.slice(0, 14)}`}
                    <button onClick={() => setPending(p => p.filter((_, i) => i !== k))} aria-label="Remove attachment" className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*,application/pdf,text/*" hidden onChange={e => void attach(e.target.files)} />
            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Attach media" className="depth-press w-11 h-11 rounded-2xl liquid-glass-subtle flex items-center justify-center disabled:opacity-40">
                <Paperclip className="w-4 h-4 text-foreground" />
              </button>
              <button onClick={toggleVoiceInput} className={`depth-press w-11 h-11 rounded-2xl flex items-center justify-center ${listening ? "bg-green-500" : "liquid-glass-subtle"}`}>
                {listening ? <MicOff className="w-4 h-4 text-primary-foreground" /> : <Mic className="w-4 h-4 text-foreground" />}
              </button>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder={listening ? "Listening..." : "Ask Aurora or attach media..."} className="flex-1 px-4 py-3 rounded-2xl bg-secondary/50 text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30" />
              <button onClick={send} disabled={loading || (!input.trim() && !pending.length)} className="depth-press w-11 h-11 rounded-2xl bg-primary flex items-center justify-center disabled:opacity-40">
                <Send className="w-4 h-4 text-primary-foreground" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PrimeAIChat;
