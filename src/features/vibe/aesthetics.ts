import { useCallback, useEffect, useState } from "react";
import { table } from "../shared/ui";

export interface Aesthetics {
  accent: string; glass_opacity: number; ring: Ring; font: FontKey; theme: ThemeKey;
  status_text: string | null; pinned_title: string | null; pinned_artist: string | null; pinned_art_url: string | null; pinned_audio_url: string | null;
}
export type Ring = "none" | "pulse" | "spin" | "aurora" | "founder";
export type FontKey = "sans" | "serif" | "mono" | "script" | "display";
export type ThemeKey = "obsidian" | "midnight" | "sunset" | "obsidian_gold";

export const DEFAULTS: Aesthetics = { accent: "#a78bfa", glass_opacity: 8, ring: "none", font: "sans", theme: "obsidian", status_text: null, pinned_title: null, pinned_artist: null, pinned_art_url: null, pinned_audio_url: null };

export const ACCENTS = ["#a78bfa", "#f472b6", "#22d3ee", "#34d399", "#fbbf24", "#fb7185", "#60a5fa", "#f97316"];
export const FONTS: Record<FontKey, { label: string; css: string }> = {
  sans: { label: "Clean", css: "ui-sans-serif, system-ui, sans-serif" },
  serif: { label: "Editorial", css: "Georgia, 'Times New Roman', serif" },
  mono: { label: "Mono", css: "ui-monospace, 'SF Mono', Menlo, monospace" },
  script: { label: "Script", css: "'Brush Script MT', 'Segoe Script', cursive" },
  display: { label: "Display", css: "'Arial Black', Impact, sans-serif" },
};
export const THEMES: Record<ThemeKey, { label: string; bg: string; locked?: "obsidian_gold_theme" }> = {
  obsidian: { label: "Obsidian", bg: "#09090B" },
  midnight: { label: "Midnight", bg: "linear-gradient(160deg,#0b1020,#111a3a)" },
  sunset: { label: "Sunset", bg: "linear-gradient(160deg,#1a0b14,#3a1226 60%,#4a1d12)" },
  obsidian_gold: { label: "Obsidian Gold", bg: "linear-gradient(160deg,#0c0a05,#1c1608 55%,#2a1f08)", locked: "obsidian_gold_theme" },
};
export const RINGS: { key: Ring; label: string; locked?: "founder_ring" }[] = [
  { key: "none", label: "None" }, { key: "pulse", label: "Pulse" }, { key: "spin", label: "Spin" }, { key: "aurora", label: "Aurora" }, { key: "founder", label: "Founder", locked: "founder_ring" },
];

const COLS = "accent, glass_opacity, ring, font, theme, status_text, pinned_title, pinned_artist, pinned_art_url, pinned_audio_url";

export const useAesthetics = (userId?: string | null) => {
  const [a, setA] = useState<Aesthetics>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!userId) return;
    let dead = false;
    void table("profile_aesthetics").select(COLS).eq("user_id", userId).maybeSingle().then(({ data }: { data: Aesthetics | null }) => {
      if (!dead) { setA(data ? { ...DEFAULTS, ...data } : DEFAULTS); setLoaded(true); }
    });
    return () => { dead = true; };
  }, [userId]);
  const save = useCallback(async (next: Aesthetics) => {
    if (!userId) return;
    const { error } = await table("profile_aesthetics").upsert({ user_id: userId, ...next }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    setA(next);
  }, [userId]);
  return { a, loaded, save, setA };
};
