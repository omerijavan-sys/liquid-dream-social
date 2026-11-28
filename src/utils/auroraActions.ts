import { supabase } from "@/integrations/supabase/client";

/** Pages Aurora may open by voice. Anything not listed here is refused. */
export const ROUTES: Record<string, string> = {
  home: "/", music: "/", feed: "/", sports: "/sports", movies: "/movies", reels: "/reels", profile: "/profile",
  messages: "/messages", chats: "/messages", wallet: "/wallet", settings: "/settings", search: "/search",
  discover: "/discover", create: "/create", post: "/create", notifications: "/notifications", extreme: "/extreme",
  help: "/help", top: "/top", meet: "/meet", random: "/random", bots: "/bots", crush: "/crush",
};

export type AuroraAction =
  | { type: "navigate"; page: string }
  | { type: "search"; query: string }
  | { type: "message"; username: string }
  | { type: "profile"; username: string }
  | { type: "back" }
  | { type: "reload" }
  | { type: "scroll"; direction: "up" | "down" };

const TAG = /^\s*\[\[ACTION:(\{[\s\S]*?\})\]\]\s*/;

/** Splits a streamed reply into the optional leading action tag and the spoken text. */
export function splitAction(full: string): { action: AuroraAction | null; text: string; pending: boolean } {
  const m = full.match(TAG);
  if (m) {
    let action: AuroraAction | null = null;
    try { action = JSON.parse(m[1]) as AuroraAction; } catch { /* ignore */ }
    return { action, text: full.slice(m[0].length), pending: false };
  }
  // tag still streaming in: hide it from the screen and voice
  if (/^\s*\[\[/.test(full) && !full.includes("]]")) return { action: null, text: "", pending: true };
  return { action: null, text: full, pending: false };
}

const clean = (s: unknown) => String(s ?? "").replace(/[^\p{L}\p{N}_. -]/gu, "").trim().slice(0, 40);

/** Runs one action. Returns a short note when it could not be done (spoken back to the user). */
export async function runAction(a: AuroraAction, navigate: (to: string | number) => void): Promise<string | null> {
  switch (a?.type) {
    case "navigate": {
      const path = ROUTES[String(a.page ?? "").toLowerCase()];
      if (!path) return "I can't open that page.";
      navigate(path); return null;
    }
    case "search": {
      const q = String(a.query ?? "").trim().slice(0, 80);
      if (!q) return null;
      navigate(`/search?q=${encodeURIComponent(q)}`); return null;
    }
    case "message":
    case "profile": {
      const name = clean(a.username).replace(/^@/, "");
      if (!name) return "Who should I look for?";
      const { data } = await supabase.from("profiles").select("user_id, username, display_name").or(`username.ilike.${name},display_name.ilike.${name}`).limit(1);
      const p = data?.[0];
      if (!p) return `I couldn't find ${name}.`;
      navigate(a.type === "message" ? `/messages?to=${p.user_id}` : `/profile/${p.user_id}`); return null;
    }
    case "back": navigate(-1); return null;
    case "reload": window.location.reload(); return null;
    case "scroll": window.scrollBy({ top: (a.direction === "up" ? -1 : 1) * window.innerHeight * 0.8, behavior: "smooth" }); return null;
    default: return null;
  }
}
