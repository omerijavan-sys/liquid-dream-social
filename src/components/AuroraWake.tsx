import { useEffect, useRef } from "react";
import { listen, canListen, WAKE, type Listener } from "@/lib/auroraSpeech";

export const WAKE_KEY = "aurora_wake";
export const wakeEnabled = () => { try { return localStorage.getItem(WAKE_KEY) === "1"; } catch { return false; } };
export const setWakeEnabled = (v: boolean) => { try { localStorage.setItem(WAKE_KEY, v ? "1" : "0"); } catch { /* ignore */ } window.dispatchEvent(new Event("aurora:wake-toggle")); };

/**
 * "Hey Aurora": while switched on and the app is on screen, listens for the wake phrase and opens Aurora.
 * Anything said after the phrase ("hey Aurora, open music") is handed to Aurora as the first command.
 */
const AuroraWake = () => {
  const cur = useRef<Listener | null>(null);
  const overlay = useRef(false);
  const alive = useRef(true);
  const timer = useRef<number>();

  useEffect(() => {
    alive.current = true;
    const stop = () => { try { cur.current?.stop(); } catch { /* ignore */ } cur.current = null; clearTimeout(timer.current); };
    const wanted = () => alive.current && wakeEnabled() && !overlay.current && document.visibilityState === "visible" && canListen();
    let fails = 0;

    const run = () => {
      stop();
      if (!wanted()) return;
      let heard = false;
      const hit = (t: string) => {
        const m = WAKE.exec(t); if (!m || heard) return;
        heard = true;
        (window as unknown as { __auroraWake?: string }).__auroraWake = t.slice(m.index + m[0].length).replace(/^[\s,.!?]+/, "").trim();
        stop(); overlay.current = true;
        window.dispatchEvent(new Event("prime:openOrb"));
      };
      void listen({
        continuous: true,
        onPartial: hit, onFinal: hit,
        onError: (e) => { if (e === "not-allowed" || e === "service-not-allowed") { fails = 99; } },
        onEnd: () => {
          if (heard) return;
          fails++;
          timer.current = window.setTimeout(run, Math.min(5000, 400 * fails));
        },
      }).then((l) => { cur.current = l; fails = Math.max(0, fails - 1); });
    };

    const refresh = () => { if (wanted() && fails < 99) run(); else stop(); };
    const onOverlay = (e: Event) => { overlay.current = !!(e as CustomEvent).detail; if (!overlay.current) setTimeout(refresh, 800); else stop(); };
    window.addEventListener("aurora:wake-toggle", refresh);
    window.addEventListener("aurora:overlay", onOverlay);
    document.addEventListener("visibilitychange", refresh);
    refresh();
    return () => { alive.current = false; stop(); window.removeEventListener("aurora:wake-toggle", refresh); window.removeEventListener("aurora:overlay", onOverlay); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return null;
};
export default AuroraWake;
