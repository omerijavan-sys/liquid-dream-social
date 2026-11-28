import { Capacitor } from "@capacitor/core";

/**
 * Aurora's ears and voice. In the Android app it uses the phone's native speech recognition and text-to-speech
 * (the WebView has neither); in a browser it uses the Web Speech API. The voice is always a woman's.
 */
const native = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
const nativeSR = () => native() && Capacitor.isPluginAvailable("SpeechRecognition");
const nativeTTS = () => native() && Capacitor.isPluginAvailable("TextToSpeech");
const webSR = () => !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
const FEMALE = /female|woman|samantha|karen|moira|tessa|serena|ava\b|allison|susan|zira|hazel|aria|jenny|libby|sonia|google uk english female|google us english|-x-(tpf|iob|iog|sfg|iol|enb|ene|afs|tpc)/i;
const MALE = /\bmale\b|daniel|david|mark|george|alex\b|fred|-x-(tpd|iom|rjs|gba)/i;

export const canListen = () => nativeSR() || webSR() || native();

/* ---------------- voice ---------------- */
let webVoice: SpeechSynthesisVoice | null | undefined;
const loadVoices = () => new Promise<SpeechSynthesisVoice[]>((res) => {
  const s = window.speechSynthesis; if (!s) return res([]);
  const v = s.getVoices(); if (v.length) return res(v);
  const t = setTimeout(() => res(s.getVoices()), 1500);
  s.addEventListener("voiceschanged", () => { clearTimeout(t); res(s.getVoices()); }, { once: true });
});
const pickWebVoice = async () => {
  if (webVoice !== undefined) return webVoice;
  const vs = (await loadVoices()).filter((v) => /^en/i.test(v.lang));
  webVoice = vs.find((v) => FEMALE.test(v.name) && !MALE.test(v.name)) ?? vs.find((v) => !MALE.test(v.name)) ?? vs[0] ?? null;
  return webVoice;
};

let stopFlag = 0;
export const stopSpeaking = () => {
  stopFlag++;
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  if (nativeTTS()) void import("@capacitor-community/text-to-speech").then((m) => m.TextToSpeech.stop()).catch(() => undefined);
};

const clean = (t: string) => t.replace(/```[\s\S]*?```/g, " ").replace(/\[\[ACTION:[\s\S]*?\]\]/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/[#*_`~>\[\]()]/g, "").replace(/\s+/g, " ").trim();
const chunks = (t: string) => t.match(/[^.!?\n]+[.!?]*/g)?.map((x) => x.trim()).filter(Boolean) ?? [t];

/** Speaks `text` in a woman's voice. Resolves when finished (or immediately if no voice is available). */
export async function speakAurora(text: string, onStart?: () => void): Promise<void> {
  const say = clean(text); if (!say) return;
  const mine = ++stopFlag;
  if (nativeTTS()) {
    try {
      const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
      let voice: number | undefined;
      try {
        const { voices } = await TextToSpeech.getSupportedVoices();
        const en = voices.map((v, i) => ({ v, i })).filter((x) => /^en/i.test(x.v.lang));
        voice = (en.find((x) => FEMALE.test(x.v.name) && !MALE.test(x.v.name)) ?? en.find((x) => !MALE.test(x.v.name)))?.i;
      } catch { /* default voice */ }
      onStart?.();
      for (const c of chunks(say)) { if (mine !== stopFlag) return; await TextToSpeech.speak({ text: c, lang: "en-US", rate: 1, pitch: 1.12, volume: 1, category: "ambient", ...(voice !== undefined ? { voice } : {}) }); }
      return;
    } catch { /* fall through to the web voice */ }
  }
  const s = window.speechSynthesis; if (!s) return;
  const v = await pickWebVoice();
  s.cancel();
  for (const c of chunks(say)) {
    if (mine !== stopFlag) return;
    await new Promise<void>((done) => {
      const u = new SpeechSynthesisUtterance(c);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
      u.rate = 1; u.pitch = 1.12; u.volume = 1;
      let started = false;
      u.onstart = () => { if (!started) { started = true; onStart?.(); } };
      u.onend = () => done(); u.onerror = () => done();
      s.speak(u);
      // some engines never fire events: don't hang the conversation
      setTimeout(() => { if (!started) { started = true; onStart?.(); } }, 800);
      setTimeout(done, 20000);
    });
  }
}

/* ---------------- ears ---------------- */
export interface Listener { stop: () => void }
export interface ListenOpts {
  onPartial?: (t: string) => void;
  onFinal: (t: string) => void;
  onEnd?: () => void;
  onError?: (code: string) => void;
  continuous?: boolean;
}

/** Starts one recognition run. Always call the returned stop() when done. */
export async function listen(o: ListenOpts): Promise<Listener> {
  if (native() && !nativeSR() && !webSR()) { o.onError?.("update-app"); o.onEnd?.(); return { stop() {} }; }
  if (nativeSR()) {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    try {
      const perm = await SpeechRecognition.requestPermissions();
      if (perm.speechRecognition !== "granted") { o.onError?.("not-allowed"); o.onEnd?.(); return { stop() {} }; }
    } catch { o.onError?.("not-allowed"); o.onEnd?.(); return { stop() {} }; }
    let last = ""; let ended = false;
    const finish = async () => {
      if (ended) return; ended = true;
      await SpeechRecognition.removeAllListeners().catch(() => undefined);
      if (last.trim()) o.onFinal(last.trim());
      o.onEnd?.();
    };
    await SpeechRecognition.addListener("partialResults", (d: { matches?: string[] }) => { last = d.matches?.[0] ?? last; o.onPartial?.(last); });
    await SpeechRecognition.addListener("listeningState", (d: { status: string }) => { if (d.status === "stopped") void finish(); });
    try { await SpeechRecognition.start({ language: "en-US", maxResults: 1, partialResults: true, popup: false }); }
    catch { o.onError?.("start-failed"); void finish(); }
    return { stop: () => { void SpeechRecognition.stop().catch(() => undefined); void finish(); } };
  }
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) { o.onError?.("unsupported"); o.onEnd?.(); return { stop() {} }; }
  const rec = new SR();
  rec.continuous = !!o.continuous; rec.interimResults = true; rec.lang = "en-US";
  rec.onresult = (e: any) => {
    let interim = "", fin = "";
    for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += r[0].transcript; else interim += r[0].transcript; }
    if (interim || fin) o.onPartial?.((fin || interim).trim());
    if (fin.trim()) o.onFinal(fin.trim());
  };
  rec.onerror = (e: any) => o.onError?.(e?.error ?? "error");
  rec.onend = () => o.onEnd?.();
  try { rec.start(); } catch { o.onError?.("start-failed"); }
  return { stop: () => { try { rec.abort(); } catch { /* ignore */ } } };
}

export const WAKE = /\b(?:hey|hi|hello|ok|okay|yo)[ ,]*(?:aurora|aurora's|a rora|arora|laura)\b/i;
