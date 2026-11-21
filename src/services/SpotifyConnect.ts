import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

const LS = "primegram:spotify";
const SCOPES = "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state";
interface Tok { access: string; refresh: string; exp: number }
const SITE = "https://primegram-extreme.vercel.app/";
const isNative = () => Capacitor.isNativePlatform();
// The installed app can't use its own https://localhost address with Spotify, so login returns through the website, which hands the code back to the app.
const redirectUri = () => (isNative() ? SITE : `${window.location.origin}/`);
const changed = () => window.dispatchEvent(new Event("prime:spotifyChanged"));

const load = (): Tok | null => { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch { return null; } };
const save = (t: Tok | null) => { try { t ? localStorage.setItem(LS, JSON.stringify(t)) : localStorage.removeItem(LS); } catch { /* ignore */ } };

let clientIdCache: string | null = null;
async function clientId(): Promise<string> {
  if (clientIdCache) return clientIdCache;
  const { data } = await supabase.functions.invoke("spotify-config");
  if (!data?.clientId) throw new Error("Spotify isn't configured");
  return (clientIdCache = data.clientId as string);
}

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = () => b64(crypto.getRandomValues(new Uint8Array(32)).buffer);

export const isSpotifyConnected = () => !!load();
export const disconnectSpotify = () => { save(null); changed(); };

export async function startSpotifyLogin() {
  const id = await clientId();
  const verifier = rand();
  const challenge = b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  try { sessionStorage.setItem("primegram:spVerifier", verifier); localStorage.setItem("primegram:spVerifier", verifier); localStorage.setItem("primegram:spReturn", window.location.pathname + window.location.search); } catch { /* ignore */ }
  const u = new URL("https://accounts.spotify.com/authorize");
  u.search = new URLSearchParams({ client_id: id, response_type: "code", redirect_uri: redirectUri(), scope: SCOPES, code_challenge_method: "S256", code_challenge: challenge, state: isNative() ? "primegram-spotify-app" : "primegram-spotify" }).toString();
  if (isNative()) { const { Browser } = await import("@capacitor/browser"); await Browser.open({ url: u.toString() }); return; }
  window.location.assign(u.toString());
}

/** Installed app: the website bounced the Spotify code back through com.primegram.app://auth-callback?spotify_code=… */
export async function finishNativeSpotify(code: string) {
  const verifier = localStorage.getItem("primegram:spVerifier");
  if (!verifier) throw new Error("Login expired, try again");
  await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: verifier });
  changed();
}

async function tokenRequest(params: Record<string, string>): Promise<Tok> {
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: await clientId(), ...params }),
  });
  if (!r.ok) throw new Error(`Spotify login failed (${r.status})`);
  const d = await r.json();
  const t: Tok = { access: d.access_token, refresh: d.refresh_token ?? load()?.refresh ?? "", exp: Date.now() + (d.expires_in - 60) * 1000 };
  save(t);
  return t;
}

/** Called on the redirect back from Spotify. Returns true if it handled a login. */
export async function finishSpotifyLogin(): Promise<boolean> {
  const p = new URLSearchParams(window.location.search);
  if (p.get("state") !== "primegram-spotify") return false;
  const code = p.get("code");
  window.history.replaceState({}, "", window.location.pathname);
  const verifier = sessionStorage.getItem("primegram:spVerifier") || localStorage.getItem("primegram:spVerifier");
  if (!code || !verifier) return true;
  await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: verifier });
  changed();
  return true;
}

export async function spotifyToken(): Promise<string | null> {
  let t = load();
  if (!t) return null;
  if (Date.now() > t.exp) {
    try { t = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh }); } catch { save(null); return null; }
  }
  return t.access;
}

// ---- Web Playback SDK (Premium only; not supported in Android WebView) ----
declare global { interface Window { Spotify?: any; onSpotifyWebPlaybackSDKReady?: () => void } }
let sdkPromise: Promise<void> | null = null;
const loadSdk = () => (sdkPromise ??= new Promise<void>((res, rej) => {
  if (window.Spotify) return res();
  window.onSpotifyWebPlaybackSDKReady = () => res();
  const s = document.createElement("script"); s.src = "https://sdk.scdn.co/spotify-player.js"; s.async = true; s.onerror = () => { sdkPromise = null; rej(new Error("sdk")); };
  document.body.appendChild(s);
}));

export interface SpState { paused: boolean; position: number; duration: number; title?: string }
let player: any = null; let deviceId: string | null = null; let readyPromise: Promise<string> | null = null;

/** Resolves a device id when the user is connected AND has Premium; rejects otherwise. */
export function initSpotifyPlayer(onState: (s: SpState) => void): Promise<string> {
  if (readyPromise) { return readyPromise; }
  readyPromise = (async () => {
    await loadSdk();
    return new Promise<string>((resolve, reject) => {
      player = new window.Spotify.Player({ name: "Primegram", getOAuthToken: (cb: (t: string) => void) => { void spotifyToken().then(t => t && cb(t)); }, volume: 0.9 });
      player.addListener("ready", ({ device_id }: { device_id: string }) => { deviceId = device_id; resolve(device_id); });
      for (const ev of ["initialization_error", "authentication_error", "account_error", "playback_error"]) player.addListener(ev, () => { reject(new Error(ev)); });
      player.addListener("player_state_changed", (st: any) => { if (st) onState({ paused: st.paused, position: st.position, duration: st.duration, title: st.track_window?.current_track?.name }); });
      player.connect().then((ok: boolean) => { if (!ok) reject(new Error("connect")); });
      setTimeout(() => reject(new Error("timeout")), 10000);
    });
  })().catch(e => { readyPromise = null; throw e; });
  return readyPromise;
}

export async function playOnSpotify(kind: "track" | "playlist" | "album", id: string) {
  await player?.activateElement?.();
  const token = await spotifyToken();
  if (!token || !deviceId) throw new Error("not ready");
  const body = kind === "track" ? { uris: [`spotify:track:${id}`] } : { context_uri: `spotify:${kind}:${id}` };
  const r = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok && r.status !== 204) throw new Error(`play ${r.status}`);
}
export const spotifyToggle = () => player?.togglePlay?.();
export const spotifySeek = (ms: number) => player?.seek?.(ms);
export const spotifyNext = () => player?.nextTrack?.();
export const spotifyPrev = () => player?.previousTrack?.();
export const spotifyStop = () => { try { player?.pause?.(); } catch { /* ignore */ } };
