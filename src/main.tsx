import { createRoot } from "react-dom/client";
import ErrorBoundary from "./components/ErrorBoundary";
import { installGlobalErrorLogging, logError } from "./utils/telemetry";
installGlobalErrorLogging();
import "./index.css";
import { applyAppearance } from "./utils/preferences";

applyAppearance();
window.addEventListener("primegram:preferences", applyAppearance);
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", applyAppearance);

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registered: ', registration);
      })
      .catch(registrationError => {
        console.log('Service Worker registration failed: ', registrationError);
      });
  });
}

// App is loaded dynamically so a crash while its modules start up (bad import, missing env var…)
// is caught here and shown, instead of leaving a blank page.
const showFatal = (err: unknown) => {
  console.error("Startup failed:", err);
  logError("startup.failed", err);
  const msg = err instanceof Error ? err.message : String(err);
  document.getElementById("root")!.innerHTML = `<div style="min-height:100vh;background:#07070a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;font-family:system-ui,sans-serif"><p style="font-size:20px;font-weight:700">Primegram X couldn't start</p><p style="max-width:420px;font-size:13px;opacity:.7;word-break:break-word"></p><button onclick="location.reload()" style="background:#e11d48;color:#fff;border:0;border-radius:999px;padding:10px 24px;font-weight:700">Reload</button></div>`;
  document.querySelector("#root p:nth-of-type(2)")!.textContent = msg;
};
const root = document.getElementById("root");
if (root) {
  import("./App.tsx").then(({ default: App }) => createRoot(root).render(<ErrorBoundary><App /></ErrorBoundary>)).catch(showFatal);
  window.addEventListener("error", (e) => { if (!root.hasChildNodes() || root.querySelector(".pg-splash")) showFatal(e.error ?? e.message); });
}
