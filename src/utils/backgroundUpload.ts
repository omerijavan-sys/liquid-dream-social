import { toast } from "sonner";

/**
 * Runs an upload/publish job without blocking the screen. The user taps once,
 * lands back on the feed, and a toast tracks the job until it finishes.
 */
export function runInBackground<T>(label: string, job: (setProgress: (msg: string) => void) => Promise<T>, onDone?: (r: T) => void, onError?: (error: unknown) => void) {
  const id = toast.loading(`${label}…`);
  const setProgress = (msg: string) => toast.loading(msg, { id });
  job(setProgress)
    .then((r) => { toast.success(`${label} — done`, { id }); onDone?.(r); })
    .catch((error) => {
      toast.error(error instanceof Error ? error.message : `${label} failed`, { id });
      onError?.(error);
    });
}
