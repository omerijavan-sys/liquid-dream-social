import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { glass, glow } from "../shared/ui";
import { previewInviter, storeRef } from "./referral";

/** Public landing for /invite/:code - remembers the code, shows who invited you, then sends you to sign up. */
const InvitePage = () => {
  const { code = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [inviter, setInviter] = useState<{ display_name: string | null; avatar_url: string | null } | null | undefined>(undefined);

  useEffect(() => {
    if (!/^[A-Za-z0-9]{4,16}$/.test(code)) { setInviter(null); return; }
    storeRef(code);
    void previewInviter(code).then(setInviter).catch(() => setInviter(null));
  }, [code]);

  const name = inviter?.display_name || "A friend";
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090B] p-5 text-white">
      <div className={`${glass} w-full max-w-sm rounded-3xl p-6 text-center`} style={{ boxShadow: glow("#a78bfa", 0.35, 40) }}>
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-3xl" style={{ boxShadow: glow("#a78bfa") }}>
          {inviter?.avatar_url ? <img src={inviter.avatar_url} alt="" className="h-full w-full object-cover" /> : "💌"}
        </div>
        <p className="text-xl font-bold">{inviter === undefined ? "…" : inviter ? `${name} invited you` : "You're invited"}</p>
        <p className="mt-1 text-sm text-white/60">Join Primegram Extreme — daily drops, streaks and your own vibe.</p>
        <button
          onClick={() => navigate(user ? "/" : "/auth")}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3 text-sm font-bold"
          style={{ boxShadow: glow("#a78bfa", 0.6, 24) }}
        >
          {user ? "Open Primegram" : "Join now"}
        </button>
      </div>
    </div>
  );
};
export default InvitePage;
