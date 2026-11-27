import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Download, Smartphone, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { ANDROID_APK_URL } from "@/components/AndroidDownloadCard";

const NOTICE_KEY = "primegram-app-download-notice-seen";
const HIDDEN_ROUTES = [
  "/welcome",
  "/auth",
  "/reset-password",
  "/terms",
  "/privacy",
  "/help",
  "/about",
  "/delete-account",
  "/invite",
  "/.lovable/oauth/consent",
];

const WebAppDownloadNotice = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const hiddenRoute = HIDDEN_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
    if (Capacitor.isNativePlatform() || !/Android/i.test(navigator.userAgent) || hiddenRoute) return;

    try {
      if (sessionStorage.getItem(NOTICE_KEY)) return;
    } catch {
      // Continue when browser storage is unavailable.
    }

    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(NOTICE_KEY, "1");
      } catch {
        // The notice still works when browser storage is unavailable.
      }

      toast.custom(
        (toastId) => (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex w-[min(92vw,26rem)] items-center gap-3 rounded-2xl border border-primary/25 bg-background/95 p-3.5 text-foreground shadow-2xl backdrop-blur-xl"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Smartphone aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Enjoy Primegram in the app</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Download the app for a better experience.</p>
            </div>
            <a
              href={ANDROID_APK_URL}
              download
              onClick={() => toast.dismiss(toastId)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Download aria-hidden="true" className="size-3.5" />
              Download
            </a>
            <button
              type="button"
              aria-label="Dismiss app download notice"
              onClick={() => toast.dismiss(toastId)}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ),
        { duration: 14000, position: "bottom-center" },
      );
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
};

export default WebAppDownloadNotice;
