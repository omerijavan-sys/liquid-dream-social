import { toPng } from "html-to-image";

/**
 * Turns a card element into a PNG. Web fonts are skipped (reading cross-origin stylesheets is what made exports throw),
 * and the first pass is retried because some WebViews paint images/QR codes only on the second pass.
 */
export const renderCard = async (node: HTMLElement): Promise<string> => {
  const opts = { pixelRatio: 2, cacheBust: true, backgroundColor: "#09090B", skipFonts: true };
  await new Promise((r) => setTimeout(r, 200));
  try { await toPng(node, opts); } catch { /* warm-up pass, ignore */ }
  return toPng(node, opts);
};

/**
 * Hands the image to the user. Order: native share sheet with the file (phone browsers), then a normal download
 * (desktop). The Android app's WebView supports neither, so it returns "preview" and the caller shows the image to
 * press-and-hold and save.
 */
export const deliverImage = async (png: string, name: string, text: string): Promise<"shared" | "saved" | "preview"> => {
  const isApp = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  const file = new File([await (await fetch(png)).blob()], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "Primegram", text }); return "shared"; }
  if (isApp) return "preview";
  const a = document.createElement("a"); a.href = png; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  return "saved";
};
