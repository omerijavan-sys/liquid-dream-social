import { useEffect, useState } from "react";
import { Loader2, Smartphone, CreditCard, Wallet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { TIP_AMOUNTS } from "@/lib/extreme";

export type PayMode = "tip" | "subscription" | "topup";
type Method = "wallet" | "mpesa" | "card";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PayMode;
  creatorId?: string;
  creatorName?: string;
  /** Required for subscriptions: the creator's monthly price (enforced again on the server). */
  price?: number;
  trackId?: string;
  onSuccess?: () => void;
}

const TITLES: Record<PayMode, string> = { tip: "Send a tip", subscription: "Subscribe", topup: "Top up wallet" };

async function pollLedger(reference: string, tries = 20): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    const { data } = await supabase.from("transactions" as never).select("reference").eq("reference", reference).maybeSingle();
    if (data) return true;
    // Fallback: ask the server to verify directly with Paystack in case the webhook is delayed.
    if (i === 3 || i === 8 || i === 14) await supabase.functions.invoke("paystack-webhook", { body: { reference } });
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

const TipAndSubscribeModal = ({ open, onOpenChange, mode, creatorId, creatorName, price, trackId, onSuccess }: Props) => {
  const [method, setMethod] = useState<Method>(mode === "topup" ? "mpesa" : "wallet");
  const [amount, setAmount] = useState<number>(mode === "subscription" ? price ?? 0 : mode === "topup" ? 500 : 50);
  const [custom, setCustom] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDone(false);
    setMethod(mode === "topup" ? "mpesa" : "wallet");
    setAmount(mode === "subscription" ? price ?? 0 : mode === "topup" ? 500 : 50);
    setCustom("");
    void supabase.rpc("wallet_my_balance").then(({ data }) => setBalance(Number(data ?? 0)));
  }, [open, mode, price]);

  const value = mode === "subscription" ? price ?? 0 : custom ? Number(custom) : amount;
  const fee = Math.round(value * 0.15 * 100) / 100;
  const net = Math.round((value - fee) * 100) / 100;

  const finish = (msg: string) => {
    setDone(true);
    toast.success(msg);
    onSuccess?.();
    window.dispatchEvent(new Event("wallet:refresh"));
  };

  const payWithWallet = async () => {
    if (!creatorId) return;
    if (balance !== null && balance < value) { toast.error("Not enough wallet balance — top up first."); return; }
    if (mode === "tip") {
      const { error } = await supabase.rpc("prime_tip", { _recipient: creatorId, _amount: value });
      if (error) throw error;
      finish(`${value.toLocaleString()} KES sent to ${creatorName ?? "creator"}`);
    } else {
      const { error } = await supabase.rpc("creator_subscribe", { _creator_id: creatorId });
      if (error) throw error;
      finish("Subscribed for one month");
    }
  };

  const payWithPaystack = async () => {
    const { data, error } = await supabase.functions.invoke("initialize-paystack-payment", {
      body: {
        amount_kes: value, payment_type: mode, creator_id: creatorId, track_id: trackId,
        method, callback_url: `${window.location.origin}/wallet`,
      },
    });
    if (error || !data?.access_code) {
      let msg = data?.error as string | undefined;
      if (!msg && error) { try { msg = (await (error as { context?: Response }).context?.json())?.error; } catch { /* ignore */ } }
      throw new Error(msg || "Couldn't start the payment");
    }
    const reference: string = data.reference;
    const { default: PaystackPop } = await import("@paystack/inline-js");
    await new Promise<void>((resolve, reject) => {
      new PaystackPop().resumeTransaction(data.access_code, {
        onSuccess: () => resolve(),
        onCancel: () => reject(new Error("Payment cancelled")),
        onError: (e: { message?: string }) => reject(new Error(e?.message || "Payment failed")),
      });
    });
    toast.loading("Confirming payment…", { id: "ps-confirm" });
    const ok = await pollLedger(reference);
    toast.dismiss("ps-confirm");
    if (!ok) throw new Error("Payment received but not confirmed yet. It will appear shortly.");
    finish(mode === "topup" ? "Wallet topped up" : mode === "tip" ? "Tip sent 🎉" : "Subscription unlocked 🎉");
  };

  const pay = async () => {
    if (!Number.isFinite(value) || value < (mode === "topup" ? 10 : 5)) { toast.error("Enter a valid amount"); return; }
    setBusy(true);
    try {
      if (method === "wallet") await payWithWallet(); else await payWithPaystack();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally { setBusy(false); }
  };

  const methods: Array<{ id: Method; label: string; icon: typeof Wallet; hide?: boolean }> = [
    { id: "wallet", label: `Wallet${balance !== null ? ` · ${balance.toLocaleString()}` : ""}`, icon: Wallet, hide: mode === "topup" },
    { id: "mpesa", label: "M-Pesa", icon: Smartphone },
    { id: "card", label: "Card", icon: CreditCard },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-black/70 text-white backdrop-blur-2xl">
        <DialogTitle>{TITLES[mode]}{creatorName && mode !== "topup" ? ` · ${creatorName}` : ""}</DialogTitle>
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="text-sm">All done — thank you!</p>
            <button className="depth-press rounded-xl bg-white/10 px-5 py-2 text-sm" onClick={() => onOpenChange(false)}>Close</button>
          </div>
        ) : (
          <div className="space-y-4">
            {mode !== "subscription" && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {(mode === "topup" ? [100, 500, 1000, 2000, 5000, 10000] : TIP_AMOUNTS).map((a) => (
                    <button key={a} onClick={() => { setAmount(a); setCustom(""); }}
                      className={`depth-press rounded-xl border px-2 py-2 text-sm ${!custom && amount === a ? "border-violet-400 bg-violet-500/20" : "border-white/10 bg-white/5"}`}>
                      {a.toLocaleString()}
                    </button>
                  ))}
                </div>
                <input value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Custom amount (KES)"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-violet-400" />
              </div>
            )}
            {mode === "subscription" && <p className="text-3xl font-bold">{(price ?? 0).toLocaleString()} <span className="text-base font-normal text-white/60">KES / month</span></p>}

            <div className="grid grid-cols-3 gap-2">
              {methods.filter((m) => !m.hide).map((m) => (
                <button key={m.id} onClick={() => setMethod(m.id)}
                  className={`depth-press flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-[11px] ${method === m.id ? "border-violet-400 bg-violet-500/20" : "border-white/10 bg-white/5"}`}>
                  <m.icon className="h-5 w-5" />{m.label}
                </button>
              ))}
            </div>

            {mode !== "topup" && method !== "wallet" && (
              <p className="text-xs text-white/60">Split: creator gets {net.toLocaleString()} KES (85%, Paystack's processing fee comes from this share); Primegram keeps {fee.toLocaleString()} KES (15%).</p>
            )}
            {mode !== "topup" && method === "wallet" && <p className="text-xs text-white/60">Paid from your wallet. Creators receive 95%; Primegram keeps 5%.</p>}

            <button disabled={busy} onClick={() => void pay()}
              className="depth-press flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#ef4444,#7c4dff 55%,#22c55e)" }}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "topup" ? "Top up" : mode === "tip" ? "Send tip" : "Subscribe"} · {Number.isFinite(value) ? value.toLocaleString() : 0} KES
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TipAndSubscribeModal;
