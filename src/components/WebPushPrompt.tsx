import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { enablePush, pushSupported } from "@/utils/pushSubscribe";

const ASKED = "primegram:webPushAsked";

/** Browser (not the Android app): once after sign-in, offers to turn on notifications. Re-subscribes quietly if already allowed. */
const WebPushPrompt = () => {
  const { user } = useAuth();
  useEffect(() => {
    if (!user || Capacitor.isNativePlatform() || !pushSupported()) return;
    if (Notification.permission === "granted") { void enablePush(user.id).catch(() => undefined); return; }
    if (Notification.permission === "denied") return;
    let asked = false; try { asked = !!localStorage.getItem(ASKED); } catch { /* ignore */ }
    if (asked) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(ASKED, "1"); } catch { /* ignore */ }
      toast("Get messages, calls and tips as notifications, even when Primegram is closed.", {
        duration: 15000,
        action: { label: "Turn on", onClick: () => { void enablePush(user.id).then(() => toast.success("Notifications are on")).catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't turn on notifications")); } },
      });
    }, 6000);
    return () => clearTimeout(t);
  }, [user]);
  return null;
};
export default WebPushPrompt;
