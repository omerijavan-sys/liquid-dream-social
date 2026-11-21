import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Loader2, Mic, MicOff, RefreshCw, Send, Users, Video, VideoOff, X } from "lucide-react";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { loadRtcConfig } from "@/utils/iceConfig";
import MediaEditor from "@/components/MediaEditor";

type Stream = { id: string; host_id: string; title: string | null; status: "live" | "ended"; started_at: string };
type Sig = { from: string; to: string; kind: "offer" | "answer" | "ice"; data: any };
type Comment = { id: string; user_id: string; content: string; name?: string };

const viewersPeakText = (n: number) => (n ? `${n} ${n === 1 ? "person" : "people"} watched.` : "No one joined this time.");
const MAX_VIEWERS = 12; // each viewer is a direct peer connection to the host's phone

/** Host (/live/new) and viewer (/live/:id) screen for Primegram Live. */
const LivePage = () => {
  const { id } = useParams();
  const isHost = !id;
  const { user } = useAuth();
  const me = user?.id ?? "";
  const navigate = useNavigate();

  const [stream, setStream] = useState<Stream | null>(null);
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState<"setup" | "starting" | "live" | "ended" | "loading" | "full">(isHost ? "setup" : "loading");
  const [viewers, setViewers] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [hearts, setHearts] = useState<{ k: number; x: number }[]>([]);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [needsTap, setNeedsTap] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [hostName, setHostName] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<MediaStream | null>(null);
  const chRef = useRef<RealtimeChannel | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const rtcRef = useRef<RTCConfiguration | null>(null);
  const names = useRef(new Map<string, string>());
  const peakRef = useRef(0);
  const endedRef = useRef(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);

  const nameOf = useCallback(async (uid: string) => {
    if (names.current.has(uid)) return names.current.get(uid)!;
    const { data } = await supabase.from("profiles").select("username,display_name").eq("user_id", uid).maybeSingle();
    const n = data?.username || data?.display_name || "user";
    names.current.set(uid, n);
    return n;
  }, []);

  const sendSig = (s: Sig) => { void chRef.current?.send({ type: "broadcast", event: "sig", payload: s }); };

  const makePc = useCallback(async (peer: string) => {
    let pc = pcs.current.get(peer);
    if (pc) return pc;
    rtcRef.current ??= await loadRtcConfig();
    pc = new RTCPeerConnection(rtcRef.current);
    pcs.current.set(peer, pc);
    pc.onicecandidate = (e) => { if (e.candidate) sendSig({ from: me, to: peer, kind: "ice", data: e.candidate.toJSON() }); };
    if (isHost) {
      localRef.current?.getTracks().forEach((t) => pc!.addTrack(t, localRef.current!));
    } else {
      pc.ontrack = (e) => {
        const v = videoRef.current; if (!v) return;
        v.srcObject = e.streams[0];
        v.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
        setHasVideo(true);
      };
    }
    pc.onconnectionstatechange = () => {
      if (pc!.connectionState === "failed" || pc!.connectionState === "closed") { pcs.current.delete(peer); }
    };
    return pc;
  }, [isHost, me]);

  const dropPeer = (peer: string) => { pcs.current.get(peer)?.close(); pcs.current.delete(peer); pendingIce.current.delete(peer); };

  /** Joins the signalling channel for a stream. Host offers to every viewer that shows up; viewers answer. */
  const joinChannel = useCallback((sid: string, hostId: string) => {
    const ch = supabase.channel(`live-${sid}`, { config: { broadcast: { self: false }, presence: { key: me } } });
    chRef.current = ch;
    ch.on("broadcast", { event: "sig" }, async ({ payload }: { payload: Sig }) => {
      if (payload.to !== me) return;
      const peer = payload.from;
      try {
        if (payload.kind === "offer" && !isHost) {
          const pc = await makePc(peer);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
          for (const c of pendingIce.current.get(peer) ?? []) await pc.addIceCandidate(c).catch(() => undefined);
          pendingIce.current.delete(peer);
          const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
          sendSig({ from: me, to: peer, kind: "answer", data: pc.localDescription });
        } else if (payload.kind === "answer" && isHost) {
          const pc = pcs.current.get(peer);
          if (pc && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
            for (const c of pendingIce.current.get(peer) ?? []) await pc.addIceCandidate(c).catch(() => undefined);
            pendingIce.current.delete(peer);
          }
        } else if (payload.kind === "ice") {
          const pc = pcs.current.get(peer);
          if (pc?.remoteDescription) await pc.addIceCandidate(payload.data).catch(() => undefined);
          else pendingIce.current.set(peer, [...(pendingIce.current.get(peer) ?? []), payload.data]);
        }
      } catch (e) { console.error("live signal", e); }
    });
    ch.on("broadcast", { event: "heart" }, () => floatHeart());
    ch.on("presence", { event: "sync" }, () => {
      const ids = Object.keys(ch.presenceState()).filter((i) => i !== hostId);
      setViewers(ids.length);
      if (ids.length > peakRef.current) peakRef.current = ids.length;
      if (!isHost) return;
      [...pcs.current.keys()].forEach((p) => { if (!ids.includes(p)) dropPeer(p); });
      ids.slice(0, MAX_VIEWERS).forEach(async (peer) => {
        if (peer === me || pcs.current.has(peer)) return;
        const pc = await makePc(peer);
        const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
        sendSig({ from: me, to: peer, kind: "offer", data: pc.localDescription });
      });
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ at: Date.now() });
    });
  }, [isHost, makePc, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const floatHeart = () => {
    const k = Date.now() + Math.random();
    setHearts((h) => [...h.slice(-12), { k, x: 10 + Math.random() * 60 }]);
    setTimeout(() => setHearts((h) => h.filter((x) => x.k !== k)), 2200);
  };

  const cleanup = useCallback(() => {
    pcs.current.forEach((pc) => pc.close()); pcs.current.clear();
    localRef.current?.getTracks().forEach((t) => t.stop()); localRef.current = null;
    if (chRef.current) { void supabase.removeChannel(chRef.current); chRef.current = null; }
  }, []);

  // Host: open the camera for the preview.
  useEffect(() => {
    if (!isHost) return;
    let dead = false;
    navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } } })
      .then((s) => { if (dead) { s.getTracks().forEach((t) => t.stop()); return; } localRef.current = s; if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(() => toast.error("Allow camera and microphone to go live."));
    return () => { dead = true; };
  }, [isHost]);

  // Viewer: load the stream and join.
  useEffect(() => {
    if (isHost || !id || !me) return;
    let dead = false;
    (async () => {
      const { data } = await (supabase as any).from("live_streams").select("id,host_id,title,status,started_at").eq("id", id).maybeSingle();
      if (dead) return;
      if (!data || data.status !== "live") { setPhase("ended"); return; }
      setStream(data as Stream);
      void nameOf(data.host_id).then(setHostName);
      joinChannel(data.id, data.host_id);
      setPhase("live");
    })();
    return () => { dead = true; };
  }, [id, isHost, me, joinChannel, nameOf]);

  // Chat + "stream ended" for everyone in the stream.
  const sid = stream?.id;
  useEffect(() => {
    if (!sid) return;
    void (supabase as any).from("live_comments").select("id,user_id,content").eq("stream_id", sid).order("created_at", { ascending: false }).limit(40).then(async ({ data }) => {
      const rows = ((data ?? []) as Comment[]).reverse();
      await Promise.all(rows.map((r) => nameOf(r.user_id)));
      setComments(rows.map((r) => ({ ...r, name: names.current.get(r.user_id) })));
    });
    const c = supabase.channel(`live-chat-${sid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_comments", filter: `stream_id=eq.${sid}` }, async ({ new: row }) => {
        const r = row as Comment; r.name = await nameOf(r.user_id);
        setComments((p) => [...p.slice(-60), r]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_streams", filter: `id=eq.${sid}` }, ({ new: row }) => {
        if ((row as { status?: string }).status === "ended" && !isHost) { cleanup(); setPhase("ended"); }
      })
      .subscribe();
    return () => { void supabase.removeChannel(c); };
  }, [sid, isHost, nameOf, cleanup]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [comments.length]);

  const goLive = async () => {
    if (!me || !localRef.current) { toast.error("Camera isn't ready yet."); return; }
    setPhase("starting");
    const { data, error } = await (supabase as any).from("live_streams").insert({ host_id: me, title: title.trim() || null }).select("id,host_id,title,status,started_at").single();
    if (error || !data) { toast.error(error?.message ?? "Couldn't start the live."); setPhase("setup"); return; }
    setStream(data as Stream);
    joinChannel(data.id, me);
    setPhase("live");
    // Keep a copy of the broadcast on this phone so it can be posted afterwards.
    try {
      const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
      recChunks.current = [];
      const rec = new MediaRecorder(localRef.current, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 3_000_000 });
      rec.ondataavailable = (e) => { if (e.data.size) recChunks.current.push(e.data); };
      rec.start(1000);
      recRef.current = rec;
    } catch { /* recording isn't supported: the live still works */ }
  };

  const endLive = async () => {
    if (endedRef.current) return; endedRef.current = true;
    if (stream) await (supabase as any).from("live_streams").update({ status: "ended", ended_at: new Date().toISOString(), peak_viewers: peakRef.current }).eq("id", stream.id);
    // Finish the local recording before the camera stops.
    let file: File | null = null;
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      await new Promise<void>((res) => { rec.onstop = () => res(); rec.stop(); });
      const blob = new Blob(recChunks.current, { type: "video/webm" });
      if (blob.size > 50_000) file = new File([blob], `live-${Date.now()}.webm`, { type: "video/webm" });
    }
    cleanup();
    if (file) { setRecording(file); return; }
    toast("Live ended");
    navigate("/", { replace: true });
  };
  // Leaving the page by any route ends a host's live.
  const streamRef = useRef<Stream | null>(null);
  streamRef.current = stream;
  useEffect(() => () => {
    const st = streamRef.current;
    if (isHost && st && !endedRef.current) { endedRef.current = true; void (supabase as any).from("live_streams").update({ status: "ended", ended_at: new Date().toISOString(), peak_viewers: peakRef.current }).eq("id", st.id); }
    cleanup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendComment = async () => {
    const t = text.trim(); if (!t || !sid || !me) return;
    setText("");
    const { error } = await (supabase as any).from("live_comments").insert({ stream_id: sid, user_id: me, content: t });
    if (error) toast.error("Couldn't send");
  };
  const sendHeart = () => { floatHeart(); void chRef.current?.send({ type: "broadcast", event: "heart", payload: {} }); };

  const flip = async () => {
    const old = localRef.current?.getVideoTracks()[0]; if (!old || !localRef.current) return;
    const facing = old.getSettings().facingMode === "environment" ? "user" : "environment";
    old.stop();
    try {
      const t = (await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false })).getVideoTracks()[0];
      t.enabled = cam;
      localRef.current.removeTrack(old); localRef.current.addTrack(t);
      pcs.current.forEach((pc) => pc.getSenders().find((s) => s.track?.kind === "video" || s.track === null)?.replaceTrack(t));
      if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.srcObject = localRef.current; void videoRef.current.play().catch(() => undefined); }
    } catch { toast.error("Couldn't switch camera"); }
  };

  const hostView = isHost;
  const live = phase === "live";

  if (recording && editing) return <MediaEditor files={[recording]} mode="post" onClose={() => navigate("/", { replace: true })} />;
  if (recording) return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-background p-6 text-center text-foreground">
      <p className="text-xl font-bold">Your live has ended</p>
      <p className="max-w-xs text-sm text-muted-foreground">{viewersPeakText(peakRef.current)} Do you want to post it, or delete it?</p>
      <div className="flex w-full max-w-xs flex-col gap-2.5">
        <button onClick={() => setEditing(true)} className="rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground">Post — edit first</button>
        <button onClick={() => { setRecording(null); toast("Live deleted"); navigate("/", { replace: true }); }} className="rounded-2xl bg-secondary py-3.5 text-sm font-semibold text-red-400">Delete</button>
      </div>
    </div>
  );

  if (phase === "ended") return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <p className="text-lg font-semibold text-foreground">This live has ended</p>
      <button onClick={() => navigate("/")} className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">Back to Primegram</button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <video ref={videoRef} autoPlay playsInline muted={hostView} className={`absolute inset-0 h-full w-full object-cover ${hostView && stream ? "" : ""}`} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70" />

      {/* top bar */}
      <div className="relative z-10 flex items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={() => (hostView && live ? void endLive() : navigate(-1))} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur"><ArrowLeft className="h-5 w-5" /></button>
        {live && <span className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold tracking-wide">LIVE</span>}
        {live && <span className="flex items-center gap-1 rounded-md bg-black/40 px-2 py-0.5 text-xs backdrop-blur"><Users className="h-3.5 w-3.5" />{viewers}</span>}
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">{hostView ? (stream?.title ?? "") : `${hostName}${stream?.title ? ` · ${stream.title}` : ""}`}</div>
        {hostView && live && <button onClick={() => void endLive()} className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold">End</button>}
      </div>

      {/* floating hearts */}
      <div className="pointer-events-none absolute bottom-24 right-4 top-1/3 z-10 w-24 overflow-hidden">
        {hearts.map((h) => <Heart key={h.k} className="absolute bottom-0 h-7 w-7 animate-[floatup_2.2s_ease-out_forwards] fill-rose-500 text-rose-500" style={{ left: `${h.x}%` }} />)}
      </div>

      {/* viewer waiting / full states */}
      {!hostView && !hasVideo && <div className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3"><Loader2 className="h-8 w-8 animate-spin" /><p className="text-sm">Joining live…</p></div>}
      {needsTap && <button onClick={() => { void videoRef.current?.play(); setNeedsTap(false); }} className="relative z-10 m-auto rounded-full bg-white px-6 py-3 text-sm font-semibold text-black">Tap to watch</button>}

      {/* host setup */}
      {hostView && !live && (
        <div className="relative z-10 m-auto w-full max-w-sm space-y-3 px-6">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Add a title (optional)" className="w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm outline-none backdrop-blur placeholder:text-white/50" />
          <button onClick={() => void goLive()} disabled={phase === "starting"} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3.5 text-sm font-bold disabled:opacity-60">
            {phase === "starting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-2.5 w-2.5 rounded-full bg-white" />} Go Live
          </button>
          <p className="text-center text-xs text-white/60">Your followers and everyone on Primegram will see you in "Live now". Up to {MAX_VIEWERS} people can watch at once.</p>
        </div>
      )}

      {/* host controls */}
      {hostView && (
        <div className="absolute right-3 top-20 z-10 flex flex-col gap-2">
          <button onClick={() => void flip()} aria-label="Switch camera" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur"><RefreshCw className="h-5 w-5" /></button>
          <button onClick={() => { localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !mic)); setMic(!mic); }} aria-label="Microphone" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur">{mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 text-red-400" />}</button>
          <button onClick={() => { localRef.current?.getVideoTracks().forEach((t) => (t.enabled = !cam)); setCam(!cam); }} aria-label="Camera" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur">{cam ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5 text-red-400" />}</button>
        </div>
      )}

      {/* chat */}
      {live && (
        <div className="relative z-10 mt-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-2 max-h-48 space-y-1 overflow-y-auto pr-16 [mask-image:linear-gradient(to_bottom,transparent,black_25%)]">
            {comments.map((c) => <p key={c.id} className="w-fit max-w-full rounded-2xl bg-black/40 px-3 py-1 text-sm backdrop-blur"><b className="mr-1.5 text-white/80">{c.name ?? "user"}</b>{c.content}</p>)}
            <div ref={chatEnd} />
          </div>
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void sendComment(); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Say something…" className="min-w-0 flex-1 rounded-full border border-white/25 bg-black/40 px-4 py-2.5 text-sm outline-none backdrop-blur placeholder:text-white/50" />
            <button type="submit" aria-label="Send" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur"><Send className="h-5 w-5" /></button>
            <button type="button" onClick={sendHeart} aria-label="Like" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur"><Heart className="h-5 w-5" /></button>
          </form>
        </div>
      )}
      {!hostView && live && <button onClick={() => navigate(-1)} aria-label="Leave" className="absolute right-3 top-3 z-20 hidden"><X /></button>}
    </div>
  );
};
export default LivePage;
