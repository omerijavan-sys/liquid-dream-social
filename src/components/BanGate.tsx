import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Locks suspended accounts out of the app with a clear message. */
const BanGate = () => {
  const { user, signOut } = useAuth() as { user: { id: string } | null; signOut?: () => Promise<void> };
  const [banned, setBanned] = useState(false);
  useEffect(() => {
    if (!user) { setBanned(false); return; }
    let cancelled = false;
    void supabase.rpc("am_i_banned" as never).then(({ data }) => { if (!cancelled) setBanned(data === true); });
    return () => { cancelled = true; };
  }, [user]);
  if (!banned) return null;
  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-[#07070a] p-8 text-center text-white">
      <p className="text-2xl font-bold">Account suspended</p>
      <p className="max-w-sm text-sm text-white/70">Your account was suspended for breaking the Primegram X community rules. If you think this is a mistake, email officialprimegram.app@gmail.com from the address on your account.</p>
      <button onClick={() => void (signOut ? signOut() : supabase.auth.signOut())} className="rounded-full bg-rose-600 px-6 py-2.5 text-sm font-bold">Sign out</button>
    </div>
  );
};
export default BanGate;
