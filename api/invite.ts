export const config = { runtime: "edge" };

const SB_URL = process.env.VITE_SUPABASE_URL || "https://kfvoqwbfgptqrrkyhorj.supabase.co";
const SB_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * /invite/:code — serves the normal app shell with rich link-preview tags (WhatsApp, Telegram, X, Facebook), so a shared
 * invite shows "<Name> invited you to Primegram" with an image instead of a bare link. People still land in the app.
 */
export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  const code = (url.searchParams.get("code") || url.pathname.split("/").pop() || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 16).toUpperCase();

  let html: string;
  try {
    const shell = await fetch(`${origin}/index.html`);
    if (!shell.ok) throw new Error("shell");
    html = await shell.text();
  } catch { return Response.redirect(`${origin}/`, 302); }

  let name: string | null = null;
  if (code && SB_KEY) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/rpc/referral_preview`, {
        method: "POST", headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ _code: code }),
      });
      const rows = (await r.json()) as { display_name?: string | null }[];
      name = rows?.[0]?.display_name ?? null;
    } catch { /* fall back to the generic text */ }
  }

  const title = name ? `${name} invited you to Primegram X` : "You're invited to Primegram X";
  const desc = "Post, go live, send Drops and earn. Tap to join with this invite.";
  const image = `${origin}/og-invite.png`;
  const swap = (re: RegExp, v: string) => { html = html.replace(re, v); };
  swap(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  swap(/(<meta property="og:title" content=")[^"]*(")/i, `$1${esc(title)}$2`);
  swap(/(<meta property="og:description" content=")[^"]*(")/i, `$1${esc(desc)}$2`);
  swap(/(<meta property="og:url" content=")[^"]*(")/i, `$1${esc(`${origin}/invite/${code}`)}$2`);
  swap(/(<meta property="og:image" content=")[^"]*(")/i, `$1${image}$2`);
  swap(/(<meta property="og:image:width" content=")[^"]*(")/i, `$11200$2`);
  swap(/(<meta property="og:image:height" content=")[^"]*(")/i, `$1630$2`);
  swap(/(<meta name="twitter:title" content=")[^"]*(")/i, `$1${esc(title)}$2`);
  swap(/(<meta name="twitter:description" content=")[^"]*(")/i, `$1${esc(desc)}$2`);
  swap(/(<meta name="twitter:image" content=")[^"]*(")/i, `$1${image}$2`);

  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
