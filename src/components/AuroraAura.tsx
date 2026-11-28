/**
 * Aurora's aura: layered, softly spinning colour rings and a pulsing glow behind a core orb.
 * `level` (0-1) makes it swell with the voice; `state` changes its energy.
 */
const AuroraAura = ({ size = 180, level = 0, state = "idle", children }: { size?: number; level?: number; state?: "idle" | "listening" | "thinking" | "speaking"; children?: React.ReactNode }) => {
  const boost = 1 + Math.min(1, level) * 0.35 + (state === "speaking" ? 0.08 : 0);
  const speed = state === "thinking" ? 0.45 : state === "listening" ? 0.7 : 1;
  const ring = (inset: string, dur: number, rev: boolean, op: number, blur: number): React.CSSProperties => ({
    position: "absolute", inset, borderRadius: "50%",
    background: "conic-gradient(from 0deg, #22d3ee, #6366f1, #d946ef, #fb7185, #fbbf24, #34d399, #22d3ee)",
    filter: `blur(${blur}px)`, opacity: op,
    animation: `aurora-spin ${dur * speed}s linear infinite ${rev ? "reverse" : "normal"}`,
  });
  return (
    <div style={{ width: size, height: size, position: "relative" }} aria-hidden={children ? undefined : true}>
      <style>{`
        @keyframes aurora-spin { to { transform: rotate(360deg); } }
        @keyframes aurora-breathe { 0%,100% { transform: scale(1); opacity: .75 } 50% { transform: scale(1.08); opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .aurora-anim, .aurora-anim * { animation: none !important; } }
      `}</style>
      <div className="aurora-anim" style={{ position: "absolute", inset: 0, transform: `scale(${boost})`, transition: "transform .12s ease-out" }}>
        <div style={{ position: "absolute", inset: "-22%", borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,.55) 0%, rgba(34,211,238,.25) 40%, transparent 70%)", filter: "blur(18px)", animation: `aurora-breathe ${3.2 * speed}s ease-in-out infinite` }} />
        <div style={ring("-6%", 9, false, 0.55, 14)} />
        <div style={ring("4%", 6, true, 0.7, 10)} />
        <div style={ring("12%", 12, false, 0.9, 6)} />
        <div style={{ position: "absolute", inset: "18%", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #fff 0%, #c4b5fd 18%, #7c3aed 52%, #1e1b4b 100%)", boxShadow: "inset 0 0 24px rgba(255,255,255,.35), 0 0 30px rgba(124,58,237,.7)" }} />
      </div>
      {children && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>}
    </div>
  );
};
export default AuroraAura;
