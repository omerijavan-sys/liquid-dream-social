import { useEffect, useState } from "react";

/** Full-screen loading screen. If it lasts too long, offers a reload and a cache reset so users are never stuck. */
const SplashLoader = () => {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setSlow(true), 10000); return () => window.clearTimeout(t); }, []);
  const reset = async () => {
    try {
      if ("serviceWorker" in navigator) (await navigator.serviceWorker.getRegistrations()).forEach((r) => void r.unregister());
      if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    } catch { /* ignore */ }
    window.location.reload();
  };
  return (
    <div className="pg-splash">
      <img src="/icons/p-default.png" alt="" width={132} height={132} />
      <h1>Primegram</h1>
      <div className="pg-line"><i /></div>
      {slow && (
        <div style={{ textAlign: "center", fontSize: 13, opacity: 0.85 }}>
          <p style={{ marginBottom: 10 }}>Taking longer than usual…</p>
          <button onClick={() => window.location.reload()} style={{ background: "#e11d48", color: "#fff", border: 0, borderRadius: 999, padding: "9px 22px", fontWeight: 700, marginRight: 8 }}>Reload</button>
          <button onClick={() => void reset()} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: 0, borderRadius: 999, padding: "9px 22px", fontWeight: 600 }}>Reset app cache</button>
        </div>
      )}
    </div>
  );
};
export default SplashLoader;
