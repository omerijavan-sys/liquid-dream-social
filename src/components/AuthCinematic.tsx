import { useEffect } from "react";
import { motion } from "framer-motion";

/**
 * Sign-in intro: the Primegram X logo blooms out of the dark, the tagline lands, then the form is revealed.
 * Short on purpose (about 2.6s) and always skippable.
 */
const FINISH_AT_MS = 2800;

interface Props { onDone: () => void }

const AuthCinematic = ({ onDone }: Props) => {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onDone(); return; }
    const t = setTimeout(onDone, FINISH_AT_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#07060f]" exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
      <motion.div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[120vmax] w-[120vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(168,85,247,.34) 0%, rgba(236,72,153,.14) 30%, transparent 60%)" }}
        initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }} />
      <motion.div aria-hidden="true" className="absolute z-0 h-40 w-40 rounded-full bg-violet-500/60 blur-[60px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 1 }} />
      <motion.img src="/icons/x-logo.png" alt="Primegram X" width={132} height={132}
        className="relative z-10 h-32 w-32 rounded-[2rem]"
        initial={{ scale: 0.5, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 140, damping: 14, delay: 0.1 }} />
      <motion.p className="relative z-10 mt-6 text-sm font-black tracking-[0.35em] text-white" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.6 }}>
        PRIMEGRAM <span className="text-fuchsia-400">X</span>
      </motion.p>
      <motion.p className="relative z-10 mt-3 text-base font-semibold text-white/80" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.6 }}>
        Post. Go live. Get paid.
      </motion.p>
      <button type="button" onClick={onDone} className="absolute bottom-8 right-6 z-10 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white">Skip intro</button>
    </motion.div>
  );
};

export default AuthCinematic;
