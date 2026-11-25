import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Flame, Loader2, Share2, X } from "lucide-react";
import { deliverImage, usePrerender } from "../shared/shareImage";
import { drawWrappedCard } from "../shared/cardCanvas";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { glass, glow, rpc, table } from "../shared/ui";
import { shareWhatsApp } from "../shared/share";
import { inviteLink, useReferral } from "../referrals/referral";
import { fetchStreak } from "../drops/streaks";
import { trackEvent } from "@/utils/telemetry";

interface Wrapped { posts: number; reels: number; drops: number; likes: number; comments: number; followers: number; views: number; top_caption: string | null; top_likes: number | null }

const Stat = ({ n, label, color }: { n: number; label: string; color: string }) => (
  <div style={{ flex: 1, padding: "12px 8px", borderRadius: 16, background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.1)", textAlign: "center" }}>
    <p style={{ fontSize: 26, fontWeight: 800, color, textShadow: glow(color, 0.6, 12) }}>{n.toLocaleString()}</p>
    <p style={{ fontSize: 10, opacity: 0.65, marginTop: 2, textTransform: "uppercase", letterSpacing: 1 }}>{label}</p>
  </div>
);

/** "My week on Primegram": a screenshot-ready recap, shared with the inviter's link inside. */
const WeeklyWrapped = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const { code } = useReferral();
  const [w, setW] = useState<Wrapped | null>(null);
  const [name, setName] = useState("You");
  const [streak, setStreak] = useState(0);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    trackEvent("wrapped_open");
    void (async () => {
      const [{ data }, { data: p }, st] = await Promise.all([rpc<Wrapped>("my_weekly_wrapped"), table("profiles").select("display_name, username").eq("user_id", user.id).maybeSingle(), fetchStreak(user.id)]);
      if (data) setW(data);
      setName(p?.display_name || p?.username || "You"); setStreak(st?.current ?? 0);
    })();
  }, [user]);

  const link = code ? inviteLink(code) : "https://primegramx.co.ke";
  const [shot, setShot] = useState<string | null>(null);
  const { png, error } = usePrerender(() => drawWrappedCard(w!, name, streak, link), !!w);
  const make = async (mode: "share" | "save") => {
    if (!png) { toast.info(error ? "The card couldn't be built. See the note below." : "Still preparing your card, one moment…"); return; }
    setBusy(true);
    try {
      if (mode === "share") trackEvent("wrapped_share");
      const r = await deliverImage(png, "my-primegram-week.png", mode === "share" ? `My week on Primegram 🔥 Come earn: ${link}` : "");
      if (r === "preview") setShot(png); else if (r === "saved") toast.success("Saved to your device");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setShot(png);
    } finally { setBusy(false); }
  };
  const share = () => make("share");
  const save = () => make("save");

  const made = w ? w.posts + w.reels + w.drops : 0;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 overflow-y-auto bg-black/85 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-4">
        <button onClick={onClose} aria-label="Close" className="self-end rounded-full bg-white/10 p-1.5 text-white"><X className="h-4 w-4" /></button>
        {shot ? <div className="flex flex-col items-center gap-2"><img src={shot} alt="My week on Primegram" className="max-h-[70vh] rounded-2xl" /><p className="text-xs text-white/70">Press and hold the image to save or share it</p></div> : w ? (
          <div ref={ref} style={{ width: 340, height: 560, background: "linear-gradient(160deg,#1a0b3b,#09090B 60%,#12082a)", color: "#fff", position: "relative", overflow: "hidden", borderRadius: 28, fontFamily: "system-ui,sans-serif" }}>
            <div style={{ position: "absolute", width: 320, height: 320, left: -80, top: -90, borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,.6),transparent 70%)" }} />
            <div style={{ position: "absolute", width: 280, height: 280, right: -90, bottom: 40, borderRadius: "50%", background: "radial-gradient(circle,rgba(236,72,153,.4),transparent 70%)" }} />
            <div style={{ position: "absolute", inset: 18, borderRadius: 24, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", display: "flex", flexDirection: "column", padding: "24px 18px 14px" }}>
              <p style={{ fontSize: 10, letterSpacing: 3, opacity: 0.6, textTransform: "uppercase" }}>My week on Primegram</p>
              <p style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{name}</p>
              {streak > 0 && <span style={{ marginTop: 8, alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.12)", color: "#fbbf24", fontSize: 12, fontWeight: 700 }}><Flame size={13} />{streak}-day streak</span>}
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}><Stat n={w.likes} label="Likes" color="#f472b6" /><Stat n={w.followers} label="New fans" color="#a78bfa" /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}><Stat n={w.views} label="Views" color="#38bdf8" /><Stat n={w.comments} label="Comments" color="#34d399" /></div>
              <p style={{ marginTop: 16, fontSize: 13, opacity: 0.85 }}>{made > 0 ? `${made} thing${made === 1 ? "" : "s"} shared this week` : "A quiet week. Time to post!"}</p>
              {w.top_caption && (w.top_likes ?? 0) > 0 && <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 14, background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.1)" }}><p style={{ fontSize: 9, opacity: 0.55, textTransform: "uppercase", letterSpacing: 1.5 }}>Top post · {w.top_likes} likes</p><p style={{ fontSize: 13, marginTop: 4, maxHeight: 54, overflow: "hidden" }}>{w.top_caption}</p></div>}
              <div style={{ flex: 1 }} />
              <p style={{ fontSize: 13, fontWeight: 800 }}>Join me on Primegram</p>
              <p style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{link.replace("https://", "")}</p>
            </div>
          </div>
        ) : <div className="flex h-[560px] w-[340px] items-center justify-center text-white/60"><Loader2 className="h-6 w-6 animate-spin" /></div>}
        {error && <p className="max-w-[320px] text-center text-xs text-red-300">Couldn't build the card ({error}). Take a screenshot of it instead.</p>}
        <div className={`${glass} flex gap-2 rounded-2xl p-2`}>
          <button disabled={!png || busy} onClick={() => void share()} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}Share</button>
          <button disabled={!w} onClick={() => shareWhatsApp("My week on Primegram 🔥 Come earn:", link, "wrapped")} className="rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50">WhatsApp</button>
          <button disabled={!png || busy} onClick={() => void save()} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Download className="h-4 w-4" />Save</button>
        </div>
      </div>
    </div>, document.body);
};
export default WeeklyWrapped;
