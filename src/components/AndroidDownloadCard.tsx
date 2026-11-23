import { useState } from "react";
import { useAppUpdate, openUpdatePrompt } from "@/utils/updateStore";
import { ArrowUpCircle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Download, ExternalLink, Smartphone } from "lucide-react";
import { toast } from "sonner";

export const ANDROID_APK_URL = "/primegram.apk";
export const PRIMEGRAM_ISA_DEV_URL = "https://primegramx.co.ke";

const AndroidDownloadCard = ({ compact = false }: { compact?: boolean }) => {
  const isNativeApp = Capacitor.isNativePlatform();
  const update = useAppUpdate();
  const [openingUpgrade, setOpeningUpgrade] = useState(false);
  const upgradeUrl = new URL(ANDROID_APK_URL, window.location.origin).toString();

  const openUpgradeDownload = async () => {
    if (openingUpgrade) return;
    setOpeningUpgrade(true);
    try {
      await Browser.open({ url: upgradeUrl });
    } catch {
      toast.error("Could not open the APK download. Please try again from your browser.");
    } finally {
      setOpeningUpgrade(false);
    }
  };

  return (
    <section className={`liquid-glass relative z-10 rounded-2xl border border-emerald-300/20 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15"><Smartphone className="h-5 w-5 text-emerald-200" /></div>
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-foreground">{isNativeApp ? "Primegram Android app" : "Primegram Extreme for Android"}</p><p className="text-[10px] text-muted-foreground">{isNativeApp ? (update ? "A new version is ready — tap Upgrade." : "You have the latest version.") : "Download the Android app."}</p></div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <a href={PRIMEGRAM_ISA_DEV_URL} target="_blank" rel="noreferrer" className="depth-press inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-[11px] font-semibold text-white hover:bg-white/20"><ExternalLink className="h-3.5 w-3.5" /> Open web app</a>
          {isNativeApp ? (
            update ? (
              <button type="button" onClick={openUpdatePrompt} className="depth-press inline-flex animate-pulse items-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-2 text-[11px] font-bold text-black shadow-[0_0_16px_rgba(52,211,153,.7)]"><ArrowUpCircle className="h-3.5 w-3.5" /> Upgrade</button>
            ) : (
              <button type="button" disabled className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[11px] font-semibold text-muted-foreground"><ArrowUpCircle className="h-3.5 w-3.5" /> Up to date</button>
            )
          ) : (
            <a href={ANDROID_APK_URL} download className="depth-press inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-semibold text-black hover:bg-emerald-400"><Download className="h-3.5 w-3.5" /> Download app</a>
          )}
        </div>
      </div>
    </section>
  );
};

export default AndroidDownloadCard;
