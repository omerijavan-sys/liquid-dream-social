/** Finds a full-length free stream (Audius) matching a Spotify track. */
let host: string | null = null;
const cache = new Map<string, string | null>();
const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)|\[.*?\]|feat\.?.*|ft\.?.*/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

async function getHost() {
  if (host) return host;
  const r = await fetch("https://api.audius.co");
  const d = await r.json();
  host = (d.data as string[] | undefined)?.find(Boolean) ?? null;
  if (!host) throw new Error("no audius host");
  return host;
}

export async function findFullStream(title: string, artist: string): Promise<string | null> {
  const key = `${title}|${artist}`;
  if (cache.has(key)) return cache.get(key)!;
  let out: string | null = null;
  try {
    const h = await getHost();
    const first = artist.split(",")[0];
    const u = new URL(`${h}/v1/tracks/search`);
    u.searchParams.set("query", `${norm(title)} ${norm(first)}`);
    u.searchParams.set("app_name", "Primegram");
    u.searchParams.set("limit", "8");
    const r = await fetch(u);
    const list = ((await r.json()).data ?? []) as Array<{ id: string; title: string; duration?: number; user?: { name?: string } }>;
    const t = norm(title), a = norm(first);
    const hit = list.find(x => {
      const xt = norm(x.title), xa = norm(x.user?.name ?? "");
      return (xt === t || xt.includes(t) || t.includes(xt)) && (xa.includes(a) || a.includes(xa) || xt.includes(a));
    });
    if (hit && (hit.duration ?? 999) > 60) out = `${h}/v1/tracks/${encodeURIComponent(hit.id)}/stream?app_name=Primegram`;
  } catch { out = null; }
  cache.set(key, out);
  return out;
}
