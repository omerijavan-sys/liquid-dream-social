import { Capacitor } from "@capacitor/core";

export const normalizeUrl = (raw: string): string => {
  const t = raw.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t; // mailto:, tel:, etc.
  return `https://${t}`;
};

/** Opens a link inside the app: native in-app browser tab on Android, overlay browser on web. */
export async function openLink(raw: string) {
  const url = normalizeUrl(raw);
  if (!/^https?:\/\//i.test(url)) { window.location.href = url; return; }
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url, presentationStyle: "popover" });
      return;
    } catch { /* fall through to overlay */ }
  }
  window.dispatchEvent(new CustomEvent("prime:openLink", { detail: { url } }));
}
