import { Check, Loader2 } from "lucide-react";
import { useUploadJobs } from "@/utils/backgroundUpload";

/** Slim progress line shown right below the "Primegram" title bar while a photo/video/story is posting. */
const UploadStrip = () => {
  const jobs = useUploadJobs().filter((j) => j.status !== "error");
  if (!jobs.length) return null;
  return (
    <div className="pointer-events-none mx-3 mt-1.5 space-y-1.5">
      {jobs.map((j) => (
        <div key={j.id} className="liquid-glass-elevated overflow-hidden rounded-2xl px-3 pb-2 pt-2">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            {j.status === "done" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            <span className="min-w-0 flex-1 truncate">{j.message}</span>
            <span className="tabular-nums text-muted-foreground">{Math.round(j.pct)}%</span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-400 transition-all duration-500 ease-out" style={{ width: `${j.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};
export default UploadStrip;
