export interface GlobalMusicTrack {
  id: string;
  title: string;
  artist: string;
  artwork: string | null;
  streamUrl: string;
  duration: number | null;
}

interface AudiusTrackResponse {
  id: string;
  title: string;
  duration?: number;
  artwork?: Record<string, string>;
  user?: { name?: string };
}

let audiusHost: string | null = null;

const getAudiusHost = async (): Promise<string> => {
  if (audiusHost) return audiusHost;
  const response = await fetch("https://api.audius.co");
  if (!response.ok) throw new Error("Global music discovery is temporarily unavailable.");
  const payload: { data?: string[] } = await response.json();
  const host = payload.data?.find(Boolean);
  if (!host) throw new Error("No global music catalogue nodes were returned.");
  audiusHost = host;
  return host;
};

const toTrack = (track: AudiusTrackResponse, host: string): GlobalMusicTrack => ({
  id: track.id,
  title: track.title || "Untitled track",
  artist: track.user?.name || "Independent artist",
  artwork: track.artwork?.["480x480"] ?? track.artwork?.["150x150"] ?? null,
  streamUrl: `${host}/v1/tracks/${encodeURIComponent(track.id)}/stream?app_name=Primegram`,
  duration: typeof track.duration === "number" ? track.duration : null,
});

async function audiusSearch(query: string, limit = 30): Promise<GlobalMusicTrack[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const host = await getAudiusHost();
  const url = new URL(`${host}/v1/tracks/search`);
  url.searchParams.set("query", term);
  url.searchParams.set("app_name", "Primegram");
  url.searchParams.set("limit", String(Math.min(50, Math.max(1, limit))));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Global music search failed (${response.status}).`);
  const payload: { data?: AudiusTrackResponse[] } = await response.json();
  return (payload.data ?? []).map(track => toTrack(track, host));
}

async function audiusTrending(limit = 30): Promise<GlobalMusicTrack[]> {
  const host = await getAudiusHost();
  const url = new URL(`${host}/v1/tracks/trending`);
  url.searchParams.set("app_name", "Primegram");
  url.searchParams.set("time", "week");
  url.searchParams.set("limit", String(Math.min(50, Math.max(1, limit))));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Global trending music failed (${response.status}).`);
  const payload: { data?: AudiusTrackResponse[] } = await response.json();
  return (payload.data ?? []).map(track => toTrack(track, host));
}

// ---- Spotify catalogue (metadata + artwork) with playable audio resolved per track ----
interface SpotifyTrack { id: string; title: string; artist: string; artwork: string | null; duration: number | null; previewUrl: string | null }
let spotifyDownUntil = 0;

async function spotifyTracks(q: string | null, limit: number): Promise<SpotifyTrack[]> {
  if (Date.now() < spotifyDownUntil) return [];
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.functions.invoke("spotify-search", { body: { q, limit } });
    if (error || !data?.tracks) { spotifyDownUntil = Date.now() + 60_000; return []; }
    return data.tracks as SpotifyTrack[];
  } catch { spotifyDownUntil = Date.now() + 60_000; return []; }
}

const clean = (v: string) => v.replace(/\(.*?\)|\[.*?\]|feat\.?.*/gi, "").trim();

async function withSpotify(q: string | null, limit: number, fallback: () => Promise<GlobalMusicTrack[]>): Promise<GlobalMusicTrack[]> {
  const sp = await spotifyTracks(q, limit);
  if (!sp.length) return fallback();
  const host = await getAudiusHost().catch(() => null);
  const resolved = await Promise.all(sp.slice(0, Math.min(sp.length, 20)).map(async (t): Promise<GlobalMusicTrack | null> => {
    let stream = t.previewUrl ?? "";
    if (host && !stream) {
      try {
        const u = new URL(`${host}/v1/tracks/search`);
        u.searchParams.set("query", `${clean(t.title)} ${clean(t.artist.split(",")[0])}`);
        u.searchParams.set("app_name", "Primegram");
        u.searchParams.set("limit", "1");
        const r = await fetch(u);
        const hit = ((await r.json()).data ?? [])[0] as AudiusTrackResponse | undefined;
        if (hit) stream = toTrack(hit, host).streamUrl;
      } catch { /* keep preview */ }
    }
    return { id: `sp_${t.id}`, title: t.title, artist: t.artist, artwork: t.artwork, streamUrl: stream, duration: t.duration };
  }));
  const out = resolved.filter((x): x is GlobalMusicTrack => !!x);
  if (out.length < 5) {
    const extra = await fallback().catch(() => []);
    const seen = new Set(out.map(t => t.title.toLowerCase()));
    out.push(...extra.filter(t => !seen.has(t.title.toLowerCase())));
  }
  return out.slice(0, limit);
}

export async function searchGlobalMusic(query: string, limit = 30): Promise<GlobalMusicTrack[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  return withSpotify(term, limit, () => audiusSearch(term, limit));
}

export async function getGlobalTrendingMusic(limit = 30): Promise<GlobalMusicTrack[]> {
  return withSpotify(null, limit, () => audiusTrending(limit));
}
