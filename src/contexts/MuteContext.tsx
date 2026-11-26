import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface MuteContextValue {
  muted: boolean;
  toggleMuted: () => void;
  setMuted: (v: boolean) => void;
}

const MuteContext = createContext<MuteContextValue>({
  muted: true,
  toggleMuted: () => {},
  setMuted: () => {},
});

export const MuteProvider = ({ children }: { children: ReactNode }) => {
  const [muted, setMuted] = useState(true);
  // Pressing volume up turns the sound on. Browsers that expose the key send "AudioVolumeUp"; the Android app
  // sends the "primegram:volume-up" event from its native key handler.
  useEffect(() => {
    const on = () => setMuted(false);
    const key = (e: KeyboardEvent) => { if (e.key === "AudioVolumeUp" || e.key === "VolumeUp" || e.code === "AudioVolumeUp") on(); };
    window.addEventListener("keydown", key);
    window.addEventListener("primegram:volume-up", on);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("primegram:volume-up", on); };
  }, []);
  return (
    <MuteContext.Provider value={{ muted, toggleMuted: () => setMuted((m) => !m), setMuted }}>
      {children}
    </MuteContext.Provider>
  );
};

export const useMute = () => useContext(MuteContext);
