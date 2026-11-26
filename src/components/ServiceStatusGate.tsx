import { useEffect, useState, type ReactNode } from "react";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * True when the backend is restricted (HTTP 402) or unreachable while our own site is reachable (e.g. blocked responses
 * without CORS headers). A device that is simply offline is not treated as an outage.
 */
const isRestricted = async (): Promise<boolean> => {
  if (!URL_ || !KEY) return false;
  const ping = async (url: string, init?: RequestInit) => {
    const ctl = new AbortController(); const t = window.setTimeout(() => ctl.abort(), 6000);
    try { return await fetch(url, { ...init, signal: ctl.signal, cache: "no-store" }); } finally { window.clearTimeout(t); }
  };
  try {
    const r = await ping(`${URL_}/auth/v1/settings`, { headers: { apikey: KEY } });
    return r.status === 402;
  } catch {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
    try { await ping("/favicon.ico", { method: "HEAD" }); } catch { return false; } // our own site is down too: just a bad connection
    await new Promise((res) => window.setTimeout(res, 3000));
    try { const r2 = await ping(`${URL_}/auth/v1/settings`, { headers: { apikey: KEY } }); return r2.status === 402; } catch { return true; }
  }
};

/**
 * Shows a friendly "back soon" screen instead of a stuck loading screen when the backend is restricted.
 * The app renders underneath straight away; the notice only appears if the check says the service is restricted,
 * and it checks again every 30 seconds so the app returns by itself once service is restored.
 */
const ServiceStatusGate = ({ children }: { children: ReactNode }) => {
  const [down, setDown] = useState(false);
  useEffect(() => {
    let dead = false, wasDown = false;
    const check = async () => {
      const d = await isRestricted();
      if (dead) return;
      if (wasDown && !d) { window.location.reload(); return; }
      wasDown = d; setDown(d);
    };
    void check();
    const id = window.setInterval(() => void check(), 30_000);
    return () => { dead = true; window.clearInterval(id); };
  }, []);
  return (
    <>
      {children}
      {down && (
        <div role="alert" className="fixed inset-0 z-[9998] flex flex-col items-center justify-center gap-4 bg-[#09090B] px-8 text-center text-white">
          <img src="/icons/x-logo-128.webp" alt="" width={84} height={84} className="rounded-2xl" />
          <h1 className="text-2xl font-extrabold">We'll be right back</h1>
          <p className="max-w-sm text-sm leading-6 text-white/70">Primegram X is getting a quick upgrade because so many of you joined. Your account, posts and followers are safe. Please check back soon.</p>
          <button onClick={() => window.location.reload()} className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-2.5 text-sm font-bold">Try again</button>
          <p className="text-xs text-white/40">Primegram X by Aurora</p>
        </div>
      )}
    </>
  );
};
export default ServiceStatusGate;
