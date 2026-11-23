import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { rpc, table } from "../shared/ui";

const KEY = "pg_ref";
/** Production origin; `primegram.app/invite/<code>` style links resolve to this domain. */
export const INVITE_ORIGIN = "https://primegramx.co.ke";
export const inviteLink = (code: string) => `${INVITE_ORIGIN}/invite/${code}`;

export const storeRef = (code: string) => { try { localStorage.setItem(KEY, code.trim().toUpperCase().slice(0, 16)); } catch { /* storage blocked */ } };
export const readRef = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const clearRef = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

export const REWARD_AT = 3;
export type Perk = "obsidian_gold_theme" | "founder_ring" | "vip_badge" | "platinum_badge";

/** My referral code, how many friends joined, and the perks that unlocked. Live-updates when a friend signs up. */
export const useReferral = () => {
  const { user } = useAuth();
  const [state, setState] = useState<{ code: string; count: number; perks: Perk[] } | null>(null);
  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: p }, { data: perks }] = await Promise.all([
      table("profiles").select("referral_code, referral_count").eq("user_id", user.id).maybeSingle(),
      table("user_perks").select("perk").eq("user_id", user.id),
    ]);
    if (p) setState({ code: p.referral_code, count: p.referral_count ?? 0, perks: ((perks ?? []) as { perk: Perk }[]).map((x) => x.perk) });
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => void load(), 30000); // cheap refresh; RLS only lets me read my own row
    return () => clearInterval(t);
  }, [user, load]);
  return { ...state, reload: load, loading: !state && !!user };
};

export const previewInviter = async (code: string) => {
  const { data } = await rpc<{ display_name: string | null; avatar_url: string | null }[]>("referral_preview", { _code: code });
  return data?.[0] ?? null;
};
export const claimReferral = (code: string) => rpc<{ ok: boolean; error: string | null }>("claim_referral", { _code: code });
