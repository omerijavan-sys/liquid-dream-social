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
      const nav = lower.match(/^(?:please )?(?:open|go to|show me|show|take me to|navigate to|launch)\s+(?:the\s+)?([a-z ]+?)(?: page| tab| screen)?$/);
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog" aria-modal="true" aria-label="Aurora assistant"
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-y-auto py-6"
        >
          {/* Dim + glass backdrop */}
          <div className="absolute inset-0 bg-background/70 backdrop-blur-2xl" />

          <div className="relative z-10 w-full max-w-lg px-6 flex flex-col items-center gap-5">
            <div className="w-full flex items-center justify-between border-b border-border pb-3"><h2 className="text-xl font-semibold text-foreground">Aurora</h2><span className="text-xs text-muted-foreground">{label}</span></div>
            {/* Orb */}
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              <AuroraAura size={220} level={phase === "speaking" ? 0.55 : intensity} state={phase === "listening" ? "listening" : phase === "speaking" ? "speaking" : phase === "thinking" ? "thinking" : "idle"}>
                <SiriOrb
                  size={150}
                  intensity={phase === "speaking" ? 0.55 : intensity}
                  listening={phase === "listening"}
                  speaking={phase === "speaking" || phase === "thinking"}
                  onClick={() => (wantListeningRef.current ? endSession() : beginSession())}
                />
              </AuroraAura>
            </motion.div>

            <div className="text-center w-full min-h-[92px] max-h-[30dvh] overflow-y-auto break-words">
              <p className="text-caption text-muted-foreground mb-1">{label}</p>
              {transcript && <p className="text-sm text-foreground/80 italic mb-2">“{transcript}”</p>}
              {reply && <p className="text-base text-foreground leading-relaxed">{reply}</p>}
              {note && <p className="mt-2 text-xs text-amber-400">{note}</p>}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon"
                onClick={() => (wantListeningRef.current ? endSession() : beginSession())}
                className={`depth-press w-14 h-14 rounded-full flex items-center justify-center ${
                  wantListeningRef.current ? "bg-primary" : "liquid-glass-subtle"
                }`}
                aria-label={wantListeningRef.current ? "Mute microphone" : "Start listening"}
              >
                {wantListeningRef.current ? (
                  <MicOff className="w-5 h-5 text-primary-foreground" />
                ) : (
                  <Mic className="w-5 h-5 text-foreground" />
                )}
              </Button>

              <Button variant="ghost" size="icon"
                onClick={() => {
                  stopSpeaking();
                  busyRef.current = false;
                  if (wantListeningRef.current) startRecognition();
                  else setPhaseSafe("idle");
                }}
                className="depth-press w-14 h-14 rounded-full liquid-glass-subtle flex items-center justify-center"
                aria-label="Stop speaking"
              >
                <Square className="w-5 h-5 text-foreground" />
              </Button>

              <Button variant="ghost" size="icon"
                onClick={() => {
                  endSession();
                  onClose();
                  onOpenTextChat?.();
                }}
                className="depth-press w-14 h-14 rounded-full liquid-glass-subtle flex items-center justify-center"
                aria-label="Switch to typing"
              >
                <Keyboard className="w-5 h-5 text-foreground" />
              </Button>

              <Button variant="ghost" size="icon"
                onClick={() => {
                  endSession();
                  onClose();
                }}
                className="depth-press w-14 h-14 rounded-full liquid-glass-subtle flex items-center justify-center"
                aria-label="Close assistant"
              >
                <X className="w-5 h-5 text-foreground" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SiriAssistant;
