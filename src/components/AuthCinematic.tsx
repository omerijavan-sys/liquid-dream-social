import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Cinematic auth intro: the supercar arrives, the man steps out,
 * opens his bag, and a light burst reveals the credential form.
 */

const FRAMES = [
  { src: "/images/auth-intro-arrive.png", alt: "A green supercar pulls up to a hotel at night" },
  { src: "/images/auth-intro-exit-standing.png", alt: "A man steps out of the supercar with his leather bag" },
  { src: "/images/auth-intro-bag.png", alt: "A man kneels and opens his leather bag, light glowing from inside" },
] as const;

const FRAME_DURATION_MS = 2000;
const BURST_AT_MS = 6000;
const FINISH_AT_MS = 7000;

interface Props {
  onDone: () => void;
}

const AuthCinematic = ({ onDone }: Props) => {
  const [frameIndex, setFrameIndex] = useState(0);
  const [bursting, setBursting] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      onDone();
      return;
    }
    const timers = [
      setTimeout(() => setFrameIndex(1), FRAME_DURATION_MS),
      setTimeout(() => setFrameIndex(2), FRAME_DURATION_MS * 2),
      setTimeout(() => setBursting(true), BURST_AT_MS),
      setTimeout(onDone, FINISH_AT_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-hidden bg-black"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <AnimatePresence initial={false}>
        <motion.img
          key={FRAMES[frameIndex].src}
          src={FRAMES[frameIndex].src}
          alt={FRAMES[frameIndex].alt}
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </AnimatePresence>

      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 50%, transparent 55%, hsla(0,0%,0%,0.75) 100%)" }}
      />

      <AnimatePresence>
        {bursting && (
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: 180,
              height: 180,
              marginLeft: -90,
              marginTop: -90,
              background:
                "radial-gradient(circle, hsla(0,0%,100%,0.98) 0%, hsla(46,95%,70%,0.55) 45%, transparent 72%)",
            }}
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: 22, opacity: [0, 1, 1] }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={onDone}
        className="absolute bottom-6 right-6 z-10 rounded-full liquid-glass px-4 py-2 text-xs font-semibold text-foreground"
      >
        Skip intro
      </button>
    </motion.div>
  );
};

export default AuthCinematic;
