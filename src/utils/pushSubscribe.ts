import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BIxoIal8OTWjGhelc6tzx29-pYEDFuU1ubHRvkiX7g7BrffCe0_fCPzMxt5aeDnwSTP-VY0Dy1yMrWQJaL-sBUY";

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Asks permission, subscribes this device to Web Push and stores it for the signed-in user. */
export async function enablePush(userId: string): Promise<void> {
  if (!pushSupported()) throw new Error("Push notifications aren't supported on this browser.");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Allow notifications in your browser settings.");
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Couldn't register this device for push.");
  const { error } = await supabase.from("push_subscriptions" as never).upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth } as never,
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions" as never).delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
