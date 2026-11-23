import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { TURN_SERVERS } from "@/utils/iceConfig";

export type ChatStatus = "idle" | "searching" | "connecting" | "live" | "partner_left";
export type ReportReason = "underage" | "harassment" | "explicit_content" | "spam";
export interface Partner { uid: string; sid: string; country: string; tags: string[]; shared: string[] }
export interface ChatMsg { id: number; me: boolean; text: string }

interface PresenceMeta { sid: string; uid: string; status: "searching" | "connected"; tags: string[]; country: string; since: number }
type Sig = { type: "invite" | "accept" | "decline" | "busy" | "offer" | "answer" | "ice" | "chat" | "bye"; from: string; to: string; sess: string; uid?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; text?: string };

const ROOM = "room:random-video-18plus";
const RTC: RTCConfiguration = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }, ...TURN_SERVERS], iceCandidatePoolSize: 4 };
const ZERO_SCORE_WAIT_MS = 2500;   // give people with matching interests a moment to show up first
const FORCE_INVITE_MS = 4500;      // liveness: even the higher session id invites after this long
const INVITE_TIMEOUT_MS = 3500;
const COOLDOWN_MS = 6000;
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/**
 * Random 1-on-1 video chat. Presence on one shared channel shows who is searching; a deterministic greedy
 * pairing (shared interests first, then anyone) picks the partner; an invite/accept handshake guarantees two
 * people never end up in two calls at once. Offers, answers, ICE and text travel as Broadcast events addressed
 * to the partner's session id. Media itself goes peer-to-peer (RTCPeerConnection).
 */
export function useRandomVideoChat(opts: { userId: string | undefined; tags: string[]; country: string; autoNext: boolean; blocked: Set<string>; onBlock: (uid: string) => void }) {
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [online, setOnline] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const o = useRef(opts); o.current = opts;
  const sid = useRef(uuid());
  const ch = useRef<RealtimeChannel | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const st = useRef<ChatStatus>("idle");
  const peers = useRef<Map<string, PresenceMeta>>(new Map());
  const firstSeen = useRef<Map<string, number>>(new Map());
  const cooldown = useRef<Map<string, number>>(new Map());
  const sess = useRef(""); const partnerRef = useRef<Partner | null>(null);
  const inviting = useRef<{ to: string; sess: string } | null>(null);
  const inviteTimer = useRef<number | undefined>(undefined);
  const searchSince = useRef(Date.now());
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const requeueTimer = useRef<number | undefined>(undefined);
  const disconnectTimer = useRef<number | undefined>(undefined);
  const msgId = useRef(0);
  const evalRef = useRef<() => void>(() => {});

  const setS = (s: ChatStatus) => { st.current = s; setStatus(s); };
  const send = (m: Omit<Sig, "from">) => { void ch.current?.send({ type: "broadcast", event: "sig", payload: { ...m, from: sid.current } }); };
  const track = (status: "searching" | "connected") => {
    void ch.current?.track({ sid: sid.current, uid: o.current.userId, status, tags: o.current.tags, country: o.current.country, since: searchSince.current } satisfies Partial<PresenceMeta>);
  };

  const closePeer = useCallback((notify: boolean) => {
    window.clearTimeout(inviteTimer.current); window.clearInterval(timer.current); window.clearTimeout(disconnectTimer.current);
    if (notify && partnerRef.current) send({ type: "bye", to: partnerRef.current.sid, sess: sess.current });
    if (pc.current) { pc.current.ontrack = null; pc.current.onicecandidate = null; pc.current.onconnectionstatechange = null; try { pc.current.close(); } catch { /* ignore */ } pc.current = null; }
    pendingIce.current = []; inviting.current = null; sess.current = ""; partnerRef.current = null;
    setRemoteStream(null); setPartner(null); setMessages([]); setSeconds(0);
  }, []);

  const makePc = useCallback(() => {
    const p = new RTCPeerConnection(RTC);
    stream.current?.getTracks().forEach(t => p.addTrack(t, stream.current!));
    const mine = sess.current;
    p.onicecandidate = e => { if (e.candidate && partnerRef.current) send({ type: "ice", to: partnerRef.current.sid, sess: mine, candidate: e.candidate.toJSON() }); };
    p.ontrack = e => { setRemoteStream(prev => { const ms = prev ?? new MediaStream(); if (!ms.getTracks().includes(e.track)) ms.addTrack(e.track); return new MediaStream(ms.getTracks()); }); };
    p.onconnectionstatechange = () => {
      if (pc.current !== p) return;
      const s = p.connectionState;
      if (s === "connected") {
        window.clearTimeout(disconnectTimer.current);
        if (st.current !== "live") { setS("live"); window.clearInterval(timer.current); timer.current = window.setInterval(() => setSeconds(x => x + 1), 1000); }
      } else if (s === "disconnected") {
        window.clearTimeout(disconnectTimer.current);
        disconnectTimer.current = window.setTimeout(() => { if (pc.current === p && p.connectionState !== "connected") partnerGone(); }, 4000);
      } else if (s === "failed" || s === "closed") partnerGone();
    };
    pc.current = p;
    return p;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goSearching = useCallback(() => {
    window.clearTimeout(requeueTimer.current);
    closePeer(false);
    searchSince.current = Date.now();
    setS("searching"); track("searching");
    window.setTimeout(() => evalRef.current(), 300);
  }, [closePeer]); // eslint-disable-line react-hooks/exhaustive-deps

  function partnerGone() {
    if (st.current !== "connecting" && st.current !== "live") return;
    closePeer(false); setS("partner_left"); track("searching");
    if (o.current.autoNext) { window.clearTimeout(requeueTimer.current); requeueTimer.current = window.setTimeout(() => { if (st.current === "partner_left") goSearching(); }, 1500); }
  }

  const beginWith = (peer: PresenceMeta, session: string, asOfferer: boolean) => {
    window.clearTimeout(inviteTimer.current); inviting.current = null; sess.current = session;
    const mine = o.current.tags;
    const p: Partner = { uid: peer.uid, sid: peer.sid, country: peer.country, tags: peer.tags ?? [], shared: (peer.tags ?? []).filter(t => mine.includes(t)) };
    partnerRef.current = p; setPartner(p); setMessages([]); setSeconds(0);
    setS("connecting"); track("connected");
    const conn = makePc();
    if (asOfferer) {
      void (async () => {
        try { const offer = await conn.createOffer(); await conn.setLocalDescription(offer); send({ type: "offer", to: peer.sid, sess: session, sdp: conn.localDescription!.toJSON() }); }
        catch { partnerGone(); }
      })();
    }
    // never hang on "Connecting…"
    window.setTimeout(() => { if (pc.current === conn && st.current === "connecting") partnerGone(); }, 20000);
  };

  const onSig = async (m: Sig) => {
    if (m.to !== sid.current || m.from === sid.current) return;
    const peer = peers.current.get(m.from);
    switch (m.type) {
      case "invite": {
        const blocked = m.uid ? o.current.blocked.has(m.uid) : false;
        const crossed = inviting.current?.to === m.from;
        if (blocked) { send({ type: "decline", to: m.from, sess: m.sess }); return; }
        if (crossed) {
          if (sid.current < m.from) return; // I stay the inviter; they will accept mine
          window.clearTimeout(inviteTimer.current); inviting.current = null;
        } else if (st.current !== "searching" || inviting.current) { send({ type: "busy", to: m.from, sess: m.sess }); return; }
        send({ type: "accept", to: m.from, sess: m.sess });
        beginWith(peer ?? { sid: m.from, uid: m.uid ?? "", status: "connected", tags: [], country: "", since: 0 }, m.sess, false);
        return;
      }
      case "accept":
        if (inviting.current?.to === m.from && inviting.current.sess === m.sess && st.current === "searching")
          beginWith(peer ?? { sid: m.from, uid: m.uid ?? "", status: "connected", tags: [], country: "", since: 0 }, m.sess, true);
        return;
      case "decline": case "busy":
        if (inviting.current?.to === m.from) { window.clearTimeout(inviteTimer.current); inviting.current = null; cooldown.current.set(m.from, Date.now() + COOLDOWN_MS); evalRef.current(); }
        return;
    }
    if (m.sess !== sess.current || m.from !== partnerRef.current?.sid) return;
    const p = pc.current;
    if (m.type === "offer" && p && m.sdp) {
      await p.setRemoteDescription(m.sdp);
      for (const c of pendingIce.current) await p.addIceCandidate(c).catch(() => {});
      pendingIce.current = [];
      const ans = await p.createAnswer(); await p.setLocalDescription(ans);
      send({ type: "answer", to: m.from, sess: m.sess, sdp: p.localDescription!.toJSON() });
    } else if (m.type === "answer" && p && m.sdp) {
      await p.setRemoteDescription(m.sdp);
      for (const c of pendingIce.current) await p.addIceCandidate(c).catch(() => {});
      pendingIce.current = [];
    } else if (m.type === "ice" && m.candidate) {
      if (p?.remoteDescription) await p.addIceCandidate(m.candidate).catch(() => {}); else pendingIce.current.push(m.candidate);
    } else if (m.type === "chat" && m.text) {
      setMessages(x => [...x.slice(-80), { id: ++msgId.current, me: false, text: m.text! }]);
    } else if (m.type === "bye") partnerGone();
  };

  /** Deterministic greedy pairing over everyone who is searching: best shared-interest pairs first, then anyone. */
  const evaluate = () => {
    if (st.current !== "searching" || inviting.current) return;
    const now = Date.now();
    const list: PresenceMeta[] = [];
    peers.current.forEach(p => {
      if (p.status !== "searching" || !p.uid) return;
      if (p.sid !== sid.current && (o.current.blocked.has(p.uid) || (cooldown.current.get(p.sid) ?? 0) > now)) return;
      list.push(p);
    });
    if (list.length < 2 || !list.some(p => p.sid === sid.current)) return;
    const age = (p: PresenceMeta) => now - (p.sid === sid.current ? searchSince.current : (firstSeen.current.get(p.sid) ?? now));
    const pairs: { a: PresenceMeta; b: PresenceMeta; score: number; key: string }[] = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const score = (a.tags ?? []).filter(t => (b.tags ?? []).includes(t)).length;
      if (score === 0 && (age(a) < ZERO_SCORE_WAIT_MS || age(b) < ZERO_SCORE_WAIT_MS)) continue;
      pairs.push({ a, b, score, key: [a.sid, b.sid].sort().join("|") });
    }
    pairs.sort((x, y) => y.score - x.score || (x.key < y.key ? -1 : 1));
    const used = new Set<string>();
    let mine: PresenceMeta | null = null;
    for (const p of pairs) {
      if (used.has(p.a.sid) || used.has(p.b.sid)) continue;
      used.add(p.a.sid); used.add(p.b.sid);
      if (p.a.sid === sid.current) mine = p.b; else if (p.b.sid === sid.current) mine = p.a;
    }
    if (!mine) return;
    const iAmLower = sid.current < mine.sid;
    if (!iAmLower && now - searchSince.current < FORCE_INVITE_MS) return; // the other side normally invites
    const session = uuid();
    inviting.current = { to: mine.sid, sess: session };
    send({ type: "invite", to: mine.sid, sess: session, uid: o.current.userId });
    window.clearTimeout(inviteTimer.current);
    inviteTimer.current = window.setTimeout(() => {
      if (inviting.current?.sess === session) { inviting.current = null; cooldown.current.set(mine!.sid, Date.now() + COOLDOWN_MS); evaluate(); }
    }, INVITE_TIMEOUT_MS);
  };
  evalRef.current = evaluate;

  const syncPeers = () => {
    const state = ch.current?.presenceState<PresenceMeta>() ?? {};
    const next = new Map<string, PresenceMeta>();
    Object.values(state).forEach(metas => { const m = metas[metas.length - 1]; if (m?.sid) next.set(m.sid, m); });
    const now = Date.now();
    next.forEach((_, k) => { if (!firstSeen.current.has(k)) firstSeen.current.set(k, now); });
    firstSeen.current.forEach((_, k) => { if (!next.has(k)) firstSeen.current.delete(k); });
    peers.current = next;
    setOnline([...next.values()].filter(p => p.status === "searching").length);
    evaluate();
  };

  const start = useCallback(async () => {
    if (!o.current.userId || st.current !== "idle") return;
    setError(null);
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = ms; setLocalStream(ms); setMicOn(true); setCamOn(true);
    } catch (e) {
      const name = (e as DOMException).name;
      setError(name === "NotAllowedError" || name === "SecurityError"
        ? "Camera and microphone access is blocked. Tap the lock or camera icon in your browser's address bar (or Android Settings → Apps → Primegram → Permissions), allow Camera and Microphone, then tap Start again."
        : name === "NotFoundError" ? "No camera or microphone was found on this device." : "Couldn't start your camera. Close other apps that use it and try again.");
      return;
    }
    const channel = supabase.channel(ROOM, { config: { presence: { key: sid.current }, broadcast: { self: false } } });
    ch.current = channel;
    channel.on("presence", { event: "sync" }, syncPeers)
      .on("broadcast", { event: "sig" }, ({ payload }) => { void onSig(payload as Sig); })
      .subscribe(s => {
        if (s === "SUBSCRIBED") { searchSince.current = Date.now(); setS("searching"); track("searching"); }
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setError("Connection to the matching service dropped. Tap Start to retry.");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    window.clearTimeout(requeueTimer.current);
    closePeer(true);
    if (ch.current) { void ch.current.untrack(); void supabase.removeChannel(ch.current); ch.current = null; }
    peers.current = new Map(); setOnline(0);
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; setLocalStream(null);
    setS("idle");
  }, [closePeer]);

  const next = useCallback(() => {
    if (st.current === "idle") return;
    closePeer(true); goSearching();
  }, [closePeer, goSearching]);

  const sendChat = useCallback((text: string) => {
    const t = text.trim().slice(0, 400);
    if (!t || !partnerRef.current || st.current === "idle") return;
    send({ type: "chat", to: partnerRef.current.sid, sess: sess.current, text: t });
    setMessages(x => [...x.slice(-80), { id: ++msgId.current, me: true, text: t }]);
  }, []);

  const toggleMic = () => { const t = stream.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); } };
  const toggleCam = () => { const t = stream.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); } };

  /** Files the report, blocks the partner for good, hangs up and finds someone new. */
  const report = useCallback(async (reason: ReportReason) => {
    const p = partnerRef.current; const me = o.current.userId;
    if (!p || !me || !p.uid) return false;
    const session = sess.current;
    closePeer(true); goSearching();
    o.current.onBlock(p.uid);
    const [r, b] = await Promise.all([
      supabase.from("video_chat_reports" as never).insert({ reporter_id: me, reported_id: p.uid, reason, session_id: session } as never),
      supabase.from("user_blocks" as never).upsert({ blocker_id: me, blocked_id: p.uid } as never),
    ]);
    return !r.error && !b.error;
  }, [closePeer, goSearching]);

  // leave cleanly on unmount, tab close or app backgrounding away
  useEffect(() => {
    const bye = () => { if (partnerRef.current) send({ type: "bye", to: partnerRef.current.sid, sess: sess.current }); };
    window.addEventListener("pagehide", bye);
    window.addEventListener("beforeunload", bye);
    const tick = window.setInterval(() => evalRef.current(), 1000);
    return () => { window.removeEventListener("pagehide", bye); window.removeEventListener("beforeunload", bye); window.clearInterval(tick); stop(); };
  }, [stop]);
  // interest/country edits while searching are re-published
  useEffect(() => { if (st.current === "searching") track("searching"); }, [opts.tags.join(","), opts.country]); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, localStream, remoteStream, partner, messages, seconds, online, micOn, camOn, error, start, stop, next, sendChat, toggleMic, toggleCam, report };
}
