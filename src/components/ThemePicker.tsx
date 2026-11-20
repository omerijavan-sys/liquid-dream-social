import { X } from "lucide-react";
import { THEMES, themeById } from "@/utils/chatThemes";

const ThemePicker = ({ value, onPick, onClose }: { value: string; onPick: (id: string) => void; onClose: () => void }) => (
  <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-t-3xl border border-white/15 bg-black/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white backdrop-blur-2xl">
      <div className="flex items-center justify-between"><p className="font-semibold">Chat theme</p><button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button></div>
      <div className="grid grid-cols-3 gap-3">
        {THEMES.map((t) => (
          <button key={t.id} onClick={() => onPick(t.id)} className={`overflow-hidden rounded-2xl border text-left ${value === t.id ? "border-white" : "border-white/15"}`}>
            <div className="h-14" style={{ background: t.bg }}><div className="m-2 ml-auto h-4 w-10 rounded-full" style={{ background: t.mine }} /></div>
            <p className="px-2 py-1 text-xs">{t.name}</p>
          </button>
        ))}
      </div>
      <label className="flex items-center justify-between rounded-2xl border border-white/15 px-3 py-2 text-sm">
        Custom colour
        <input type="color" value={value.startsWith("custom:") ? value.slice(7) : "#d4af37"} onChange={(e) => onPick(`custom:${e.target.value}`)} className="h-8 w-12 rounded bg-transparent" aria-label="Pick a custom colour" />
      </label>
      <p className="text-[11px] text-white/50">Current: {themeById(value).name}</p>
    </div>
  </div>
);
export default ThemePicker;
