import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff, Keyboard, Square } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { useNavigate } from "react-router-dom";
import SiriOrb from "./SiriOrb";
import AuroraAura from "./AuroraAura";
import { authHeader } from "@/utils/authFetch";
import { Button } from "@/components/ui/button";
import { ROUTES, runAction, splitAction } from "@/utils/auroraActions";
import { listen, speakAurora, stopSpeaking, canListen, type Listener } from "@/lib/auroraSpeech";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prime-ai-chat`;

type Msg = { role: "user" | "assistant"; content: string };
type Phase = "idle" | "listening" | "thinking" | "speaking";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenTextChat?: () => void;
}

/**
 * Siri-style real-time voice assistant.
 * Continuous speech recognition -> streamed AI reply -> spoken response,
 * then automatically resumes listening for a natural back-and-forth.
 */
const SiriAssistant = ({ open, onClose, onOpenTextChat }: Props) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [intensity, setIntensity] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<Msg[]>([]);
  const navigate = useNavigate();

  const recognitionRef = useRef<Listener | null>(null);
  const wantListeningRef = useRef(false);
  const phaseRef = useRef<Phase>("idle");
  const busyRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>();

  const setPhaseSafe = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  /* ---------------- mic level meter (drives orb reactivity) ---------------- */
  const startMeter = useCallback(async () => {
    if (audioCtxRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setIntensity((prev) => prev * 0.6 + (avg / 180) * 0.4);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      toast.error("Microphone access is needed for voice chat");
    }
  }, []);

  const stopMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setIntensity(0);
  }, []);

  /* ---------------- Aurora's voice (a woman's, native on Android) ---------------- */
  const speak = useCallback((text: string, onDone: () => void) => {
    if (!text.trim()) { onDone(); return; }
    setPhaseSafe("speaking");
    void speakAurora(text, () => setPhaseSafe("speaking")).catch(() => undefined).finally(onDone);
  }, []);

  /* ---------------- recognition control ---------------- */
  const stopRecognition = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    recognitionRef.current = null;
  }, []);

  const askAI = useCallback(
    async (text: string) => {
      busyRef.current = true;
      stopRecognition();
      setPhaseSafe("thinking");
      setReply("");

      // Instant local commands: "open movies", "go back", "scroll down"...
      const lower = text.toLowerCase().replace(/^(hey |hi |ok |okay )?aurora[, ]*/i, "").trim();
      const done = (line: string) => {
        setReply(line);
        speak(line, () => {
          busyRef.current = false;
          if (wantListeningRef.current) startRecognition();
          else setPhaseSafe("idle");
        });
      };
      const act = async (a: Parameters<typeof runAction>[0], say: string) => {
        const problem = await runAction(a, navigate as never).catch(() => "Sorry, I couldn't do that.");
        done(problem ?? say);
      };
      let m: RegExpMatchArray | null;
      if ((m = lower.match(/^(?:please )?(?:play|put on|i want to (?:hear|listen to)|listen to)\s+(?:me\s+|some\s+)?(.+?)(?: on (?:music|primegram|spotify))?$/)) && !/^(music|some music|a song|something|songs?)$/.test(m[1])) { void act({ type: "play", query: m[1] }, `Playing ${m[1]}.`); return; }
      if (/^(?:please )?(?:play|put on)\s*(?:some |my )?(?:music|songs?|a song|something)?$/.test(lower) || /^(?:open|show|go to)\s+(?:the\s+)?(?:music|music hub|player)(?: page)?$/.test(lower)) { void act({ type: "music", cmd: /^(?:please )?(?:play|put on)/.test(lower) ? "resume" : "open" }, "Opening your music."); return; }
      if (/^(pause|pause (?:the )?(?:music|song)|stop (?:the )?(?:music|song)|stop playing)$/.test(lower)) { void act({ type: "music", cmd: "pause" }, "Paused."); return; }
      if (/^(resume|continue|unpause)(?: (?:the )?(?:music|song))?$/.test(lower)) { void act({ type: "music", cmd: "resume" }, "Resuming."); return; }
      if (/^(next|skip)(?: (?:the )?(?:song|track))?$|^play (?:the )?next(?: song| track)?$/.test(lower)) { void act({ type: "music", cmd: "next" }, "Next song."); return; }
      if (/^(previous|prev|last)(?: (?:the )?(?:song|track))?$|^play (?:the )?previous(?: song| track)?$/.test(lower)) { void act({ type: "music", cmd: "prev" }, "Previous song."); return; }
      if ((m = lower.match(/^(?:please )?(?:open|show|view|go to)\s+(?:@)?([a-z0-9_. ]+?)(?:'s| s)?\s+profile$|^(?:please )?(?:open|show|view)\s+profile (?:of |for )?(?:@)?([a-z0-9_. ]+)$/)) && !/^(my|me|the|your)$/.test((m[1] || m[2]).trim())) { const n = (m[1] || m[2]).trim(); void act({ type: "profile", username: n }, `Opening ${n}'s profile.`); return; }
      if (/^(?:please )?(?:open|show|view|go to)\s+(?:my|me|my own)\s+profile$/.test(lower)) { void act({ type: "navigate", page: "profile" }, "Opening your profile."); return; }
      if ((m = lower.match(/^(?:please )?(?:message|text|chat with|dm)\s+(?:@)?([a-z0-9_. ]+)$/))) { void act({ type: "message", username: m[1].trim() }, `Opening your chat with ${m[1].trim()}.`); return; }
      if ((m = lower.match(/^(?:please )?search(?: for)?\s+(.+)$/))) { void act({ type: "search", query: m[1] }, `Searching for ${m[1]}.`); return; }
      const nav = lower.match(/^(?:please )?(?:open|go to|show me|show|take me to|navigate to|launch)\s+(?:the\s+)?([a-z ]+?)(?: page| tab| screen)?$/);
      if (nav && nav[1].trim() === "music") { void act({ type: "music", cmd: "open" }, "Opening your music."); return; }
      if (nav && ROUTES[nav[1].trim()]) { navigate(ROUTES[nav[1].trim()]); done(`Opening ${nav[1].trim()}.`); return; }
      if (/^(go back|back|previous page)$/.test(lower)) { navigate(-1 as never); done("Going back."); return; }
      if (/^scroll (down|up)$/.test(lower)) { void runAction({ type: "scroll", direction: lower.endsWith("up") ? "up" : "down" }, navigate as never); done("Okay."); return; }

      const userMsg: Msg = { role: "user", content: text };
      const convo = [...history, userMsg].slice(-16);
      let full = "";
      try {
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: await authHeader() },
          body: JSON.stringify({ messages: convo, mode: "voice" }),
        });
        if (!resp.ok) {
          const e = await resp.json().catch(() => ({}));
          throw new Error(e.error || `Error ${resp.status}`);
        }
        const reader = resp.body?.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") break;
            try {
              const delta = JSON.parse(json).choices?.[0]?.delta?.content;
              if (delta) {
                full += delta;
                setReply(splitAction(full).text);
              }
            } catch {}
          }
        }
      } catch (e: any) {
        full = e?.message || "Sorry, I couldn't reach my brain just now.";
        setReply(full);
      }

      const parsed = splitAction(full);
      let spoken = parsed.text.trim();
      if (parsed.action) {
        const problem = await runAction(parsed.action, navigate as never).catch(() => "Sorry, I couldn't do that.");
        if (problem) spoken = problem;
        if (!spoken) spoken = "Done.";
        setReply(spoken);
      }
      setHistory([...convo, { role: "assistant" as const, content: spoken }].slice(-16));
      speak(spoken, () => {
        busyRef.current = false;
        if (wantListeningRef.current) startRecognition();
        else setPhaseSafe("idle");
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, navigate, speak, stopRecognition],
  );

  const startRecognition = useCallback(() => {
    if (!canListen()) {
      setNote("This browser can't listen. Try Chrome or Edge, or use the Android app.");
      return;
    }
    if (busyRef.current) return;
    try { recognitionRef.current?.stop(); } catch {}
    setPhaseSafe("listening");
    let mine: Listener | null = null;
    void listen({
      continuous: true,
      onPartial: (t) => { setTranscript(t); setNote(""); },
      onFinal: (t) => { if (!busyRef.current) askAI(t); },
      onError: (err) => {
        const why: Record<string, string> = {
          "not-allowed": "Microphone is blocked. Allow microphone access for Primegram in your browser or phone settings, then tap the orb.",
          "service-not-allowed": "Speech recognition is blocked. Allow microphone access, then tap the orb.",
          "audio-capture": "No microphone found.",
          network: "Voice recognition needs an internet connection (some browsers like Brave don't support it; try Chrome or Edge).",
          unsupported: "This browser can't listen. Try Chrome or Edge, or use the Android app.",
          "update-app": "Voice needs the newest Primegram app. Install the latest APK from primegramx.co.ke/primegram.apk, then open Aurora again.",
          "start-failed": "Couldn't start the microphone. Tap the orb to try again.",
        };
        if (err === "no-speech" || err === "aborted") return;
        setNote(why[err] ?? `Voice problem (${err}). Tap the orb to retry.`);
        if (err === "not-allowed" || err === "service-not-allowed" || err === "unsupported" || err === "update-app") { wantListeningRef.current = false; setPhaseSafe("idle"); }
      },
      onEnd: () => {
        // keep the conversation going: listen again unless Aurora is busy answering
        if (recognitionRef.current === mine && wantListeningRef.current && !busyRef.current) {
          setTimeout(() => { if (wantListeningRef.current && !busyRef.current) startRecognition(); }, 300);
        }
      },
    }).then((l) => { mine = l; recognitionRef.current = l; });
  }, [askAI]);

  const beginSession = useCallback(() => {
    wantListeningRef.current = true;
    // Start recognition synchronously inside the tap so the browser keeps the user gesture
    startRecognition();
    // Level meter is cosmetic; start it after recognition has claimed the mic
    if (!Capacitor.isNativePlatform()) setTimeout(() => { startMeter(); }, 600);
  }, [startMeter, startRecognition]);

  const endSession = useCallback(() => {
    wantListeningRef.current = false;
    busyRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {}
    recognitionRef.current = null;
    stopSpeaking();
    stopMeter();
    setPhaseSafe("idle");
  }, [stopMeter]);

  // Auto-start the live session when opened
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("aurora:overlay", { detail: open }));
    if (open) {
      setTranscript("");
      setReply("");
      setNote("");
      const w = window as unknown as { __auroraWake?: string };
      const first = w.__auroraWake?.trim(); w.__auroraWake = undefined;
      if (first) { wantListeningRef.current = true; setTimeout(() => askAI(first), 400); }
      else beginSession();
    } else {
      endSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => endSession(), [endSession]);

  const label =
    phase === "listening"
      ? "Listening…"
      : phase === "thinking"
        ? "Thinking…"
        : phase === "speaking"
          ? "Speaking…"
          : "Tap the orb to talk";

  const aState = phase === "listening" ? "listening" : phase === "speaking" ? "speaking" : phase === "thinking" ? "thinking" : "idle";
  const toggleMic = () => (wantListeningRef.current ? endSession() : beginSession());
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          role="dialog" aria-label="Aurora assistant"
          className="pointer-events-none fixed inset-0 z-[70]"
        >
          {/* Siri-style glow around the screen edge; the app stays visible and usable behind it */}
          <style>{`
            @keyframes aurora-edge { 0% { filter: hue-rotate(0deg) } 100% { filter: hue-rotate(360deg) } }
            @keyframes aurora-edge-pulse { 0%,100% { opacity: .75 } 50% { opacity: 1 } }
          `}</style>
          <div className="absolute inset-0" style={{
            boxShadow: `inset 0 0 ${phase === "listening" ? 38 + Math.min(40, intensity * 90) : 30}px 6px rgba(124,92,255,.75), inset 0 0 90px 10px rgba(34,211,238,.35), inset 0 0 140px 14px rgba(217,70,239,.25)`,
            animation: "aurora-edge 6s linear infinite, aurora-edge-pulse 2.4s ease-in-out infinite",
            transition: "box-shadow .15s ease-out",
          }} />
          <div className="absolute inset-x-0 bottom-0 flex justify-center px-3" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-[2rem] border border-white/20 bg-black/55 p-3 pr-4 text-white shadow-2xl backdrop-blur-2xl"
            >
              <button onClick={toggleMic} aria-label={wantListeningRef.current ? "Mute microphone" : "Start listening"} className="shrink-0">
                <AuroraAura size={76} level={phase === "speaking" ? 0.5 : intensity} state={aState} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">{label}</p>
                <div className="max-h-[22dvh] overflow-y-auto break-words">
                  {transcript && !reply && <p className="text-sm italic text-white/80">“{transcript}”</p>}
                  {reply ? <p className="text-sm leading-snug text-white">{reply}</p> : !transcript && !note && <p className="text-sm text-white/60">{phase === "idle" ? "Tap the orb to talk" : "Go ahead, I'm listening"}</p>}
                  {note && <p className="mt-1 text-xs text-amber-300">{note}</p>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <button onClick={() => { stopSpeaking(); busyRef.current = false; if (wantListeningRef.current) startRecognition(); else setPhaseSafe("idle"); }} aria-label="Stop speaking" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"><Square className="h-3.5 w-3.5" /></button>
                <button onClick={() => { endSession(); onClose(); }} aria-label="Close assistant" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"><X className="h-4 w-4" /></button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SiriAssistant;
