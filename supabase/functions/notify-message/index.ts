// Sends Android pushes (Firebase Cloud Messaging v1): new direct messages, group messages and incoming calls.
// Secret needed: FCM_SERVICE_ACCOUNT (the full Firebase service-account JSON).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const b64u = (b: ArrayBuffer | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = ""; bytes.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function accessToken(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claim}`));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${b64u(sig)}` }),
  });
  if (!r.ok) throw new Error(`FCM auth failed (${r.status}) ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).access_token as string;
}

type Msg = Record<string, unknown>;

Deno.serve(async (req) => {
  const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  try {
    const input = await req.json().catch(() => ({})) as { id?: string; call?: string; group_msg?: string; test?: string };
    const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!raw) return ok({ skipped: "FCM_SERVICE_ACCOUNT not set" });
    const sa = JSON.parse(raw);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const nameOf = async (uid: string) => {
      const { data } = await db.from("profiles").select("display_name,username").eq("user_id", uid).maybeSingle();
      return data?.display_name || data?.username || "Someone";
    };

    let targets: string[] = []; let build: (() => Msg) | null = null;
    if (typeof input.id === "string") {
      // claim the message once so retries never double-notify
      const { data: msg } = await db.from("messages").update({ notified_at: new Date().toISOString() }).eq("id", input.id).is("notified_at", null).select("id,sender_id,receiver_id,content,media_type").maybeSingle();
      if (!msg) return ok({ skipped: "already sent or missing" });
      const name = await nameOf(msg.sender_id);
      const body = msg.media_type === "image" ? "📷 Photo" : msg.media_type === "video" ? "🎥 Video" : msg.media_type === "audio" ? "🎤 Voice message" : msg.media_type ? "Shared a post" : (msg.content || "").slice(0, 120);
      targets = [msg.receiver_id];
      build = () => ({ notification: { title: name, body }, data: { type: "message", sender: msg.sender_id }, android: { priority: "HIGH", notification: { channel_id: "messages", tag: `dm-${msg.sender_id}`, sound: "default" } } });
    } else if (typeof input.group_msg === "string") {
      const { data: gm } = await db.from("group_messages").select("id,group_id,sender_id,content,media_type").eq("id", input.group_msg).maybeSingle();
      if (!gm) return ok({ skipped: "missing" });
      const [{ data: g }, { data: mem }] = await Promise.all([
        db.from("chat_groups").select("name").eq("id", gm.group_id).maybeSingle(),
        db.from("chat_group_members").select("user_id").eq("group_id", gm.group_id),
      ]);
      const sender = await nameOf(gm.sender_id);
      targets = (mem ?? []).map((m: { user_id: string }) => m.user_id).filter((u: string) => u !== gm.sender_id);
      const body = `${sender}: ${gm.media_type ? "📎 Media" : (gm.content || "").slice(0, 100)}`;
      build = () => ({ notification: { title: g?.name ?? "Group", body }, data: { type: "message", group: gm.group_id }, android: { priority: "HIGH", notification: { channel_id: "messages", tag: `grp-${gm.group_id}`, sound: "default" } } });
    } else if (typeof input.call === "string") {
      const { data: c } = await db.from("call_invitations").select("id,caller_id,receiver_id,audio,status,created_at").eq("id", input.call).maybeSingle();
      if (!c || c.status !== "ringing") return ok({ skipped: "call not ringing" });
      const name = await nameOf(c.caller_id);
      targets = [c.receiver_id];
      build = () => ({
        notification: { title: `Incoming ${c.audio ? "voice" : "video"} call`, body: `${name} is calling you` },
        data: { type: "call", call_id: c.id, sender: c.caller_id, audio: c.audio ? "1" : "0" },
        android: { priority: "HIGH", ttl: "45s", notification: { channel_id: "calls", tag: `call-${c.id}`, sound: "default", default_vibrate_timings: true, notification_priority: "PRIORITY_MAX", visibility: "PUBLIC", sticky: false } },
      });
    } else if (typeof input.test === "string") {
      targets = [input.test];
      build = () => ({ notification: { title: "Primegram", body: "Test notification ✅" }, data: { type: "message" }, android: { priority: "HIGH", notification: { channel_id: "messages", sound: "default" } } });
    } else return ok({ error: "nothing to send" }, 400);

    const { data: tokens } = await db.from("push_tokens").select("token").in("user_id", targets);
    if (!tokens?.length) return ok({ skipped: "no devices" });
    const at = await accessToken(sa);
    let sent = 0; const errors: string[] = [];
    for (const t of tokens) {
      const message = { ...build!(), token: t.token };
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" }, body: JSON.stringify({ message }),
      });
      if (r.ok) sent++;
      else {
        const txt = await r.text(); errors.push(`${r.status} ${txt.slice(0, 300)}`);
        if (txt.includes("UNREGISTERED") || txt.includes("NOT_FOUND")) await db.from("push_tokens").delete().eq("token", t.token);
      }
    }
    return ok({ sent, errors });
  } catch (e) {
    return ok({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});
