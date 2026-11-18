import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Plus, Search, Sparkles, Layers, Music, Trophy, Gamepad2, Film, X, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PrimeMusicHub from "./PrimeMusicHub";

const hubItems = [
  { icon: Music, label: "Music", color: "hsl(350, 80%, 58%)", id: "music" },
  { icon: Trophy, label: "Sports", color: "hsl(210, 100%, 60%)", id: "sports" },
  { icon: Gamepad2, label: "Games", color: "hsl(280, 70%, 55%)", id: "games" },
  { icon: Film, label: "Movies", color: "hsl(40, 90%, 55%)", id: "movies" },
];

const PrimeHubPanel = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [musicOpen, setMusicOpen] = useState(false);
  const navigate = useNavigate();

  const handleClick = (id: string) => {
    if (id === "music") setMusicOpen(true);
    else if (id === "sports") { onClose(); navigate("/sports"); }
    else if (id === "games") window.open("https://poki.com", "_blank");
    else if (id === "movies") { onClose(); navigate("/movies"); }
  };

  return (
    <>
      <AnimatePresence>
        {open && !musicOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-28 right-4 z-[60] liquid-glass-elevated rounded-3xl p-5 w-56"
          >
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <span className="text-headline text-foreground text-sm">Prime Hub</span>
              </div>
              <button onClick={onClose} className="depth-press w-7 h-7 rounded-full liquid-glass-subtle flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 relative z-10">
              {hubItems.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleClick(item.id)}
                  className="depth-press liquid-glass rounded-2xl p-3 flex flex-col items-center gap-2 relative z-10"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${item.color}20` }}>
                    <item.icon className="w-5 h-5" style={{ color: item.color }} />
                  </div>
                  <span className="text-caption text-foreground">{item.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <PrimeMusicHub open={musicOpen} onClose={() => setMusicOpen(false)} />
    </>
  );
};

const FloatingActions = () => {
  const [aiOpen, setAiOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [PrimeAI, setPrimeAI] = useState<React.ComponentType<any> | null>(null);
  const openAI = useCallback(async () => {
    if (!PrimeAI) {
      const mod = await import("./PrimeAIChat");
      setPrimeAI(() => mod.default);
    }
    setAiOpen(true);
    setHubOpen(false);
  }, [PrimeAI]);

  useEffect(() => {
    const handleOpenAssistant = () => { void openAI(); };
    window.addEventListener("prime:openOrb", handleOpenAssistant);
    return () => window.removeEventListener("prime:openOrb", handleOpenAssistant);
  }, [openAI]);

  const grads: Record<string, string> = {
    "Create post": "linear-gradient(135deg,#ff6bd6,#7c4dff)",
    "Open chat": "linear-gradient(135deg,#38bdf8,#6366f1)",
    "Quick search": "linear-gradient(135deg,#34d399,#06b6d4)",
    "AI assistant": "linear-gradient(135deg,#a78bfa,#ec4899)",
    "Prime Hub": "linear-gradient(135deg,#fbbf24,#f97316)",
    "Hide floating actions": "linear-gradient(135deg,#64748b,#334155)",
  };
  return (
    <>
      <div className="fixed bottom-28 right-3 z-[60] flex flex-col items-center gap-3">
        {[
          { label: "Prime Hub", icon: Layers, run: () => setHubOpen(true), bg: "linear-gradient(135deg,#fbbf24,#f97316)", glow: "rgba(249,115,22,0.55)" },
          { label: "AI assistant", icon: Sparkles, run: () => { void openAI(); }, bg: "linear-gradient(135deg,#a78bfa,#ec4899)", glow: "rgba(167,139,250,0.55)" },
        ].map((a) => (
          <motion.button
            key={a.label}
            type="button"
            aria-label={a.label}
            title={a.label}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            animate={{ y: [0, -4, 0] }}
            transition={{ y: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}
            onClick={a.run}
            className="relative flex h-12 w-12 items-center justify-center rounded-full text-white ring-1 ring-white/40"
            style={{ background: a.bg, boxShadow: `0 8px 22px ${a.glow}, inset 0 1px 1px rgba(255,255,255,0.6)` }}
          >
            <span aria-hidden className="pointer-events-none absolute inset-x-2 top-1 h-3 rounded-full bg-white/30 blur-[2px]" />
            <a.icon className="h-5 w-5 drop-shadow" />
          </motion.button>
        ))}
      </div>

      <PrimeHubPanel open={hubOpen} onClose={() => setHubOpen(false)} />
      {PrimeAI && <PrimeAI open={aiOpen} onClose={() => setAiOpen(false)} />}
    </>
  );
};

export default FloatingActions;
