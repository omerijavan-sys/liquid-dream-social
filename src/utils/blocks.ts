import { supabase } from "@/integrations/supabase/client";

/** Everyone the signed-in user has blocked or been blocked by (hidden both ways). Cached briefly. */
let cache: { at: number; p: Promise<Set<string>> } | null = null;
const TTL = 60_000;

export const getBlockedIds = (): Promise<Set<string>> => {
  if (cache && Date.now() - cache.at < TTL) return cache.p;
  const p = (async () => {
    const { data, error } = await (supabase.rpc as any)("my_blocked_ids"); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (error || !Array.isArray(data)) return new Set<string>();
    return new Set<string>(data as string[]);
  })().catch(() => new Set<string>());
  cache = { at: Date.now(), p };
  return p;
};
export const invalidateBlocked = () => { cache = null; };
