import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneOff, Mic, MicOff, Video, VideoOff, Users } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { loadRtcConfig } from "@/utils/iceConfig";
import { startRingtone } from "@/hooks/useRingtone";

type Sig = { from: string; to: string; kind: "offer" | "answer" | "ice"; data: any };
const MAX_PEOPLE = 8;

const Tile = ({ stream, label, muted }: { stream: MediaStream | null; label: string; muted?: boolean }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  const hasVideo = !!stream?.getVideoTracks().some(t => t.enabled && t.readyState === "live");
  return (
    <div className="relative overflow-hidden rounded-2xl bg-neutral-900">
      <video ref={ref} autoPlay playsInline muted={muted} className={`h-full w-full object-cover ${hasVideo ? "" : "opacity-0"}`} />
      {!hasVideo && <div className="absolute inset-0 flex items-center justify-center"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-2xl font-bold text-white">{label.slice(0, 1).toUpperCase()}</span></div>}
      <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{label}</span>
    </div>
  );
};

/** Mesh group call: everyone who joins connects to everyone else; presence tells us who is here. */
const GroupCallPage = () => {
  const { callId } = useParams<{ callId: string }>();
  const [params] = useSearchParams();
  const audioOnly = params.get("audio") === "1";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [groupName, setGroupName] = useState("Group call");
  const [names, setNames] = useState<Record<string, string>>({});
  const [remote, setRemote] = useState<Record<string, MediaStream>>({});
  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(!audioOnly);
  const [joined, setJoined] = useState(false);
  const [secs, setSecs] = useState(0);
  const localRef = useRef<MediaStream | null>(null);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIce = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const doneRef = useRef(false);
  const ringRef = useRef<(() => void) | null>(null);

  const leave = useCallback(async (endForAll: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    ringRef.current?.(); ringRef.current = null;
    if (endForAll && callId) await supabase.from("group_calls" as never).update({ status: "ended" } as never).eq("id", callId);
    pcs.current.forEach(pc => pc.close()); pcs.current.clear();
    localRef.current?.getTracks().forEach(t => t.stop()); localRef.current = null;
    if (chRef.current) { void chRef.current.untrack(); void supabase.removeChannel(chRef.current); chRef.current = null; }
    navigate("/messages", { replace: true });
  }, [callId, navigate]);

  useEffect(() => {
    if (!callId || !user) return;
    let cancelled = false;
    doneRef.current = false;
    const me = user.id;

    const loadNames = async (ids: string[]) => {
      const need = ids.filter(i => !names[i]);
      if (!need.length) return;
      const { data } = await supabase.from("profiles").select("user_id, display_name, username").in("user_id", need);
      setNames(n => ({ ...n, ...Object.fromEntries((data ?? []).map(p => [p.user_id, p.display_name || p.username || "Member"])) }));
    };

    const sendSig = (s: Sig) => { void chRef.current?.send({ type: "broadcast", event: "sig", payload: s }); };

    const makePc = async (peer: string) => {
      const existing = pcs.current.get(peer); if (existing) return existing;
      const pc = new RTCPeerConnection(await loadRtcConfig());
      pcs.current.set(peer, pc);
      localRef.current?.getTracks().forEach(t => pc.addTrack(t, localRef.current!));
      pc.onicecandidate = e => { if (e.candidate) sendSig({ from: me, to: peer, kind: "ice", data: e.candidate.toJSON() }); };
      pc.ontrack = e => { if (e.streams[0]) setRemote(r => ({ ...r, [peer]: e.streams[0] })); };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") { ringRef.current?.(); ringRef.current = null; }
        if (pc.connectionState === "failed") { try { pc.restartIce(); } catch { /* ignore */ } }
      };
      return pc;
    };
    const dropPeer = (peer: string) => {
      pcs.current.get(peer)?.close(); pcs.current.delete(peer); pendingIce.current.delete(peer);
      setRemote(r => { const n = { ...r }; delete n[peer]; return n; });
    };

    const run = async () => {
      const { data: call } = await supabase.from("group_calls" as never).select("group_id, status, audio").eq("id", callId).maybeSingle() as { data: { group_id: string; status: string } | null };
      if (!call || call.status !== "active") throw new Error("This group call has ended.");
      const { data: g } = await supabase.from("chat_groups" as never).select("name").eq("id", call.group_id).maybeSingle() as { data: { name: string } | null };
      if (g && !cancelled) setGroupName(g.name);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: audioOnly ? false : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } });
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      localRef.current = stream; setLocal(stream);
      void loadNames([me]);

      const ch = supabase.channel(`gcall-${callId}`, { config: { broadcast: { self: false }, presence: { key: me } } });
      chRef.current = ch;
      ch.on("broadcast", { event: "sig" }, async ({ payload }: { payload: Sig }) => {
        if (payload.to !== me) return;
        const peer = payload.from;
        const pc = await makePc(peer);
        try {
          if (payload.kind === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
            for (const c of pendingIce.current.get(peer) ?? []) await pc.addIceCandidate(c).catch(() => undefined);
            pendingIce.current.delete(peer);
            const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
            sendSig({ from: me, to: peer, kind: "answer", data: pc.localDescription });
          } else if (payload.kind === "answer") {
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
              for (const c of pendingIce.current.get(peer) ?? []) await pc.addIceCandidate(c).catch(() => undefined);
              pendingIce.current.delete(peer);
            }
          } else if (pc.remoteDescription) await pc.addIceCandidate(payload.data).catch(() => undefined);
          else pendingIce.current.set(peer, [...(pendingIce.current.get(peer) ?? []), payload.data]);
        } catch (e) { console.error("group call signal", e); }
      });
      ch.on("presence", { event: "sync" }, () => {
        const ids = Object.keys(ch.presenceState()).filter(i => i !== me);
        void loadNames(ids);
        // peers who left
        [...pcs.current.keys()].forEach(p => { if (!ids.includes(p)) dropPeer(p); });
        // the member with the smaller id makes the offer, so each pair negotiates exactly once
        ids.slice(0, MAX_PEOPLE - 1).forEach(async peer => {
          if (me < peer && !pcs.current.has(peer)) {
            const pc = await makePc(peer);
            const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
            sendSig({ from: me, to: peer, kind: "offer", data: pc.localDescription });
          }
        });
      });
      ch.subscribe(async status => {
        if (status !== "SUBSCRIBED" || cancelled) return;
        await ch.track({ at: Date.now() });
        setJoined(true);
      });
    };
    run().catch(err => { toast.error(err instanceof Error ? err.message : "Allow microphone access to join."); void leave(false); });

    // Someone else ended the call for everyone
    const state = supabase.channel(`gcall-state-${callId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "group_calls", filter: `id=eq.${callId}` },
      ({ new: row }) => { if ((row as { status?: string }).status === "ended") { toast("The group call ended."); void leave(false); } }).subscribe();
    const tick = setInterval(() => setSecs(s => s + 1), 1000);
    return () => { cancelled = true; clearInterval(tick); void supabase.removeChannel(state); if (!doneRef.current) void leave(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, user?.id]);

  // when I'm alone for a while after others had joined, the call is over; last one out ends it
  const others = Object.keys(remote).length;
  const hangUp = () => {
    const alone = (chRef.current ? Object.keys(chRef.current.presenceState()).filter(i => i !== user?.id).length : 0) === 0;
    void leave(alone);
  };

  const toggleMute = () => { const n = !muted; localRef.current?.getAudioTracks().forEach(t => (t.enabled = !n)); setMuted(n); };
  const toggleVideo = () => { const n = !videoOn; localRef.current?.getVideoTracks().forEach(t => (t.enabled = n)); setVideoOn(n); };
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const peers = Object.keys(remote);
  const cols = peers.length + 1 <= 1 ? "grid-cols-1" : peers.length + 1 <= 4 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="flex h-dvh flex-col bg-black text-white">
      <div className="safe-area-top flex items-center justify-between px-4 py-3">
        <div className="min-w-0"><p className="truncate font-semibold">{groupName}</p><p className="text-xs text-white/70">{joined ? (others ? fmt(secs) : "Waiting for others to join…") : "Joining…"}</p></div>
        <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs"><Users className="h-3.5 w-3.5" />{others + 1}</span>
      </div>
      <div className={`grid flex-1 auto-rows-fr gap-2 p-2 ${cols}`}>
        <Tile stream={videoOn ? local : null} label="You" muted />
        {peers.map(p => <Tile key={p} stream={remote[p]} label={names[p] ?? "Member"} />)}
      </div>
      <div className="safe-area-bottom flex justify-center gap-4 pb-8 pt-3">
        <button onClick={toggleMute} aria-label="Mute" className={`flex h-14 w-14 items-center justify-center rounded-full ${muted ? "bg-red-500/50" : "bg-white/15"}`}>{muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}</button>
        <button onClick={toggleVideo} disabled={audioOnly} aria-label="Camera" className={`flex h-14 w-14 items-center justify-center rounded-full disabled:opacity-40 ${!videoOn ? "bg-red-500/50" : "bg-white/15"}`}>{videoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}</button>
        <button onClick={hangUp} aria-label="Leave call" className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-600/50"><PhoneOff className="h-6 w-6" /></button>
      </div>
    </div>
  );
};

export default GroupCallPage;
