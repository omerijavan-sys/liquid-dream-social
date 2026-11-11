import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Plus, Search, Sparkles, Layers, Music, Trophy, Gamepad2, Film, X, Video, Eye, EyeOff } from "lucide-react";
import OnlineCalls from "./OnlineCalls";
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
  const [callsOpen, setCallsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(() => localStorage.getItem("primegram:floatingActionsHidden") === "true");
  const [PrimeAI, setPrimeAI] = useState<React.ComponentType<any> | null>(null);
  const navigate = useNavigate();

  const openAI = useCallback(async () => {
    if (!PrimeAI) {
      const mod = await import("./PrimeAIChat");
      setPrimeAI(() => mod.default);
    }
    setAiOpen(true);
    setMenuOpen(false);
    setHubOpen(false);
  }, [PrimeAI]);

  useEffect(() => {
    const handleOpenAssistant = () => { void openAI(); };
    window.addEventListener("prime:openOrb", handleOpenAssistant);
    return () => window.removeEventListener("prime:openOrb", handleOpenAssistant);
  }, [openAI]);

  const actions = [
    { label: "Create post", icon: Plus, run: () => navigate("/create"), position: [0.76, 0.72] },
    { label: "Open chat", icon: MessageCircle, run: () => navigate("/messages"), position: [0.28, 0.76] },
    { label: "Quick search", icon: Search, run: () => navigate("/search"), position: [0.14, 0.5] },
    { label: "AI assistant", icon: Sparkles, run: () => { void openAI(); }, position: [0.32, 0.25] },
    { label: "Online calls", icon: Video, run: () => setCallsOpen(true), position: [0.7, 0.25] },
    { label: "Prime Hub", icon: Layers, run: () => setHubOpen(true), position: [0.88, 0.48] },
    { label: "Hide floating actions", icon: EyeOff, run: () => {
      localStorage.setItem("primegram:floatingActionsHidden", "true");
      setHidden(true);
      setMenuOpen(false);
    }, position: [0.52, 0.55] },
  ];
  const originX = window.innerWidth - 44;
  const originY = window.innerHeight - 96;

  return (
    <>
      {hidden ? (
        <button
          type="button"
          aria-label="Show floating actions"
          title="Show floating actions"
          onClick={() => {
            localStorage.setItem("primegram:floatingActionsHidden", "false");
            setHidden(false);
          }}
          className="fixed bottom-24 right-4 z-[55] flex h-11 w-11 items-center justify-center rounded-full liquid-glass-elevated text-foreground shadow-lg"
        >
          <Eye className="h-5 w-5" />
        </button>
      ) : (
      <>
        <AnimatePresence>
          {menuOpen && (
            <motion.button
              type="button"
              aria-label="Close quick actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-[54] bg-background/20 backdrop-blur-[2px]"
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {menuOpen && actions.map((action, index) => {
            const targetX = Math.max(40, Math.min(window.innerWidth - 40, window.innerWidth * action.position[0]));
            const targetY = Math.max(84, Math.min(window.innerHeight - 110, window.innerHeight * action.position[1]));
            return (
              <motion.button
                key={action.label}
                type="button"
                aria-label={action.label}
                title={action.label}
                initial={{ opacity: 0, scale: 0.35, x: originX - targetX, y: originY - targetY }}
                animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, scale: 0.35, x: originX - targetX, y: originY - targetY }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: index * 0.035 }}
                onClick={() => { setMenuOpen(false); action.run(); }}
                style={{ left: targetX, top: targetY, translate: "-50% -50%" }}
                className="depth-press fixed z-[56] flex h-14 w-14 items-center justify-center rounded-full liquid-glass-elevated text-primary shadow-xl"
              >
                <action.icon className="h-5 w-5" />
                <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-background/90 px-2 py-1 text-[10px] font-medium text-foreground shadow">
                  {action.label}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      <div className="fixed bottom-24 right-4 z-[60]">
        <motion.button
          type="button"
          aria-label={menuOpen ? "Close quick actions" : "Open quick actions"}
          aria-expanded={menuOpen}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setMenuOpen((open) => !open)}
          className="depth-press flex h-14 w-14 items-center justify-center rounded-full liquid-glass-elevated text-primary shadow-lg"
          style={{ boxShadow: "0 4px 24px hsla(280, 80%, 60%, 0.38)" }}
        >
          <motion.span animate={{ rotate: menuOpen ? 45 : 0 }} className="flex">
            {menuOpen
              ? <X className="h-6 w-6" />
              : <Plus className="h-6 w-6" />}
          </motion.span>
        </motion.button>
      </div>
      </>
      )}

      <PrimeHubPanel open={hubOpen} onClose={() => setHubOpen(false)} />
      <OnlineCalls open={callsOpen} onClose={() => setCallsOpen(false)} />
      {PrimeAI && <PrimeAI open={aiOpen} onClose={() => setAiOpen(false)} />}
    </>
  );
};

export default FloatingActions;
