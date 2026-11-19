import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pollLedger } from "@/components/TipAndSubscribeModal";

/** After Paystack redirects back (?reference=pg_…), confirm the payment and send the user back where they were. */
const PaystackReturn = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ref = q.get("reference") || q.get("trxref");
    if (!ref || !ref.startsWith("pg_")) return;
    let saved: { path?: string; mode?: string } = {};
    try { saved = JSON.parse(localStorage.getItem("primegram:payReturn") || "{}"); localStorage.removeItem("primegram:payReturn"); } catch { /* ignore */ }
    window.history.replaceState({}, "", window.location.pathname);
    void (async () => {
      toast.loading("Confirming your payment…", { id: "ps-ret" });
      // ask the server to verify straight away, then wait for the ledger row
      await supabase.functions.invoke("paystack-webhook", { body: { reference: ref } }).catch(() => undefined);
      const ok = await pollLedger(ref, 12);
      toast.dismiss("ps-ret");
      if (ok) {
        toast.success(saved.mode === "topup" ? "Wallet topped up 🎉" : saved.mode === "subscription" ? "Subscription unlocked 🎉" : "Payment received 🎉");
        window.dispatchEvent(new Event("wallet:refresh"));
      } else toast.error("We haven't received confirmation yet — it will appear shortly if the payment went through.");
      if (saved.path && saved.path !== window.location.pathname) navigate(saved.path, { replace: true });
    })();
  }, [navigate]);
  return null;
};
export default PaystackReturn;
