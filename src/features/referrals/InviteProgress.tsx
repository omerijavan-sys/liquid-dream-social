import { useEffect, useState } from "react";
import { Copy, Gift, Lock, MessageCircle, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { glass, glow, rpc } from "../shared/ui";
import { shareWhatsApp } from "../shared/share";
import { inviteLink, REWARD_AT, useReferral } from "./referral";

/** Progress card for the profile: "Invite 2 more friends to unlock Obsidian Gold Theme" + the share link. */
const InviteProgress = () => {
  const { code, count = 0, perks = [], loading } = useReferral();
  const [earn, setEarn] = useState<{ total: number; last30: number; friends_earning: number } | null>(null);
  useEffect(() => { void rpc<{ total: number; last30: number; friends_earning: number }>("my_referral_earnings").then(({ data }) => { if (data) setEarn(data); }); }, []);
  if (loading || !code) return null;
  const link = inviteLink(code);
  const left = Math.max(0, REWARD_AT - count);
  const unlocked = left === 0;
  const share = async () => {
    const text = "Come earn at Primegram 🔥";
    try { if (navigator.share) { await navigator.share({ title: "Primegram", text, url: link }); return; } } catch { return; }
    await navigator.clipboard.writeText(link).catch(() => undefined); toast.success("Invite link copied");
  };
  return (
    <section className={`${glass} rounded-2xl p-4 text-white`} style={unlocked ? { boxShadow: glow("#fbbf24", 0.35, 26) } : undefined}>
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-amber-300" />
        <p className="text-sm font-bold">{unlocked ? "Founder perks unlocked" : "Invite friends, unlock Founder perks"}</p>
      </div>
      <p className="mt-1 text-xs text-white/70">
        {unlocked ? "Obsidian Gold theme, Founder avatar ring and VIP badge are yours." : `Invite ${left} more friend${left === 1 ? "" : "s"} to unlock the Obsidian Gold Theme.`}
      </p>
      <div className="mt-3 flex gap-1.5" aria-label={`${Math.min(count, REWARD_AT)} of ${REWARD_AT} friends joined`}>
        {Array.from({ length: REWARD_AT }).map((_, i) => (
          <div key={i} className={`h-2 flex-1 rounded-full ${i < count ? "bg-gradient-to-r from-amber-300 to-yellow-500" : "bg-white/10"}`} style={i < count ? { boxShadow: glow("#fbbf24", 0.7, 10) } : undefined} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-white/70">
        {([["obsidian_gold_theme", "Obsidian Gold"], ["founder_ring", "Founder ring"], ["vip_badge", "VIP badge"]] as const).map(([k, label]) => (
          <span key={k} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${perks.includes(k) ? "bg-amber-300/20 text-amber-200" : "bg-white/5"}`}>{!perks.includes(k) && <Lock className="h-2.5 w-2.5" />}{label}</span>
        ))}
        <span className="ml-auto tabular-nums">{count} joined</span>
      </div>
      <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-200"><Sparkles className="h-3.5 w-3.5" />Virtual credits from friends: {Number(earn?.total ?? 0).toLocaleString()} cr</p>
        <p className="mt-1 text-[11px] text-white/70">Earn virtual credits whenever a friend you invite pays or earns on Primegram, for their first 90 days. Credits are in-app rewards only, not real money and can't be withdrawn.</p>
        {earn && earn.last30 > 0 && <p className="mt-1 text-[11px] text-emerald-200">{Number(earn.last30).toLocaleString()} cr in the last 30 days from {earn.friends_earning} friend{earn.friends_earning === 1 ? "" : "s"}</p>}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/80">{link.replace("https://", "")}</code>
        <button onClick={() => { void navigator.clipboard.writeText(link); toast.success("Copied"); }} aria-label="Copy invite link" className="rounded-xl border border-white/10 bg-white/10 p-2"><Copy className="h-4 w-4" /></button>
        <button onClick={() => shareWhatsApp("Come earn at Primegram 🔥", link, "profile")} aria-label="Invite on WhatsApp" className="rounded-xl bg-[#25D366] p-2 text-black"><MessageCircle className="h-4 w-4" /></button>
        <button onClick={() => void share()} aria-label="Share invite link" className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 p-2"><Share2 className="h-4 w-4" /></button>
      </div>
    </section>
  );
};
export default InviteProgress;
