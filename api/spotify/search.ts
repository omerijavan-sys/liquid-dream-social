import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AppAuthenticationError,
  getAuthenticatedUser,
  getSpotifyToken,
  UserAuthorizationRequiredError,
} from "../../src/server/spotify-connect";

type SpotifySearchTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images?: { url: string }[] };
  duration_ms: number;
  external_urls?: { spotify?: string };
};

type SpotifySearchPayload = { tracks?: { items?: SpotifySearchTrack[] } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await getAuthenticatedUser(req);
    const rawQuery = req.query.q;
    const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim();

    if (!query || query.length < 2 || query.length > 100) {
      return res.status(400).json({ error: "Enter a search with 2–100 characters." });
    }

    const token = await getSpotifyToken(user);
    const searchParams = new URLSearchParams({ q: query, type: "track", limit: "12" });
    const spotifyResponse = await fetch(`https://api.spotify.com/v1/search?${searchParams}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (spotifyResponse.status === 429) {
      const retryAfter = spotifyResponse.headers.get("retry-after");
      if (retryAfter) res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({ error: "Spotify search is temporarily rate limited. Try again shortly." });
    }

    if (spotifyResponse.status === 401 || spotifyResponse.status === 403) {
      return res.status(401).json({ error: "Spotify denied this catalog search. Reconnect your account and try again." });
    }

    if (!spotifyResponse.ok) {
      return res.status(502).json({ error: "Spotify could not complete this search." });
    }

    const payload = (await spotifyResponse.json()) as SpotifySearchPayload;
    const tracks = (payload.tracks?.items ?? []).map((track) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((artist: { name: string }) => artist.name),
      album: track.album.name,
      albumImage: track.album.images?.[0]?.url ?? null,
      durationMs: track.duration_ms,
      spotifyUrl: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
    }));

    return res.status(200).json({ tracks });
  } catch (error) {
    if (error instanceof AppAuthenticationError) {
      return res.status(401).json({ error: error.message });
    }

    if (error instanceof UserAuthorizationRequiredError) {
      return res.status(401).json({ error: "Connect your Spotify account to search the catalog." });
    }

    return res.status(500).json({ error: "Spotify search is unavailable right now." });
  }
}
