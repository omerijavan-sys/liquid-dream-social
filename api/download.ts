export const config = { runtime: "edge" };

const BASE = "https://github.com/omerijavan-sys/liquid-dream-social/releases/latest/download/";

/** Streams the newest APK through primegram's own domain so the browser saves it straight to Downloads. */
export default async function handler(): Promise<Response> {
  let upstream = await fetch(BASE + "primegram.apk", { redirect: "follow" });
  if (!upstream.ok) upstream = await fetch(BASE + "app-debug.apk", { redirect: "follow" });
  if (!upstream.ok || !upstream.body) return new Response("The app download is not available right now. Please try again in a minute.", { status: 502 });
  const headers = new Headers({
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": 'attachment; filename="Primegram.apk"',
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  return new Response(upstream.body, { status: 200, headers });
}
