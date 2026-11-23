import { supabase } from "@/integrations/supabase/client";

// Lightweight first-party crash + usage logging. No third party, no ads, no personal data: only the route path
// (never the query string), an error message and the app platform. Stored in `client_events` (admins read only).

const platform = () => (/Android/i.test(navigator.userAgent) ? ((window as { Capacitor?: unknown }).Capacitor ? "android-app" : "android-web") : /iPhone|iPad/i.test(navigator.userAgent) ? "ios-web" : "desktop-web");
const recent = new Map<string, number>();
let sent = 0;

const send = (row: { kind: "error" | "page" | "event"; name: string; message?: string; stack?: string; path?: string }) => {
  try {
    if (sent >= 40) return; // hard cap per page load so a crash loop can't flood the table
    const key = `${row.kind}|${row.name}|${row.message ?? ""}`;
    const now = Date.now();
    if (now - (recent.get(key) ?? 0) < 60_000) return; // same event at most once a minute
    recent.set(key, now); sent++;
    void supabase.from("client_events" as never).insert({
      kind: row.kind,
      name: row.name.slice(0, 120),
      message: row.message?.slice(0, 1500),
      stack: row.stack?.slice(0, 4000),
      path: (row.path ?? location.pathname).slice(0, 200),
      platform: platform(),
      app_version: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "web",
    } as never).then(() => undefined, () => undefined);
  } catch { /* logging must never break the app */ }
};

export const logError = (name: string, err: unknown, extra?: string) => {
  const e = err instanceof Error ? err : new Error(String(err));
  send({ kind: "error", name, message: `${e.message}${extra ? ` | ${extra}` : ""}`, stack: e.stack });
};
export const trackPage = (path: string) => send({ kind: "page", name: path, path });
export const trackEvent = (name: string) => send({ kind: "event", name });

let installed = false;
export const installGlobalErrorLogging = () => {
  if (installed) return; installed = true;
  window.addEventListener("error", (e) => logError("window.error", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => logError("unhandledrejection", e.reason));
};
