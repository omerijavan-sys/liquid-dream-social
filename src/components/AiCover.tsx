import { useState } from "react";

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const GRADS = [["#7c3aed", "#22d3ee"], ["#db2777", "#fbbf24"], ["#2563eb", "#a78bfa"], ["#059669", "#60a5fa"], ["#ea580c", "#f472b6"], ["#c026d3", "#34d399"]];

/** Old-project media links are unreachable until the old project unlocks. */
export const isBrokenMedia = (url?: string | null) => !!url && url.includes("kfvoqwbfgptqrrkyhorj.supabase.co");

/**
 * An AI-generated cover for a post whose own picture/video can't load.
 * Uses the free Pollinations image service (no key); if it can't load either, a gradient with the caption is shown.
 */
const AiCover = ({ postId, caption, username }: { postId: string; caption?: string | null; username?: string }) => {
  const [failed, setFailed] = useState(false);
  const seed = hash(postId);
  const text = (caption || "").replace(/#\w+/g, "").replace(/\s+/g, " ").trim().slice(0, 140);
  const prompt = `${text || `a moment shared by ${username ?? "a friend"}`}, vibrant social media cover art, cinematic, colorful, no text`;
  const src = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=960&seed=${seed}&nologo=true`;
  const [a, b] = GRADS[seed % GRADS.length];
  return (
    <div className="relative w-full aspect-[4/5] overflow-hidden" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {!failed && <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 w-full h-full object-cover" />}
      {failed && text && <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-lg font-semibold text-white drop-shadow">{text}</p>}
    </div>
  );
};
export default AiCover;
