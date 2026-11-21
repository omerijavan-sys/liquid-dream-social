import { supabase } from "@/integrations/supabase/client";
const seen = new Set<string>();
/** Counts one unique viewer for a reel (the server ignores repeat views and the owner's own). */
export function countReelView(reelId: string) {
  if (seen.has(reelId)) return;
  seen.add(reelId);
  void (supabase.rpc as any)("register_reel_view", { _reel_id: reelId });
}
