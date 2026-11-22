import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Req = { resolve: (ok: boolean) => void };
let host: ((r: Req) => void) | null = null;
let hasPinCache: boolean | null = null;
export const forgetPinCache = () => { hasPinCache = null; };

/** Asks for the wallet PIN right before money moves. Resolves true when there is no PIN or it was entered correctly. */
export async function requestPin(): Promise<boolean> {
  if (hasPinCache !== true) {
    const { data } = await (supabase.rpc as any)("wallet_has_pin");
    hasPinCache = !!data;
  }
  if (!hasPinCache) return true;
  return new Promise<boolean>((resolve) => { if (!host) { resolve(false); return; } host({ resolve }); });
}

/** Mount once near the app root. */
export const PinHost = () => {
  const [req, setReq] = useState<Req | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { host = (r) => { setPin(""); setReq(r); }; return () => { host = null; }; }, []);
  useEffect(() => { if (req) setTimeout(() => input.current?.focus(), 50); }, [req]);
  if (!req) return null;
  const done = (ok: boolean) => { req.resolve(ok); setReq(null); };
  const submit = async () => {
    if (pin.length < 4 || busy) return;
    setBusy(true);
    const { data, error } = await (supabase.rpc as any)("wallet_verify_pin", { _pin: pin });
    setBusy(false);
    if (error) { toast.error(error.message); setPin(""); return; }
    if (data) done(true); else { toast.error("Wrong PIN"); setPin(""); }
  };
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={() => done(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-t-3xl border border-white/20 bg-white/10 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-white shadow-2xl backdrop-blur-3xl sm:rounded-3xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><Lock className="h-6 w-6" /></div>
        <div><p className="text-lg font-bold">Enter wallet PIN</p><p className="text-xs text-white/65">Needed to confirm this payment</p></div>
        <input ref={input} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => e.key === "Enter" && void submit()} inputMode="numeric" type="password" autoComplete="off" placeholder="••••" className="w-full rounded-2xl bg-black/30 py-3 text-center text-2xl tracking-[0.6em] outline-none ring-1 ring-white/20 focus:ring-white/50" aria-label="Wallet PIN" />
        <div className="flex gap-2">
          <button onClick={() => done(false)} className="flex-1 rounded-2xl bg-white/10 py-3 text-sm font-semibold">Cancel</button>
          <button onClick={() => void submit()} disabled={pin.length < 4 || busy} className="flex-1 rounded-2xl bg-white py-3 text-sm font-bold text-black disabled:opacity-50">{busy ? "Checking…" : "Confirm"}</button>
        </div>
      </div>
    </div>
  );
};

/** Wallet settings card: create or change the PIN. */
export const WalletPinSetup = () => {
  const [has, setHas] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [oldPin, setOld] = useState(""); const [pin, setPin] = useState(""); const [again, setAgain] = useState("");
  const load = () => { void (supabase.rpc as any)("wallet_has_pin").then(({ data }: { data: boolean }) => { setHas(!!data); hasPinCache = !!data; }); };
  useEffect(load, []);
  const save = async () => {
    if (!/^\d{4,6}$/.test(pin)) { toast.error("PIN must be 4 to 6 digits"); return; }
    if (pin !== again) { toast.error("PINs don't match"); return; }
    const { error } = await (supabase.rpc as any)("wallet_set_pin", { _pin: pin, _old: has ? oldPin : null });
    if (error) { toast.error(error.message); return; }
    toast.success(has ? "PIN changed" : "Wallet PIN set"); setOpen(false); setOld(""); setPin(""); setAgain(""); forgetPinCache(); load();
  };
  const f = "w-full rounded-xl bg-secondary px-3 py-2.5 text-center tracking-[0.4em] outline-none";
  return (
    <div className="liquid-glass rounded-2xl p-4 relative z-10">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left">
        <Lock className="h-5 w-5 text-primary" />
        <span className="flex-1"><span className="block text-sm font-semibold text-foreground">Wallet PIN</span><span className="block text-xs text-muted-foreground">{has === null ? "…" : has ? "On — asked when you send money" : "Off — add a PIN to protect payments"}</span></span>
        <span className="text-xs font-semibold text-primary">{has ? "Change" : "Set up"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {has && <input value={oldPin} onChange={(e) => setOld(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" placeholder="Current PIN" className={f} />}
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" placeholder="New PIN (4–6 digits)" className={f} />
          <input value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" placeholder="Repeat new PIN" className={f} />
          <button onClick={() => void save()} className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">Save PIN</button>
        </div>
      )}
    </div>
  );
};
