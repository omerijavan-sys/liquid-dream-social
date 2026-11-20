import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { finishNativeSpotify } from "@/services/SpotifyConnect";

export const NATIVE_REDIRECT = "com.primegram.app://auth-callback";

/** Opens Google sign-in in the system browser (Chrome Custom Tab) from the Android app. */
export async function nativeGoogleSignIn() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Could not start Google sign-in");
  await Browser.open({ url: data.url });
}

/** Catches the com.primegram.app://auth-callback deep link and finishes sign-in inside the app. */
const NativeAuthBridge = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapApp.addListener("appUrlOpen", async ({ url }) => {
      if (!url.startsWith(NATIVE_REDIRECT)) return;
      try { await Browser.close(); } catch { /* already closed */ }
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
