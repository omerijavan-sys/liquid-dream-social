import { useEffect, useState } from "react";
import { Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { creatorShare, fetchItems, kes, myUnlocked, openItem, type PpvItem, unlockItem } from "./ppv";

/** A paid photo/video. Locked and blurred until the viewer pays; the owner and earlier buyers see it straight away. */
const LockedMedia = ({ itemId, compact = false, className = "" }: { itemId: string; compact?: boolean; className?: string }) => {
  const { user } = useAuth();
  const [item, setItem] = useState<PpvItem | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let dead = false;
    void (async () => {
      const items = await fetchItems([itemId]);
      const it = items[itemId];
      if (dead) return;
      if (!it) { setMissing(true); return; }
      setItem(it);
      if (user && (it.owner_id === user.id || (await myUnlocked([itemId])).has(itemId))) {
        try { const u = await openItem(itemId); if (!dead) setUrl(u); } catch { /* stays locked */ }
      }
    })();
    return () => { dead = true; };
  }, [itemId, user]);

  const unlock = async () => {
    if (!item || busy) return;
    setBusy(true);
    try { setUrl(await unlockItem(itemId)); toast.success("Unlocked"); }
    catch (e) { const m = e instanceof Error ? e.message : "Couldn't unlock"; if (m !== "Payment cancelled") toast.error(m); }
    finally { setBusy(false); }
  };

  if (missing) return <div className={`rounded-xl bg-black/30 p-4 text-center text-xs text-white/60 ${className}`}>This content is no longer available</div>;
  if (url && item) return item.media_type === "video"
    ? <video src={url} controls playsInline className={`max-h-80 w-full rounded-xl bg-black object-contain ${className}`} />
    : <img src={url} alt="Unlocked content" className={`max-h-80 w-full rounded-xl object-contain ${className}`} />;

  const mine = !!item && item.owner_id === user?.id;
  return (
    <div className={`relative flex ${compact ? "h-36 w-56" : "min-h-[16rem] w-full"} flex-col items-center justify-center gap-2 overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_30%_20%,#7c3aed55,transparent_60%),radial-gradient(ellipse_at_80%_80%,#ec489955,transparent_60%),#0b0b16] p-4 text-center ${className}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur"><Lock className="h-5 w-5 text-white" /></span>
      {!item ? <Loader2 className="h-4 w-4 animate-spin text-white/70" /> : (
        <>
          <p className="text-sm font-bold text-white">{item.media_type === "video" ? "Paid video" : "Paid photo"}</p>
          {item.teaser && <p className="max-w-[14rem] truncate text-xs text-white/70">{item.teaser}</p>}
          {mine ? <p className="text-xs text-white/70">Your price {kes(item.price_kes)} · you earn {kes(creatorShare(item.price_kes))}</p> : (
            <button onClick={() => void unlock()} disabled={busy} className="mt-1 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-xs font-bold text-white shadow-[0_0_18px_rgba(168,85,247,.5)] disabled:opacity-60">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}Unlock for {kes(item.price_kes)}
            </button>
          )}
        </>
      )}
    </div>
  );
};
export default LockedMedia;
