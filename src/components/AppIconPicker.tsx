import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { toast } from "sonner";
import { Check } from "lucide-react";

const AppIcon = registerPlugin<{ set(o: { name: string }): Promise<void>; get(): Promise<{ name: string }> }>("AppIcon");
const ICONS = [
  { id: "Default", name: "Classic", bg: "#FFFFFF" },
  { id: "Gold", name: "Gold", bg: "#D4AF37" },
  { id: "Midnight", name: "Midnight", bg: "#0B0B12" },
  { id: "Violet", name: "Violet", bg: "#6D28D9" },
  { id: "Emerald", name: "Emerald", bg: "#059669" },
  { id: "Rose", name: "Rose", bg: "#E11D48" },
  { id: "Sky", name: "Sky", bg: "#0284C7" },
];

/** Android app only: choose which icon Primegram shows on your home screen. */
const AppIconPicker = () => {
  const [current, setCurrent] = useState("Default");
  const native = Capacitor.isNativePlatform();
  useEffect(() => { if (native) void AppIcon.get().then(r => setCurrent(r.name)).catch(() => undefined); }, [native]);
  if (!native) return null;
  const pick = async (id: string) => {
    try { await AppIcon.set({ name: id }); setCurrent(id); toast.success("Icon changed. It may take a few seconds to update on your home screen."); }
    catch { toast.error("Couldn't change the icon. Update the app to the latest version."); }
  };
  return (
    <div className="liquid-glass rounded-2xl p-4">
      <p className="text-sm font-semibold text-foreground">App icon</p>
      <p className="mb-3 text-xs text-muted-foreground">Pick the look that fits you.</p>
      <div className="grid grid-cols-4 gap-3">
        {ICONS.map(i => (
          <button key={i.id} onClick={() => void pick(i.id)} aria-label={i.name} className="flex flex-col items-center gap-1">
            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 shadow-lg" style={{ background: i.bg }}>
              <span className="text-lg font-black" style={{ color: i.bg === "#FFFFFF" ? "#111" : "#fff" }}>P</span>
              {current === i.id && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-black"><Check className="h-3 w-3" /></span>}
            </span>
            <span className="text-[10px] text-muted-foreground">{i.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
export default AppIconPicker;
