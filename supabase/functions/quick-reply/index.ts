// Sends a reply typed (or tapped) in an Android notification, even while the app is closed.
// The phone's own push token is the credential: it is tied to one user in push_tokens.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  try {
    const { token, to, group, text } = await req.json().catch(() => ({})) as { token?: string; to?: string; group?: string; text?: string };
    const msg = (text ?? "").trim().slice(0, 1000);
    if (!token || !msg || (!to && !group)) return ok({ error: "bad request" }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: dev } = await db.from("push_tokens").select("user_id").eq("token", token).maybeSingle();
    if (!dev) return ok({ error: "unknown device" }, 401);
    const uid = dev.user_id as string;

    if (group) {
      const { data: mem } = await db.from("chat_group_members").select("user_id").eq("group_id", group).eq("user_id", uid).maybeSingle();
      if (!mem) return ok({ error: "not a member" }, 403);
      const { error } = await db.from("group_messages").insert({ group_id: group, sender_id: uid, content: msg });
      if (error) return ok({ error: error.message }, 500);
      return ok({ sent: true });
    }
    const { data: blocked } = await db.from("user_blocks").select("blocker_id").or(`and(blocker_id.eq.${uid},blocked_id.eq.${to}),and(blocker_id.eq.${to},blocked_id.eq.${uid})`).limit(1);
    if (blocked?.length) return ok({ error: "blocked" }, 403);
    const { error } = await db.from("messages").insert({ sender_id: uid, receiver_id: to, content: msg });
    if (error) return ok({ error: error.message }, 500);
    return ok({ sent: true });
  } catch (e) {
    return ok({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});
