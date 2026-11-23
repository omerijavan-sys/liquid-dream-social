import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { toast } from "sonner";
import { Check } from "lucide-react";

const AppIcon = registerPlugin<{ set(o: { name: string }): Promise<void>; get(): Promise<{ name: string }> }>("AppIcon");
const ICONS = [
  { id: "Default", name: "Classic", img: "/icons/p-default.png" },
  { id: "Gold", name: "Gold", img: "/icons/p-gold.png" },
  { id: "Midnight", name: "Midnight", img: "/icons/p-midnight.png" },
  { id: "Violet", name: "Violet", img: "/icons/p-violet.png" },
  { id: "Emerald", name: "Emerald", img: "/icons/p-emerald.png" },
  { id: "Rose", name: "Rose", img: "/icons/p-rose.png" },
  { id: "Sky", name: "Sky", img: "/icons/p-sky.png" },
];
/** Neon "Prime X" glass icons. */
const X_ICONS = [
  { id: "XViolet", name: "X Violet", img: "/icons/xviolet.png" },
  { id: "XBlue", name: "X Blue", img: "/icons/xblue.png" },
  { id: "XCyan", name: "X Cyan", img: "/icons/xcyan.png" },
  { id: "XGreen", name: "X Green", img: "/icons/xgreen.png" },
  { id: "XGold", name: "X Gold", img: "/icons/xgold.png" },
  { id: "XRed", name: "X Red", img: "/icons/xred.png" },
  { id: "XPink", name: "X Pink", img: "/icons/xpink.png" },
  { id: "XSilver", name: "X Silver", img: "/icons/xsilver.png" },
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
  const grid = (list: typeof ICONS) => (
    <div className="grid grid-cols-4 gap-3">
      {list.map(i => (
        <button key={i.id} onClick={() => void pick(i.id)} aria-label={i.name} className="flex flex-col items-center gap-1">
          <span className="relative flex h-14 w-14 items-center justify-center">
            <img src={i.img} alt="" className="h-14 w-14 rounded-2xl shadow-lg" />
            {current === i.id && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-black"><Check className="h-3 w-3" /></span>}
          </span>
          <span className="text-[11px] text-muted-foreground">{i.name}</span>
        </button>
      ))}
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="liquid-glass relative z-10 rounded-2xl p-4">
        <p className="text-sm font-semibold text-foreground">Prime X · neon glass</p>
        <p className="mb-3 text-xs text-muted-foreground">Dark glass X with a glowing edge.</p>
        {grid(X_ICONS)}
      </div>
      <div className="liquid-glass relative z-10 rounded-2xl p-4">
        <p className="text-sm font-semibold text-foreground">Classic</p>
        <p className="mb-3 text-xs text-muted-foreground">Pick the look that fits you.</p>
        {grid(ICONS)}
      </div>
    </div>
  );
};
export default AppIconPicker;
