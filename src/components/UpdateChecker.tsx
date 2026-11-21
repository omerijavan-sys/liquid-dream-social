import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { ArrowUpCircle, X } from "lucide-react";
import { toast } from "sonner";
import { setAppUpdate } from "@/utils/updateStore";

type UpdatePlugin = {
  download(o: { url: string }): Promise<{ size: number }>;
  cancel(): Promise<void>;
  hasDownload(): Promise<{ exists: boolean }>;
  install(): Promise<{ needsPermission: boolean }>;
  addListener(ev: "progress", cb: (e: { pct: number; received: number; total: number }) => void): Promise<PluginListenerHandle>;
};
const AppUpdate = registerPlugin<UpdatePlugin>("AppUpdate");

const RELEASES = "https://api.github.com/repos/omerijavan-sys/liquid-dream-social/releases?per_page=1";
const INSTALLED = Number(import.meta.env.VITE_APP_BUILD || 0);
const mb = (n: number) => (n / 1048576).toFixed(1);

/** Android app only: pops up an Upgrade prompt by itself when a newer build exists, downloads it inside the app and opens Android's installer. */
const UpdateChecker = () => {
  const [update, setUpdate] = useState<{ build: number; url: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState({ pct: 0, received: 0, total: 0 });
  const [downloaded, setDownloaded] = useState(false);
  const busyRef = useRef(false);

  const check = useCallback(async () => {
    try {
      const r = await fetch(RELEASES, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (!r.ok) return;
      const rel = (await r.json())?.[0];
      const build = Number(String(rel?.tag_name ?? "").replace(/\D/g, ""));
      const assets: { name: string; browser_download_url: string }[] = rel?.assets ?? [];
      const asset = assets.find(a => a.name === "primegram.apk") ?? assets.find(a => a.name.endsWith(".apk"));
      if (build > INSTALLED && asset?.browser_download_url) { const u = { build, url: asset.browser_download_url }; setUpdate(u); setAppUpdate(u); }
    } catch { /* offline: try again next time */ }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void check();
    const h = CapApp.addListener("appStateChange", ({ isActive }) => { if (isActive) void check(); });
    return () => { void h.then(x => x.remove()); };
  }, [check]);

  // No self-installer permission in the app (Play Protect treats those as risky), so Upgrade opens the
  // signed APK download in the browser and Android's normal installer takes over.
  const upgrade = async () => {
    if (!update) return;
    try { await Browser.open({ url: update.url }); }
    catch { toast.error("Couldn't open the download. Try again."); }
  };

  // The update prompt pops up by itself when a newer build exists (once per build until the app is reopened).
  useEffect(() => {
    if (!update) return;
    let seen = false;
    try { seen = sessionStorage.getItem("primegram-update-seen") === String(update.build); } catch { /* ignore */ }
    if (!seen) setOpen(true);
  }, [update]);
  const dismiss = () => {
    try { if (update) sessionStorage.setItem("primegram-update-seen", String(update.build)); } catch { /* ignore */ }
    setHidden(true); setOpen(false);
  };

  useEffect(() => {
    const o = () => { setHidden(false); setOpen(true); };
    window.addEventListener("prime:open-update", o);
    return () => window.removeEventListener("prime:open-update", o);
  }, []);

  if (!update) return null;
  return (
    <>
      {!open && (
        <button onClick={() => { setHidden(false); setOpen(true); }} aria-label="Upgrade available" className="fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[90] flex h-10 w-10 animate-pulse items-center justify-center rounded-full bg-emerald-400 text-black shadow-[0_0_18px_rgba(52,211,153,.8)]"><ArrowUpCircle className="h-6 w-6" /></button>
      )}
      {open && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60" onClick={() => !busy && dismiss()}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-t-3xl border border-white/15 bg-black/80 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white backdrop-blur-2xl">
            <div className="flex items-center justify-between"><p className="text-lg font-bold">New version available</p>{!busy && <button onClick={dismiss} aria-label="Close"><X className="h-5 w-5" /></button>}</div>
            <p className="text-sm text-white/70">{busy ? "Downloading the new Primegram inside the app…" : "A newer Primegram is ready. Tap Upgrade — it downloads here in the app and your account and data stay as they are."}</p>
            {busy && (
              <div className="space-y-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-sky-400 transition-all duration-200" style={{ width: `${prog.pct}%` }} /></div>
                <p className="text-xs tabular-nums text-white/60">{prog.pct}%{prog.total > 0 ? ` · ${mb(prog.received)} of ${mb(prog.total)} MB` : ""}</p>
              </div>
            )}
            <button disabled={busy} onClick={() => void upgrade()} className="w-full rounded-2xl bg-emerald-400 py-3 text-sm font-bold text-black disabled:opacity-60">{busy ? `Downloading ${prog.pct}%` : "Upgrade"}</button>
            {busy ? <button onClick={() => void AppUpdate.cancel()} className="w-full py-1 text-xs text-white/50">Cancel</button>
              : <button onClick={dismiss} className="w-full py-1 text-xs text-white/50">Later</button>}
          </div>
        </div>
      )}
    </>
  );
};
export default UpdateChecker;
