import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useMute } from "@/contexts/MuteContext";
import { supabase } from "@/integrations/supabase/client";
import { INLINE_VIDEO_ATTRS } from "@/utils/media";
import CommentsSection from "@/components/CommentsSection";
import ShareSheet from "@/components/ShareSheet";
import PostMusicPlayer from "@/components/PostMusicPlayer";
import type { ViewerPost } from "@/components/MediaViewer";

type ProfilePostItem = ViewerPost & { thumbnail_url?: string | null };

export default function ProfilePostsViewer({
  posts,
  initialPostId,
  username,
  open,
  onClose,
}: {
  posts: ProfilePostItem[];
  initialPostId: string | null;
  username?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { muted } = useMute();
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const startIndex = Math.max(0, posts.findIndex((post) => post.id === initialPostId));
  const activePost = posts[activeIndex] ?? null;
  const activePostId = activePost?.id;
  const activePostLikesCount = activePost?.likes_count;
  const activePostViews = activePost?.views_count;
  const shareTarget = useMemo(() => activePost ? ({
    kind: "post" as const,
    id: activePost.id,
    mediaUrl: activePost.media_url,
    mediaType: activePost.media_type,
    caption: activePost.caption,
    username,
    link: `${window.location.origin}/?post=${activePost.id}`,
  }) : null, [activePost, username]);

  useEffect(() => {
    if (!open || !posts.length) return;
    setActiveIndex(startIndex);
    listRef.current?.children[startIndex]?.scrollIntoView({ block: "start" });
  }, [open, startIndex, posts.length]);

  useEffect(() => {
    if (!open || !activePostId) return;
    let cancelled = false;
    setLikes(activePostLikesCount ?? 0);
    setCommentsOpen(false);
    setShareOpen(false);
    void (async () => {
      const [likeResult, commentResult] = await Promise.all([
        user
          ? supabase.from("post_likes").select("id").eq("post_id", activePostId).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("post_comments").select("id", { count: "exact", head: true }).eq("post_id", activePostId),
      ]);
      if (cancelled) return;
      setLiked(Boolean(likeResult.data));
      if (typeof commentResult.count === "number") setComments(commentResult.count);
      const { data } = await supabase.rpc("register_post_view", { _post_id: activePostId });
      if (!cancelled && typeof data === "number") setViews(data);
    })();
    return () => { cancelled = true; };
  }, [activePostId, activePostLikesCount, open, user]);

  const [views, setViews] = useState(0);
  useEffect(() => {
    setViews(activePostViews ?? 0);
  }, [activePostId, activePostViews]);

  const toggleLike = async () => {
    if (!activePost) return;
    if (!user) return toast.error("Sign in to like posts");
    const next = !liked;
    setLiked(next);
    setLikes((count) => Math.max(0, count + (next ? 1 : -1)));
    const { error } = next
      ? await supabase.from("post_likes").insert({ post_id: activePost.id, user_id: user.id })
      : await supabase.from("post_likes").delete().eq("post_id", activePost.id).eq("user_id", user.id);
    if (error) {
      setLiked(!next);
      setLikes((count) => Math.max(0, count + (next ? -1 : 1)));
      toast.error("Couldn't update like");
    }
  };

  return (
    <>
      <Dialog open={open && posts.length > 0} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="h-dvh w-screen max-w-none overflow-hidden rounded-none border-0 bg-black p-0 text-white [&>button]:hidden">
          <DialogTitle className="sr-only">{username ? `${username}'s posts` : "Profile posts"}</DialogTitle>
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span className="rounded-full bg-black/45 px-3 py-1 text-sm font-semibold">{username || "Posts"}</span>
            <button onClick={onClose} aria-label="Close posts" className="flex size-9 items-center justify-center rounded-full bg-black/50"><X className="size-5" /></button>
          </div>
          <div
            ref={listRef}
            onScroll={(event) => {
              const height = event.currentTarget.clientHeight;
              if (height) setActiveIndex(Math.min(posts.length - 1, Math.round(event.currentTarget.scrollTop / height)));
            }}
            className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {posts.map((post, index) => (
              <section key={post.id} className="relative flex h-dvh snap-start items-center justify-center bg-black">
                {post.media_type === "video" && post.media_url ? (
                  <video src={post.media_url} poster={post.thumbnail_url || undefined} autoPlay={index === activeIndex} loop playsInline {...INLINE_VIDEO_ATTRS} muted={muted || index !== activeIndex} preload={index === activeIndex ? "auto" : "metadata"} className="h-full w-full object-contain" />
                ) : post.media_url ? (
                  <img src={post.media_url} alt={post.caption ? `Post by ${username || "user"}: ${post.caption}` : `Post by ${username || "user"}`} className="max-h-full max-w-full object-contain" />
                ) : (
                  <p className="max-w-xl px-8 text-center text-lg">{post.caption}</p>
                )}
                <div className="absolute bottom-28 right-3 z-20 flex flex-col items-center gap-5">
                  <button onClick={toggleLike} aria-label={liked ? "Unlike post" : "Like post"} aria-pressed={liked} className="flex flex-col items-center gap-0.5">
                    <Heart className={`size-7 drop-shadow ${liked ? "fill-red-500 text-red-500" : ""}`} />
                    <span className="text-[11px]">{index === activeIndex ? likes : (post.likes_count ?? 0)}</span>
                  </button>
                  <button onClick={() => setCommentsOpen(true)} aria-label="Open comments" className="flex flex-col items-center gap-0.5">
                    <MessageCircle className="size-7 drop-shadow" />
                    <span className="text-[11px]">{index === activeIndex ? comments : "Comments"}</span>
                  </button>
                  <button onClick={() => setShareOpen(true)} aria-label="Share post"><Send className="size-7 drop-shadow" /></button>
                </div>
                <div className="absolute inset-x-0 bottom-0 z-10 space-y-1.5 bg-gradient-to-t from-black/80 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pr-20">
                  {post.music?.title && <div className="text-white"><PostMusicPlayer music={post.music} /></div>}
                  {post.caption && <p className="line-clamp-3 text-sm">{post.caption}</p>}
                  <p className="text-[11px] text-white/65">{(index === activeIndex ? views : (post.views_count ?? 0)).toLocaleString()} views</p>
                </div>
              </section>
            ))}
          </div>
          {commentsOpen && activePost && (
            <div className="absolute inset-x-0 bottom-0 z-30 max-h-[70%] overflow-y-auto rounded-t-3xl border-t border-white/15 bg-background p-4 text-foreground">
              <div className="mb-2 flex items-center justify-between"><span className="font-semibold">Comments</span><button onClick={() => setCommentsOpen(false)} aria-label="Close comments"><X className="size-5" /></button></div>
              <CommentsSection postId={activePost.id} onCountChange={setComments} />
            </div>
          )}
        </DialogContent>
      </Dialog>
      {shareTarget && <ShareSheet open={shareOpen} onOpenChange={setShareOpen} target={shareTarget} />}
    </>
  );
}
