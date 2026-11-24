import { INLINE_VIDEO_ATTRS } from "@/utils/media";
import { BLANK_POSTER } from "@/lib/blankPoster";
import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Send, X, Volume2, VolumeX, Eye, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMute } from "@/contexts/MuteContext";
import CommentsSection from "@/components/CommentsSection";
import ShareSheet from "@/components/ShareSheet";
import PostMusicPlayer, { type PostMusic } from "@/components/PostMusicPlayer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface ViewerPost {
  id: string;
  media_url: string | null;
  media_type: string | null;
  caption: string | null;
  author?: string | null;
  likes_count?: number;
  views_count?: number;
  music?: PostMusic | null;
}

/** Full-screen viewer: videos open like a reel (tap to pause, global mute, side actions), photos open like a post. */
const MediaViewer = ({ post, onClose }: { post: ViewerPost | null; onClose: () => void }) => {
  const { muted, toggleMuted } = useMute();
  const [me, setMe] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState(0);
  const [views, setViews] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [share, setShare] = useState(false);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = post?.media_type === "video";

  useEffect(() => {
    if (!post) return;
    let dead = false;
    setLikes(post.likes_count ?? 0); setViews(post.views_count ?? 0); setLiked(false); setShowComments(false); setPaused(false);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (dead) return;
      setMe(user?.id ?? null);
      const [l, c] = await Promise.all([
        user ? supabase.from("post_likes").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("post_comments").select("id", { count: "exact", head: true }).eq("post_id", post.id),
      ]);
      if (dead) return;
      setLiked(!!l.data); if (typeof c.count === "number") setComments(c.count);
      const v = await supabase.rpc("register_post_view", { _post_id: post.id });
      if (!dead && typeof v.data === "number") setViews(v.data);
    })();
    return () => { dead = true; };
  }, [post?.id]);

  const toggleLike = async () => {
    if (!post) return;
    if (!me) return toast.error("Sign in to like posts");
    const next = !liked;
    setLiked(next); setLikes(c => Math.max(0, c + (next ? 1 : -1)));
    const { error } = next ? await supabase.from("post_likes").insert({ post_id: post.id, user_id: me }) : await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", me);
    if (error) { setLiked(!next); setLikes(c => Math.max(0, c + (next ? -1 : 1))); toast.error("Couldn't update like"); }
  };

  const tapVideo = () => { const v = videoRef.current; if (!v) return; if (v.paused) { void v.play(); setPaused(false); } else { v.pause(); setPaused(true); } };
  const link = post ? `${window.location.origin}/?post=${post.id}` : "";

  return (
    <>
      <Dialog open={!!post} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="flex h-dvh w-screen max-w-none flex-col rounded-none border-0 bg-black p-0 text-white [&>button]:hidden">
          <DialogTitle className="sr-only">{isVideo ? "Reel" : "Post"}</DialogTitle>
          {post && (
            <>
              <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <span className="rounded-full bg-black/40 px-3 py-1 text-sm font-semibold">{post.author ?? ""}</span>
                <div className="flex gap-2">
                  {isVideo && <button onClick={toggleMuted} aria-label={muted ? "Unmute" : "Mute"} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50">{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>}
                  <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50"><X className="h-5 w-5" /></button>
                </div>
              </div>

              <div className="relative flex min-h-0 flex-1 items-center justify-center" onClick={isVideo ? tapVideo : undefined}>
                {isVideo
                  ? <video ref={videoRef} poster={BLANK_POSTER} src={post.media_url ?? undefined} autoPlay loop {...INLINE_VIDEO_ATTRS} muted={muted} className="h-full w-full object-contain" />
                  : post.media_url ? <img src={post.media_url} alt="" className="max-h-full max-w-full object-contain" /> : <p className="p-8 text-center text-lg">{post.caption}</p>}
              </div>

              {/* action rail */}
              <div className="absolute bottom-28 right-3 z-20 flex flex-col items-center gap-5">
                <button onClick={toggleLike} aria-label="Like" className="flex flex-col items-center gap-0.5"><Heart className={`h-7 w-7 drop-shadow ${liked ? "fill-red-500 text-red-500" : ""}`} /><span className="text-[11px]">{likes}</span></button>
                <button onClick={() => setShowComments(true)} aria-label="Comments" className="flex flex-col items-center gap-0.5"><MessageCircle className="h-7 w-7 drop-shadow" /><span className="text-[11px]">{comments}</span></button>
                <button onClick={() => setShare(true)} aria-label="Share"><Send className="h-7 w-7 drop-shadow" /></button>
              </div>

              <div className="absolute inset-x-0 bottom-0 z-10 space-y-1.5 bg-gradient-to-t from-black/80 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pr-20">
                {post.music?.title && <div className="text-white"><PostMusicPlayer music={post.music} /></div>}
                {post.caption && <p className="line-clamp-3 text-sm">{post.caption}</p>}
                <p className="flex items-center gap-1 text-[11px] text-white/60"><Eye className="h-3 w-3" />{views.toLocaleString()} views</p>
              </div>

              {showComments && (
                <div className="absolute inset-x-0 bottom-0 z-30 max-h-[70%] overflow-y-auto rounded-t-3xl border-t border-white/15 bg-background p-4 text-foreground">
                  <div className="mb-2 flex items-center justify-between"><span className="font-semibold">Comments</span><button onClick={() => setShowComments(false)} aria-label="Close comments"><X className="h-5 w-5" /></button></div>
                  <CommentsSection postId={post.id} onCountChange={setComments} />
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      {post && <ShareSheet open={share} onOpenChange={setShare} target={{ kind: "post", id: post.id, mediaUrl: post.media_url, mediaType: post.media_type, caption: post.caption, username: post.author, link }} />}
    </>
  );
};
export default MediaViewer;
