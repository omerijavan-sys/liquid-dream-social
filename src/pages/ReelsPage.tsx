import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, X, Film, Upload, Heart, MessageCircle, Share2, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import GlassTabBar from "@/components/GlassTabBar";
import CreatorTipButton from "@/components/CreatorTipButton";

const REEL_BATCH_SIZE = 20;

const ReelsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [caption, setCaption] = useState("");
  const [musicTitle, setMusicTitle] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reels, setReels] = useState<any[]>([]);
  const [loadingReels, setLoadingReels] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const pageRef = useRef(0);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const reelIds = reels.map(reel => reel.id);

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
      const profileMap = new Map(profiles?.map(profile => [profile.user_id, profile]) || []);
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
    if (!container || reels.length === 0 || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const index = Number(entry.target.getAttribute("data-index"));
        if (entry.isIntersecting) {
          setCurrentIndex(index);
          videoRefs.current.get(index)?.play().catch(() => {});
          if (index >= reels.length - 5) void fetchReels();
        } else {
          videoRefs.current.get(index)?.pause();
        }
      });
    }, { root: container, threshold: 0.7, rootMargin: "0px 0px 500px 0px" });
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

  const handleCreateReel = async () => {
    if (!user || !videoFile) { toast.error("Select a video"); return; }
    setUploading(true);
    try {
      const ext = videoFile.name.split(".").pop();
      const path = `${user.id}/reel_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("media").upload(path, videoFile);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      const { error } = await supabase.from("reels").insert({ user_id: user.id, caption: caption || null, music_title: musicTitle || null, video_url: publicUrl });
      if (error) throw error;
      toast.success("Reel posted!");
      setCreating(false); setCaption(""); setMusicTitle(""); setVideoFile(null); setVideoPreview(null);
      await fetchReels(true);
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally { setUploading(false); }
  };

  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    if (!user || reelIds.length === 0) return;
    supabase.from("reel_likes").select("reel_id").eq("user_id", user.id).in("reel_id", reelIds)
      .then(({ data }) => setLiked(new Set((data || []).map(d => d.reel_id))));
    supabase.from("reel_comments").select("reel_id").in("reel_id", reelIds).then(({ data }) => {
      const c: Record<string, number> = {};
      (data || []).forEach(d => { c[d.reel_id] = (c[d.reel_id] || 0) + 1; });
      setCommentCounts(c);
    });
  }, [user, reelIds.join(",")]);

  const toggleLike = async (id: string) => {
    if (!user) { toast.error("Sign in to like"); return; }
    const isLiked = liked.has(id);
    setLiked(prev => { const n = new Set(prev); isLiked ? n.delete(id) : n.add(id); return n; });
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

  const shareReel = async (reel: any) => {
    const url = `${window.location.origin}/reels?r=${reel.id}`;
    try {
      if (navigator.share) await navigator.share({ title: "Primegram Reel", text: reel.caption || "Watch this reel", url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* cancelled */ }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#080b14] text-white [background-image:radial-gradient(ellipse_at_24%_16%,rgba(168,85,247,.2),transparent_35%),radial-gradient(ellipse_at_88%_22%,rgba(34,211,238,.18),transparent_33%),radial-gradient(ellipse_at_73%_88%,rgba(212,175,55,.16),transparent_36%)]">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 safe-area-top">
        <div className="flex items-center justify-between px-5 py-4">
          <button onClick={() => navigate("/")} className="depth-press w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <span className="font-serif text-lg font-bold text-amber-100">Reels</span>
          <button onClick={() => setCreating(true)} aria-label="Create reel" className="depth-press flex h-9 w-9 items-center justify-center rounded-full border border-amber-100/70 bg-gradient-to-br from-amber-100 to-amber-500 text-black shadow-[0_0_18px_rgba(252,211,77,.38)]">
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
        <div ref={containerRef} className="relative h-[100dvh] overflow-y-scroll snap-y snap-mandatory scrollbar-none pb-24 pt-14">
          {reels.map((reel, i) => (
            <div
              key={reel.id}
              data-index={i}
              className="relative mx-auto flex h-[calc(100dvh_-_3.5rem)] w-[calc(100%_-_1rem)] max-w-[1540px] snap-start snap-always flex-col pt-1 md:w-[calc(100%_-_0.5rem)]"
            >
              <div
                className="relative h-[min(74vh,720px)] w-full overflow-hidden rounded-[2rem] border border-white/10 bg-[#100c08] shadow-[0_18px_70px_rgba(0,0,0,.42)] md:ml-9 md:w-[calc(100%_-_6rem)] md:rounded-[2.6rem]"
                onClick={() => {
                  const video = videoRefs.current.get(i);
                  if (!video) return;
                  if (video.paused) video.play().catch(() => {});
                  else video.pause();
                }}
              >
                {reel.video_url && (
                  <video
                    ref={el => { if (el) videoRefs.current.set(i, el); }}
                    src={reel.video_url}
                    className="h-full w-full object-cover"
                    loop
                    playsInline
                    muted={muted}
                    preload={Math.abs(i - currentIndex) <= 1 ? "auto" : "none"}
                  />
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15" />
                {reel.user_id === user?.id && (
                  <button
                    onClick={event => { event.stopPropagation(); navigate("/profile?tab=reels"); }}
                    className="absolute bottom-3 right-3 z-10 rounded-xl border border-amber-100/70 bg-black/55 px-3 py-1.5 text-xs font-semibold text-amber-100 backdrop-blur-md"
                  >
                    View Insights
                  </button>
                )}
              </div>

              <div className="absolute right-1 top-[60%] z-10 flex -translate-y-1/4 flex-col items-center gap-2 md:right-0 md:top-[60%] md:gap-3">
                <button onClick={(e) => { e.stopPropagation(); toggleLike(reel.id); }} className="depth-press flex flex-col items-center gap-1" aria-label="Like">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/55 shadow-[0_4px_18px_rgba(0,0,0,.35)] backdrop-blur-xl md:h-11 md:w-11">
                    <Heart className={`h-5 w-5 ${liked.has(reel.id) ? "fill-rose-400 text-rose-400" : "text-amber-100"}`} />
                  </div>
                  <span className="text-[11px] text-amber-100">{reel.likes_count ?? 0}</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); loadComments(reel.id); }} className="depth-press flex flex-col items-center gap-1" aria-label="Comments">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/55 shadow-[0_4px_18px_rgba(0,0,0,.35)] backdrop-blur-xl md:h-11 md:w-11">
                    <MessageCircle className="h-5 w-5 text-amber-100" />
                  </div>
                  <span className="text-[11px] text-amber-100">{commentCounts[reel.id] || 0}</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); shareReel(reel); }} className="depth-press flex flex-col items-center gap-1" aria-label="Share">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/55 shadow-[0_4px_18px_rgba(0,0,0,.35)] backdrop-blur-xl md:h-11 md:w-11">
                    <Share2 className="h-5 w-5 text-amber-100" />
                  </div>
                </button>
                <CreatorTipButton creatorId={reel.user_id} creatorName={reel.profile?.display_name || "creator"} compact />
                <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); }} className="depth-press">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/55 shadow-[0_4px_18px_rgba(0,0,0,.35)] backdrop-blur-xl md:h-11 md:w-11">
                    {muted ? <VolumeX className="h-5 w-5 text-amber-100" /> : <Volume2 className="h-5 w-5 text-amber-100" />}
                  </div>
                </button>
              </div>

              <div className="mt-4 flex min-w-0 items-center gap-2 pr-14">
                <button
                  onClick={() => reel.profile?.user_id && navigate(`/profile/${reel.profile.user_id}`)}
                  aria-label={`Open ${reel.profile?.display_name || "user"}'s profile`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-100/70 bg-black/50 text-sm font-bold text-amber-100"
                >
                  {reel.profile?.avatar_url
                    ? <img src={reel.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                    : (reel.profile?.display_name || "U")[0]}
                </button>
                <div className="min-w-0">
                  <button onClick={() => reel.profile?.user_id && navigate(`/profile/${reel.profile.user_id}`)} className="text-sm font-semibold text-white">
                    {reel.profile?.display_name || "User"} <span className="text-amber-300">●</span>
                  </button>
                  {(reel.caption || reel.music_title) && (
                    <p className="truncate text-xs text-white/65">{reel.caption || `♪ ${reel.music_title}`}</p>
                  )}
                </div>
              </div>
            </div>
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
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
                </button>
              </div>
            </div>
            <div className="flex-1 p-5 space-y-4 overflow-y-auto">
              <div className="liquid-glass rounded-2xl p-6 relative z-10">
                <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
                {videoPreview ? (
                  <div className="relative">
                    <video src={videoPreview} className="w-full rounded-xl aspect-[9/16] object-cover" controls />
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
              <div className="liquid-glass rounded-2xl p-4 relative z-10">
                <label className="text-caption text-muted-foreground block mb-2">Music (optional)</label>
                <input value={musicTitle} onChange={e => setMusicTitle(e.target.value)} placeholder="Add music title..." className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
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
    </div>
  );
};

export default ReelsPage;
