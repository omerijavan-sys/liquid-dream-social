import { glow } from "../shared/ui";
import type { Ring } from "./aesthetics";

const GRADS: Record<Exclude<Ring, "none" | "pulse">, string> = {
  spin: "conic-gradient(from 0deg,var(--ac),transparent 40%,var(--ac))",
  aurora: "conic-gradient(from 0deg,#22d3ee,#a78bfa,#f472b6,#fbbf24,#22d3ee)",
  founder: "conic-gradient(from 0deg,#fde68a,#b45309,#fbbf24,#fff7d6,#b45309,#fde68a)",
};
const CSS = `@keyframes pg-spin{to{transform:rotate(360deg)}}@keyframes pg-pulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}@media (prefers-reduced-motion:reduce){.pg-ring *{animation:none!important}}`;

/** Animated avatar ring. Children is the avatar itself (it should fill its box). */
const AvatarRing = ({ ring, accent, size = 64, children }: { ring: Ring; accent: string; size?: number; children: React.ReactNode }) => {
  const pad = ring === "none" ? 0 : 3;
  return (
    <div className="pg-ring relative shrink-0 rounded-full" style={{ width: size + pad * 2, height: size + pad * 2, ["--ac" as string]: accent }}>
      <style>{CSS}</style>
      {ring === "pulse" && <span className="absolute inset-0 rounded-full" style={{ boxShadow: glow(accent, 0.9, 22), border: `2px solid ${accent}`, animation: "pg-pulse 1.8s ease-in-out infinite" }} />}
      {ring !== "none" && ring !== "pulse" && (
        <span className="absolute inset-0 overflow-hidden rounded-full" style={{ boxShadow: glow(ring === "founder" ? "#fbbf24" : accent, 0.55, 20) }}>
          <span className="absolute left-1/2 top-1/2 block" style={{ width: "150%", height: "150%", margin: "-75% 0 0 -75%", background: GRADS[ring], animation: `pg-spin ${ring === "aurora" ? 6 : 3}s linear infinite` }} />
        </span>
      )}
      <div className="absolute overflow-hidden rounded-full bg-[#09090B]" style={{ inset: pad, }}>{children}</div>
    </div>
  );
};
export default AvatarRing;
