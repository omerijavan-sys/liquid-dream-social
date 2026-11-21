import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { finishSpotifyLogin } from "@/services/SpotifyConnect";

/** Handles the redirect back from Spotify login (?code=…&state=primegram-spotify). */
const SpotifyCallback = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("state") === "primegram-spotify-app" && !Capacitor.isNativePlatform()) {
      // opened in the phone's browser tab: hand the result back to the Primegram app
      const code = q.get("code");
      window.location.replace(`com.primegram.app://auth-callback?${code ? `spotify_code=${encodeURIComponent(code)}` : "spotify_error=1"}`);
      return;
    }
    if (new URLSearchParams(window.location.search).get("state") !== "primegram-spotify") return;
    void finishSpotifyLogin()
      .then((handled) => {
        if (!handled) return;
        toast.success("Spotify connected 🎧");
        let back = "/";
        try { back = localStorage.getItem("primegram:spReturn") || "/"; localStorage.removeItem("primegram:spReturn"); } catch { /* ignore */ }
        navigate(back, { replace: true });
        setTimeout(() => window.dispatchEvent(new Event("prime:openMusic")), 300);
      })
      .catch(() => toast.error("Couldn't connect Spotify. Check the redirect URL in your Spotify app settings."));
  }, [navigate]);
  return null;
};
export default SpotifyCallback;
