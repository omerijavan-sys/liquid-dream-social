// Spotify catalogue search (client-credentials flow). Secrets: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

let cached: { token: string; exp: number } | null = null;
async function token(): Promise<string> {
  if (cached && Date.now() < cached.exp) return cached.token;
  const id = Deno.env.get("SPOTIFY_CLIENT_ID"), secret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  if (!id || !secret) throw Object.assign(new Error("Spotify is not configured"), { status: 503 });
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw Object.assign(new Error(`Spotify auth failed (${r.status})`), { status: 502 });
  const d = await r.json();
  cached = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
  return cached.token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { q, limit } = await req.json().catch(() => ({}));
    const term = typeof q === "string" && q.trim().length >= 2 ? q.trim().slice(0, 100) : "year:2026";
    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", term);
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", String(Math.min(30, Math.max(1, Number(limit) || 20))));
    const r = await fetch(url, { headers: { Authorization: `Bearer ${await token()}` } });
    if (!r.ok) return json({ error: `Spotify search failed (${r.status})` }, 502);
    const d = await r.json();
    const tracks = (d.tracks?.items ?? []).map((t: any) => ({
      id: t.id,
      title: t.name,
      artist: (t.artists ?? []).map((a: any) => a.name).join(", "),
      artwork: t.album?.images?.[0]?.url ?? null,
      duration: Math.round((t.duration_ms ?? 0) / 1000) || null,
      previewUrl: t.preview_url ?? null,
    }));
    return json({ tracks });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Spotify error" }, (e as { status?: number }).status ?? 500);
  }
});
