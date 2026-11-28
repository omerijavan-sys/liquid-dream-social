import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const PLATFORM_RATE = 0.15;
const GROUP_VERIFY_KES = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secret) return json({ error: "Paystack is not configured" }, 503);
    const h = req.headers.get("Authorization");
    if (!h?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: h } } });
    const { data: claims } = await anon.auth.getClaims(h.replace("Bearer ", ""));
    const buyerId = claims?.claims?.sub as string | undefined;
    if (!buyerId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const paymentType = String(body.payment_type ?? "");
    if (!["tip", "subscription", "topup", "group_verify"].includes(paymentType)) return json({ error: "Invalid payment_type" }, 400);
    let amount = Math.round(Number(body.amount_kes) * 100) / 100;
    const email = String(claims?.claims?.email ?? body.buyer_email ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "A valid email is required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    let creatorId: string | null = null;
    let subaccount: string | null = null;

    let groupId: string | null = null;
    if (paymentType === "group_verify") {
      groupId = String(body.group_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(groupId)) return json({ error: "group_id required" }, 400);
      const { data: g } = await admin.from("chat_groups").select("id, created_by, is_verified").eq("id", groupId).maybeSingle();
      if (!g) return json({ error: "Group not found" }, 404);
      if (g.is_verified) return json({ error: "This group is already verified" }, 409);
      const { data: mem } = await admin.from("chat_group_members").select("role").eq("group_id", groupId).eq("user_id", buyerId).maybeSingle();
      if (g.created_by !== buyerId && mem?.role !== "admin") return json({ error: "Only group admins can verify the group" }, 403);
      amount = GROUP_VERIFY_KES; // price is enforced server-side
    }
    if (paymentType !== "topup" && paymentType !== "group_verify") {
      creatorId = String(body.creator_id ?? "");
      if (!creatorId) return json({ error: "creator_id required" }, 400);
      if (creatorId === buyerId) return json({ error: "You can't pay yourself" }, 400);
      const { data: acct } = await admin.from("creator_payout_accounts").select("paystack_subaccount_code, active").eq("user_id", creatorId).maybeSingle();
      if (!acct?.paystack_subaccount_code || !acct.active) return json({ error: "This creator hasn't set up payouts yet" }, 409);
      subaccount = acct.paystack_subaccount_code;
      if (paymentType === "subscription") {
        const { data: cp } = await admin.from("creator_profiles").select("monthly_price").eq("user_id", creatorId).maybeSingle();
        if (!cp?.monthly_price) return json({ error: "This creator has no subscription price" }, 409);
        amount = Number(cp.monthly_price); // price is enforced server-side
      }
    }
    if (!Number.isFinite(amount) || amount < 10 || amount > 150000) return json({ error: "Amount must be between 10 and 150,000 KES" }, 400);

    const platformFee = paymentType === "group_verify" ? amount : paymentType === "topup" ? 0 : Math.round(amount * PLATFORM_RATE * 100) / 100;
    const creatorNet = paymentType === "topup" || paymentType === "group_verify" ? 0 : Math.round((amount - platformFee) * 100) / 100;
    const reference = `pg_${crypto.randomUUID().replace(/-/g, "")}`;
    const origin = String(body.callback_url ?? "").startsWith("https://") ? String(body.callback_url) : undefined;

    const payload: Record<string, unknown> = {
      email,
      amount: Math.round(amount * 100), // KES subunits
      currency: "KES",
      reference,
      channels: body.method === "card" ? ["card"] : body.method === "mpesa" ? ["mobile_money"] : ["mobile_money", "card"],
      metadata: {
        buyer_id: buyerId, creator_id: creatorId, payment_type: paymentType, amount_kes: amount,
        platform_fee_kes: platformFee, creator_net_kes: creatorNet, track_id: body.track_id ?? null, group_id: groupId,
      },
    };
    if (origin) payload.callback_url = origin;
    if (subaccount) { payload.subaccount = subaccount; payload.bearer = "subaccount"; }

    const r = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.status) return json({ error: d?.message || `Paystack error (${r.status})` }, 502);
    return json({ authorization_url: d.data.authorization_url, access_code: d.data.access_code, reference: d.data.reference ?? reference, amount_kes: amount });
  } catch (e) {
    console.error("initialize-paystack-payment", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
