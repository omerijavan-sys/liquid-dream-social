import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Gift, Loader2, MessageCircle, Share2, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { trackEvent } from "@/utils/telemetry";
import DropComposer from "../drops/DropComposer";
import { inviteLink, REWARD_AT, useReferral } from "../referrals/referral";
import { nativeShare, shareWhatsApp } from "../shared/share";
import { rpc, table } from "../shared/ui";

interface Person { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null; is_verified: boolean; is_official: boolean; followers: number }
const FOLLOW_GOAL = 5;

/** Welcome flow for brand-new accounts: follow people, post a first Drop, invite friends. Existing users never see it. */
const Flow = ({ onDone }: { onDone: () => void }) => {
  const { user } = useAuth();
  const { code } = useReferral();
  const [step, setStep] = useState(0);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [composer, setComposer] = useState(false);
  const [dropped, setDropped] = useState(false);

  useEffect(() => { trackEvent("onboarding_start"); }, []);
  useEffect(() => { void rpc<Person[]>("suggested_people", { _limit: 14 }).then(({ data }) => setPeople(data ?? [])); }, []);

  const follow = async (p: Person) => {
    if (!user) return;
    const has = followed.has(p.user_id);
    setFollowed((s) => { const n = new Set(s); if (has) n.delete(p.user_id); else n.add(p.user_id); return n; });
    const { error } = has
      ? await table("follows").delete().eq("follower_id", user.id).eq("following_id", p.user_id)
      : await table("follows").insert({ follower_id: user.id, following_id: p.user_id });
    if (error) { toast.error("Couldn't update follow"); setFollowed((s) => { const n = new Set(s); if (has) n.add(p.user_id); else n.delete(p.user_id); return n; }); }
  };
  const next = (name: string) => { trackEvent(`onboarding_${name}`); setStep((s) => s + 1); };
  const finish = async (skipped: boolean) => {
    trackEvent(skipped ? "onboarding_skip" : "onboarding_done");
    await rpc("complete_onboarding");
    onDone();
  };

  const link = code ? inviteLink(code) : "https://primegramx.co.ke";
  const msg = "I'm on Primegram — post, go live and earn. Join me 🔥";
  const btn = "w-full rounded-2xl py-3.5 text-sm font-bold";

  return createPortal(
    <div className="fixed inset-0 z-[150] flex flex-col bg-[radial-gradient(ellipse_at_50%_0%,#2a1050,#0b0618_55%,#000)] text-white">
      <div className="flex items-center gap-2 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <img src="/icons/x-logo-128.webp" alt="" className="h-8 w-8 rounded-xl" />
        <div className="flex flex-1 gap-1.5">{[0, 1, 2].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-gradient-to-r from-violet-400 to-fuchsia-400" : "bg-white/15"}`} />)}</div>
        <button onClick={() => void finish(true)} className="text-xs font-semibold text-white/55">Skip</button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-6">
        {step === 0 && (<>
          <h1 className="text-2xl font-extrabold">Follow people you'll love</h1>
          <p className="mt-1 text-sm text-white/65">Follow {FOLLOW_GOAL} to fill your feed with posts, Drops and lives. <span className="font-semibold text-white">{Math.min(followed.size, FOLLOW_GOAL)}/{FOLLOW_GOAL}</span></p>
          <div className="mt-4 space-y-2">
            {!people && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-white/60" /></div>}
            {people?.length === 0 && <p className="py-8 text-center text-sm text-white/60">You're one of the first here — invite friends in the next step.</p>}
            {people?.map((p) => (
              <div key={p.user_id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-xl">
                {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 font-bold">{(p.username ?? "U")[0].toUpperCase()}</span>}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.display_name || p.username}{(p.is_verified || p.is_official) && " ✓"}</p><p className="truncate text-xs text-white/55">@{p.username} · {p.followers} followers</p></div>
                <button onClick={() => void follow(p)} className={`rounded-full px-4 py-1.5 text-xs font-bold ${followed.has(p.user_id) ? "bg-white/15 text-white" : "bg-gradient-to-r from-violet-500 to-fuchsia-500"}`}>{followed.has(p.user_id) ? <Check className="h-4 w-4" /> : "Follow"}</button>
              </div>
            ))}
          </div>
        </>)}

        {step === 1 && (<>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500"><Sparkles className="h-7 w-7" /></span>
          <h1 className="mt-4 text-2xl font-extrabold">Post your first Drop</h1>
          <p className="mt-1 text-sm text-white/65">Once a day, share a photo, a 5-second voice note or your song of the day. Friends' Drops unlock when you post yours, and your streak starts today.</p>
          {dropped
            ? <p className="mt-6 flex items-center gap-2 rounded-2xl bg-emerald-500/15 p-4 text-sm font-semibold text-emerald-300"><Check className="h-5 w-5" />Your first Drop is live. Streak started!</p>
            : <button onClick={() => setComposer(true)} className={`${btn} mt-6 bg-gradient-to-r from-violet-500 to-fuchsia-500`}>Create my Drop</button>}
        </>)}

        {step === 2 && (<>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500"><Gift className="h-7 w-7" /></span>
          <h1 className="mt-4 text-2xl font-extrabold">Bring your friends</h1>
          <p className="mt-1 text-sm text-white/65">Invite {REWARD_AT} friends to unlock the Obsidian Gold theme, Founder ring and VIP badge. Everything is better with your people here.</p>
          <div className="mt-6 space-y-2.5">
            <button onClick={() => shareWhatsApp(msg, link, "onboarding")} className={`${btn} flex items-center justify-center gap-2 bg-[#25D366] text-black`}><MessageCircle className="h-5 w-5" />Invite on WhatsApp</button>
            <button onClick={() => void nativeShare(msg, link, "onboarding")} className={`${btn} flex items-center justify-center gap-2 bg-white/10`}><Share2 className="h-5 w-5" />Share another way</button>
            <button onClick={() => { void navigator.clipboard.writeText(link); toast.success("Link copied"); trackEvent("invite_copy_onboarding"); }} className={`${btn} flex items-center justify-center gap-2 border border-white/15`}><Copy className="h-4 w-4" />Copy my link</button>
          </div>
        </>)}
      </div>

      <div className="px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {step < 2
          ? <button onClick={() => next(step === 0 ? "follow" : "drop")} className={`${btn} flex items-center justify-center gap-2 bg-white text-black`}>{step === 0 && followed.size > 0 ? <UserPlus className="h-4 w-4" /> : null}{step === 1 && !dropped ? "Maybe later" : "Continue"}</button>
          : <button onClick={() => void finish(false)} className={`${btn} bg-white text-black`}>Start exploring</button>}
      </div>
      {composer && <DropComposer onClose={() => setComposer(false)} onPosted={() => { setComposer(false); setDropped(true); trackEvent("onboarding_first_drop"); }} />}
    </div>,
    document.body,
  );
};

const OnboardingGate = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const check = useCallback(async (attempt = 0) => {
    if (!user || (user as { is_anonymous?: boolean }).is_anonymous) return;
    const { data } = await table("profiles").select("onboarded_at").eq("user_id", user.id).maybeSingle();
    if (!data && attempt < 2) { setTimeout(() => void check(attempt + 1), 1500); return; } // profile row is created just after sign-up
    if (data && !data.onboarded_at) setShow(true);
  }, [user]);
  useEffect(() => { setShow(false); void check(); }, [check]);
  return show ? <Flow onDone={() => setShow(false)} /> : null;
};
export default OnboardingGate;
