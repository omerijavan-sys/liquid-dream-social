import { useEffect, useRef } from "react";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { getMusicState, nextTrack, prevTrack, stopMusic, subscribeMusic, toggleMusic } from "@/services/MusicEngine";

interface MusicServicePlugin {
  update(o: { title: string; artist: string; playing: boolean }): Promise<void>;
  stop(): Promise<void>;
  addListener(ev: "action", f: (e: { action: string }) => void): Promise<PluginListenerHandle>;
}
const MusicService = registerPlugin<MusicServicePlugin>("MusicService");

/** Android app: keeps songs playing with the screen off or the app minimised (foreground service + notification controls). */
const BackgroundAudio = () => {
  const last = useRef("");
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    const push = () => {
      const s = getMusicState();
      const t = s.track;
      const real = t && !t.key.startsWith("post|") && !t.key.startsWith("clip|");
      const sig = real ? `${t.key}|${s.paused ? 0 : 1}` : "";
      if (sig === last.current) return;
      last.current = sig;
      if (!real) { void MusicService.stop().catch(() => undefined); return; }
      void MusicService.update({ title: t.title, artist: t.artist, playing: !s.paused }).catch(() => undefined);
    };
    const off = subscribeMusic(push);
    const h = MusicService.addListener("action", ({ action }) => {
      if (action === "toggle") toggleMusic();
      else if (action === "next") nextTrack();
      else if (action === "prev") prevTrack();
      else if (action === "stop") stopMusic();
    });
    return () => { off(); void h.then(x => x.remove()); };
  }, []);
  return null;
};
export default BackgroundAudio;
