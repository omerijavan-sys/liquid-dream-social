import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, ChevronRight, Play } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { isVideoMedia } from "@/utils/media";
import { useNavigate } from "react-router-dom";

interface StoryBubbleProps {
  name: string;
  imageUrl?: string | null;
  initial: string;
  gradient: string;
  hasNew?: boolean;
  index: number;
  onClick?: () => void;
  isAdd?: boolean;
}

const StoryBubble = ({ name, imageUrl, initial, gradient, hasNew = true, index, onClick, isAdd }: StoryBubbleProps) => (
  <motion.button
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    className="flex flex-col items-center gap-1.5 min-w-[4.5rem] depth-press"
    onClick={onClick}
  >
    <div className={`relative w-16 h-16 rounded-full ${hasNew ? "p-[2px]" : "p-[1px]"}`}
      style={{ background: hasNew ? gradient : "hsla(var(--glass-border) / 0.15)" }}
    >
      <div className="w-full h-full rounded-full bg-background p-[2px]">
        <div className="w-full h-full rounded-full liquid-glass flex items-center justify-center overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover rounded-full" />
          ) : isAdd ? (
            <Plus className="w-6 h-6 text-primary relative z-10" />
          ) : (
            <span className="text-lg font-semibold text-foreground relative z-10">{initial}</span>
          )}
        </div>
      </div>
    </div>
    <span className="text-caption text-foreground/70 truncate w-full text-center">{name}</span>
  </motion.button>
);

interface StoryView {
  id: string;
  user_id: string;
  image_url: string;
  display_name: string;
  created_at: string;
  progress?: number;
}

const StoriesBar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stories, setStories] = useState<StoryView[]>([]);
  const [viewingStory, setViewingStory] = useState<StoryView | null>(null);
  const [uploading, setUploading] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<number>();
  const storyProgressRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [storyDuration, setStoryDuration] = useState(5000);
  const advance = useCallback(() => {
    if (!viewingStory) return;
    const index = stories.findIndex(story => story.id === viewingStory.id);
    setStoryDuration(5000);
    storyProgressRef.current = 0;
    setStoryProgress(0);
    setPaused(false);
    setViewingStory(stories[index + 1] || null);
  }, [stories, viewingStory]);
  const openStory = (story: StoryView) => {
    storyProgressRef.current = 0;
    setStoryProgress(0);
    setPaused(false);
    setViewingStory(story);
  };

  // Fetch stories from DB — only those < 24 hours old
  useEffect(() => {
    const fetchStories = async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("posts")
        .select("id, media_url, user_id, created_at")
        .eq("media_type", "story")
        .gte("created_at", twentyFourHoursAgo)
        .order("created_at", { ascending: false })
        .limit(30);

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", userIds);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        setStories(data.map(s => ({
          id: s.id,
          user_id: s.user_id,
          image_url: s.media_url || "",
          display_name: profileMap.get(s.user_id)?.display_name || "User",
          created_at: s.created_at,
        })));
      }
    };
    fetchStories();
  }, []);

  // Keep the remaining display time while a story is paused.
  useEffect(() => {
    if (!viewingStory || paused) return;
    if (isVideoMedia(viewingStory.image_url)) return;
    const start = Date.now() - storyProgressRef.current * storyDuration;
    const duration = storyDuration;
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      storyProgressRef.current = p;
      setStoryProgress(p);
      if (p < 1) {
        progressRef.current = requestAnimationFrame(tick);
      } else {
        advance();
      }
    };
    progressRef.current = requestAnimationFrame(tick);
    return () => { if (progressRef.current) cancelAnimationFrame(progressRef.current); };
  }, [viewingStory, storyDuration, paused, advance]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else void video.play().catch(() => {});
  }, [paused, viewingStory?.id]);
  useEffect(() => {
    if (!viewingStory) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setViewingStory(null); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [viewingStory]);

  const handleAddStory = () => fileRef.current?.click();

  const handleReaction = async (emoji: string) => {
    if (!viewingStory || !user) {
      toast.error("Sign in to react to a story");
      return;
    }
    if (viewingStory.user_id === user.id) return;
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: viewingStory.user_id,
      content: `Reacted to your story: ${emoji}`,
    });
    if (error) {
      toast.error("Couldn't send your reaction");
      return;
    }
    toast.success("Story reaction sent");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/story_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("media").upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      const { data: post, error } = await supabase.from("posts").insert({ user_id: user.id, media_url: publicUrl, media_type: "story", caption: "Story" }).select("id").single();
      if (error) throw error;
      toast.success("Story posted!");
      setStories(prev => [{ id: post.id, user_id: user.id, image_url: publicUrl, display_name: user.user_metadata?.full_name || "You", created_at: new Date().toISOString() }, ...prev]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post story");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
      <div className="overflow-x-auto scrollbar-none py-3 px-4">
        <div className="flex gap-3">
          <StoryBubble name={uploading ? "Posting..." : "Your Story"} initial="+" gradient="linear-gradient(135deg, hsl(210, 100%, 60%), hsl(260, 80%, 60%))" hasNew={false} index={0} onClick={handleAddStory} isAdd />
          {stories.map((story, i) => (
            <StoryBubble key={story.id} name={story.display_name} imageUrl={story.image_url} initial={story.display_name[0]} gradient="linear-gradient(135deg, hsl(350, 80%, 58%), hsl(280, 70%, 55%))" hasNew index={i + 1} onClick={() => openStory(story)} />
          ))}
        </div>
      </div>

      {createPortal(<AnimatePresence>
        {viewingStory && (
          <motion.div role="dialog" aria-label="Story viewer" aria-modal="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-background flex flex-col">
            {/* Progress bar */}
            <div className="absolute top-4 safe-area-top left-4 right-4 z-20 bg-background/70 rounded-lg p-3">
              <div className="h-0.5 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary rounded-full" style={{ width: `${storyProgress * 100}%` }} />
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(viewingStory.user_id === user?.id ? "/profile" : `/profile/${viewingStory.user_id}`)}
                    aria-label={`Open ${viewingStory.display_name}'s profile`}
                    className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-foreground text-sm font-bold"
                  >
                    {viewingStory.display_name[0]}
                  </button>
                  <button
                    onClick={() => navigate(viewingStory.user_id === user?.id ? "/profile" : `/profile/${viewingStory.user_id}`)}
                    className="text-foreground text-sm font-medium truncate"
                  >
                    {viewingStory.display_name}
                  </button>
                  <span className="text-muted-foreground text-xs">{new Date(viewingStory.created_at).toLocaleTimeString()}</span>
                </div>
                <Button variant="secondary" size="icon" aria-label="Close story" onClick={() => setViewingStory(null)} className="w-8 h-8 rounded-full"><X /></Button>
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              {isVideoMedia(viewingStory.image_url) ? (
                <button type="button" aria-label={paused ? "Resume story" : "Pause story"} onClick={() => setPaused(value => !value)} className="relative h-full w-full">
                  <video ref={videoRef} key={viewingStory.id} src={viewingStory.image_url} autoPlay playsInline className="h-full w-full object-contain" onEnded={advance} onTimeUpdate={event => {
                    const video = event.currentTarget;
                    if (Number.isFinite(video.duration)) {
                      const progress = video.currentTime / video.duration;
                      storyProgressRef.current = progress;
                      setStoryProgress(progress);
                    }
                  }} />
                  {paused && <span className="absolute inset-0 flex items-center justify-center bg-black/20"><Play className="h-12 w-12 fill-white text-white" /></span>}
                </button>
              ) : (
                <button type="button" aria-label={paused ? "Resume story" : "Pause story"} onClick={() => setPaused(value => !value)} className="relative h-full w-full">
                  <img src={viewingStory.image_url} alt="Story" className="h-full w-full object-contain" />
                  {paused && <span className="absolute inset-0 flex items-center justify-center bg-black/20"><Play className="h-12 w-12 fill-white text-white" /></span>}
                </button>
              )}
            </div>
            <div className="absolute bottom-5 left-4 right-16 z-20 flex items-center gap-2">
              {["❤️", "😂", "😮", "🔥", "👏"].map((emoji) => (
                <button key={emoji} type="button" aria-label={`React ${emoji}`} disabled={viewingStory.user_id === user?.id} onClick={() => void handleReaction(emoji)} className="rounded-full bg-background/70 px-2.5 py-1.5 text-lg backdrop-blur-md disabled:opacity-50">
                  {emoji}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="icon" aria-label="Next story" onClick={advance} className="absolute right-4 bottom-5 z-20"><ChevronRight /></Button>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </>
  );
};

export default StoriesBar;
