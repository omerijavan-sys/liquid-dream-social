import { createPortal } from "react-dom";
import { trackEvent } from "@/utils/telemetry";
import ReportDialog from "@/components/ReportDialog";
import { BLANK_POSTER } from "@/lib/blankPoster";
import PostMusicPlayer from "@/components/PostMusicPlayer";
import MusicClipPicker from "@/components/MusicClipPicker";
import MusicPicker, { type PickedTrack } from "@/components/MusicPicker";
import { useMute } from "@/contexts/MuteContext";
import ShareSheet from "@/components/ShareSheet";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, X, Film, Upload, Heart, MessageCircle, Share2, Volume2, VolumeX, Loader2, Download, Flag, Play, Trash2, Repeat2, Bookmark, MoreVertical, ThumbsUp, ThumbsDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import GlassTabBar from "@/components/GlassTabBar";
import CreatorTipButton from "@/components/CreatorTipButton";
import { runInBackground } from "@/utils/backgroundUpload";
import { countReelView } from "@/utils/reelViews";
import FilterStrip from "@/components/FilterStrip";
import { bakeVideoFilter, compressVideo } from "@/utils/bakeVideo";
import { captureVideoThumb } from "@/utils/videoThumb";
import { uploadVideoCover } from "@/utils/videoThumb";
import { suggestCaptions } from "@/utils/aiCaption";
import { readContentPrefs } from "@/components/SettingsExtras";
import { UPLOAD_CACHE } from "@/utils/media";

const REEL_BATCH_SIZE = 20;

const ReelsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creating, setCreating] = useState(() => new URLSearchParams(window.location.search).get("new") === "1");
  const [caption, setCaption] = useState("");
  const [musicTitle, setMusicTitle] = useState("");
  const [reelTrack, setReelTrack] = useState<PickedTrack | null>(null);
  const [reelClip, setReelClip] = useState({ start: 0, len: 30 });
  const [reelPicker, setReelPicker] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [opts, setOpts] = useState(() => { const p = readContentPrefs(); return { allow_comments: p.reelDefaultComments, allow_download: p.reelDefaultDownload, hide_likes: false, visibility: "public" as "public" | "followers" }; });
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [heartBurst, setHeartBurst] = useState<{ id: string; k: number } | null>(null);
  const lastTap = useRef<{ t: number; id: string }>({ t: 0, id: "" });
  const prefs = readContentPrefs();
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [reelFilter, setReelFilter] = useState("none");
  const [reelThumb, setReelThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!videoFile) { setReelThumb(null); return; }
    let dead = false, url: string | null = null;
    void captureVideoThumb(videoFile).then((b) => { if (b && !dead) { url = URL.createObjectURL(b); setReelThumb(url); } });
    return () => { dead = true; if (url) URL.revokeObjectURL(url); };
  }, [videoFile]);
  const [uploading, setUploading] = useState(false);
  const [reels, setReels] = useState<any[]>([]);
  const [loadingReels, setLoadingReels] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [videoBuffering, setVideoBuffering] = useState(false);
  const [videoPaused, setVideoPaused] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const viewedReel = reels[currentIndex]?.id;
  useEffect(() => { if (!viewedReel) return; const t = window.setTimeout(() => countReelView(viewedReel), 1500); return () => window.clearTimeout(t); }, [viewedReel]);

  useEffect(() => {
    if (!viewedReel) return;
    const video = videoRefs.current.get(currentIndex);
    if (!video) return;
    setVideoBuffering(true);
    setVideoError(false);
    void video.play().then(() => { setVideoPaused(false); setVideoBuffering(false); }).catch(() => { setVideoPaused(true); setVideoBuffering(false); });
    return () => video.pause();
  }, [currentIndex, viewedReel]);
  // Start muted so browsers allow scroll-triggered autoplay. Users can enable
  // sound with the volume button after playback has started.
  const { muted, toggleMuted } = useMute();
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const pageRef = useRef(0);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const reelIdKey = reels.map(reel => reel.id).join(",");
  const deepLinkDone = useRef(false);

  // Deep link: /reels?r=<id> scrolls to the shared reel once loaded.
  useEffect(() => {
    if (deepLinkDone.current || reels.length === 0) return;
    const target = new URLSearchParams(window.location.search).get("r");
    if (!target) { deepLinkDone.current = true; return; }
    const idx = reels.findIndex(r => r.id === target);
    if (idx >= 0) {
      deepLinkDone.current = true;
      requestAnimationFrame(() => {
        const el = containerRef.current?.children[idx] as HTMLElement | undefined;
        el?.scrollIntoView({ block: "start" });
      });
    } else if (hasMoreRef.current && !loadingRef.current) {
      void fetchReels(false);
    }
  }, [reels]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchReels = useCallback(async (reset = false) => {
    if (loadingRef.current || (!reset && !hasMoreRef.current)) return;
    loadingRef.current = true;
    setLoadingReels(reset);
    setLoadingMore(!reset);
    if (reset) {
      pageRef.current = 0;
      hasMoreRef.current = true;
      setHasMore(true);
    }
    const page = reset ? 0 : pageRef.current;
    try {
      const { data, error } = await supabase.from("reels").select("*")
        .order("created_at", { ascending: false })
        .range(page * REEL_BATCH_SIZE, page * REEL_BATCH_SIZE + REEL_BATCH_SIZE - 1);
      if (error) throw error;
      const batch = data ?? [];
      const userIds = [...new Set(batch.map(reel => reel.user_id))];
      const { data: profiles, error: profileError } = userIds.length
        ? await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds)
        : { data: [], error: null };
      if (profileError) throw profileError;
      const profileMap = new Map((profiles ?? []).map(profile => [profile.user_id, profile] as const));
      const mapped = batch.map(reel => ({ ...reel, profile: profileMap.get(reel.user_id) ?? null }));
      setReels(current => reset ? mapped : [...current, ...mapped]);
      pageRef.current = page + 1;
      hasMoreRef.current = batch.length === REEL_BATCH_SIZE;
      setHasMore(hasMoreRef.current);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load reels");
    } finally {
      loadingRef.current = false;
      setLoadingReels(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { void fetchReels(true); }, [fetchReels]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || reels.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const index = Number(entry.target.getAttribute("data-index"));
        if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
          setCurrentIndex(index);
          if (hasMoreRef.current && index >= reels.length - 5) void fetchReels();
        } else {
          videoRefs.current.get(index)?.pause();
          setCurrentIndex(current => current === index ? -1 : current);
        }
      });
    }, { root: container, threshold: 0.7 });
    container.querySelectorAll("[data-index]").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [fetchReels, hasMore, reels]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    } else {
      toast.error("Please select a video file");
    }
  };

  const handleCreateReel = () => {
    if (!user || !videoFile) { toast.error("Select a video"); return; }
    const snap = { file: videoFile, filter: reelFilter, caption, musicTitle: reelTrack?.title ?? musicTitle, track: reelTrack, clip: reelClip, opts, uid: user.id };
    setCreating(false); setCaption(""); setMusicTitle(""); setReelTrack(null); setReelClip({ start: 0, len: 30 }); setVideoFile(null); setVideoPreview(null); setSuggestions([]); setReelFilter("none");
    runInBackground("Uploading your reel", async (progress) => {
      if (snap.filter !== "none") { progress("Applying filter…"); snap.file = await bakeVideoFilter(snap.file, snap.filter, (p) => progress(`Applying filter… ${p}%`)); }
      progress("Optimizing video…"); snap.file = await compressVideo(snap.file, (p) => progress(`Optimizing video… ${p}%`));
      progress("Preparing cover…");
      const thumbnail_url = await uploadVideoCover(snap.uid, snap.file);
      progress("Uploading reel…");
      const ext = snap.file.name.split(".").pop();
      const path = `${snap.uid}/reel_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("media").upload(path, snap.file, { cacheControl: UPLOAD_CACHE });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      const { error } = await supabase.from("reels").insert({ user_id: snap.uid, caption: snap.caption || null, music_title: snap.musicTitle || null, music_artist: snap.track?.artist ?? null, music_art_url: snap.track?.artUrl ?? null, music_url: snap.track?.streamUrl ?? null, ...(snap.track ? { music_start: snap.clip.start, music_len: snap.clip.len } : {}), video_url: publicUrl, thumbnail_url, ...snap.opts } as any);
      if (error) throw error;
    }, () => { void fetchReels(true); });
    toast.info("Uploading in the background — keep browsing");
  };

  const downloadReel = async (reel: any) => {
    if (!reel.allow_download && reel.user_id !== user?.id) { toast.error("The creator turned off downloads"); return; }
    const t = toast.loading("Downloading reel…");
    try {
      const blob = await (await fetch(reel.video_url)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `primegram-reel-${reel.id.slice(0, 8)}.mp4`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast.success("Saved to your downloads", { id: t });
    } catch { toast.error("Couldn't download this reel", { id: t }); }
  };

  const [reportReelId, setReportReelId] = useState<string | undefined>();
  const reportReel = (reel: any) => { if (user) setReportReelId(reel.id); };
  const deleteReel = async (reel: any) => {
    if (!user || reel.user_id !== user.id) return;
    if (!window.confirm("Delete this reel? This can't be undone.")) return;
    const { error } = await supabase.from("reels").delete().eq("id", reel.id).eq("user_id", user.id);
    if (error) { toast.error("Couldn't delete the reel"); return; }
    setReels(prev => prev.filter(r => r.id !== reel.id));
    toast.success("Reel deleted");
  };

  // Shake the phone to report the reel on screen.
  useEffect(() => {
    if (!prefs.shakeToReport) return;
    let last = 0, lastReport = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity; if (!a) return;
      const force = Math.abs(a.x ?? 0) + Math.abs(a.y ?? 0) + Math.abs(a.z ?? 0);
      const now = Date.now();
      if (force > 38 && now - last > 400) {
        last = now;
        const reel = reels[currentIndex];
        if (reel && reel.user_id !== user?.id && now - lastReport > 8000) { lastReport = Date.now(); reportReel(reel); }
        else lastReport = Date.now();
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [reels, currentIndex, prefs.shakeToReport, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    if (!user || !reelIdKey) return;
    const reelIds = reelIdKey.split(",");
    supabase.from("reel_likes").select("reel_id").eq("user_id", user.id).in("reel_id", reelIds)
      .then(({ data }) => setLiked(new Set((data || []).map(d => d.reel_id))));
    supabase.from("reel_comments").select("reel_id").in("reel_id", reelIds).then(({ data }) => {
      const c: Record<string, number> = {};
      (data || []).forEach(d => { c[d.reel_id] = (c[d.reel_id] || 0) + 1; });
      setCommentCounts(c);
    });
    const q = (name: string) => (supabase.from as unknown as (t: string) => any)(name); // eslint-disable-line @typescript-eslint/no-explicit-any
    void q("reel_saves").select("reel_id").eq("user_id", user.id).in("reel_id", reelIds).then(({ data }: { data: { reel_id: string }[] | null }) => setSaved(new Set((data || []).map(d => d.reel_id))));
    void q("reel_reposts").select("reel_id, user_id").in("reel_id", reelIds).then(({ data }: { data: { reel_id: string; user_id: string }[] | null }) => {
      const c: Record<string, number> = {}; const mine = new Set<string>();
      (data || []).forEach(d => { c[d.reel_id] = (c[d.reel_id] || 0) + 1; if (d.user_id === user.id) mine.add(d.reel_id); });
      setRepostCounts(c); setReposted(mine);
    });
  }, [user, reelIdKey]);

  const toggleLike = async (id: string) => {
    if (!user) { toast.error("Sign in to like"); return; }
    const isLiked = liked.has(id);
    setLiked(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(id);
      else next.add(id);
      return next;
    });
    setReels(prev => prev.map(r => r.id === id ? { ...r, likes_count: Math.max(0, r.likes_count + (isLiked ? -1 : 1)) } : r));
    const { error } = isLiked
      ? await supabase.from("reel_likes").delete().eq("reel_id", id).eq("user_id", user.id)
      : await supabase.from("reel_likes").insert({ reel_id: id, user_id: user.id });
    if (error) toast.error("Couldn't update like");
  };

  const loadComments = async (id: string) => {
    setOpenComments(id);
    const { data } = await supabase.from("reel_comments").select("*").eq("reel_id", id).order("created_at", { ascending: true });
    const uids = [...new Set((data || []).map(c => c.user_id))];
    const { data: profs } = uids.length ? await supabase.from("profiles").select("user_id, username, display_name").in("user_id", uids) : { data: [] as any[] };
    const pm = new Map((profs || []).map(p => [p.user_id, p]));
    setComments((data || []).map(c => ({ ...c, profile: pm.get(c.user_id) })));
  };

  const postComment = async () => {
    if (!user || !openComments || !newComment.trim()) return;
    const { error } = await supabase.from("reel_comments").insert({ reel_id: openComments, user_id: user.id, content: newComment.trim() });
    if (error) { toast.error("Couldn't post comment"); return; }
    setNewComment("");
    setCommentCounts(c => ({ ...c, [openComments]: (c[openComments] || 0) + 1 }));
    loadComments(openComments);
  };

  const toggleReelPlayback = (index: number) => {
    const video = videoRefs.current.get(index);
    if (!video) return;
    if (video.paused) {
      setVideoBuffering(true);
      setVideoError(false);
      void video.play().then(() => { setVideoPaused(false); setVideoBuffering(false); }).catch(() => { setVideoPaused(true); setVideoBuffering(false); });
    } else {
      video.pause();
      setVideoPaused(true);
    }
  };


  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [reposted, setReposted] = useState<Set<string>>(new Set());
  const [repostCounts, setRepostCounts] = useState<Record<string, number>>({});
  const [menuReel, setMenuReel] = useState<any | null>(null);
  const tbl = (name: string) => (supabase.from as unknown as (t: string) => any)(name); // eslint-disable-line @typescript-eslint/no-explicit-any
  const toggleSave = async (id: string) => {
    if (!user) { toast.error("Sign in to save"); return; }
    const on = saved.has(id);
    setSaved(prev => { const n = new Set(prev); if (on) n.delete(id); else n.add(id); return n; });
    const { error } = on ? await tbl("reel_saves").delete().eq("reel_id", id).eq("user_id", user.id) : await tbl("reel_saves").insert({ reel_id: id, user_id: user.id });
    if (error) { toast.error("Couldn't update saved"); return; }
    toast.success(on ? "Removed from saved" : "Saved. Find it in your profile's saved tab");
  };
  const toggleRepost = async (reel: any) => {
    if (!user) { toast.error("Sign in to repost"); return; }
    if (reel.user_id === user.id) { toast.info("That's your own reel"); return; }
    const on = reposted.has(reel.id);
    setReposted(prev => { const n = new Set(prev); if (on) n.delete(reel.id); else n.add(reel.id); return n; });
    setRepostCounts(c => ({ ...c, [reel.id]: Math.max(0, (c[reel.id] || 0) + (on ? -1 : 1)) }));
    const { error } = on ? await tbl("reel_reposts").delete().eq("reel_id", reel.id).eq("user_id", user.id) : await tbl("reel_reposts").insert({ reel_id: reel.id, user_id: user.id });
    if (error) { toast.error("Couldn't repost"); return; }
    toast.success(on ? "Repost removed" : "Reposted to your profile");
  };
  const reelFeedback = (reel: any, kind: "interested" | "not_interested") => {
    try {
      const k = "primegram:reelFeedback"; const cur = JSON.parse(localStorage.getItem(k) || "{}");
      cur[reel.id] = kind; localStorage.setItem(k, JSON.stringify(cur));
    } catch { /* storage unavailable */ }
    trackEvent(`reel_${kind}`);
    setMenuReel(null);
    if (kind === "not_interested") { setReels(prev => prev.filter(r => r.id !== reel.id)); toast.success("Got it. You'll see fewer reels like this"); }
    else toast.success("Great, we'll show you more like this");
  };

  const [shareReelTarget, setShareReelTarget] = useState<any | null>(null);
  const shareReel = (reel: any) => { setShareReelTarget(reel); };
  return (
    <div className="min-h-screen overflow-hidden bg-[#080b14] text-white [background-image:radial-gradient(ellipse_at_24%_16%,rgba(168,85,247,.2),transparent_35%),radial-gradient(ellipse_at_88%_22%,rgba(34,211,238,.18),transparent_33%),radial-gradient(ellipse_at_73%_88%,rgba(212,175,55,.16),transparent_36%)]">
      <ReportDialog open={!!reportReelId} onClose={() => setReportReelId(undefined)} targetType="reel" targetId={reportReelId} />

      {menuReel && createPortal(
        <div className="fixed inset-0 z-[95] flex items-end bg-black/60" onClick={() => setMenuReel(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full rounded-t-3xl border-t border-white/10 bg-[#11131c]/95 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-white backdrop-blur-xl">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" />
            {([
              ...(menuReel.user_id !== user?.id ? [
                { k: "int", icon: ThumbsUp, label: "Interested", run: () => reelFeedback(menuReel, "interested") },
                { k: "not", icon: ThumbsDown, label: "Not interested", run: () => reelFeedback(menuReel, "not_interested") },
              ] : []),
              ...((menuReel.allow_download !== false || menuReel.user_id === user?.id) ? [{ k: "dl", icon: Download, label: "Download", run: () => { setMenuReel(null); void downloadReel(menuReel); } }] : []),
              ...(menuReel.user_id === user?.id
                ? [{ k: "del", icon: Trash2, label: "Delete reel", danger: true, run: () => { const r = menuReel; setMenuReel(null); void deleteReel(r); } }]
                : [{ k: "rep", icon: Flag, label: "Report", danger: true, run: () => { const r = menuReel; setMenuReel(null); reportReel(r); } }]),
            ] as { k: string; icon: typeof Flag; label: string; danger?: boolean; run: () => void }[]).map(o => (
              <button key={o.k} onClick={o.run} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-semibold active:bg-white/10 ${o.danger ? "text-red-300" : ""}`}><o.icon className="h-5 w-5" />{o.label}</button>
            ))}
            <button onClick={() => setMenuReel(null)} className="mt-1 w-full rounded-xl bg-white/10 py-3 text-sm font-semibold">Cancel</button>
          </div>
        </div>, document.body)}
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 safe-area-top">
        <div className="flex items-center justify-between px-5 py-4">
          <button onClick={() => navigate("/")} className="depth-press w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="font-serif text-lg font-bold text-amber-100">Reels</span>
          <button onClick={() => setCreating(true)} aria-label="Create reel" className="depth-press flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {reels.length === 0 && loadingReels ? (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      ) : reels.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
          <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center mb-4">
            <Film className="w-10 h-10 text-white/50" />
          </div>
          <p className="text-white font-semibold mb-1">No reels yet</p>
          <p className="text-sm text-white/50 mb-6">Create the first reel!</p>
          <button onClick={() => setCreating(true)} className="depth-press px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm">Create Reel</button>
        </div>
      ) : (
        <div ref={containerRef} className="relative h-[100dvh] snap-y snap-mandatory overflow-y-auto scrollbar-none">
          {reels.map((reel, i) => (
            <section
              key={reel.id}
              data-index={i}
              aria-label={`Reel ${i + 1}`}
              className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden bg-black"
            >
              <div
                className="absolute inset-0"
                onClick={() => {
                  const now = Date.now();
                  if (prefs.doubleTapLike && lastTap.current.id === reel.id && now - lastTap.current.t < 320) {
                    lastTap.current = { t: 0, id: "" };
                    if (!liked.has(reel.id)) void toggleLike(reel.id);
                    setHeartBurst({ id: reel.id, k: now });
                    setTimeout(() => setHeartBurst(h => (h && h.k === now ? null : h)), 800);
                    return;
                  }
                  lastTap.current = { t: now, id: reel.id };
                  toggleReelPlayback(i);
                }}
              >
                {reel.video_url && (
                  <video
                    ref={el => { if (el) { videoRefs.current.set(i, el); el.volume = Math.max(0, Math.min(1, (reel as { video_volume?: number }).video_volume ?? 1)); } else videoRefs.current.delete(i); }}
                    src={currentIndex >= 0 && (i === currentIndex || i === currentIndex + 1) ? reel.video_url : undefined}
                    className="h-full w-full bg-black object-cover"
                    loop
                    playsInline
                    muted={muted}
                    poster={reel.thumbnail_url || BLANK_POSTER}
                    preload={i === currentIndex ? "auto" : i === currentIndex + 1 ? "metadata" : "none"}
                    aria-label={`Video by ${reel.profile?.display_name || "user"}; press Enter or Space to play or pause`}
                    tabIndex={0}
                    onKeyDown={event => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      event.stopPropagation();
                      toggleReelPlayback(i);
                    }}
                    onWaiting={() => { if (i === currentIndex) setVideoBuffering(true); }}
                    onCanPlay={() => { if (i === currentIndex) { setVideoBuffering(false); setVideoError(false); } }}
                    onPlaying={() => { if (i === currentIndex) { setVideoBuffering(false); setVideoPaused(false); setVideoError(false); } }}
                    onPause={() => { if (i === currentIndex) setVideoPaused(true); }}
                    onError={() => { if (i === currentIndex) { setVideoBuffering(false); setVideoError(true); } }}
                  />
                )}
                {heartBurst?.id === reel.id && (
                  <motion.div key={heartBurst.k} initial={{ scale: 0.3, opacity: 1 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 0.8 }} className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <Heart className="h-24 w-24 fill-rose-500 text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,.8)]" />
                  </motion.div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                {i === currentIndex && videoBuffering && (
                  <div role="status" aria-label="Buffering video" className="absolute inset-0 z-10 flex items-center justify-center text-white">
                    <Loader2 className="size-8 animate-spin" />
                  </div>
                )}
                {i === currentIndex && videoError && (
                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation();
                      const video = videoRefs.current.get(i);
                      if (!video) return;
                      setVideoError(false);
                      setVideoBuffering(true);
                      video.load();
                      void video.play().catch(() => { setVideoBuffering(false); setVideoError(true); });
                    }}
                    className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 text-sm font-semibold text-white"
                  >
                    Tap to retry video
                  </button>
                )}
                {i === currentIndex && videoPaused && !videoBuffering && !videoError && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 text-white">
                    <button type="button" aria-label="Play video" onClick={event => { event.stopPropagation(); toggleReelPlayback(i); }} className="pointer-events-auto flex size-16 items-center justify-center rounded-full bg-black/50 backdrop-blur-md">
                      <Play className="ml-1 size-7 fill-current" />
                    </button>
                    <button type="button" onClick={event => { event.stopPropagation(); toggleMuted(); }} aria-label={muted ? "Unmute videos" : "Mute videos"} className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm font-semibold backdrop-blur-md">
                      {muted ? <><VolumeX className="size-5" />Unmute</> : <><Volume2 className="size-5" />Mute</>}
                    </button>
                  </div>
                )}
              </div>

              {/* Creator + caption, bottom-left */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-20 pt-24">
                <div className="pointer-events-auto flex items-center gap-2">
                  <button
                    onClick={event => { event.stopPropagation(); if (reel.profile?.user_id) navigate(`/profile/${reel.profile.user_id}`); }}
                    aria-label={`Open ${reel.profile?.display_name || "user"}'s profile`}
                    className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-black/50 text-sm font-bold text-white"
                  >
                    {reel.profile?.avatar_url ? <img src={reel.profile.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : (reel.profile?.display_name || "U")[0]}
                  </button>
                  <div className="min-w-0">
                    <button onClick={event => { event.stopPropagation(); if (reel.profile?.user_id) navigate(`/profile/${reel.profile.user_id}`); }} className="text-sm font-semibold text-white">
                      {reel.profile?.display_name || "User"} <span className="text-amber-300">●</span>
                    </button>
                    {reel.caption && <p className="line-clamp-2 text-xs text-white/85">{reel.caption}</p>}
                  </div>
                </div>
                {reel.music_title && <div className="pointer-events-auto mt-2 truncate text-xs text-white/80"><PostMusicPlayer music={{ title: reel.music_title, artist: reel.music_artist, art_url: reel.music_art_url, stream_url: reel.music_url, start: reel.music_start, len: reel.music_len, volume: (reel as { music_volume?: number }).music_volume }} /></div>}
              </div>

              {/* Action rail, right */}
              <div className="absolute bottom-[max(6rem,calc(env(safe-area-inset-bottom)+4.5rem))] right-2.5 z-20 flex flex-col items-center gap-3.5">
                {reel.user_id === user?.id && (
                  <button onClick={(e) => { e.stopPropagation(); navigate("/profile?tab=reels"); }} className="rounded-lg border border-white/20 bg-black/55 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md">Insights</button>
                )}
                <button onClick={(e) => { e.stopPropagation(); toggleLike(reel.id); }} className="depth-press flex flex-col items-center gap-0.5" aria-label="Like">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"><Heart className={`h-6 w-6 ${liked.has(reel.id) ? "fill-rose-400 text-rose-400" : "text-white"}`} /></div>
                  <span className="text-[11px] font-medium text-white">{reel.hide_likes && reel.user_id !== user?.id ? "" : (reel.likes_count ?? 0)}</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); if (reel.allow_comments === false) { toast.info("Comments are turned off for this reel"); return; } loadComments(reel.id); }} className={`depth-press flex flex-col items-center gap-0.5 ${reel.allow_comments === false ? "opacity-50" : ""}`} aria-label="Comments">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"><MessageCircle className="h-6 w-6 text-white" /></div>
                  <span className="text-[11px] font-medium text-white">{commentCounts[reel.id] || 0}</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); void toggleRepost(reel); }} className="depth-press flex flex-col items-center gap-0.5" aria-label={reposted.has(reel.id) ? "Remove repost" : "Repost"}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"><Repeat2 className={`h-6 w-6 ${reposted.has(reel.id) ? "text-emerald-400" : "text-white"}`} /></div>
                  <span className="text-[11px] font-medium text-white">{repostCounts[reel.id] || 0}</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); void toggleSave(reel.id); }} className="depth-press flex flex-col items-center gap-0.5" aria-label={saved.has(reel.id) ? "Unsave" : "Save"}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"><Bookmark className={`h-6 w-6 ${saved.has(reel.id) ? "fill-amber-300 text-amber-300" : "text-white"}`} /></div>
                </button>
                <button onClick={(e) => { e.stopPropagation(); shareReel(reel); }} className="depth-press flex flex-col items-center gap-0.5" aria-label="Share">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"><Share2 className="h-6 w-6 text-white" /></div>
                </button>
                <CreatorTipButton creatorId={reel.user_id} creatorName={reel.profile?.display_name || "creator"} compact />
                <button onClick={(e) => { e.stopPropagation(); setMenuReel(reel); }} className="depth-press flex flex-col items-center gap-0.5" aria-label="More options">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"><MoreVertical className="h-6 w-6 text-white" /></div>
                </button>
              </div>
            </section>
          ))}
          {loadingMore && (
            <div className="pointer-events-none absolute bottom-20 left-0 right-0 z-20 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      <AnimatePresence>
        {creating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-background flex flex-col">
            <div className="liquid-glass-elevated safe-area-top">
              <div className="flex items-center gap-3 px-5 py-4 relative z-10">
                <button onClick={() => { setCreating(false); setVideoFile(null); setVideoPreview(null); }} className="depth-press"><X className="w-5 h-5 text-foreground" /></button>
                <span className="text-headline text-foreground text-base flex-1">New Reel</span>
                <button onClick={handleCreateReel} disabled={uploading || !videoFile} className="depth-press px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
                  Post
                </button>
              </div>
            </div>
            <div className="flex-1 p-5 space-y-4 overflow-y-auto">
              <div className="liquid-glass rounded-2xl p-6 relative z-10">
                <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
                {videoPreview ? (
                  <div className="relative">
                    <video src={videoPreview} style={{ filter: reelFilter }} className="w-full rounded-xl max-h-[65vh] bg-black object-contain" controls playsInline />
                    <div className="mt-3"><FilterStrip value={reelFilter} onChange={setReelFilter} thumb={reelThumb} /></div>
                    <button onClick={() => { setVideoFile(null); setVideoPreview(null); }} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center"><X className="w-4 h-4 text-foreground" /></button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} className="depth-press w-full py-16 rounded-xl border-2 border-dashed border-border flex flex-col items-center gap-3">
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Tap to upload video</span>
                  </button>
                )}
              </div>
              <div className="liquid-glass rounded-2xl p-4 relative z-10">
                <label className="text-caption text-muted-foreground block mb-2">Caption</label>
                <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Write a caption..." className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none h-20" />
              </div>
              {prefs.aiCaptions && (
                <div className="liquid-glass rounded-2xl p-4 relative z-10">
                  <button type="button" disabled={suggesting} onClick={async () => { setSuggesting(true); const r = await suggestCaptions({ mediaType: "video", music: musicTitle, hint: caption }); setSuggestions(r.captions); if (!r.ai) toast.info("Showing built-in ideas — the AI service isn't connected yet"); setSuggesting(false); }} className="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-60">{suggesting ? "Thinking…" : "✨ Suggest caption"}</button>
                  <div className="mt-2 flex flex-col gap-1.5">{suggestions.map(c => <button key={c} type="button" onClick={() => { setCaption(c); setSuggestions([]); }} className="rounded-xl bg-secondary/50 px-3 py-2 text-left text-xs text-foreground">{c}</button>)}</div>
                </div>
              )}
              <div className="liquid-glass rounded-2xl p-4 relative z-10 space-y-3">
                <p className="text-caption text-muted-foreground">Reel settings</p>
                {([["allow_comments", "Allow comments"], ["allow_download", "Allow downloads"], ["hide_likes", "Hide like count"]] as const).map(([k, label]) => (
                  <label key={k} className="flex items-center justify-between text-sm text-foreground">{label}<input type="checkbox" checked={Boolean(opts[k])} onChange={e => setOpts(o => ({ ...o, [k]: e.target.checked }))} className="h-5 w-5 accent-[hsl(var(--primary))]" /></label>
                ))}
                <label className="flex items-center justify-between text-sm text-foreground">Who can watch
                  <select value={opts.visibility} onChange={e => setOpts(o => ({ ...o, visibility: e.target.value as "public" | "followers" }))} className="rounded-lg bg-secondary/60 px-2 py-1 text-sm"><option value="public">Everyone</option><option value="followers">Followers</option></select>
                </label>
              </div>
              <div className="liquid-glass rounded-2xl p-4 relative z-10">
                <label className="text-caption text-muted-foreground block mb-2">Music (optional)</label>
                <button type="button" onClick={() => setReelPicker(true)} className="w-full text-left text-sm text-foreground">{reelTrack ? `♪ ${reelTrack.title} — ${reelTrack.artist}` : "Tap to choose a song…"}</button>
                {reelTrack && <MusicClipPicker track={reelTrack} start={reelClip.start} len={reelClip.len} onChange={(start, len) => setReelClip({ start, len })} />}
                <MusicPicker open={reelPicker} onClose={() => setReelPicker(false)} onPick={(t) => { setReelTrack(t); setMusicTitle(t.title); }} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {openComments && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-x-0 bottom-0 z-[60] max-h-[70vh] rounded-t-3xl liquid-glass bg-background/95 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border relative z-10">
              <span className="font-semibold text-foreground">Comments</span>
              <button onClick={() => setOpenComments(null)} aria-label="Close comments"><X className="w-5 h-5 text-foreground" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 relative z-10">
              {comments.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No comments yet. Be the first!</p>}
              {comments.map(c => (
                <div key={c.id} className="text-sm">
                  <button
                    onClick={() => c.profile?.user_id && navigate(`/profile/${c.profile.user_id}`)}
                    disabled={!c.profile?.user_id}
                    className="font-semibold text-foreground mr-2 disabled:cursor-default"
                  >
                    {c.profile?.username || c.profile?.display_name || "user"}
                  </button>
                  <span className="text-foreground/90">{c.content}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 p-4 border-t border-border relative z-10">
              <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === "Enter" && postComment()} placeholder="Add a comment..." className="flex-1 bg-muted rounded-full px-4 py-2 text-sm text-foreground outline-none" />
              <button onClick={postComment} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold">Post</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <GlassTabBar />
      {shareReelTarget && (
        <ShareSheet
          open
          onOpenChange={o => { if (!o) setShareReelTarget(null); }}
          target={{ kind: "reel", id: shareReelTarget.id, mediaUrl: shareReelTarget.video_url, mediaType: "video", caption: shareReelTarget.caption, username: shareReelTarget.profile?.username, link: `${window.location.origin}/reels?r=${shareReelTarget.id}` }}
        />
      )}
    </div>
  );
};

export default ReelsPage;
