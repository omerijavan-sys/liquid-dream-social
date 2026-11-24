import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMute } from "@/contexts/MuteContext";
import { toast } from "sonner";
import ShareSheet from "@/components/ShareSheet";
import { countReelView } from "@/utils/reelViews";
import { BLANK_POSTER } from "@/lib/blankPoster";

/** A reel shown in the home feed; its video only loads and plays while nearby. */
const HomeReelCard = ({ reel, timeAgo }: { reel: any; timeAgo: string }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { muted, toggleMuted } = useMute();
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState<number>(reel.likes_count ?? 0);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    let viewTimer = 0;
    const preloadObserver = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: "400px 0px" });
    const playbackObserver = new IntersectionObserver(([entry]) => {
      const active = entry.isIntersecting && entry.intersectionRatio >= 0.6;
      setVisible(active);
      if (active) {
        window.clearTimeout(viewTimer);
        viewTimer = window.setTimeout(() => countReelView(reel.id), 1500);
      } else {
        window.clearTimeout(viewTimer);
        videoRef.current?.pause();
      }
    }, { threshold: 0.6 });
    preloadObserver.observe(el);
    playbackObserver.observe(el);
    return () => { window.clearTimeout(viewTimer); preloadObserver.disconnect(); playbackObserver.disconnect(); };
  }, [reel.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (near && visible) void video.play().catch(() => {});
    else video.pause();
  }, [near, visible]);

  useEffect(() => {
    if (!user) return;
    void supabase.from("reel_likes").select("reel_id").eq("reel_id", reel.id).eq("user_id", user.id).maybeSingle().then(({ data }) => setLiked(Boolean(data)));
  }, [user, reel.id]);

  const toggleLike = async () => {
    if (!user) { toast.error("Sign in to like"); return; }
    const was = liked;
    setLiked(!was); setLikes(n => Math.max(0, n + (was ? -1 : 1)));
    const { error } = was
      ? await supabase.from("reel_likes").delete().eq("reel_id", reel.id).eq("user_id", user.id)
      : await supabase.from("reel_likes").insert({ reel_id: reel.id, user_id: user.id });
    if (error) { setLiked(was); setLikes(n => Math.max(0, n + (was ? 1 : -1))); toast.error("Couldn't update like"); }
  };

  return (
    <div className="liquid-glass mb-6 overflow-hidden rounded-[1.5rem]">
      <div className="relative z-10 flex items-center gap-2 p-4">
        <button onClick={() => navigate(`/profile/${reel.user_id}`)} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold">
          {reel.profile?.avatar_url ? <img src={reel.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (reel.profile?.display_name || "U")[0].toUpperCase()}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{reel.profile?.display_name || "User"}</p>
          <p className="text-[11px] text-muted-foreground">{timeAgo}</p>
        </div>
      </div>
      <div ref={boxRef} className="relative flex w-full items-center justify-center bg-background/40" onClick={() => { const v = videoRef.current; if (!v) return; if (v.paused) void v.play().catch(() => {}); else v.pause(); }}>
        {!near && reel.thumbnail_url && <img src={reel.thumbnail_url} alt="" loading="lazy" decoding="async" className="h-auto max-h-[75vh] min-h-[30vh] w-full object-contain bg-background" />}
        {!near && !reel.thumbnail_url && <div aria-hidden="true" className="flex min-h-[30vh] w-full items-center justify-center bg-gradient-to-br from-muted via-background to-muted"><Play className="size-10 fill-current text-muted-foreground" /></div>}
        {near && (
          <video ref={videoRef} src={reel.video_url} poster={reel.thumbnail_url || BLANK_POSTER} className="h-auto max-h-[75vh] w-full bg-background object-contain" muted={muted} loop playsInline preload={visible ? "auto" : "none"} />
        )}
        <button aria-label={muted ? "Unmute" : "Mute"} onClick={event => { event.stopPropagation(); toggleMuted(); }} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 backdrop-blur">{muted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}</button>
      </div>
      <div className="relative z-10 flex items-center gap-4 p-4">
        <button onClick={() => void toggleLike()} aria-label="Like" className="flex items-center gap-1.5 text-sm text-foreground"><Heart className={`h-5 w-5 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />{reel.hide_likes && reel.user_id !== user?.id ? "" : likes}</button>
        <button onClick={() => navigate(`/reels?r=${reel.id}`)} aria-label="Comments" className="flex items-center text-foreground"><MessageCircle className="h-5 w-5" /></button>
        <button onClick={() => setShareOpen(true)} aria-label="Share" className="flex items-center text-foreground"><Share2 className="h-5 w-5" /></button>
        {reel.caption && <p className="min-w-0 flex-1 truncate text-sm text-foreground/80">{reel.caption}</p>}
      </div>
      {shareOpen && <ShareSheet open onOpenChange={open => { if (!open) setShareOpen(false); }} target={{ kind: "reel", id: reel.id, mediaUrl: reel.video_url, mediaType: "video", caption: reel.caption, username: reel.profile?.username, link: `${window.location.origin}/reels?r=${reel.id}` }} />}
    </div>
  );
};
export default HomeReelCard;
