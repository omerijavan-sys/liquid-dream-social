import { supabase } from "@/integrations/supabase/client";

export const GROUP_VERIFY_PRICE_KES = 100;

/** Pays the 100 KES group verification with Paystack (M-Pesa or card). Resolves true once the blue tick is on. */
export async function payGroupVerification(groupId: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("initialize-paystack-payment", {
    body: { payment_type: "group_verify", group_id: groupId, amount_kes: GROUP_VERIFY_PRICE_KES, callback_url: `${window.location.origin}/messages` },
  });
  if (error || !data?.access_code) {
    let msg = data?.error as string | undefined;
    if (!msg && error) { try { msg = (await (error as { context?: Response }).context?.json())?.error; } catch { /* ignore */ } }
    throw new Error(msg || "Couldn't start the payment");
  }
  const reference: string = data.reference;
  let Pop: (new () => { resumeTransaction: (code: string, cb: Record<string, unknown>) => void }) | null = null;
  try { Pop = (await import("@paystack/inline-js")).default as never; } catch { Pop = null; }
  if (!Pop) {
    try { localStorage.setItem("primegram:payReturn", JSON.stringify({ ref: reference, mode: "group_verify", path: window.location.pathname + window.location.search, at: Date.now() })); } catch { /* ignore */ }
    window.location.assign(data.authorization_url);
    await new Promise(() => undefined);
    return false;
  }
  const P = Pop;
  await new Promise<void>((resolve, reject) => {
    new P().resumeTransaction(data.access_code, {
      onSuccess: () => resolve(),
      onCancel: () => reject(new Error("Payment cancelled")),
      onError: (e: { message?: string }) => reject(new Error(e?.message || "Payment failed")),
    });
  });
  for (let i = 0; i < 12; i++) {
    if (i === 2 || i === 6 || i === 10) await supabase.functions.invoke("paystack-webhook", { body: { reference } }).catch(() => undefined);
    const { data: g } = await supabase.from("chat_groups" as never).select("is_verified").eq("id", groupId).maybeSingle() as { data: { is_verified: boolean } | null };
    if (g?.is_verified) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}
