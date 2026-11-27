import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { closeExternalBrowser, openExternalUrl } from "@/utils/openExternalUrl";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { finishNativeSpotify } from "@/services/SpotifyConnect";

export const NATIVE_REDIRECT = "com.primegram.app://auth-callback";

const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined;

/**
 * Google's own account picker inside the app (no browser hand-off), exchanged for a Supabase session.
 * Returns false when the installed APK doesn't have the plugin yet, so the caller can use the browser flow instead.
 */
async function nativeGoogleIdTokenSignIn(): Promise<boolean> {
  if (!GOOGLE_WEB_CLIENT_ID || !Capacitor.isPluginAvailable("SocialLogin")) return false;
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  await SocialLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID } });
  const res = await SocialLogin.login({ provider: "google", options: {} });
  const idToken = (res as { result?: { idToken?: string | null } }).result?.idToken;
  if (!idToken) throw new Error("Google sign-in was cancelled");
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
  if (error) throw error;
  toast.success("Signed in with Google");
  window.location.replace("/");
  return true;
}

/** Google sign-in from the Android app: native account picker when available, otherwise the system browser. */
export async function nativeGoogleSignIn() {
  if (await nativeGoogleIdTokenSignIn()) return;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Could not start Google sign-in");
  await openExternalUrl(data.url);
}

/** Catches the com.primegram.app://auth-callback deep link and finishes sign-in inside the app. */
const NativeAuthBridge = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapApp.addListener("appUrlOpen", async ({ url }) => {
      if (!url.startsWith(NATIVE_REDIRECT)) return;
      await closeExternalBrowser();
      if (url.includes("spotify_code=") || url.includes("spotify_error=")) {
        try {
          const code = new URL(url).searchParams.get("spotify_code");
          if (!code) throw new Error("Spotify login was cancelled");
          await finishNativeSpotify(code);
          toast.success("Spotify connected 🎧");
          setTimeout(() => window.dispatchEvent(new Event("prime:openMusic")), 300);
        } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't connect Spotify"); }
        return;
      }
      try {
        const u = new URL(url.replace("#", url.includes("?") ? "&" : "?"));
        const err = u.searchParams.get("error_description") || u.searchParams.get("error");
        if (err) throw new Error(err);
        const code = u.searchParams.get("code");
        const access_token = u.searchParams.get("access_token");
        const refresh_token = u.searchParams.get("refresh_token");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
        } else throw new Error("Sign-in response was empty");
        toast.success("Signed in with Google");
        window.location.replace("/");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Google sign-in failed");
      }
    });
    return () => { void handle.then(h => h.remove()); };
  }, []);
  return null;
};
export default NativeAuthBridge;
