import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { useNavigate } from "react-router-dom";
import { Download, ExternalLink, ArrowRight, Film, MessageCircle, Wallet, Music2, Video } from "lucide-react";
import PrimeLogo from "@/components/PrimeLogo";
import AndroidDownloadCard, { ANDROID_APK_URL, PRIMEGRAM_ISA_DEV_URL } from "@/components/AndroidDownloadCard";

const WelcomePage = () => {
  const navigate = useNavigate();
  const [tagIdx, setTagIdx] = useState(0);
  const tags = ["Share your world.", "Create. Earn. Connect.", "Reels, chats & live calls.", "Your money, your wallet."];
  const go = () => navigate("/auth", { replace: true });
  useEffect(() => {
    const t = setTimeout(go, 6500);
    const r = setInterval(() => setTagIdx(i => (i + 1) % tags.length), 1600);
    return () => { clearTimeout(t); clearInterval(r); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const chips = [
    { icon: Film, label: "Reels" }, { icon: MessageCircle, label: "Chat" }, { icon: Video, label: "Live calls" },
    { icon: Music2, label: "Music" }, { icon: Wallet, label: "Wallet" },
  ];

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 45%, hsl(var(--primary) / 0.25), transparent 55%)" }} />
      {[
        { c: "rgba(239,68,68,0.35)", x: ["-20%", "10%", "-20%"], y: ["-10%", "15%", "-10%"], pos: "left-[-15%] top-[-10%]" },
        { c: "rgba(59,130,246,0.32)", x: ["10%", "-15%", "10%"], y: ["10%", "-10%", "10%"], pos: "right-[-20%] top-[20%]" },
        { c: "rgba(34,197,94,0.28)", x: ["0%", "12%", "0%"], y: ["10%", "-12%", "10%"], pos: "left-[10%] bottom-[-20%]" },
      ].map((b, i) => (
        <motion.div key={i} aria-hidden className={`pointer-events-none absolute h-[22rem] w-[22rem] rounded-full blur-3xl ${b.pos}`} style={{ background: b.c }} animate={{ x: b.x, y: b.y }} transition={{ duration: 9 + i * 2, repeat: Infinity, ease: "easeInOut" }} />
      ))}
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.span key={i} aria-hidden className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-white/60"
          style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` }}
          animate={{ y: [0, -30, 0], opacity: [0.15, 0.8, 0.15] }}
          transition={{ duration: 3 + (i % 5), repeat: Infinity, delay: i * 0.25 }} />
      ))}
      {!Capacitor.isNativePlatform() && (
        <a
          href={ANDROID_APK_URL}
          download
          aria-label="Download Primegram Extreme Android app"
          className="liquid-glass depth-press absolute right-5 top-5 z-20 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/30 text-emerald-200 shadow-[0_0_24px_hsl(145_70%_50%/0.18)] transition hover:scale-105 hover:text-emerald-100"
        >
          <Download className="h-5 w-5" />
        </a>
      )}
      <a
        href={PRIMEGRAM_ISA_DEV_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Open Primegram Extreme web app"
        className="liquid-glass depth-press absolute left-5 top-5 z-20 inline-flex h-12 items-center gap-2 rounded-2xl border border-cyan-300/30 px-3 text-[10px] font-semibold text-cyan-100 shadow-[0_0_24px_hsl(190_70%_50%/0.18)] transition hover:scale-105 hover:text-cyan-50"
      >
        <span className="hidden sm:inline">Open web app</span><ExternalLink className="h-4 w-4" />
      </a>
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} className="relative">
        <motion.div className="absolute -inset-8 rounded-full border border-primary/40" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 6, ease: "linear" }} />
        <PrimeLogo size={96} />
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="relative z-10 mt-10 text-3xl font-black tracking-[0.3em] bg-gradient-to-r from-red-400 via-violet-400 to-green-400 bg-clip-text text-transparent">PRIMEGRAM</motion.h1>
      <div className="mt-4 h-6 relative z-10">
        <motion.p key={tagIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-medium text-foreground/80">{tags[tagIdx]}</motion.p>
      </div>
      <div className="relative z-10 mt-5 flex flex-wrap justify-center gap-2 px-6">
        {chips.map((c, i) => (
          <motion.span key={c.label} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 + i * 0.1 }}
            className="liquid-glass-subtle inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-foreground/90">
            <c.icon className="h-3.5 w-3.5 text-primary" />{c.label}
          </motion.span>
        ))}
      </div>
      <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} onClick={go}
        className="depth-press relative z-10 mt-8 inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold text-white shadow-lg"
        style={{ background: "linear-gradient(135deg,#ef4444,#7c4dff 55%,#22c55e)", boxShadow: "0 8px 28px rgba(124,77,255,0.5)" }}>
        Get started <ArrowRight className="h-4 w-4" />
      </motion.button>
      <div className="relative z-10 mt-5 h-1 w-40 rounded-full bg-secondary overflow-hidden">
        <motion.div className="h-full bg-primary" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 6.4, ease: "linear" }} />
      </div>
      <div className="relative z-10 mt-6 w-[min(92vw,26rem)]"><AndroidDownloadCard compact /></div>
      <p className="absolute bottom-8 text-xs text-muted-foreground">Created by Java Prime · Sponsored by JP7 ULTRA</p>
    </div>
  );
};

export default WelcomePage;
