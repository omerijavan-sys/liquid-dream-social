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
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#07070a] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.10), transparent 60%)" }} />
      {[
        { c: "rgba(255,255,255,0.12)", x: ["-20%", "10%", "-20%"], y: ["-10%", "15%", "-10%"], pos: "left-[-15%] top-[-10%]" },
        { c: "rgba(255,255,255,0.16)", x: ["10%", "-15%", "10%"], y: ["10%", "-10%", "10%"], pos: "right-[-20%] top-[20%]" },
        { c: "rgba(200,200,215,0.14)", x: ["0%", "12%", "0%"], y: ["10%", "-12%", "10%"], pos: "left-[10%] bottom-[-20%]" },
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
          className="liquid-glass depth-press absolute right-5 top-5 z-20 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/30 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_8px_30px_rgba(0,0,0,.35)] backdrop-blur-2xl transition hover:scale-105"
        >
          <Download className="h-5 w-5" />
        </a>
      )}
      <a
        href={PRIMEGRAM_ISA_DEV_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Open Primegram Extreme web app"
        className="liquid-glass depth-press absolute left-5 top-5 z-20 inline-flex h-12 items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-3 text-[10px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_8px_30px_rgba(0,0,0,.35)] backdrop-blur-2xl transition hover:scale-105"
      >
        <span className="hidden sm:inline">Open web app</span><ExternalLink className="h-4 w-4" />
      </a>
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} className="relative">
        <motion.div className="absolute -inset-8 rounded-full border border-white/25" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 6, ease: "linear" }} />
        <PrimeLogo size={96} />
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="relative z-10 mt-10 text-3xl font-black tracking-[0.3em] bg-gradient-to-b from-white via-white/90 to-white/50 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(255,255,255,.25)]">PRIMEGRAM</motion.h1>
      <div className="mt-4 h-6 relative z-10">
        <motion.p key={tagIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-medium text-foreground/80">{tags[tagIdx]}</motion.p>
      </div>
      <div className="relative z-10 mt-5 flex flex-wrap justify-center gap-2 px-6">
        {chips.map((c, i) => (
          <motion.span key={c.label} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 + i * 0.1 }}
            className="liquid-glass-subtle inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-foreground/90">
            <c.icon className="h-3.5 w-3.5 text-white/90" />{c.label}
          </motion.span>
        ))}
      </div>
      <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} onClick={go}
        className="depth-press relative z-10 mt-8 inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/35 bg-white/15 px-8 py-3 text-sm font-bold text-white backdrop-blur-2xl"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.6), inset 0 -8px 18px rgba(255,255,255,.06), 0 10px 34px rgba(0,0,0,.45)" }}>
        Get started <ArrowRight className="h-4 w-4" />
      </motion.button>
      <div className="relative z-10 mt-5 h-1 w-40 rounded-full bg-white/15 overflow-hidden">
        <motion.div className="h-full bg-white/80" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 6.4, ease: "linear" }} />
      </div>
      <div className="relative z-10 mt-6 w-[min(92vw,26rem)]"><AndroidDownloadCard compact /></div>
      <p className="absolute bottom-8 text-xs text-muted-foreground">Created by Java Prime · Sponsored by JP7 ULTRA</p>
    </div>
  );
};

export default WelcomePage;
