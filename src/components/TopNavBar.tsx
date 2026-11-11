import { useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { MessageCircle, Settings, Wallet, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import pLogo from "@/assets/p-logo-lux.png";

const TopNavBar = ({ homeStyle = false }: { homeStyle?: boolean }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { scrollY } = useScroll();
  const navigate = useNavigate();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const prev = scrollY.getPrevious() ?? 0;
    setCollapsed(latest > 60 && latest > prev);
  });

  const iconBtn = `depth-press flex h-8 w-8 items-center justify-center rounded-full ${homeStyle ? "border border-rose-400/20 bg-black/50 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,.12)]" : "liquid-glass-subtle"}`;

  return (
    <motion.header
      className={`fixed left-0 right-0 top-0 z-50 safe-area-top ${homeStyle ? "border-b border-rose-400/25 bg-[#070910]/90 shadow-[0_1px_18px_rgba(244,63,94,.08)] backdrop-blur-xl" : ""}`}
      animate={collapsed ? { y: -10, opacity: 0.9 } : { y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <motion.div
        className={`${homeStyle ? "mx-auto flex items-center justify-between border-b border-rose-400/20 bg-white/[0.025]" : "liquid-glass-elevated mx-auto flex items-center justify-between"}`}
        animate={collapsed ? {
          marginLeft: "1.5rem", marginRight: "1.5rem", marginTop: "0.5rem",
          borderRadius: "2rem", paddingLeft: "1rem", paddingRight: "1rem",
          paddingTop: "0.5rem", paddingBottom: "0.5rem",
        } : {
          marginLeft: "0rem", marginRight: "0rem", marginTop: "0rem",
          borderRadius: "0rem", paddingLeft: "1rem", paddingRight: "1rem",
          paddingTop: "0.625rem", paddingBottom: "0.625rem",
        }}
        layout
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
      >
        <motion.div
          className="relative z-10 flex items-center gap-2"
          animate={collapsed ? { justifyContent: "center", flex: 1 } : { justifyContent: "flex-start", flex: 0 }}
        >
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('prime:openOrb'))}
            className="depth-press flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg"
            aria-label="Open Heiji AI"
          >
            <img src={pLogo} alt="Primegram" className="w-full h-full object-contain" />
          </button>
          <motion.h1
            className={`text-headline ${homeStyle ? "text-rose-200" : "text-foreground"}`}
            animate={collapsed ? { fontSize: "0rem", width: 0, opacity: 0 } : { fontSize: "1.15rem", width: "auto", opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            Primegram
          </motion.h1>
        </motion.div>

        <motion.div
          className="relative z-10 flex items-center gap-2"
          animate={collapsed ? { opacity: 0, width: 0, overflow: "hidden" } : { opacity: 1, width: "auto" }}
        >
          <button className={iconBtn} onClick={() => navigate("/messages")} aria-label="Messages">
            <MessageCircle className={`h-4 w-4 ${homeStyle ? "text-rose-300" : "text-foreground"}`} strokeWidth={1.5} />
          </button>
          <button className={iconBtn} onClick={() => navigate("/extreme")} aria-label="Prime Extreme">
            <Rocket className="w-4 h-4 text-primary" strokeWidth={1.5} />
          </button>
          <button className={iconBtn} onClick={() => navigate("/wallet")} aria-label="Wallet">
            <Wallet className={`h-4 w-4 ${homeStyle ? "text-rose-300" : "text-foreground"}`} strokeWidth={1.5} />
          </button>
          <button className={iconBtn} onClick={() => navigate("/settings")} aria-label="Settings">
            <Settings className={`h-4 w-4 ${homeStyle ? "text-rose-300" : "text-foreground"}`} strokeWidth={1.5} />
          </button>
        </motion.div>
      </motion.div>
    </motion.header>
  );
};

export default TopNavBar;
