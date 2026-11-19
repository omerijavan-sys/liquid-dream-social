import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const PLATFORM_RATE = 0.15;
const enc = new TextEncoder();

async function hmacSha512Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// deno-lint-ignore no-explicit-any
async function processCharge(admin: any, data: any): Promise<{ ok: boolean; duplicate: boolean }> {
  const reference = String(data.reference ?? "");
  const meta = data.metadata ?? {};
  if (!reference || data.currency !== "KES") return { ok: false, duplicate: false };
  const type = String(meta.payment_type ?? "");
  if (!["tip", "subscription", "topup"].includes(type)) return { ok: false, duplicate: false };
  const gross = Math.round(Number(data.amount)) / 100;
  if (Math.abs(gross - Number(meta.amount_kes)) > 0.01) { console.error("amount mismatch", reference); return { ok: false, duplicate: false }; }
  const buyerId = meta.buyer_id as string;
  const creatorId = (meta.creator_id as string | null) || null;
  const platformFee = type === "topup" ? 0 : Math.round(gross * PLATFORM_RATE * 100) / 100;
  const paystackFee = Math.round(Number(data.fees ?? 0)) / 100;
  // bearer=subaccount: the Paystack processing fee comes out of the creator's 85% share
  const creatorNet = type === "topup" ? 0 : Math.round((gross - platformFee - paystackFee) * 100) / 100;

  const { error: insErr } = await admin.from("transactions").insert({
    reference, payment_type: type, buyer_id: buyerId, creator_id: creatorId, gross_kes: gross,
    platform_fee_kes: platformFee, creator_net_kes: creatorNet, paystack_fee_kes: paystackFee,
    channel: data.channel ?? null, track_id: meta.track_id ?? null, status: "success",
    raw: { id: data.id, paid_at: data.paid_at, channel: data.channel },
  });
  const duplicate = insErr?.code === "23505";
  if (insErr && !duplicate) { console.error("ledger insert failed", insErr); return { ok: false, duplicate: false }; }

  // Unlock steps are idempotent per reference, so a retried webhook can safely repeat them.
  if (type === "subscription" && creatorId) {
    const { data: sub } = await admin.from("subscriptions").select("last_reference, expires_at").eq("subscriber_id", buyerId).eq("creator_id", creatorId).maybeSingle();
    if (sub?.last_reference !== reference) {
      const base = sub && new Date(sub.expires_at) > new Date() ? new Date(sub.expires_at) : new Date();
      const expires = new Date(base.getTime() + 30 * 86400000).toISOString();
      await admin.from("subscriptions").upsert({ subscriber_id: buyerId, creator_id: creatorId, amount_kes: gross, status: "active", last_reference: reference, expires_at: expires }, { onConflict: "subscriber_id,creator_id" });
      await admin.from("creator_subscriptions").upsert({ subscriber_id: buyerId, creator_id: creatorId, amount: Math.round(gross), status: "active", started_at: new Date().toISOString(), expires_at: expires, canceled_at: null }, { onConflict: "subscriber_id,creator_id" });
    }
  } else if (type === "topup") {
    const note = `Paystack top-up ${reference}`;
    const { data: have } = await admin.from("wallet_transactions").select("id").eq("user_id", buyerId).eq("note", note).maybeSingle();
    if (!have) await admin.from("wallet_transactions").insert({ user_id: buyerId, type: "topup", amount: gross, counterparty: "Paystack", note });
  }
  return { ok: true, duplicate };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secret) return json({ error: "Paystack is not configured" }, 503);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const raw = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    if (signature) {
      // ---- Paystack webhook ----
      const expected = await hmacSha512Hex(secret, raw);
      if (!safeEqual(expected, signature.toLowerCase())) return json({ error: "Invalid signature" }, 401);
      const event = JSON.parse(raw);
      if (event.event === "charge.success") await processCharge(admin, event.data);
      return json({ received: true }); // always 200 so Paystack stops retrying
    }

    // ---- Client-triggered verification fallback (authenticated buyer) ----
    const h = req.headers.get("Authorization");
    if (!h?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: h } } });
    const { data: claims } = await anon.auth.getClaims(h.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Unauthorized" }, 401);
    const { reference } = JSON.parse(raw || "{}");
    if (!reference || typeof reference !== "string") return json({ error: "reference required" }, 400);
    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.status) return json({ error: "Could not verify payment" }, 502);
    if (d.data?.status !== "success") return json({ status: d.data?.status ?? "pending" });
    if (d.data?.metadata?.buyer_id !== userId) return json({ error: "Not your payment" }, 403);
    const res = await processCharge(admin, d.data);
    return json({ status: res.ok ? "success" : "failed" });
  } catch (e) {
    console.error("paystack-webhook", e);
    return json({ error: "Unexpected error" }, 500);
  }
});
