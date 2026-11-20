import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Registers this phone for message notifications (works when the app is closed). Android app only. */
const NativePush = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user || import.meta.env.VITE_PUSH_ENABLED !== "true") return; // only builds that include a valid google-services.json register for push
    let cleanup: Array<() => void> = [];
    void (async () => {
      try {
        await PushNotifications.createChannel({ id: "messages", name: "Messages", description: "New message alerts", importance: 5, visibility: 1, vibration: true });
        const perm = await PushNotifications.checkPermissions();
        const granted = perm.receive === "granted" || (await PushNotifications.requestPermissions()).receive === "granted";
        if (!granted) return;
        const reg = await PushNotifications.addListener("registration", async ({ value }) => {
          await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<unknown>)("register_push_token", { _token: value, _platform: "android" });
        });
        const act = await PushNotifications.addListener("pushNotificationActionPerformed", () => navigate("/messages"));
        cleanup = [() => void reg.remove(), () => void act.remove()];
        await PushNotifications.register();
      } catch { /* Firebase not configured in this build */ }
    })();
    return () => cleanup.forEach((f) => f());
  }, [user?.id, navigate]);
  return null;
};
export default NativePush;
