import { useEffect, useState, type RefObject } from "react";
import { toPng } from "html-to-image";

/**
 * Turns a card element into a PNG. Web fonts are skipped (reading cross-origin stylesheets is what made exports throw),
 * and the first pass is retried because some WebViews paint images/QR codes only on the second pass.
 */
export const renderCard = async (node: HTMLElement): Promise<string> => {
  const base = { pixelRatio: 2, cacheBust: false, backgroundColor: "#09090B", skipFonts: true };
  await new Promise((r) => setTimeout(r, 200));
  // Progressively simpler attempts, so a WebView that chokes on one feature still gets a card.
  const attempts = [
    base,
    { ...base, pixelRatio: 1 },
    { ...base, pixelRatio: 1, filter: (n: Node) => !(n instanceof HTMLImageElement && n.dataset.skipExport === "1") },
  ];
  let last: unknown;
  for (const o of attempts) {
    try { return await toPng(node, o); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 150)); }
  }
  throw last;
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

/**
 * Renders the card as soon as it is on screen, so Share/Save are instant. That keeps the tap's "user gesture" alive,
 * which phones require before they will open the share sheet (an export that runs after the tap can lose it).
 */
export const usePrerender = (ref: RefObject<HTMLElement>, ready: boolean) => {
  const [png, setPng] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    let dead = false;
    setPng(null); setError(null);
    const t = window.setTimeout(async () => {
      try {
        if (!ref.current) throw new Error("card not ready");
        const r = await renderCard(ref.current);
        if (!dead) setPng(r);
      } catch (e) {
        if (!dead) setError(e instanceof Event ? "an image on the card failed to load" : (e as Error)?.message || "unknown error");
      }
    }, 400);
    return () => { dead = true; window.clearTimeout(t); };
  }, [ready, ref]);
  return { png, error };
};
