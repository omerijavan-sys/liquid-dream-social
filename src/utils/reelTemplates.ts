import { FILTERS } from "@/utils/filters";

const css = (name: string) => FILTERS.find((f) => f.name === name)?.css ?? "none";

export interface ReelTemplate {
  id: string; name: string; emoji: string; blurb: string;
  filter: string; bright: number; contrast: number; sat: number;
  secs: number;       // seconds per photo
  musicVol: number;   // 0–1
  videoVol: number;   // 0–1
  clipLen: number;    // music clip length, seconds
  gradient: string;
}

/** One-tap looks: colour grade + photo pacing + sound mix. They only fill in the editor controls, which stay editable. */
export const REEL_TEMPLATES: ReelTemplate[] = [
  { id: "cinema", name: "Cinematic", emoji: "🎬", blurb: "Rich contrast, slow pace", filter: css("Clarendon"), bright: 0.95, contrast: 1.15, sat: 1.05, secs: 4, musicVol: 0.8, videoVol: 0.6, clipLen: 30, gradient: "from-amber-700 to-slate-900" },
  { id: "beat", name: "Beat Drop", emoji: "🥁", blurb: "Fast cuts, loud music", filter: css("Vivid"), bright: 1.05, contrast: 1.1, sat: 1.3, secs: 1, musicVol: 1, videoVol: 0.15, clipLen: 15, gradient: "from-fuchsia-600 to-rose-600" },
  { id: "neon", name: "Neon Night", emoji: "🌃", blurb: "Electric colours", filter: css("Neon"), bright: 0.95, contrast: 1.2, sat: 1.5, secs: 2, musicVol: 0.9, videoVol: 0.4, clipLen: 20, gradient: "from-cyan-500 to-purple-700" },
  { id: "vhs", name: "Retro VHS", emoji: "📼", blurb: "Warm, faded, nostalgic", filter: css("Retro"), bright: 1.05, contrast: 0.95, sat: 1.1, secs: 2.5, musicVol: 0.85, videoVol: 0.5, clipLen: 20, gradient: "from-orange-600 to-yellow-700" },
  { id: "noir", name: "Noir", emoji: "🖤", blurb: "Black & white drama", filter: css("Noir"), bright: 0.95, contrast: 1.25, sat: 0, secs: 3.5, musicVol: 0.75, videoVol: 0.7, clipLen: 25, gradient: "from-zinc-600 to-black" },
  { id: "dream", name: "Dreamy", emoji: "☁️", blurb: "Soft glow, gentle pace", filter: css("Dream"), bright: 1.1, contrast: 0.9, sat: 1.2, secs: 4, musicVol: 0.7, videoVol: 0.3, clipLen: 30, gradient: "from-pink-400 to-indigo-500" },
  { id: "summer", name: "Golden Hour", emoji: "🌅", blurb: "Warm summer tones", filter: css("Warm"), bright: 1.08, contrast: 1.05, sat: 1.25, secs: 3, musicVol: 0.85, videoVol: 0.5, clipLen: 20, gradient: "from-orange-400 to-rose-500" },
  { id: "talk", name: "Voice First", emoji: "🎙️", blurb: "Your voice loud, music low", filter: css("Lark"), bright: 1.02, contrast: 1.05, sat: 1.05, secs: 3, musicVol: 0.2, videoVol: 1, clipLen: 30, gradient: "from-emerald-500 to-teal-700" },
  { id: "clean", name: "Clean", emoji: "✨", blurb: "Reset to original", filter: "none", bright: 1, contrast: 1, sat: 1, secs: 3, musicVol: 1, videoVol: 1, clipLen: 15, gradient: "from-slate-500 to-slate-700" },
];
