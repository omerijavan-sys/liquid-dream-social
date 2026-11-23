import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Bump this when the Terms or Privacy Policy change; everyone is asked to agree again. */
export const LEGAL_VERSION = "2026-11";
const KEY = "primegram:legal";

const accepted = () => { try { return localStorage.getItem(KEY) === LEGAL_VERSION; } catch { return false; } };

/** Blocks the app until the person agrees to the Terms of Service and Privacy Policy, and records it on their account. */
const ConsentGate = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [ok, setOk] = useState(accepted);
  const [checked, setChecked] = useState(false);
  const [declined, setDeclined] = useState(false);

  // once signed in, store the agreement against the account (once per version)
  useEffect(() => {
    if (!user || !ok) return;
    void (supabase.from("legal_acceptances" as never) as unknown as { upsert: (v: object, o: object) => Promise<unknown> })
      .upsert({ user_id: user.id, version: LEGAL_VERSION, platform: Capacitor.getPlatform() }, { onConflict: "user_id,version", ignoreDuplicates: true });
  }, [user?.id, ok]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ok || !user || ["/about", "/privacy", "/terms"].includes(pathname)) return null;

  const accept = () => { try { localStorage.setItem(KEY, LEGAL_VERSION); } catch { /* private mode */ } setOk(true); };
  const decline = async () => {
    setDeclined(true);
    if (Capacitor.isNativePlatform()) { const { App } = await import("@capacitor/app"); void App.exitApp(); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-background/95 p-5 backdrop-blur-xl">
      <div className="liquid-glass-elevated w-full max-w-md rounded-3xl p-6">
        <div className="relative z-10">
          <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" /><h1 className="text-lg font-bold text-foreground">Before you continue</h1></div>
          <p className="text-sm text-muted-foreground">Primegram needs your agreement to its Terms of Service and Privacy Policy. In short:</p>
          <ul className="mt-3 space-y-1.5 text-sm text-foreground/90">
            <li>• You must be of legal age (the age of majority where you live).</li>
            <li>• You own what you post and let Primegram show it to others.</li>
            <li>• We never sell your personal data.</li>
            <li>• We use your camera, microphone, photos and notifications only for features you use (posts, calls, messages).</li>
            <li>• Illegal, abusive or exploitative content gets removed and accounts can be suspended.</li>
          </ul>
          <p className="mt-3 text-sm">
            Read the full <button className="font-semibold text-primary underline" onClick={() => navigate("/terms")}>Terms of Service</button> and{" "}
            <button className="font-semibold text-primary underline" onClick={() => navigate("/privacy")}>Privacy Policy</button>.
          </p>
          <label className="mt-4 flex items-start gap-3 text-sm text-foreground">
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" />
            <span>I have read and agree to the Terms of Service and Privacy Policy.</span>
          </label>
          <button disabled={!checked} onClick={accept} className="mt-4 w-full rounded-2xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40">Agree and continue</button>
          <button onClick={() => void decline()} className="mt-2 w-full py-2 text-sm text-muted-foreground">Decline</button>
          {declined && <p className="mt-1 text-center text-xs text-muted-foreground">You need to agree to use Primegram.</p>}
        </div>
      </div>
    </div>
  );
};
export default ConsentGate;
