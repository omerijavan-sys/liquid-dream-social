import { supabase } from "@/integrations/supabase/client";
import { requestPin } from "@/components/WalletPin";
import { rpc, table } from "../shared/ui";

/** Primegram keeps 15% of every paid unlock; the creator receives the rest. */
export const PPV_FEE = 0.15;
export const PPV_MIN = 20;
export const PPV_MAX = 20000;
export const creatorShare = (price: number) => Math.round(price * (1 - PPV_FEE) * 100) / 100;
export const kes = (n: number) => `KES ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export interface PpvItem { id: string; owner_id: string; kind: "post" | "message"; price_kes: number; media_type: "image" | "video"; teaser: string | null }

export const priceError = (v: string): string | null => {
  const n = Number(v);
  if (!v.trim() || !Number.isFinite(n)) return "Enter a price";
  if (n < PPV_MIN || n > PPV_MAX) return `Price must be between ${kes(PPV_MIN)} and ${kes(PPV_MAX)}`;
  return null;
};

/** Uploads to the private bucket (only the owner and buyers can ever read it). Returns the storage path. */
export const uploadLocked = async (userId: string, file: Blob, name = ""): Promise<string> => {
  const ext = (name.split(".").pop() || (file.type.startsWith("video/") ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${userId}/ppv_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("locked-media").upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  return path;
};

export const fetchItems = async (ids: string[]): Promise<Record<string, PpvItem>> => {
  if (!ids.length) return {};
  const { data } = await table("ppv_items").select("id, owner_id, kind, price_kes, media_type, teaser").in("id", ids);
  return Object.fromEntries(((data ?? []) as PpvItem[]).map((i) => [i.id, { ...i, price_kes: Number(i.price_kes) }]));
};

export const myUnlocked = async (ids: string[]): Promise<Set<string>> => {
  if (!ids.length) return new Set();
  const { data } = await table("ppv_unlocks").select("item_id").in("item_id", ids);
  return new Set(((data ?? []) as { item_id: string }[]).map((r) => r.item_id));
};

export const signedUrl = async (path: string): Promise<string> => {
  const { data, error } = await supabase.storage.from("locked-media").createSignedUrl(path, 3600);
  if (error || !data) throw error ?? new Error("Couldn't open this content");
  return data.signedUrl;
};

/** Asks for the wallet PIN (if set), pays from the wallet, and returns a temporary link to the media. */
export const unlockItem = async (itemId: string): Promise<string> => {
  if (!(await requestPin())) throw new Error("Payment cancelled");
  const { data, error } = await rpc<string>("ppv_unlock", { _item: itemId });
  if (error) throw new Error(error.message);
  return signedUrl(data as string);
};

/** Owner or an earlier buyer: just get the link, no payment. */
export const openItem = async (itemId: string): Promise<string> => {
  const { data, error } = await rpc<string>("ppv_unlock", { _item: itemId });
  if (error) throw new Error(error.message);
  return signedUrl(data as string);
};
