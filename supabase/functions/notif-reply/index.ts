// Sends a reply typed into an Android notification while the app is closed.
// The device's own push token is the credential: it is secret to that phone and tied to one user in push_tokens.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...cors } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { token, kind, to, group, text } = await req.json() as { token?: string; kind?: string; to?: string; group?: string; text?: string };
    const body = (text ?? "").trim().slice(0, 1000);
    if (!token || !body) return ok({ error: "missing fields" }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: dev } = await db.from("push_tokens").select("user_id").eq("token", token).maybeSingle();
    if (!dev) return ok({ error: "unknown device" }, 401);
    const me = dev.user_id as string;
    if (kind === "group" && group) {
      const { data: mem } = await db.from("chat_group_members").select("user_id").eq("group_id", group).eq("user_id", me).maybeSingle();
      if (!mem) return ok({ error: "not a member" }, 403);
      const { error } = await db.from("group_messages").insert({ group_id: group, sender_id: me, content: body });
      if (error) return ok({ error: error.message }, 500);
    } else if (to) {
      if (to === me) return ok({ error: "invalid" }, 400);
      const { error } = await db.from("messages").insert({ sender_id: me, receiver_id: to, content: body });
      if (error) return ok({ error: error.message }, 500);
    } else return ok({ error: "no recipient" }, 400);
    return ok({ sent: true });
  } catch (e) {
    return ok({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});
