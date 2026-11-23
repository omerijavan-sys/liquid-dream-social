import { useCallback, useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { ArrowUpCircle, X } from "lucide-react";
import { toast } from "sonner";
import { setAppUpdate, type AppUpdate } from "@/utils/updateStore";

type UpdatePlugin = { clearCacheAndReload(): Promise<{ ok: boolean }> };
const AppUpdate = registerPlugin<UpdatePlugin>("AppUpdate");

/** Official download page, opened in the browser only when this installed app is too old for the site (native change). */
const DOWNLOAD_PAGE = "https://primegramx.co.ke/primegram.apk";

/**
 * Android app only. The app loads the live site over HTTPS, so most updates are just "load the newest web build":
 * the Upgrade button clears the WebView cache and reloads. Nothing is downloaded or installed by the app itself.
 * If a release needs new native code (version.json says minNative > this app's build) it points to the official download page.
 */
const UpdateChecker = () => {
  const [update, setUpdate] = useState<NonNullable<AppUpdate> | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    try {
      const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) return;
      const v = (await r.json()) as { web?: string; minNative?: number };
      const info = await CapApp.getInfo();
      const nativeBuild = Number(info.build) || 0;
      let next: AppUpdate = null;
      if ((v.minNative ?? 0) > nativeBuild) next = { kind: "native", url: DOWNLOAD_PAGE };
      else if (v.web && v.web !== __WEB_BUILD__) next = { kind: "web" };
      setUpdate(next); setAppUpdate(next);
    } catch { /* offline: try again next time */ }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void check();
    const h = CapApp.addListener("appStateChange", ({ isActive }) => { if (isActive) void check(); });
    return () => { void h.then(x => x.remove()); };
  }, [check]);

  const upgrade = async () => {
    if (!update || busy) return;
    setBusy(true);
    try {
      if (update.kind === "native") { await Browser.open({ url: update.url! }); setBusy(false); return; }
      // drop service-worker caches too, then let the native side clear the WebView cache and reload over HTTPS
      try { for (const k of await caches.keys()) await caches.delete(k); } catch { /* ignore */ }
      try { for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister(); } catch { /* ignore */ }
      await AppUpdate.clearCacheAndReload();
    } catch {
      setBusy(false);
      try { window.location.reload(); } catch { toast.error("Couldn't update. Please try again."); }
    }
  };

  // The prompt pops up by itself when an update exists (once per version until the app is reopened).
  useEffect(() => {
    if (!update) return;
    const key = update.kind === "web" ? __WEB_BUILD__ : "native";
    let seen = false;
    try { seen = sessionStorage.getItem("primegram-update-seen") === key; } catch { /* ignore */ }
    if (!seen) setOpen(true);
  }, [update]);
  const dismiss = () => {
    try { if (update) sessionStorage.setItem("primegram-update-seen", update.kind === "web" ? __WEB_BUILD__ : "native"); } catch { /* ignore */ }
    setOpen(false);
  };

  useEffect(() => {
    const o = () => setOpen(true);
    window.addEventListener("prime:open-update", o);
    return () => window.removeEventListener("prime:open-update", o);
  }, []);

  if (!update) return null;
  const isNative = update.kind === "native";
  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Upgrade available" className="fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[90] flex h-10 w-10 animate-pulse items-center justify-center rounded-full bg-emerald-400 text-black shadow-[0_0_18px_rgba(52,211,153,.8)]"><ArrowUpCircle className="h-6 w-6" /></button>
      )}
      {open && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60" onClick={() => !busy && dismiss()}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-t-3xl border border-white/15 bg-black/80 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white backdrop-blur-2xl">
            <div className="flex items-center justify-between"><p className="text-lg font-bold">{isNative ? "New app version available" : "Update available"}</p>{!busy && <button onClick={dismiss} aria-label="Close"><X className="h-5 w-5" /></button>}</div>
            <p className="text-sm text-white/70">{isNative
              ? "This update needs the newest Primegram app. Tap Get the app to open our official download page."
              : "A newer Primegram is ready. Tap Update to load it now — your account and data stay as they are."}</p>
            <button disabled={busy} onClick={() => void upgrade()} className="w-full rounded-2xl bg-emerald-400 py-3 text-sm font-bold text-black disabled:opacity-60">{busy ? "Updating…" : isNative ? "Get the app" : "Update"}</button>
            {!busy && <button onClick={dismiss} className="w-full py-1 text-xs text-white/50">Later</button>}
          </div>
        </div>
      )}
    </>
  );
};
export default UpdateChecker;
