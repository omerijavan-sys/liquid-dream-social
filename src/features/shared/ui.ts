import { supabase } from "@/integrations/supabase/client";

/** Obsidian + frosted-glass design tokens shared by every growth feature. */
export const OBSIDIAN = "#09090B";
export const glass = "border border-white/10 bg-white/[0.06] backdrop-blur-xl";
export const glassStrong = "border border-white/10 bg-black/50 backdrop-blur-xl";

/** Hex colour -> "r,g,b" so glows can use rgba() with any alpha. */
export const rgb = (hex: string) => {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "a78bfa";
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
};
export const glow = (hex: string, a = 0.55, blur = 18) => `0 0 ${blur}px rgba(${rgb(hex)},${a})`;

type Err = { message: string } | null;
/** The generated Supabase types predate the growth tables, so these thin wrappers keep call sites typed locally. */
export const rpc = <T = unknown>(fn: string, args: Record<string, unknown> = {}) =>
  (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: T | null; error: Err }>)(fn, args);
export const table = (name: string) => (supabase.from as unknown as (t: string) => any)(name); // eslint-disable-line @typescript-eslint/no-explicit-any

/** The device's IANA timezone, saved to the profile so streak days roll over at the user's own midnight. */
export const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Nairobi"; } catch { return "Africa/Nairobi"; } };

export const uploadMedia = async (userId: string, folder: string, blob: Blob, ext: string): Promise<string> => {
  const path = `${folder}/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: blob.type || undefined });
  if (error) throw error;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
};
