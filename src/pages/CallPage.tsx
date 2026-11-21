import { logSecurityEvent } from "@/utils/audit";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { PhoneOff, Mic, MicOff, Video, VideoOff, RefreshCw, SkipForward, Send, Flag } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startRingtone } from "@/hooks/useRingtone";
import { loadRtcConfig } from "@/utils/iceConfig";
import { rtcChannelName } from "@/utils/calls";
import { Button } from "@/components/ui/button";



type Status = "ringing" | "connecting" | "connected" | "ended";

const CallPage = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [params] = useSearchParams();
  const isCallee = params.get("incoming") === "1";
  const audioOnly = params.get("audio") === "1";
  const callId = params.get("call");
  const randomMode = params.get("random") === "1";
  const meetMode = params.get("mode") === "adult" ? "adult" : "general";
  const exitPath = randomMode ? `/meet?mode=${meetMode}${audioOnly ? "&audio=1" : ""}` : "/";
  const [chatLog, setChatLog] = useState<{ me: boolean; text: string }[]>([]);
  const [chatText, setChatText] = useState("");
  const { user } = useAuth();

  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(!audioOnly);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [switchingCamera, setSwitchingCamera] = useState(false);
  const [callTime, setCallTime] = useState(0);
  const [peerName, setPeerName] = useState("User");
  const [status, setStatus] = useState<Status>("ringing");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const stopRingRef = useRef<(() => void) | null>(null);
  const endedRef = useRef(false);

  const send = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      if (event !== "ice") {
        void logSecurityEvent("realtime", `call_${event}_sent`, String(payload.to ?? "") || undefined);
      }
      channelRef.current?.send({
        type: "broadcast",
        event,
        payload: { ...payload, from: user?.id },
      });
    },
    [user?.id],
  );


  const cleanup = useCallback(() => {
    stopRingRef.current?.();
    stopRingRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const hangUp = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    send("hangup");
    // If we hang up while still ringing, cancel the recipient's ringtone.
    if (callId) void supabase.from("call_invitations").update({ status: "ended" }).eq("id", callId);
    setStatus("ended");
    cleanup();
    setTimeout(() => navigate(exitPath, { replace: true }), 600);
  }, [cleanup, navigate, send, callId, exitPath]);

  useEffect(() => {
    if (!userId || !user) return;
    let cancelled = false;
    endedRef.current = false;
    pendingIce.current = [];
    let readyTimer: ReturnType<typeof setInterval> | undefined;
    let invitationChannel: ReturnType<typeof supabase.channel> | undefined;

    supabase
      .from("profiles")
      .select("display_name, username")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data && !cancelled) setPeerName(data.display_name || data.username || "User");
      });

    const start = async () => {
      if (!callId || userId === user.id) throw new Error("Start your call from Messages or online members.");
      const { data: invitation, error } = await supabase.from("call_invitations").select("*").eq("id", callId).single();
      if (error || !invitation || (isCallee ? invitation.receiver_id !== user.id || invitation.caller_id !== userId : invitation.caller_id !== user.id || invitation.receiver_id !== userId) || !["ringing", "accepted"].includes(invitation.status)) throw new Error("This call is no longer available.");
      if (cancelled) return;
      invitationChannel = supabase.channel(`call-state-${callId}`).on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "call_invitations", filter: `id=eq.${callId}`,
      }, ({ new: row }) => { if (row.status === "ended" || row.status === "declined") hangUp(); }).subscribe();
      const pc = new RTCPeerConnection(await loadRtcConfig());
      pcRef.current = pc;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: audioOnly ? false : { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) send("ice", { candidate: e.candidate.toJSON() });
      };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === "connected") {
          stopRingRef.current?.();
          stopRingRef.current = null;
          setStatus("connected");
        }
        // Transient network flips: re-gather against Google STUN before giving up.
        if (s === "disconnected") {
          setStatus("connecting");
          try {
            pc.restartIce();
          } catch {
            /* older browsers */
          }
          setTimeout(() => {
            if (pcRef.current === pc && pc.connectionState !== "connected") hangUp();
          }, 6000);
          return;
        }
        if (s === "failed") {
          toast.error("Couldn't connect the call — the network blocked it. Try Wi-Fi or another network.");
        }
        if (s === "failed" || s === "closed") hangUp();
      };


      const channel = supabase.channel(`${rtcChannelName(user.id, userId)}--${callId}`, {
        config: { private: true, broadcast: { self: false } },
      });
      channelRef.current = channel;
      let makingOffer = false;
      const offerToPeer = async () => {
        if (isCallee || makingOffer || cancelled) return;
        makingOffer = true;
        try {
          if (pc.signalingState === "have-local-offer" && pc.localDescription) {
            send("offer", { sdp: pc.localDescription });
          } else if (pc.signalingState === "stable") {
            const offer = await pc.createOffer({ iceRestart: pc.connectionState === "disconnected" });
            await pc.setLocalDescription(offer);
            send("offer", { sdp: pc.localDescription });
          }
        } finally { makingOffer = false; }
      };
      channel.on("broadcast", { event: "ready" }, ({ payload }) => { if (payload.from === userId) void offerToPeer(); });

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }: any) => {
          if (payload.from !== userId || !pcRef.current || !isCallee || pc.signalingState !== "stable") return;
          if (readyTimer) clearInterval(readyTimer);
          setStatus("connecting");
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          for (const c of pendingIce.current) await pcRef.current.addIceCandidate(c);
          pendingIce.current = [];
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          send("answer", { sdp: answer });
        })
        .on("broadcast", { event: "answer" }, async ({ payload }: any) => {
          if (payload.from !== userId || !pcRef.current) return;
          if (pcRef.current.signalingState === "have-local-offer") {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            for (const c of pendingIce.current) await pcRef.current.addIceCandidate(c);
            pendingIce.current = [];
          }
        })
        .on("broadcast", { event: "ice" }, async ({ payload }: any) => {
          if (payload.from !== userId || !pcRef.current) return;
          if (pcRef.current.remoteDescription) {
            await pcRef.current.addIceCandidate(payload.candidate).catch(() => {});
          } else {
            pendingIce.current.push(payload.candidate);
          }
        })
        .on("broadcast", { event: "chat" }, ({ payload }: any) => {
          if (payload.from !== userId) return;
          setChatLog(l => [...l.slice(-30), { me: false, text: String(payload.text || "").slice(0, 500) }]);
        })
        .on("broadcast", { event: "hangup" }, () => {
          if (endedRef.current) return;
          endedRef.current = true;
          setStatus("ended");
          cleanup();
          setTimeout(() => navigate(randomMode ? exitPath : "/messages"), 600);
        })
        .subscribe(async (state) => {
          if (state !== "SUBSCRIBED" || cancelled) return;
          if (isCallee) {
            // Tell the caller we are here so they (re)send the offer.
            send("ready");
            setStatus("connecting");
          } else {
            stopRingRef.current = startRingtone();
            // Wait for the recipient's ready signal instead of sending an offer into an empty room.
          }
        });

      if (isCallee) readyTimer = setInterval(() => {
        if (pc.signalingState === "stable" && pc.connectionState !== "connected") send("ready");
      }, 1500);
      pc.onnegotiationneeded = () => {
        if (pc.remoteDescription) void offerToPeer();
      };
    };

    start().catch((err) => {
      console.error("Call init failed:", err);
      toast.error(err instanceof Error ? err.message : "Allow camera and microphone access to call.");
      cleanup();
      setStatus("ended");
    });

    const timer = setInterval(() => { if (pcRef.current?.connectionState === "connected") setCallTime(t => t + 1); }, 1000);
    // Give up if the other side never answers within 45 seconds.
    const noAnswer = setTimeout(() => {
      if (!endedRef.current && pcRef.current?.connectionState !== "connected") {
        toast.error("No answer");
        hangUp();
      }
    }, 45000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(noAnswer);
      if (readyTimer) clearInterval(readyTimer);
      if (invitationChannel) void supabase.removeChannel(invitationChannel);
      if (callId) void supabase.from("call_invitations").update({ status: "ended" }).eq("id", callId);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user?.id]);

  const toggleMute = () => {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };

  const toggleVideo = () => {
    const next = !videoOn;
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setVideoOn(next);
  };

  const flipCamera = async () => {
    if (switchingCamera || audioOnly) return;
    const next = facing === "user" ? "environment" : "user";
    setSwitchingCamera(true);
    let fresh: MediaStream | null = null;
    try {
      fresh = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: next }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const newTrack = fresh.getVideoTracks()[0];
      const stream = streamRef.current;
      const oldTrack = stream?.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((item) => item.track?.kind === "video");
      if (!newTrack || !stream || !sender) throw new Error("Camera switching is unavailable for this call.");
      newTrack.enabled = videoOn;
      await sender.replaceTrack(newTrack);
      if (oldTrack) {
        stream.removeTrack(oldTrack);
        oldTrack.stop();
      }
      stream.addTrack(newTrack);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play().catch(() => undefined);
      }
      fresh = null;
      setFacing(next);
    } catch (error) {
      fresh?.getTracks().forEach((track) => track.stop());
      toast.error(error instanceof Error ? error.message : "Couldn't switch cameras. Check camera permission and try again.");
    } finally {
      setSwitchingCamera(false);
    }
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="h-dvh bg-background flex flex-col relative overflow-hidden">
      {/* Liquid glass blobs — only while ringing/connecting so the live call stays clear */}
      <div className={`absolute inset-0 -z-10 transition-opacity duration-500 ${status === "connected" ? "opacity-0" : "opacity-100"}`}>
        <motion.div
          className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(var(--brand-blue) / 0.5), transparent 70%)", filter: "blur(60px)" }}
          animate={{ x: [0, 80, 0], y: [0, 60, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -right-32 w-[480px] h-[480px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(var(--brand-red) / 0.45), transparent 70%)", filter: "blur(60px)" }}
          animate={{ x: [0, -60, 0], y: [0, -80, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 right-1/4 w-[360px] h-[360px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(var(--brand-green) / 0.4), transparent 70%)", filter: "blur(70px)" }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
      {status !== "connected" && <div className="absolute inset-0 bg-background/40 backdrop-blur-md" />}
      {status === "connected" && <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />}
      {status === "connected" && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />}

      <div className="relative z-10 safe-area-top p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={status === "connected" ? "flex flex-col items-center text-center" : "mx-auto max-w-sm liquid-glass-elevated rounded-3xl px-6 py-4 text-center"}
        >
          <p className={`relative z-10 font-semibold text-white drop-shadow ${status === "connected" ? "text-lg" : "text-display text-2xl text-foreground"}`}>{peerName}</p>
          <p className="relative z-10 mt-1 font-mono text-sm text-white/90 drop-shadow">
            {status === "ringing" ? (isCallee ? "Incoming call…" : "Ringing…") : status === "connecting" ? "Connecting…" : status === "ended" ? "Call ended" : formatTime(callTime)}
          </p>
        </motion.div>
      </div>

      <div className="relative z-10 flex-1 flex items-end justify-end p-4">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          drag
          dragConstraints={{ left: -220, right: 0, top: -420, bottom: 0 }}
          className="w-24 h-36 rounded-2xl overflow-hidden border-2 border-white/40 bg-black shadow-2xl cursor-grab active:cursor-grabbing"
        >
          <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover relative z-10 ${facing === "user" ? "mirror" : ""}`} />
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 safe-area-bottom pb-8"
      >
        {randomMode && (
          <div className="mx-auto mb-3 w-full max-w-sm px-3">
            <div className="max-h-28 space-y-1 overflow-y-auto">
              {chatLog.slice(-6).map((m, i) => <p key={i} className={`w-fit max-w-[85%] rounded-2xl px-3 py-1 text-sm text-white ${m.me ? "ml-auto bg-primary/80" : "bg-black/60"}`}>{m.text}</p>)}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input value={chatText} onChange={e => setChatText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && chatText.trim()) { send("chat", { text: chatText.trim() }); setChatLog(l => [...l, { me: true, text: chatText.trim() }]); setChatText(""); } }} placeholder="Type a message…" maxLength={300} className="min-w-0 flex-1 rounded-full bg-black/55 px-4 py-2 text-sm text-white placeholder:text-white/50 outline-none backdrop-blur" />
              <button aria-label="Send" onClick={() => { if (chatText.trim()) { send("chat", { text: chatText.trim() }); setChatLog(l => [...l, { me: true, text: chatText.trim() }]); setChatText(""); } }} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><Send className="h-4 w-4" /></button>
              <button aria-label="Report this person" onClick={async () => { if (!user || !userId) return; await supabase.from("reports").insert({ reporter_id: user.id, target_type: "user", target_id: userId, reason: "Reported in random video chat" } as any); toast.success("Reported — moving to the next person"); hangUp(); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/70 text-white"><Flag className="h-4 w-4" /></button>
            </div>
          </div>
        )}
        <div className="mx-auto max-w-sm rounded-full bg-black/55 py-3 px-4 backdrop-blur-sm">
          <div className="flex justify-center gap-3 relative z-10">
            <Button variant="ghost" size="icon"
              onClick={toggleMute}
              aria-label="Toggle microphone"
              className={`depth-press w-14 h-14 rounded-full flex items-center justify-center ${muted ? "bg-red-500/40" : "bg-white/15"}`}
            >
              {muted ? <MicOff className="w-6 h-6 text-destructive" /> : <Mic className="w-6 h-6 text-white" />}
            </Button>
            <Button variant="ghost" size="icon" disabled={audioOnly}
              onClick={toggleVideo}
              aria-label="Toggle camera"
              className={`depth-press w-14 h-14 rounded-full flex items-center justify-center ${!videoOn ? "bg-red-500/40" : "bg-white/15"}`}
            >
              {videoOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-destructive" />}
            </Button>
            <Button variant="ghost" size="icon" disabled={audioOnly || switchingCamera}
              onClick={flipCamera}
              aria-label={switchingCamera ? "Switching camera" : "Switch camera"}
              className="depth-press w-14 h-14 rounded-full bg-white/15 flex items-center justify-center"
            >
              <RefreshCw className="w-6 h-6 text-white" />
            </Button>
            {randomMode && (
              <Button variant="ghost" size="icon" onClick={hangUp} aria-label="Next person" title="Next person" className="depth-press w-14 h-14 rounded-full bg-emerald-500/60 flex items-center justify-center">
                <SkipForward className="w-6 h-6 text-white" />
              </Button>
            )}
            <Button variant="destructive" size="icon"
              onClick={hangUp}
              aria-label="End call"
              className="depth-press w-14 h-14 rounded-full bg-destructive flex items-center justify-center shadow-lg shadow-destructive/50"
            >
              <PhoneOff className="w-6 h-6 text-destructive-foreground" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CallPage;
