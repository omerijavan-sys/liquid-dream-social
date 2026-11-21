import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Download, X } from "lucide-react";
import { openLink } from "@/utils/openLink";

const RELEASES = "https://api.github.com/repos/omerijavan-sys/liquid-dream-social/releases?per_page=1";
const INSTALLED = Number(import.meta.env.VITE_APP_BUILD || 0);

/** Android app only: checks for a newer APK and shows an update icon when one is available. */
const UpdateChecker = () => {
  const [update, setUpdate] = useState<{ build: number; url: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  const check = useCallback(async () => {
    try {
      const r = await fetch(RELEASES, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (!r.ok) return;
      const rel = (await r.json())?.[0];
      const build = Number(String(rel?.tag_name ?? "").replace(/\D/g, ""));
      const asset = (rel?.assets ?? []).find((a: { name: string }) => a.name.endsWith(".apk"));
      if (build > INSTALLED && asset?.browser_download_url) setUpdate({ build, url: asset.browser_download_url });
    } catch { /* offline: try again next time */ }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void check();
    const h = CapApp.addListener("appStateChange", ({ isActive }) => { if (isActive) void check(); });
    return () => { void h.then(x => x.remove()); };
  }, [check]);

  if (!update || hidden) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Update available"
        className="fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[90] flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-black shadow-[0_0_18px_rgba(52,211,153,.7)] active:scale-90"
      >
        <Download className="h-5 w-5 animate-bounce" />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-black bg-red-500" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-t-3xl border border-white/15 bg-black/80 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white backdrop-blur-2xl">
            <div className="flex items-center justify-between"><p className="text-lg font-bold">New version available</p><button onClick={() => setOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button></div>
            <p className="text-sm text-white/70">A newer Primegram is ready. Tap Update, open the downloaded file and tap Install — your account and data stay as they are.</p>
            <button onClick={() => { openLink(update.url); setOpen(false); }} className="w-full rounded-2xl bg-emerald-400 py-3 text-sm font-bold text-black">Update now</button>
            <button onClick={() => { setHidden(true); setOpen(false); }} className="w-full py-1 text-xs text-white/50">Later</button>
          </div>
        </div>
      )}
    </>
  );
};
export default UpdateChecker;
