const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

let cached: { token: string; exp: number } | null = null;
async function token(): Promise<string> {
  if (cached && Date.now() < cached.exp) return cached.token;
  const id = (Deno.env.get("SPOTIFY_CLIENT_ID") ?? "").trim(), secret = (Deno.env.get("SPOTIFY_CLIENT_SECRET") ?? "").trim();
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

// Spotify caps search at 10 results per request, so we page (offset) to fill larger requests.
async function search(kind: string, term: string, want: number, bearer: string) {
  const out: any[] = [];
  for (let offset = 0; out.length < want && offset < 30; offset += 10) {
    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", term);
    url.searchParams.set("type", kind);
    url.searchParams.set("limit", "10");
    url.searchParams.set("offset", String(offset));
    const r = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` } });
    if (!r.ok) { if (out.length) break; throw Object.assign(new Error(`Spotify search failed (${r.status})`), { status: 502 }); }
    const d = await r.json();
    const items = (d[`${kind}s`]?.items ?? []).filter(Boolean);
    out.push(...items);
    if (items.length < 10) break;
  }
  return out.slice(0, want);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { q, limit, type } = await req.json().catch(() => ({}));
    const kind = type === "playlist" ? "playlist" : type === "album" ? "album" : "track";
    const term = typeof q === "string" && q.trim().length >= 2 ? q.trim().slice(0, 100) : kind === "track" ? "year:2026" : "top hits";
    const want = Math.min(30, Math.max(1, Number(limit) || 20));
    const raw = await search(kind, term, want, await token());
    if (kind === "playlist") {
      const items = raw.map((p: any) => ({ id: p.id, title: p.name, artist: p.owner?.display_name ?? "Spotify", artwork: p.images?.[0]?.url ?? null, kind: "playlist" }));
      return json({ items });
    }
    if (kind === "album") {
      const items = raw.map((a: any) => ({ id: a.id, title: a.name, artist: (a.artists ?? []).map((x: any) => x.name).join(", "), artwork: a.images?.[0]?.url ?? null, kind: "album" }));
      return json({ items });
    }
    const tracks = raw.map((t: any) => ({
      id: t.id,
      title: t.name,
      artist: (t.artists ?? []).map((a: any) => a.name).join(", "),
      artwork: t.album?.images?.[0]?.url ?? null,
      duration: Math.round((t.duration_ms ?? 0) / 1000) || null,
      previewUrl: t.preview_url ?? null,
      kind: "track",
    }));
    return json({ tracks, items: tracks });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Spotify error" }, (e as { status?: number }).status ?? 500);
  }
});
