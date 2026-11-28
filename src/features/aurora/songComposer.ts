/** Composes and renders a short original song in the browser (no paid service): an AI-written spec -> synthesised track. */

export type SongSpec = {
  title: string; lyrics: string; bpm: number; key: string; mode: "major" | "minor";
  style: "afrobeat" | "pop" | "lofi" | "trap" | "rnb" | "gospel" | "dance"; progression: number[];
};

const KEYS: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const STYLES = ["afrobeat", "pop", "lofi", "trap", "rnb", "gospel", "dance"] as const;

/** Reads the AI's JSON reply into a safe, complete spec (the model may add text around it or omit fields). */
export function parseSongSpec(raw: string, fallbackTitle: string): SongSpec {
  let o: Record<string, unknown> = {};
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { o = JSON.parse(m[0]); } catch { /* use defaults */ } }
  const style = STYLES.includes(String(o.style).toLowerCase() as never) ? (String(o.style).toLowerCase() as SongSpec["style"]) : "pop";
  const prog = Array.isArray(o.progression) ? o.progression.map(Number).filter((n) => n >= 1 && n <= 7).slice(0, 8) : [];
  const defaultBpm = { afrobeat: 104, pop: 112, lofi: 78, trap: 140, rnb: 90, gospel: 96, dance: 124 }[style];
  return {
    title: String(o.title || fallbackTitle || "Untitled").slice(0, 60),
    lyrics: String(o.lyrics || "").slice(0, 2500),
    bpm: Math.min(160, Math.max(65, Math.round(Number(o.bpm) || defaultBpm))),
    key: KEYS[String(o.key)] !== undefined ? String(o.key) : "C",
    mode: String(o.mode).toLowerCase() === "minor" ? "minor" : "major",
    style, progression: prog.length >= 3 ? prog : [1, 5, 6, 4],
  };
}

const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// 16-step drum patterns per style
const DRUMS: Record<SongSpec["style"], { k: number[]; s: number[]; h: number[]; swing: number }> = {
  afrobeat: { k: [0, 6, 10], s: [4, 12], h: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15], swing: 0.0 },
  pop: { k: [0, 4, 8, 12], s: [4, 12], h: [2, 6, 10, 14], swing: 0 },
  lofi: { k: [0, 7, 10], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], swing: 0.12 },
  trap: { k: [0, 3, 10], s: [8], h: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], swing: 0 },
  rnb: { k: [0, 7, 11], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], swing: 0.08 },
  gospel: { k: [0, 8], s: [4, 12], h: [0, 4, 8, 12], swing: 0.1 },
  dance: { k: [0, 4, 8, 12], s: [4, 12], h: [2, 6, 10, 14], swing: 0 },
};

export const songDuration = (s: SongSpec) => Math.min(90, (24 * 4 * 60) / s.bpm);

/** Renders the song to an AudioBuffer (offline, faster than real time). */
export async function renderSong(spec: SongSpec, sampleRate = 44100): Promise<AudioBuffer> {
  const dur = songDuration(spec);
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * sampleRate), sampleRate);
  const rand = rng(hash(spec.title + spec.style + spec.bpm));
  const beat = 60 / spec.bpm, step = beat / 4, bar = beat * 4;
  const root = 48 + KEYS[spec.key]; // C3 area
  const scale = SCALES[spec.mode];
  const degreeNote = (deg: number, oct = 0) => root + scale[(deg - 1) % 7] + 12 * (Math.floor((deg - 1) / 7) + oct);
  const master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.connect(master);
  const d = DRUMS[spec.style];

  // noise buffer for snare / hats
  const nb = ctx.createBuffer(1, sampleRate, sampleRate); const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = rand() * 2 - 1;
  const noise = (t: number, len: number, freq: number, type: BiquadFilterType, vol: number) => {
    const src = ctx.createBufferSource(); src.buffer = nb; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(comp); src.start(t, rand() * 0.5); src.stop(t + len + 0.02);
  };
  const tone = (t: number, len: number, midi: number, type: OscillatorType, vol: number, cutoff: number, attack = 0.01, pan = 0) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = mtof(midi);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(f).connect(g).connect(p).connect(comp); o.start(t); o.stop(t + len + 0.05);
  };
  const kick = (t: number) => {
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(spec.style === "trap" ? 1.1 : 0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + (spec.style === "trap" ? 0.5 : 0.28));
    o.connect(g).connect(comp); o.start(t); o.stop(t + 0.55);
  };

  const bars = Math.floor(dur / bar);
  // a two-bar melodic motif that returns, with small variations
  const motif: Array<number | null> = Array.from({ length: 16 }, (_, i) => (i % 2 === 0 || rand() < 0.35) && rand() < 0.78 ? Math.floor(rand() * 5) : null);
  let lastDeg = 3;
  for (let b = 0; b < bars; b++) {
    const chordDeg = spec.progression[b % spec.progression.length];
    const tBar = b * bar;
    const section = b < 2 ? "intro" : b >= bars - 2 ? "outro" : b % 8 >= 6 ? "break" : "main";
    // chords (pad)
    if (section !== "break" || spec.style !== "trap") {
      [0, 2, 4].forEach((k, i) => tone(tBar, bar * 0.98, degreeNote(chordDeg + k) + 12, spec.style === "lofi" || spec.style === "rnb" ? "triangle" : "sawtooth", 0.05, spec.style === "dance" ? 2400 : 1300, 0.08, (i - 1) * 0.35));
    }
    for (let s = 0; s < 16; s++) {
      const t = tBar + s * step + (s % 2 ? step * d.swing : 0);
      if (section !== "intro" || b === 1) {
        if (d.k.includes(s)) kick(t);
        if (d.s.includes(s)) { noise(t, 0.16, 1800, "bandpass", 0.5); tone(t, 0.1, 55, "triangle", 0.2, 800); }
        if (d.h.includes(s)) noise(t, spec.style === "trap" ? 0.03 : 0.05, 7000, "highpass", s % 4 === 0 ? 0.22 : 0.12);
      }
      // bass follows the kick with a few passing notes
      if ((d.k.includes(s) || (spec.style === "afrobeat" && s % 4 === 2)) && section !== "intro") {
        tone(t, step * (spec.style === "trap" ? 6 : 2.4), degreeNote(chordDeg, -1) - 12 * (spec.style === "trap" ? 1 : 0), spec.style === "trap" ? "sine" : "sawtooth", spec.style === "trap" ? 0.5 : 0.22, 420, 0.005);
      }
      // lead melody: the motif over chord tones, one bar per half of the motif
      const m = motif[(b % 2) * 8 + (s >> 1)];
      if (s % 2 === 0 && m !== null && section !== "intro" && section !== "break") {
        const chordTones = [chordDeg, chordDeg + 2, chordDeg + 4, chordDeg + 7, chordDeg + 1];
        let deg = chordTones[m]; if (Math.abs(deg - lastDeg) > 4) deg += deg > lastDeg ? -7 : 7; lastDeg = deg;
        tone(t, step * 1.8, degreeNote(deg, 1), spec.style === "dance" ? "square" : "triangle", 0.09, 3200, 0.012, 0.25);
      }
    }
  }
  return ctx.startRendering();
}

/** 16-bit stereo WAV file of an AudioBuffer. */
export function toWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); out.setUint32(4, 36 + len * ch * 2, true); w(8, "WAVE"); w(12, "fmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
  out.setUint16(22, ch, true); out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  w(36, "data"); out.setUint32(40, len * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Blob([out], { type: "audio/wav" });
}

/** AAC .m4a (about 10x smaller than WAV) when the browser can encode it; otherwise the WAV. */
export async function encodeSong(buf: AudioBuffer): Promise<{ blob: Blob; ext: string }> {
  try {
    if (typeof AudioEncoder === "undefined") throw new Error("no AudioEncoder");
    const { Output, Mp4OutputFormat, BufferTarget, AudioBufferSource } = await import("mediabunny");
    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
    const source = new AudioBufferSource({ codec: "aac", bitrate: 160_000 });
    output.addAudioTrack(source);
    await output.start();
    await source.add(buf);
    source.close();
    await output.finalize();
    const data = (output.target as InstanceType<typeof BufferTarget>).buffer;
    if (data && data.byteLength > 0) return { blob: new Blob([data], { type: "audio/mp4" }), ext: "m4a" };
  } catch { /* fall back to WAV */ }
  return { blob: toWav(buf), ext: "wav" };
}
