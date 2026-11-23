import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Activity, AudioLines, BellRing, Check, ClipboardCopy, Cpu, Gauge, Loader2, Mic, RefreshCw, Trash2, Wifi, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { readPreference, savePreference } from "@/utils/preferences";

/**
 * Developer tools: everything on this panel is measured on this device right now (no simulated numbers).
 * Live FPS / memory / latency / network, a one-tap health check, cache + push utilities and a copyable report.
 */
type Prefs = { fpsOverlay: boolean; vibeIntensity: number };
type Check = { label: string; ok: boolean; detail: string };
const KEY = "advanced-developer-hub";
const N = 40; // samples kept per sparkline

const push = (a: number[], v: number) => [...a.slice(-(N - 1)), v];
const Spark = ({ values, color, max }: { values: number[]; color: string; max?: number }) => {
  const hi = max ?? Math.max(1, ...values) * 1.15;
  const pts = values.map((v, i) => `${(i / Math.max(1, N - 1)) * 100},${30 - Math.min(30, (v / hi) * 30)}`).join(" ");
  return <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>;
};
const Tile = ({ label, value, unit, color, values, max }: { label: string; value: string; unit?: string; color: string; values: number[]; max?: number }) => (
  <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
    <p className="text-[11px] font-medium uppercase tracking-wider text-white/45">{label}</p>
    <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums" style={{ color, textShadow: `0 0 14px ${color}66` }}>{value}<span className="ml-1 text-xs font-normal text-white/40">{unit}</span></p>
    <Spark values={values} color={color} max={max} />
  </div>
);
const Btn = ({ icon, label, onClick, busy }: { icon: ReactNode; label: string; onClick: () => void; busy?: boolean }) => (
  <button onClick={onClick} disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 text-[13px] font-semibold text-white transition-colors active:bg-white/10 disabled:opacity-60 [&>svg]:h-4 [&>svg]:w-4">
    {busy ? <Loader2 className="animate-spin" /> : icon}{label}
  </button>
);

const AdvancedDeveloperHub = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(() => ({ fpsOverlay: false, vibeIntensity: 55, ...readPreference<Partial<Prefs>>(KEY, {}) }));
  const setPref = (u: Partial<Prefs>) => setPrefs(c => { const n = { ...c, ...u }; savePreference(KEY, n); return n; });

  // ---- live measurements ----
  const [fps, setFps] = useState<number[]>([]);
  const [mem, setMem] = useState<number[]>([]);
  const [lat, setLat] = useState<number[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const conn = (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number; rtt?: number } }).connection;

  const ping = useCallback(async () => {
    const t0 = performance.now();
    try { await supabase.from("profiles").select("user_id").limit(1); const ms = Math.round(performance.now() - t0); setLat(l => push(l, ms)); return ms; }
    catch { return null; }
  }, []);

  useEffect(() => {
    let frames = 0, last = performance.now(), raf = 0, dead = false;
    const loop = (now: number) => {
      if (dead) return; frames++;
      if (now - last >= 1000) { setFps(f => push(f, Math.round((frames * 1000) / (now - last)))); frames = 0; last = now;
        const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory; if (m) setMem(a => push(a, Math.round(m.usedJSHeapSize / 1048576))); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    void ping(); const t = setInterval(() => void ping(), 8000);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { dead = true; cancelAnimationFrame(raf); clearInterval(t); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [ping]);

  const curFps = fps.at(-1) ?? 0;
  useEffect(() => { // optional on-screen FPS meter
    if (!prefs.fpsOverlay) return;
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;right:12px;top:80px;z-index:9999;padding:4px 10px;border-radius:10px;background:rgba(0,0,0,.8);border:1px solid rgba(34,211,238,.4);color:#67e8f9;font:12px ui-monospace,monospace;pointer-events:none";
    document.body.appendChild(el);
    const t = setInterval(() => { el.textContent = `${fps.at(-1) ?? 0} FPS`; }, 500);
    return () => { clearInterval(t); el.remove(); };
  }, [prefs.fpsOverlay, fps]);

  // ---- health check ----
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [native, setNative] = useState<{ version: string; build: string } | null>(null);
  useEffect(() => { if (Capacitor.isNativePlatform()) void CapApp.getInfo().then(i => setNative({ version: i.version, build: i.build })).catch(() => undefined); }, []);

  const runChecks = async () => {
    setChecking(true);
    const out: Check[] = [];
    out.push({ label: "Internet", ok: navigator.onLine, detail: navigator.onLine ? `${conn?.effectiveType?.toUpperCase() ?? "connected"}${conn?.downlink ? ` · ${conn.downlink} Mbps` : ""}` : "Offline" });
    const ms = await ping();
    out.push({ label: "Primegram servers", ok: ms !== null, detail: ms !== null ? `${ms} ms round trip` : "Unreachable" });
    const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    out.push({ label: "Signed-in session", ok: !!data.session, detail: data.session ? "Valid" : "No active session" });
    try {
      const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" }); const v = await r.json() as { web?: string };
      out.push({ label: "App version", ok: v.web === __WEB_BUILD__, detail: v.web === __WEB_BUILD__ ? `Latest (${__WEB_BUILD__.slice(0, 7)})` : `Update available (${String(v.web).slice(0, 7)})` });
    } catch { out.push({ label: "App version", ok: false, detail: "Couldn't check" }); }
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration().catch(() => undefined) : undefined;
    out.push({ label: "Offline cache (service worker)", ok: !!reg?.active, detail: reg?.active ? (navigator.serviceWorker.controller ? "Active and in control" : "Installed, takes over on next open") : "Not installed" });
    const perm = "Notification" in window ? Notification.permission : "unsupported";
    out.push({ label: "Notifications permission", ok: perm === "granted", detail: perm === "granted" ? "Allowed" : perm === "denied" ? "Blocked in system settings" : perm === "default" ? "Not asked yet" : "Not supported here" });
    try { const e = await navigator.storage?.estimate?.(); if (e?.usage !== undefined) out.push({ label: "Local storage", ok: true, detail: `${(e.usage / 1048576).toFixed(1)} MB used` }); } catch { /* not available */ }
    setChecks(out); setChecking(false);
    return out;
  };

  // ---- utilities ----
  const [pushBusy, setPushBusy] = useState(false);
  const testPush = async () => {
    if (!user) return; setPushBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("notify-message", { body: { test: user.id } });
      if (error) throw error;
      const d = data as { sent?: number; skipped?: string; errors?: string[] };
      if (d?.sent) toast.success(`Test notification sent to ${d.sent} device${d.sent === 1 ? "" : "s"}`);
      else toast.info(d?.skipped === "no devices" ? "No phone is registered for notifications yet. Open the Android app and allow notifications." : d?.skipped ?? d?.errors?.[0] ?? "Nothing was sent");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't send a test notification"); }
    finally { setPushBusy(false); }
  };
  const clearCache = async () => {
    try {
      for (const k of await caches.keys()) await caches.delete(k);
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    } catch { /* best effort */ }
    toast.success("Cache cleared — reloading"); setTimeout(() => location.reload(), 500);
  };
  const copyReport = async () => {
    const report = {
      time: new Date().toISOString(), webBuild: __WEB_BUILD__, native, platform: Capacitor.getPlatform(), online,
      network: conn ? { type: conn.effectiveType, downlinkMbps: conn.downlink, rttMs: conn.rtt } : null,
      screen: `${screen.width}x${screen.height}@${window.devicePixelRatio}`, userAgent: navigator.userAgent, language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, fps: curFps, latencyMs: lat.at(-1) ?? null, jsHeapMb: mem.at(-1) ?? null,
      checks: checks ?? (await runChecks()),
    };
    try { await navigator.clipboard.writeText(JSON.stringify(report, null, 2)); toast.success("Diagnostics copied — paste it to support"); } catch { toast.error("Couldn't copy"); }
  };

  // ---- vibe engine (real microphone visualizer, on-device only) ----
  const [mic, setMic] = useState(false);
  const [bars, setBars] = useState<number[]>(Array(32).fill(8));
  const stream = useRef<MediaStream | null>(null); const ctx = useRef<AudioContext | null>(null); const an = useRef<AnalyserNode | null>(null);
  const stopMic = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; void ctx.current?.close(); ctx.current = null; an.current = null; setMic(false); setBars(Array(32).fill(8)); };
  useEffect(() => () => stopMic(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!mic || !an.current) return;
    const a = an.current, s = new Uint8Array(a.frequencyBinCount);
    const t = setInterval(() => { a.getByteFrequencyData(s); setBars(Array.from({ length: 32 }, (_, i) => Math.max(8, Math.min(100, ((s[Math.floor(i * s.length / 32)] ?? 0) / 255) * 100 * (prefs.vibeIntensity / 55))))); }, 80);
    return () => clearInterval(t);
  }, [mic, prefs.vibeIntensity]);
  const toggleMic = async (on: boolean) => {
    if (!on) { stopMic(); return; }
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: true }); const c = new AudioContext(); const src = c.createMediaStreamSource(st); const a = c.createAnalyser(); a.fftSize = 128; src.connect(a);
      stream.current = st; ctx.current = c; an.current = a; setMic(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Microphone permission was denied."); }
  };

  const fpsColor = curFps >= 50 ? "#4ade80" : curFps >= 30 ? "#fbbf24" : "#f87171";
  const latMs = lat.at(-1);
  const latColor = latMs === undefined ? "#a1a1aa" : latMs < 250 ? "#22d3ee" : latMs < 700 ? "#fbbf24" : "#f87171";
  const env: [string, string][] = [
    ["Platform", Capacitor.isNativePlatform() ? `Android app${native ? ` · v${native.version} (${native.build})` : ""}` : "Web / PWA"],
    ["Web build", __WEB_BUILD__.slice(0, 10)],
    ["Screen", `${screen.width}×${screen.height} @${window.devicePixelRatio}x`],
    ["Timezone", Intl.DateTimeFormat().resolvedOptions().timeZone],
    ["Language", navigator.language],
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-black/40 p-4 text-white shadow-[0_8px_40px_rgba(0,0,0,.4)] backdrop-blur-xl">
      <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-cyan-500/15 blur-3xl" />
      <header className="relative flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,.25)]"><Cpu className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><h2 className="text-base font-bold">Developer tools</h2><p className="text-xs text-white/50">Live readings from this device</p></div>
        <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${online ? "border-emerald-400/30 text-emerald-300" : "border-red-400/30 text-red-300"}`}><span className={`h-1.5 w-1.5 rounded-full ${online ? "animate-pulse bg-emerald-400" : "bg-red-400"}`} />{online ? "Online" : "Offline"}</span>
      </header>

      <div className="relative mt-4 grid grid-cols-2 gap-2.5">
        <Tile label="Frame rate" value={String(curFps)} unit="fps" color={fpsColor} values={fps} max={65} />
        <Tile label="Server latency" value={latMs === undefined ? "—" : String(latMs)} unit="ms" color={latColor} values={lat} />
        <Tile label="JS memory" value={mem.length ? String(mem.at(-1)) : "n/a"} unit={mem.length ? "MB" : ""} color="#d946ef" values={mem} />
        <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/45">Network</p>
          <p className="mt-0.5 font-mono text-2xl font-bold text-sky-300">{online ? (conn?.effectiveType?.toUpperCase() ?? "OK") : "—"}</p>
          <p className="mt-1 text-[11px] text-white/45">{conn?.downlink ? `${conn.downlink} Mbps` : "speed n/a"}{conn?.rtt ? ` · ${conn.rtt} ms RTT` : ""}</p>
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-2 gap-2.5">
        <Btn icon={<Activity />} label="Run health check" onClick={() => void runChecks()} busy={checking} />
        <Btn icon={<ClipboardCopy />} label="Copy report" onClick={() => void copyReport()} />
        <Btn icon={<BellRing />} label="Test notification" onClick={() => void testPush()} busy={pushBusy} />
        <Btn icon={<Trash2 />} label="Clear cache" onClick={() => void clearCache()} />
      </div>

      {checks && (
        <div className="relative mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/10 bg-black/35">
          {checks.map(c => (
            <div key={c.label} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${c.ok ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"}`}>{c.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}</span>
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{c.label}</span><span className="block truncate text-xs text-white/50">{c.detail}</span></span>
            </div>
          ))}
        </div>
      )}

      <div className="relative mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/10 bg-black/35">
        {env.map(([k, v]) => <div key={k} className="flex items-center justify-between gap-3 px-3.5 py-2"><span className="text-xs text-white/45">{k}</span><span className="truncate font-mono text-xs text-white/85">{v}</span></div>)}
        <div className="flex items-center gap-3 px-3.5 py-2.5"><Gauge className="h-4 w-4 text-cyan-300" /><span className="flex-1 text-[13px]">Show FPS on screen</span><Switch checked={prefs.fpsOverlay} onCheckedChange={v => setPref({ fpsOverlay: v })} aria-label="Show FPS on screen" /></div>
      </div>

      <div className="relative mt-3 rounded-2xl border border-white/10 bg-black/35 p-3.5">
        <div className="flex items-center gap-2"><AudioLines className="h-4 w-4 text-rose-300" /><h3 className="text-[13px] font-semibold">Vibe engine</h3><span className="ml-auto text-[11px] text-white/40">{mic ? "Listening" : "Off"}</span></div>
        <div className="mt-2 flex h-16 items-center justify-center gap-[3px] overflow-hidden rounded-xl bg-gradient-to-r from-rose-950/50 via-fuchsia-950/30 to-rose-950/50 px-2">
          {bars.map((h, i) => <span key={i} className="w-1.5 shrink-0 rounded-full bg-gradient-to-t from-rose-600 to-pink-200 transition-[height] duration-100" style={{ height: `${h}%` }} />)}
        </div>
        <div className="mt-3 flex items-center gap-3"><Mic className="h-4 w-4 text-white/50" /><span className="flex-1 text-[13px]">Microphone visualizer</span><Switch checked={mic} onCheckedChange={v => void toggleMic(v)} aria-label="Microphone visualizer" /></div>
        <div className="mt-3 flex items-center gap-3"><Zap className="h-4 w-4 text-white/50" /><span className="shrink-0 text-[13px]">Intensity</span>
          <Slider min={0} max={100} step={1} value={[prefs.vibeIntensity]} onValueChange={([v]) => setPref({ vibeIntensity: v })} aria-label="Vibe intensity" /><span className="w-7 text-right font-mono text-xs text-white/60">{prefs.vibeIntensity}</span></div>
        <p className="mt-2 text-[11px] text-white/35">Audio is analyzed on this device only — never recorded or uploaded.</p>
      </div>
      <p className="relative mt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/30"><Wifi className="h-3 w-3" /><RefreshCw className="h-3 w-3" />All numbers refresh live</p>
    </section>
  );
};

export default AdvancedDeveloperHub;
