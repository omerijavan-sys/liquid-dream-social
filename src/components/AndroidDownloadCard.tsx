import { Download, Smartphone } from "lucide-react";

export const ANDROID_APK_URL = "/primegram-extreme.apk";

const AndroidDownloadCard = ({ compact = false }: { compact?: boolean }) => (
  <section className={`liquid-glass relative z-10 rounded-2xl border border-emerald-300/20 ${compact ? "p-3" : "p-4"}`}>
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15"><Smartphone className="h-5 w-5 text-emerald-200" /></div>
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-foreground">Primegram Extreme for Android</p><p className="text-[10px] text-muted-foreground">Install the official Android app from this device.</p></div>
      <a href={ANDROID_APK_URL} download className="depth-press inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-semibold text-black hover:bg-emerald-400"><Download className="h-3.5 w-3.5" /> Download APK</a>
    </div>
  </section>
);

export default AndroidDownloadCard;
