import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiComplete } from "../_shared/ai.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const h = req.headers.get("Authorization");
    if (!h?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const c = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: h } } });
    const { data } = await c.auth.getClaims(h.replace("Bearer ", ""));
    if (!data?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const { prompt } = await req.json();
    const text = await aiComplete([{ role: "system", content: "You are a music recommender. Reply with up to 5 lines in the form 'Title - Artist'. No other text." }, { role: "user", content: String(prompt ?? "").slice(0, 2000) }]);
    return json({ recommendations: text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 5) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "AI error" }, 500);
  }
});
