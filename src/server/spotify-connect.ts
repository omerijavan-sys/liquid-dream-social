import { createClient, type User } from "@supabase/supabase-js";
import {
  getToken,
  startAuthorization,
  UserAuthorizationRequiredError,
} from "@vercel/connect";
import type { VercelRequest } from "@vercel/node";

const CONNECTOR_UID = "spotify/primegram-spotify";
const SPOTIFY_SCOPES: string[] = [];

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export class AppAuthenticationError extends Error {}

export async function getAuthenticatedUser(req: VercelRequest): Promise<User> {
  const authorization = req.headers.authorization;
  const bearer = Array.isArray(authorization) ? authorization[0] : authorization;
  const accessToken = bearer?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!accessToken) throw new AppAuthenticationError("Sign in to connect Spotify.");

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new AppAuthenticationError("Your session is invalid or expired. Sign in again.");
  }

  return data.user;
}

function getConnectParams(user: Pick<User, "id">) {
  return {
    subject: { type: "user" as const, id: user.id },
    scopes: SPOTIFY_SCOPES,
  };
}

export function getSpotifyToken(user: Pick<User, "id">) {
  return getToken(CONNECTOR_UID, getConnectParams(user));
}

function asOrigin(value: string) {
  return new URL(value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`).origin;
}

function getApplicationOrigin(req: VercelRequest) {
  if (process.env.NODE_ENV !== "production" && process.env.V0_RUNTIME_URL) {
    return asOrigin(process.env.V0_RUNTIME_URL);
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return asOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  }

  if (process.env.VERCEL_URL) {
    return asOrigin(process.env.VERCEL_URL);
  }

  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeader = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
  const host = hostHeader ?? req.headers.host;
  if (!host) throw new Error("Unable to determine the application origin.");

  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ?? "https";
  return `${protocol}://${host}`;
}

export async function getSpotifyAuthorizationUrl(user: Pick<User, "id">, req: VercelRequest) {
  const callbackUrl = new URL("/", getApplicationOrigin(req));
  callbackUrl.searchParams.set("spotify", "connected");

  const { url } = await startAuthorization(
    CONNECTOR_UID,
    getConnectParams(user),
    { callbackUrl: callbackUrl.toString() },
  );

  return url;
}

export { UserAuthorizationRequiredError };
