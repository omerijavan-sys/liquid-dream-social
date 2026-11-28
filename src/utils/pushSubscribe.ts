import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BHcpwgIsVwQyNfCUzW-7EZ6wTuXE0WeYbsEOEuXuRvkSdpbrSzpvtQVRPNfJu4cxK1BecJACJzWs40AAh6y4ZKA";

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Asks permission, subscribes this device to Web Push and stores it for the signed-in user. */
export async function enablePush(userId: string): Promise<void> {
  if (Capacitor.isNativePlatform()) { // Android app: Firebase push; NativePush registers the token once permission is granted
    const r = await PushNotifications.requestPermissions();
    if (r.receive !== "granted") throw new Error("Allow notifications for Primegram in your phone's settings.");
    window.dispatchEvent(new Event("prime:push-enable"));
    return;
  }
  if (!pushSupported()) throw new Error("Push notifications aren't supported on this browser.");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Allow notifications in your browser settings.");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with an older server key can't receive pushes any more: replace it.
  const want = toKey(VAPID_PUBLIC_KEY);
  const have = sub?.options?.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
  if (sub && have && (have.length !== want.length || have.some((b, i) => b !== want[i]))) { await sub.unsubscribe().catch(() => undefined); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want });
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Couldn't register this device for push.");
  const { error } = await supabase.from("push_subscriptions" as never).upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth } as never,
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function disablePush(): Promise<void> {
  if (Capacitor.isNativePlatform()) { await PushNotifications.unregister().catch(() => undefined); return; }
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions" as never).delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

/** Human-readable push status for the current device (Android app or browser). */
export async function pushStatus(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const r = await PushNotifications.checkPermissions().catch(() => null);
    return !r ? "unavailable" : r.receive === "granted" ? "allowed" : r.receive === "denied" ? "blocked in phone settings" : "not enabled";
  }
  if (!pushSupported()) return "not supported here";
  return Notification.permission === "granted" ? "allowed" : Notification.permission === "denied" ? "blocked in browser settings" : "not enabled";
}

/** Asks the server to push a test alert to this account's registered phones. */
export async function sendNativeTest(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first.");
  const { data, error } = await supabase.functions.invoke("notify-message", { body: { test: user.id } });
  if (error) throw error;
  const d = data as { sent?: number; skipped?: string };
  if (!d?.sent) throw new Error(d?.skipped === "no devices" ? "This phone isn't registered yet. Enable notifications and reopen the app." : "Nothing was sent");
}
