import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { ArrowUpCircle, X } from "lucide-react";
import { toast } from "sonner";
import { setAppUpdate } from "@/utils/updateStore";

type UpdatePlugin = {
  enqueue(o: { url: string }): Promise<{ id: number }>;
  status(o: { id: number }): Promise<{ state: "running" | "paused" | "done" | "failed" | "gone" | "unknown"; received?: number; total?: number }>;
  cancelDownload(o: { id: number }): Promise<void>;
  openDownloads(): Promise<void>;
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

  // Android's own downloader fetches the signed APK (progress shown here); when it finishes the user taps the
  // notification (or Open) and Android's installer takes over. Primegram itself needs no install permission.
  const dlId = useRef<number | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPoll = () => { if (poll.current) clearInterval(poll.current); poll.current = null; };
  useEffect(() => stopPoll, []);
  const upgrade = async () => {
    if (!update || busyRef.current) return;
    if (downloaded) { void AppUpdate.openDownloads(); return; }
    busyRef.current = true; setBusy(true); setProg({ pct: 0, received: 0, total: 0 });
    try {
      const { id } = await AppUpdate.enqueue({ url: update.url });
      dlId.current = id;
      let stall = 0, idle = 0;
      stopPoll();
      poll.current = setInterval(async () => {
        const s = await AppUpdate.status({ id }).catch(() => null);
        if (!s) return;
        const total = s.total && s.total > 0 ? s.total : 0, received = s.received ?? 0;
        setProg({ pct: total ? Math.min(99, Math.floor(received * 100 / total)) : 0, received, total });
        // Android's downloader can sit at 0% forever (queued behind another download, slow redirect, restricted
        // network). If nothing has arrived after ~20s, hand the same file to the browser, which downloads reliably.
        if (s.state !== "done" && received === 0 && ++idle > 40) {
          stopPoll(); void AppUpdate.cancelDownload({ id }); busyRef.current = false; setBusy(false);
          toast.message("Switching to a browser download…");
          try { await Browser.open({ url: update.url }); } catch { toast.error("Couldn't start the download. Try again."); }
          return;
        }
        if (received > 0) idle = 0;
        if (s.state === "done") {
          stopPoll(); busyRef.current = false; setBusy(false); setDownloaded(true); setProg(p => ({ ...p, pct: 100 }));
          toast.success("Downloaded — tap the notification (or Open) to install");
          void AppUpdate.openDownloads();
        } else if (s.state === "failed" || s.state === "gone") {
          stopPoll(); busyRef.current = false; setBusy(false); toast.error("Download failed. Check your connection and try again.");
        } else if (s.state === "paused" && ++stall > 40) {
          stopPoll(); busyRef.current = false; setBusy(false); toast.error("Download is waiting for a network. Try again.");
        }
      }, 500);
    } catch (e) {
      busyRef.current = false; setBusy(false);
      try { await Browser.open({ url: update.url }); } catch { toast.error("Couldn't start the download. Try again."); }
    }
  };
  const cancelDl = () => { stopPoll(); if (dlId.current != null) void AppUpdate.cancelDownload({ id: dlId.current }); busyRef.current = false; setBusy(false); };

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
            <p className="text-sm text-white/70">{busy ? "Downloading the new Primegram…" : "A newer Primegram is ready. Tap Upgrade to download it — your account and data stay as they are."}</p>
            {busy && (
              <div className="space-y-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-sky-400 transition-all duration-200" style={{ width: `${prog.pct}%` }} /></div>
                <p className="text-xs tabular-nums text-white/60">{prog.pct}%{prog.total > 0 ? ` · ${mb(prog.received)} of ${mb(prog.total)} MB` : ""}</p>
              </div>
            )}
            <button disabled={busy} onClick={() => void upgrade()} className="w-full rounded-2xl bg-emerald-400 py-3 text-sm font-bold text-black disabled:opacity-60">{busy ? (prog.received ? `Downloading ${prog.pct}%` : "Starting download…") : downloaded ? "Open to install" : "Upgrade"}</button>
            {busy ? <button onClick={cancelDl} className="w-full py-1 text-xs text-white/50">Cancel</button>
              : <button onClick={dismiss} className="w-full py-1 text-xs text-white/50">Later</button>}
          </div>
        </div>
      )}
    </>
  );
};
export default UpdateChecker;
