import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Download, X } from "lucide-react";

const APK = "/primegram.apk";
let shownThisLoad = false; // once per page load, not on every route change

/** Website only: every time someone opens Primegram in a browser, invite them to get the Android app. */
const DownloadAppPrompt = () => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (shownThisLoad || Capacitor.isNativePlatform()) return;
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return; // the Android app can't be installed on iPhones
    if (window.matchMedia?.("(display-mode: standalone)").matches) return; // already installed as an app
    const t = setTimeout(() => { shownThisLoad = true; setOpen(true); }, 2500);
    return () => clearTimeout(t);
  }, []);
  if (!open) return null;
  return (
    <div role="dialog" aria-label="Download the Primegram app" className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[90] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-black/85 p-3 text-white shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-4">
      <img src="/favicon.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Download the app</p>
        <p className="text-xs text-white/65">For a better experience: faster, with call and message alerts.</p>
      </div>
      <a href={APK} download="primegram.apk" onClick={() => setOpen(false)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-400 px-3.5 py-2 text-xs font-bold text-black"><Download className="h-3.5 w-3.5" />Download</a>
      <button onClick={() => setOpen(false)} aria-label="Dismiss" className="shrink-0 p-1 text-white/60"><X className="h-4 w-4" /></button>
    </div>
  );
};
export default DownloadAppPrompt;
