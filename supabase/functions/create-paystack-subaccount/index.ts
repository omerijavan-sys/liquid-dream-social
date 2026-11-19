import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const PLATFORM_PERCENT = 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secret) return json({ error: "Paystack is not configured" }, 503);
    const h = req.headers.get("Authorization");
    if (!h?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: h } } });
    const { data: claims } = await anon.auth.getClaims(h.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const business_name = String(body.business_name ?? "").trim().slice(0, 80);
    const settlement_bank = String(body.settlement_bank ?? "MPESA").trim().toUpperCase().slice(0, 20);
    const account_number = String(body.account_number ?? "").replace(/\s+/g, "").slice(0, 30);
    if (business_name.length < 2) return json({ error: "Enter your name or business name" }, 400);
    if (!/^[0-9]{6,20}$/.test(account_number.replace(/^\+/, ""))) return json({ error: "Enter a valid M-Pesa number or bank account number" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: existing } = await admin.from("creator_payout_accounts").select("paystack_subaccount_code").eq("user_id", userId).maybeSingle();

    const payload = { business_name, settlement_bank, account_number, percentage_charge: PLATFORM_PERCENT, description: `Primegram creator ${userId}` };
    const url = existing?.paystack_subaccount_code
      ? `https://api.paystack.co/subaccount/${existing.paystack_subaccount_code}`
      : "https://api.paystack.co/subaccount";
    const r = await fetch(url, {
      method: existing?.paystack_subaccount_code ? "PUT" : "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.status) return json({ error: d?.message || `Paystack error (${r.status})` }, 502);
    const code = d.data?.subaccount_code ?? existing?.paystack_subaccount_code;
    const { error } = await admin.from("creator_payout_accounts").upsert({
      user_id: userId, business_name, settlement_bank, account_number,
      paystack_subaccount_code: code, percentage_charge: PLATFORM_PERCENT, active: true, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) return json({ error: "Could not save payout account" }, 500);
    return json({ ok: true, subaccount_code: code });
  } catch (e) {
    console.error("create-paystack-subaccount", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
