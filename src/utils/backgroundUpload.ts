import { toast } from "sonner";
import { useSyncExternalStore } from "react";

export type UploadJob = { id: number; label: string; message: string; pct: number; status: "running" | "done" | "error" };

let jobs: UploadJob[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => { jobs = [...jobs]; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useUploadJobs() {
  return useSyncExternalStore(subscribe, () => jobs);
}

/**
 * Runs an upload/publish job without blocking the screen. The person taps once, lands back on the feed
 * and a progress line under the Primegram header tracks the job until it finishes.
 */
export function runInBackground<T>(label: string, job: (setProgress: (msg: string) => void) => Promise<T>, onDone?: (r: T) => void) {
  const entry: UploadJob = { id: nextId++, label, message: `${label}…`, pct: 4, status: "running" };
  jobs.push(entry); emit();
  // Storage uploads don't report bytes, so ease towards 92% while the job runs and snap to 100% when it lands.
  const tick = window.setInterval(() => {
    entry.pct = Math.min(92, entry.pct + (92 - entry.pct) * 0.06 + 0.3);
    emit();
  }, 400);
  const remove = (ms: number) => window.setTimeout(() => { jobs = jobs.filter((j) => j.id !== entry.id); emit(); }, ms);
  const setProgress = (msg: string) => { entry.message = msg; emit(); };
  job(setProgress)
    .then((r) => { window.clearInterval(tick); entry.pct = 100; entry.status = "done"; entry.message = `${label} — done`; emit(); remove(1600); onDone?.(r); })
    .catch((e) => {
      window.clearInterval(tick); entry.status = "error"; emit(); remove(300);
      toast.error(e instanceof Error ? e.message : `${label} failed`);
    });
}
