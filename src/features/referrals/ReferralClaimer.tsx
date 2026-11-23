import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { claimReferral, clearRef, readRef } from "./referral";

/**
 * Mounted once inside the app. If someone opened an invite link and then signed up (email, phone or Google),
 * credit the inviter. The server rejects self-referrals, re-referrals, unknown codes and accounts older than 3 days,
 * so the worst a tampered localStorage value can do is nothing.
 */
const ReferralClaimer = () => {
  const { user } = useAuth();
  const done = useRef<string | null>(null);
  useEffect(() => {
    const code = readRef();
    if (!user || !code || done.current === user.id) return;
    done.current = user.id;
    void claimReferral(code).then(({ data }) => {
      clearRef(); // single attempt either way, a bad code must never retry forever
      if (data?.ok) toast.success("Welcome! You joined through a friend's invite 🎉");
    });
  }, [user]);
  return null;
};
export default ReferralClaimer;
