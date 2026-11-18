// AI backend. Uses AI_API_KEY (+ optional AI_BASE_URL / AI_MODEL, OpenAI-compatible) when set,
// otherwise the free keyless Pollinations endpoint so the assistant always works.
export function aiConfig() {
  const key = Deno.env.get("AI_API_KEY");
  return {
    url: `${(Deno.env.get("AI_BASE_URL") ?? (key ? "https://api.openai.com/v1" : "https://text.pollinations.ai/openai")).replace(/\/$/, "")}${key ? "/chat/completions" : ""}`,
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) } as Record<string, string>,
    model: Deno.env.get("AI_MODEL") ?? (key ? "gpt-4o-mini" : "openai"),
  };
}
export async function aiComplete(messages: unknown[]): Promise<string> {
  const c = aiConfig();
  const r = await fetch(c.url, { method: "POST", headers: c.headers, body: JSON.stringify({ model: c.model, messages }) });
  if (!r.ok) throw new Error(`AI service unavailable (${r.status})`);
  const d = await r.json();
  return d?.choices?.[0]?.message?.content ?? "";
}
