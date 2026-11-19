import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AppAuthenticationError,
  getAuthenticatedUser,
  getSpotifyAuthorizationUrl,
} from "../../src/server/spotify-connect";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await getAuthenticatedUser(req);
    const url = await getSpotifyAuthorizationUrl(user, req);
    return res.status(200).json({ url });
  } catch (error) {
    if (error instanceof AppAuthenticationError) {
      return res.status(401).json({ error: error.message });
    }

    return res.status(500).json({ error: "Could not start Spotify authorization." });
  }
}
