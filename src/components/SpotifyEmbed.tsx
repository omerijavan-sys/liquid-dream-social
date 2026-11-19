import { useEffect, useRef } from "react";

declare global {
  interface Window { onSpotifyIframeApiReady?: (api: any) => void }
}

let apiPromise: Promise<any> | null = null;
function loadSpotifyApi(): Promise<any> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = (api) => resolve(api);
    const s = document.createElement("script");
    s.src = "https://open.spotify.com/embed/iframe-api/v1";
    s.async = true;
    s.onerror = () => { apiPromise = null; reject(new Error("Spotify player could not load")); };
    document.body.appendChild(s);
  });
  return apiPromise;
}

export const spotifyIdOf = (id?: string | null) => (id && id.startsWith("sp_") ? id.slice(3) : null);

/** Official Spotify player for a track. Plays Spotify audio (full track when the listener is signed in to Spotify, otherwise a preview). */
const SpotifyEmbed = ({ trackId, kind = "track", autoplay = true, onEnded, onFail, height }: {
  trackId: string; kind?: "track" | "playlist" | "album"; autoplay?: boolean; onEnded?: () => void; onFail?: () => void; height?: number;
}) => {
  height = height ?? (kind === "track" ? 80 : 352);
  const hostRef = useRef<HTMLDivElement>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  useEffect(() => {
    let controller: any = null;
    let dead = false;
    let fired = false;
    loadSpotifyApi().then((api) => {
      if (dead || !hostRef.current) return;
      const el = document.createElement("div");
      hostRef.current.innerHTML = "";
      hostRef.current.appendChild(el);
      api.createController(el, { uri: `spotify:${kind}:${trackId}`, width: "100%", height }, (c: any) => {
        controller = c;
        c.addListener("ready", () => { if (autoplay) c.play(); });
        c.addListener("playback_update", (e: any) => {
          const { position, duration, isPaused } = e.data || {};
          if (duration > 0 && position >= duration - 400 && !fired && isPaused !== false) { fired = true; endedRef.current?.(); }
          else if (position < (duration || 0) - 2000) fired = false;
        });
      });
    }).catch(() => onFail?.());
    return () => { dead = true; try { controller?.destroy?.(); } catch { /* ignore */ } };
  }, [trackId, kind, autoplay, height]);

  return <div ref={hostRef} style={{ minHeight: height }} className="w-full overflow-hidden rounded-xl" />;
};

export default SpotifyEmbed;
