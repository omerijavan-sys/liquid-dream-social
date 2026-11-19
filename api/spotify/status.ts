import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AppAuthenticationError,
  getAuthenticatedUser,
  getSpotifyToken,
  UserAuthorizationRequiredError,
} from "../../src/server/spotify-connect";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "private, no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const user = await getAuthenticatedUser(req);

    try {
      await getSpotifyToken(user);
      return res.status(200).json({ connected: true });
    } catch (error) {
      if (error instanceof UserAuthorizationRequiredError) {
        return res.status(200).json({ connected: false });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof AppAuthenticationError) {
      return res.status(401).json({ error: error.message });
    }

    return res.status(500).json({ error: "Could not check Spotify connection." });
  }
}
