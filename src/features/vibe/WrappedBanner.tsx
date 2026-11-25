import { lazy, Suspense, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { glass } from "../shared/ui";
import { trackEvent } from "@/utils/telemetry";

const WeeklyWrapped = lazy(() => import("./WeeklyWrapped"));

/** ISO-ish week key, so the banner shows once per week and only on weekends (Sat to Mon). */
const weekKey = (d: Date) => { const t = new Date(d); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
const KEY = "primegram:wrappedSeen";
const safe = <T,>(f: () => T, fallback: T): T => { try { return f(); } catch { return fallback; } };

const WrappedBanner = () => {
  const now = new Date();
  const weekend = [6, 0, 1].includes(now.getDay());
  const wk = weekKey(now);
  const [hidden, setHidden] = useState(() => safe(() => localStorage.getItem(KEY) === wk, false));
  const [open, setOpen] = useState(false);
  if (!weekend || hidden) return null;
  const dismiss = () => { safe(() => localStorage.setItem(KEY, wk), undefined); setHidden(true); };
  return (
    <>
      <div className={`${glass} mx-4 mb-3 flex items-center gap-3 rounded-2xl p-3`}>
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => { trackEvent("wrapped_banner_tap"); setOpen(true); }}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"><CalendarDays className="h-5 w-5" /></span>
          <span className="min-w-0"><span className="block text-sm font-bold">Your week on Primegram is ready</span><span className="block text-xs text-muted-foreground">See your likes, fans and streak, then share it</span></span>
        </button>
        <button aria-label="Dismiss" onClick={dismiss} className="rounded-full p-1.5 text-muted-foreground"><X className="h-4 w-4" /></button>
      </div>
      {open && <Suspense fallback={null}><WeeklyWrapped onClose={() => { setOpen(false); dismiss(); }} /></Suspense>}
    </>
  );
};
export default WrappedBanner;
