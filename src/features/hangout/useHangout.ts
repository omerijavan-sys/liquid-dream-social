import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { table } from "../shared/ui";

export interface Prompt { id: string; group_id: string; kind: "qa" | "poll"; body: string; options: string[] | null; created_at: string; expires_at: string }
export interface Listener { user_id: string; name: string; track: { title: string; artist: string } | null }
export interface Burst { id: number; emoji: string; x: number }

export const EMOJIS = ["🔥", "😂", "❤️", "👏", "😮"];
const COLS = "id, group_id, kind, body, options, created_at, expires_at";

/**
 * One Supabase Realtime channel per group:
 *  - Presence: who is in the hangout right now and what they're listening to
 *  - Broadcast: emoji reactions + "something changed" pings that make members refetch prompts/answers/votes
 * Nothing here is persisted except prompts/answers/votes, which live in tables protected by RLS.
 */
export const useHangout = (groupId: string, myName: string) => {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [tick, setTick] = useState(0); // bumps whenever answers/votes change anywhere in the group
  const ch = useRef<RealtimeChannel | null>(null);
  const track = useRef<Listener["track"]>(null);
  const seq = useRef(0);

  const loadPrompts = useCallback(async () => {
    const { data } = await table("hangout_prompts").select(COLS).eq("group_id", groupId).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(10);
    setPrompts((data ?? []) as Prompt[]);
  }, [groupId]);

  useEffect(() => {
    if (!user) return;
    void loadPrompts();
    const refresh = setInterval(() => void loadPrompts(), 30_000); // safety net if a broadcast is missed
    const channel = supabase.channel(`hangout:${groupId}`, { config: { presence: { key: user.id }, broadcast: { self: true } } });
    channel
      .on("presence", { event: "sync" }, () => {
        const st = channel.presenceState() as Record<string, Listener[]>;
        setListeners(Object.values(st).map((v) => v[v.length - 1]).filter(Boolean));
      })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        const id = ++seq.current;
        setBursts((b) => [...b.slice(-14), { id, emoji: String(payload.emoji).slice(0, 4), x: 10 + Math.random() * 80 }]);
        setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 2200);
      })
      .on("broadcast", { event: "changed" }, () => { void loadPrompts(); setTick((t) => t + 1); })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ user_id: user.id, name: myName, track: track.current });
      });
    ch.current = channel;
    return () => { clearInterval(refresh); ch.current = null; void supabase.removeChannel(channel); };
  }, [groupId, user, myName, loadPrompts]);

  const react = useCallback((emoji: string) => { void ch.current?.send({ type: "broadcast", event: "reaction", payload: { emoji } }); }, []);
  const changed = useCallback(() => { void ch.current?.send({ type: "broadcast", event: "changed", payload: {} }); }, []);
  const listen = useCallback(async (t: Listener["track"]) => {
    track.current = t;
    if (user) await ch.current?.track({ user_id: user.id, name: myName, track: t });
  }, [user, myName]);

  return { prompts, listeners, bursts, tick, react, changed, listen, reload: loadPrompts };
};
