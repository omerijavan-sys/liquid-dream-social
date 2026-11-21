export interface ChatTheme { id: string; name: string; bg: string; mine: string; theirs: string; accent: string }

const mk = (id: string, name: string, c1: string, c2: string, base = "#06050a"): ChatTheme => ({
  id, name, accent: c1,
  bg: `radial-gradient(ellipse at 15% 20%, ${c1}33, transparent 45%), radial-gradient(ellipse at 85% 80%, ${c2}30, transparent 45%), ${base}`,
  mine: `linear-gradient(135deg, ${c1}cc, ${c2}aa)`,
  theirs: "rgba(255,255,255,0.07)",
});

export const THEMES: ChatTheme[] = [
  mk("gold", "Gold", "#d4af37", "#8a5a00", "#050505"),
  mk("ocean", "Ocean", "#0ea5e9", "#1d4ed8"),
  mk("sunset", "Sunset", "#f97316", "#db2777"),
  mk("forest", "Forest", "#22c55e", "#047857"),
  mk("rose", "Rose", "#fb7185", "#be185d"),
  mk("violet", "Violet", "#a78bfa", "#6d28d9"),
  mk("aurora", "Aurora", "#2dd4bf", "#8b5cf6"),
  mk("midnight", "Midnight", "#64748b", "#1e293b", "#02030a"),
  mk("candy", "Candy", "#f472b6", "#38bdf8"),
];

/** Built-in theme id, or `custom:#rrggbb` for a colour the user picked. */
export function themeById(id?: string | null): ChatTheme {
  if (id?.startsWith("custom:")) {
    const c = id.slice(7);
    if (/^#[0-9a-fA-F]{6}$/.test(c)) return mk(id, "Custom", c, c + "", "#06050a");
  }
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export const dmThemeKey = (partnerId: string) => `primegram:dmTheme:${partnerId}`;
export const readDmTheme = (partnerId: string): string => { try { return localStorage.getItem(dmThemeKey(partnerId)) || "gold"; } catch { return "gold"; } };
export const writeDmTheme = (partnerId: string, id: string) => { try { localStorage.setItem(dmThemeKey(partnerId), id); } catch { /* ignore */ } };
