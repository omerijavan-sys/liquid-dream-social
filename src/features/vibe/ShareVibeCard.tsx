import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Share2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { deliverImage, renderCard } from "../shared/shareImage";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { glass, table } from "../shared/ui";
import { shareWhatsApp } from "../shared/share";
import { inviteLink, useReferral } from "../referrals/referral";
import { fetchStreak } from "../drops/streaks";
import { type Aesthetics } from "./aesthetics";
import VibeCard, { type VibeProfile } from "./VibeCard";

/** Avatars are inlined as data URLs first so the PNG export can't be tainted by cross-origin images. */
const toDataUrl = async (url: string): Promise<string | null> => {
  try {
    const b = await (await fetch(url, { mode: "cors" })).blob();
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => res(null); r.readAsDataURL(b); });
  } catch { return null; }
};

const ShareVibeCard = ({ a, onClose }: { a: Aesthetics; onClose: () => void }) => {
  const { user } = useAuth();
  const { code } = useReferral();
  const [p, setP] = useState<VibeProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !code) return;
    let dead = false;
    void (async () => {
      const [{ data }, st] = await Promise.all([table("profiles").select("display_name, username, bio, avatar_url").eq("user_id", user.id).maybeSingle(), fetchStreak(user.id)]);
      const avatarDataUrl = data?.avatar_url ? await toDataUrl(data.avatar_url) : null;
      if (!dead) setP({ name: data?.display_name || data?.username || "Primegram user", username: data?.username ?? null, bio: data?.bio ?? null, avatarDataUrl, streak: st?.current ?? 0, code });
    })();
    return () => { dead = true; };
  }, [user, code]);

  const [shot, setShot] = useState<string | null>(null);
  const make = async (mode: "share" | "save") => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const png = await renderCard(ref.current);
      const r = mode === "share" ? await deliverImage(png, "primegram-vibe-card.png", "Come earn at Primegram 🔥") : await deliverImage(png, "primegram-vibe-card.png", "");
      if (r === "preview") setShot(png); else if (r === "saved") toast.success("Saved to your device");
    } catch (e) { if ((e as Error).name !== "AbortError") toast.error("Couldn't create the card. Try again."); }
    finally { setBusy(false); }
  };
  const share = () => make("share");
  const download = () => make("save");

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 overflow-y-auto bg-black/85 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-4">
        <button onClick={onClose} aria-label="Close" className="self-end rounded-full bg-white/10 p-1.5 text-white"><X className="h-4 w-4" /></button>
        {shot ? <div className="flex flex-col items-center gap-2"><img src={shot} alt="Your Vibe Card" className="max-h-[70vh] rounded-2xl" /><p className="text-xs text-white/70">Press and hold the image to save or share it</p></div> : p ? <div style={{ maxWidth: "100%", transform: "scale(var(--s,1))" }}><VibeCard ref={ref} p={p} a={a} /></div> : <div className="flex h-[560px] w-[340px] items-center justify-center text-white/60"><Loader2 className="h-6 w-6 animate-spin" /></div>}
        <div className={`${glass} flex gap-2 rounded-2xl p-2`}>
          <button disabled={!p || busy} onClick={() => void share()} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}Share</button>
          <button disabled={!p} onClick={() => shareWhatsApp("Come earn at Primegram 🔥 Check out my vibe card:", code ? inviteLink(code) : "https://primegramx.co.ke", "vibecard")} className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50">WhatsApp</button>
          <button disabled={!p || busy} onClick={() => void download()} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Download className="h-4 w-4" />Save</button>
        </div>
      </div>
    </div>, document.body);
};
export default ShareVibeCard;
