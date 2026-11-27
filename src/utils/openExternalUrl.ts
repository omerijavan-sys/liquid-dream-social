import { Capacitor } from "@capacitor/core";

export function toAndroidIntentUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only web links can be opened externally");
  }
  const scheme = url.protocol.slice(0, -1);
  return `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
}

/** Opens an external URL with Capacitor Browser, falling back to Android's URL handler on older installs. */
export async function closeExternalBrowser() {
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch {
    // The plugin may not exist in older native installs.
  }
}

export async function openExternalUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only web links can be opened externally");
  }

  if (!Capacitor.isNativePlatform()) {
    window.location.assign(url.href);
    return;
  }

  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: url.href });
  } catch (error) {
    if (Capacitor.getPlatform() !== "android") throw error;
    window.location.assign(toAndroidIntentUrl(url.href));
  }
}
