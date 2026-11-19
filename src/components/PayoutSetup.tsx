import { useEffect, useState } from "react";
import { Loader2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Lets a creator register their M-Pesa / bank settlement details so tips and subscriptions pay out via Paystack (85% to them). */
const PayoutSetup = () => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [bank, setBank] = useState("MPESA");
  const [acct, setAcct] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase.from("creator_payout_accounts" as never).select("business_name, settlement_bank, account_number, paystack_subaccount_code").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        const d = data as { business_name: string; settlement_bank: string; account_number: string; paystack_subaccount_code: string | null } | null;
        if (d) { setName(d.business_name); setBank(d.settlement_bank); setAcct(d.account_number); setCode(d.paystack_subaccount_code); }
      });
  }, [user]);

  const save = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-paystack-subaccount", { body: { business_name: name, settlement_bank: bank, account_number: acct } });
      if (error || data?.error) {
        let msg = data?.error as string | undefined;
        if (!msg && error) { try { msg = (await (error as { context?: Response }).context?.json())?.error; } catch { /* ignore */ } }
        throw new Error(msg || "Couldn't save payout details");
      }
      setCode(data.subaccount_code);
      toast.success("Payout account saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save payout details"); }
    finally { setBusy(false); }
  };

  return (
    <section className="liquid-glass rounded-2xl p-4 relative z-10 space-y-3">
      <h3 className="flex items-center gap-2 font-semibold text-foreground"><Landmark className="h-4 w-4" /> Payout account (Paystack)</h3>
      <p className="text-xs text-muted-foreground">Card and M-Pesa tips/subscriptions are split automatically: you get 85%, Primegram keeps 15%. Paystack's processing fee comes out of your share. Money is settled to the account below.</p>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name or business name" className="w-full rounded-xl bg-secondary/50 px-3 py-2 text-sm outline-none" />
      <div className="grid grid-cols-3 gap-2">
        <input value={bank} onChange={e => setBank(e.target.value.toUpperCase())} placeholder="MPESA" className="col-span-1 rounded-xl bg-secondary/50 px-3 py-2 text-sm outline-none" aria-label="Settlement bank code" />
        <input value={acct} onChange={e => setAcct(e.target.value)} inputMode="numeric" placeholder="M-Pesa number / account no." className="col-span-2 rounded-xl bg-secondary/50 px-3 py-2 text-sm outline-none" />
      </div>
      <p className="text-[11px] text-muted-foreground">Use bank code MPESA for M-Pesa, or your bank's Paystack code for a bank account.</p>
      <button disabled={busy} onClick={() => void save()} className="depth-press flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}{code ? "Update payout account" : "Save payout account"}
      </button>
      {code && <p className="text-[11px] text-emerald-400">Active · {code}</p>}
    </section>
  );
};

export default PayoutSetup;
