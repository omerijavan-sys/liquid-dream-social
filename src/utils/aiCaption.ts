import { authHeader } from "@/utils/authFetch";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prime-ai-chat`;

export interface CaptionContext { mediaType: string; music?: string | null; hint?: string }

const FALLBACKS: Record<string, string[]> = {
  video: ["Caught in the moment 🎬 #primegram", "Turn the sound up 🔊✨", "Watch till the end 👀🔥"],
  image: ["Good light, good mood ☀️ #primegram", "Little moments, big feelings ✨", "Just me being me 📸"],
  text: ["Thinking out loud 💭", "Today's thought — what's yours?", "Say it with me 👇"],
};

/** Suggest captions with the AI service; falls back to built-in ideas if it isn't reachable. */
export async function suggestCaptions(ctx: CaptionContext): Promise<{ captions: string[]; ai: boolean }> {
  const kind = ctx.mediaType === "video" ? "video" : ctx.mediaType === "image" ? "image" : "text";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(CHAT_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: await authHeader() },
      body: JSON.stringify({
        messages: [{ role: "user", content: `Write 3 short, catchy social media captions (max 12 words each, with 1-2 emojis and one hashtag) for a ${kind} post${ctx.music ? ` with the song "${ctx.music}"` : ""}${ctx.hint ? `. The author started with: "${ctx.hint}"` : ""}. Reply with only the 3 captions, one per line, no numbering.` }],
      }),
    });
    clearTimeout(timer);
    if (!res.ok || !res.body) throw new Error("ai unavailable");
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        try { text += JSON.parse(data).choices?.[0]?.delta?.content ?? ""; } catch { /* partial */ }
      }
    }
    const captions = text.split("\n").map(l => l.replace(/^[-*\d.\s"]+|"$/g, "").trim()).filter(Boolean).slice(0, 3);
    if (captions.length) return { captions, ai: true };
  } catch { /* fall through */ }
  return { captions: FALLBACKS[kind], ai: false };
}
