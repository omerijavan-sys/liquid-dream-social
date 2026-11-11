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

export async function searchGlobalMusic(query: string, limit = 30): Promise<GlobalMusicTrack[]> {
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

export async function getGlobalTrendingMusic(limit = 30): Promise<GlobalMusicTrack[]> {
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
