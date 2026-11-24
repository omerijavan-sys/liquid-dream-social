import { toast } from "sonner";
import { trackEvent } from "@/utils/telemetry";

/** Opens WhatsApp with a ready-made message (works for Chats and "Status" shares on every phone). */
export const shareWhatsApp = (text: string, url: string, source = "app") => {
  trackEvent(`share_whatsapp_${source}`);
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
};

export const nativeShare = async (text: string, url: string, source = "app"): Promise<void> => {
  trackEvent(`share_native_${source}`);
  try { if (navigator.share) { await navigator.share({ title: "Primegram", text, url }); return; } } catch { return; }
  await navigator.clipboard.writeText(url).catch(() => undefined);
  toast.success("Link copied");
};
