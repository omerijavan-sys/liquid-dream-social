import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { captureVideoFrame } from "@/utils/videoPoster";

const MAX_PER_SESSION = 2;
let ran = false;

/**
 * Old reels were uploaded without a cover image. When their owner opens the app we quietly generate and save
 * one (max 2 per session, after the app is idle) so Trending, profile grids and Reels stop showing blank tiles.
 */
export function useCoverBackfill(userId: string | undefined) {
  useEffect(() => {
    if (!userId || ran) return;
    const t = window.setTimeout(() => {
      if (ran) return;
      ran = true;
      void (async () => {
        try {
          const { data } = await supabase.from("reels").select("id, video_url").eq("user_id", userId).is("thumbnail_url", null).order("created_at", { ascending: false }).limit(MAX_PER_SESSION);
          for (const r of data ?? []) {
            if (!r.video_url) continue;
            const dataUrl = await captureVideoFrame(r.video_url);
            if (!dataUrl) continue;
            const blob = await (await fetch(dataUrl)).blob();
            const path = `${userId}/cover_${Date.now()}_${r.id.slice(0, 8)}.jpg`;
            const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: "image/jpeg" });
            if (error) continue;
            const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
            await supabase.from("reels").update({ thumbnail_url: url }).eq("id", r.id).eq("user_id", userId);
          }
        } catch { /* best effort: never disturb the app */ }
      })();
    }, 8000);
    return () => window.clearTimeout(t);
  }, [userId]);
}
