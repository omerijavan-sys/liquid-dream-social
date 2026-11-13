import { Download, ExternalLink, Smartphone } from "lucide-react";

export const ANDROID_APK_URL = "/primegram-extreme.apk";
export const PRIMEGRAM_ISA_DEV_URL = "https://primegram.is-a.dev";

const AndroidDownloadCard = ({ compact = false }: { compact?: boolean }) => (
  <section className={`liquid-glass relative z-10 rounded-2xl border border-emerald-300/20 ${compact ? "p-3" : "p-4"}`}>
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15"><Smartphone className="h-5 w-5 text-emerald-200" /></div>
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-foreground">Primegram Extreme for Android</p><p className="text-[10px] text-muted-foreground">Install the official Android app from this device.</p></div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <a href={PRIMEGRAM_ISA_DEV_URL} target="_blank" rel="noreferrer" className="depth-press inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-400/20"><ExternalLink className="h-3.5 w-3.5" /> Open web app</a>
        <a href={ANDROID_APK_URL} download className="depth-press inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-semibold text-black hover:bg-emerald-400"><Download className="h-3.5 w-3.5" /> Download APK</a>
      </div>
    </div>
  </section>
);

export default AndroidDownloadCard;
