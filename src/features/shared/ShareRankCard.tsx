import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Share2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { deliverImage, usePrerender } from "./shareImage";
import { drawRankCard, type RankData } from "./cardCanvas";
import { shareWhatsApp } from "./share";
import { glass } from "./ui";
import { inviteLink, useReferral } from "../referrals/referral";

const toDataUrl = async (url: string): Promise<string | null> => {
  try {
    const b = await (await fetch(url, { mode: "cors" })).blob();
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => res(null); r.readAsDataURL(b); });
  } catch { return null; }
};

/** Shareable "my rank this week" image. Drawn on canvas like the other cards so it works in the Android WebView. */
const ShareRankCard = ({ rank, onClose }: { rank: { rank: number; total: number; score: number; likes: number; views: number; items: number }; onClose: () => void }) => {
  const { user } = useAuth();
  const { code } = useReferral();
  const [d, setD] = useState<RankData | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const link = code ? inviteLink(code) : "https://primegramx.co.ke";

  useEffect(() => {
    if (!user) return;
    let dead = false;
    void (async () => {
      const { data } = await supabase.from("profiles").select("display_name, username, avatar_url").eq("user_id", user.id).maybeSingle();
      const avatarDataUrl = data?.avatar_url ? await toDataUrl(data.avatar_url) : null;
      if (!dead) setD({ name: data?.display_name || data?.username || "Primegram creator", avatarDataUrl, ...rank });
    })();
    return () => { dead = true; };
  }, [user, rank]);

  const { png, error } = usePrerender(() => drawRankCard(d!, link), !!d);
  const share = async () => {
    if (!png) { toast.info("Still preparing your card, one moment…"); return; }
    setBusy(true);
    try {
      const r = await deliverImage(png, "primegram-rank.png", `I'm #${rank.rank} on Primegram this week 🔥 Beat my rank:`);
      if (r === "preview") setShot(png); else if (r === "saved") toast.success("Saved to your device");
    } catch (e) { if ((e as Error).name !== "AbortError") setShot(png); } finally { setBusy(false); }
  };
  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 overflow-y-auto bg-black/85 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-4">
        <button onClick={onClose} aria-label="Close" className="self-end rounded-full bg-white/10 p-1.5 text-white"><X className="h-4 w-4" /></button>
        {png ? <img src={png} alt="Your weekly rank card" className="max-h-[68vh] rounded-3xl shadow-2xl" /> : <div className="flex h-[60vh] w-[300px] items-center justify-center rounded-3xl bg-white/5">{error ? <p className="px-4 text-center text-xs text-red-300">Couldn't build the card ({error}).</p> : <Loader2 className="h-6 w-6 animate-spin text-white/70" />}</div>}
        {shot && <p className="text-xs text-white/70">Press and hold the image to save it.</p>}
        <div className={`${glass} flex gap-2 rounded-2xl p-2`}>
          <button disabled={!png || busy} onClick={() => void share()} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Share2 className="h-4 w-4" /> Share</button>
          <button onClick={() => shareWhatsApp(`I'm #${rank.rank} on Primegram this week 🔥 Beat my rank:`, link, "rankcard")} className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-black"><MessageCircle className="h-4 w-4" /> WhatsApp</button>
        </div>
      </div>
    </div>, document.body);
};
export default ShareRankCard;
