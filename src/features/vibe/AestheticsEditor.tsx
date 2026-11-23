import { useState } from "react";
import { Lock, X } from "lucide-react";
import { toast } from "sonner";
import { glass, glow } from "../shared/ui";
import { useReferral } from "../referrals/referral";
import { ACCENTS, type Aesthetics, FONTS, RINGS, THEMES, type ThemeKey } from "./aesthetics";

/** Bottom sheet to customise accent glow, glass opacity, avatar ring, bio font, theme and pinned status/track. */
const AestheticsEditor = ({ value, onSave, onClose }: { value: Aesthetics; onSave: (a: Aesthetics) => Promise<void>; onClose: () => void }) => {
  const [v, setV] = useState<Aesthetics>(value);
  const [busy, setBusy] = useState(false);
  const { perks = [], count = 0 } = useReferral();
  const set = <K extends keyof Aesthetics>(k: K, x: Aesthetics[K]) => setV((p) => ({ ...p, [k]: x }));
  const save = async () => {
    setBusy(true);
    try {
      const clean = { ...v, pinned_audio_url: v.pinned_audio_url && /^https:\/\//i.test(v.pinned_audio_url) ? v.pinned_audio_url : null };
      await onSave(clean); toast.success("Vibe saved ✨"); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save"); }
    finally { setBusy(false); }
  };
  const h = (t: string) => <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-widest text-white/50">{t}</p>;
  const inp = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none";
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`${glass} max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#09090B]/95 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white`}>
        <div className="flex items-center justify-between"><p className="text-lg font-bold">Customize your vibe</p><button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button></div>

        {h("Glow color")}
        <div className="flex flex-wrap items-center gap-2.5">
          {ACCENTS.map((c) => <button key={c} onClick={() => set("accent", c)} aria-label={c} className={`h-8 w-8 rounded-full border-2 ${v.accent === c ? "border-white" : "border-transparent"}`} style={{ background: c, boxShadow: glow(c, 0.7, 12) }} />)}
          <input type="color" value={v.accent} onChange={(e) => set("accent", e.target.value)} aria-label="Custom color" className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent p-0" />
        </div>

        {h(`Frosted glass · ${v.glass_opacity}%`)}
        <input type="range" min={2} max={40} value={v.glass_opacity} onChange={(e) => set("glass_opacity", Number(e.target.value))} className="w-full" style={{ accentColor: v.accent }} />

        {h("Avatar ring")}
        <div className="flex flex-wrap gap-2">
          {RINGS.map((r) => { const lock = !!r.locked && !perks.includes(r.locked); return (
            <button key={r.key} disabled={lock} onClick={() => set("ring", r.key)} className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${v.ring === r.key ? "border-white bg-white/15" : "border-white/10 bg-white/5"} disabled:opacity-50`}>{lock && <Lock className="h-3 w-3" />}{r.label}</button>
          ); })}
        </div>

        {h("Theme")}
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(THEMES) as ThemeKey[]).map((k) => { const t = THEMES[k]; const lock = !!t.locked && !perks.includes(t.locked); return (
            <button key={k} disabled={lock} onClick={() => set("theme", k)} className={`relative h-14 overflow-hidden rounded-xl border text-left text-xs font-semibold ${v.theme === k ? "border-white" : "border-white/10"} disabled:opacity-60`} style={{ background: t.bg }}>
              <span className="absolute bottom-1.5 left-2 flex items-center gap-1">{lock && <Lock className="h-3 w-3" />}{t.label}</span>
              {lock && <span className="absolute right-2 top-1.5 text-[9px] text-amber-200">Invite {Math.max(0, 3 - count)} more</span>}
            </button>
          ); })}
        </div>

        {h("Bio font")}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FONTS) as (keyof typeof FONTS)[]).map((k) => <button key={k} onClick={() => set("font", k)} className={`rounded-full border px-3 py-1.5 text-sm ${v.font === k ? "border-white bg-white/15" : "border-white/10 bg-white/5"}`} style={{ fontFamily: FONTS[k].css }}>{FONTS[k].label}</button>)}
        </div>

        {h("Status")}
        <input value={v.status_text ?? ""} onChange={(e) => set("status_text", e.target.value.slice(0, 80) || null)} placeholder="What's your vibe right now?" className={inp} />
        {h("Pinned track")}
        <div className="space-y-2">
          <input value={v.pinned_title ?? ""} onChange={(e) => set("pinned_title", e.target.value.slice(0, 120) || null)} placeholder="Song title" className={inp} />
          <input value={v.pinned_artist ?? ""} onChange={(e) => set("pinned_artist", e.target.value.slice(0, 120) || null)} placeholder="Artist" className={inp} />
          <input value={v.pinned_audio_url ?? ""} onChange={(e) => set("pinned_audio_url", e.target.value.trim() || null)} placeholder="Audio / song link (https://…, optional)" inputMode="url" className={inp} />
        </div>

        <button disabled={busy} onClick={() => void save()} className="mt-5 w-full rounded-2xl py-3 text-sm font-bold text-black disabled:opacity-50" style={{ background: v.accent, boxShadow: glow(v.accent, 0.6, 22) }}>{busy ? "Saving…" : "Save vibe"}</button>
      </div>
    </div>
  );
};
export default AestheticsEditor;
