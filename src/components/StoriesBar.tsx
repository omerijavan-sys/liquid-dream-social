import { BLANK_POSTER } from "@/lib/blankPoster";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, ChevronLeft, ChevronRight, Play, MessageCircle, Send, Music2, Search } from "lucide-react";
import { runInBackground } from "@/utils/backgroundUpload";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { isVideoMedia } from "@/utils/media";
import { useNavigate } from "react-router-dom";
import { searchGlobalMusic, type GlobalMusicTrack } from "@/services/GlobalMusicService";
import PostMusicPlayer from "@/components/PostMusicPlayer";
import { UPLOAD_CACHE } from "@/utils/media";

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
  cover_url?: string | null;
  display_name: string;
  created_at: string;
  music_title?: string | null;
  music_artist?: string | null;
  music_art_url?: string | null;
  music_url?: string | null;
  music_youtube_id?: string | null;
  music_start?: number | null;
  music_len?: number | null;
  music_volume?: number | null;
  progress?: number;
}

const StoriesBar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stories, setStories] = useState<StoryView[]>([]);
  const [viewingStory, setViewingStory] = useState<StoryView | null>(null);
  const [uploading, setUploading] = useState(false);
  const [storyTrack, setStoryTrack] = useState<GlobalMusicTrack | null>(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [musicQuery, setMusicQuery] = useState("");
  const [musicResults, setMusicResults] = useState<GlobalMusicTrack[]>([]);
  const [searchingMusic, setSearchingMusic] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<number>();
  const storyProgressRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [storyDuration, setStoryDuration] = useState(5000);
  // Portrait photos/videos fill the whole screen; wide ones stay whole over a blurred copy of themselves.
  const [storyCover, setStoryCover] = useState(true);
  const fit = storyCover ? "object-cover" : "object-contain";
  // One circle per person: all of someone's live stories sit together, oldest first (the order you watch them in).
  const groups = useMemo(() => {
    const m = new Map<string, StoryView[]>();
    for (const st of stories) { const a = m.get(st.user_id); if (a) a.push(st); else m.set(st.user_id, [st]); }
    return [...m.values()].map(list => [...list].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)));
  }, [stories]);
  const flat = useMemo(() => groups.flat(), [groups]);
  const viewingGroup = viewingStory ? groups.find(g => g[0].user_id === viewingStory.user_id) ?? [] : [];
  const viewingIndex = viewingStory ? viewingGroup.findIndex(x => x.id === viewingStory.id) : -1;
  // The progress bar is painted straight onto the DOM so the video never competes with React re-renders.
  const paint = (p: number) => { storyProgressRef.current = p; if (barRef.current) barRef.current.style.width = `${p * 100}%`; };
  const advance = useCallback(() => {
    if (!viewingStory) return;
    const index = flat.findIndex(story => story.id === viewingStory.id);
    setStoryDuration(5000);
    paint(0);
    setPaused(false);
    setViewingStory(flat[index + 1] || null);
  }, [flat, viewingStory]);
  const back = useCallback(() => {
    if (!viewingStory) return;
    const index = flat.findIndex(story => story.id === viewingStory.id);
    setStoryDuration(5000);
    paint(0);
    setPaused(false);
    if (videoRef.current) videoRef.current.currentTime = 0;
    // first story: just restart it
    if (index > 0) setViewingStory(flat[index - 1]);
  }, [flat, viewingStory]);
  // Tap left third = previous, the rest = next; press and hold = pause.
  const holdTimer = useRef<number>();
  const held = useRef(false);
  const zoneDown = () => { held.current = false; holdTimer.current = window.setTimeout(() => { held.current = true; setPaused(true); }, 220); };
  const zoneUp = (e: React.PointerEvent<HTMLElement>) => {
    window.clearTimeout(holdTimer.current);
    if (held.current) { setPaused(false); held.current = false; return; }
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX - r.left < r.width * 0.35) back(); else advance();
  };
  const openStory = (story: StoryView) => {
    paint(0);
    setPaused(false);
    setViewingStory(story);
  };

  // Fetch stories from DB — only those < 24 hours old
  useEffect(() => {
    const fetchStories = async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("posts")
        .select("id, media_url, user_id, created_at, music_title, music_artist, music_art_url, music_url, music_youtube_id, music_start, music_len, music_volume")
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
          cover_url: profileMap.get(s.user_id)?.avatar_url || (isVideoMedia(s.media_url || "") ? null : s.media_url),
          display_name: profileMap.get(s.user_id)?.display_name || "User",
          created_at: s.created_at,
          music_title: s.music_title,
          music_artist: s.music_artist,
          music_art_url: s.music_art_url,
          music_url: s.music_url,
          music_youtube_id: s.music_youtube_id,
          music_start: (s as any).music_start,
          music_len: (s as any).music_len,
          music_volume: (s as any).music_volume,
        })));
      }
    };
    fetchStories();
    const again = () => { void fetchStories(); };
    window.addEventListener("prime:stories-changed", again);
    return () => window.removeEventListener("prime:stories-changed", again);
  }, []);

  // Who is live right now
  const [lives, setLives] = useState<{ id: string; host_id: string; name: string; avatar: string | null }[]>([]);
  useEffect(() => {
    const load = async () => {
      const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const { data } = await supabase.from("live_streams" as never).select("id,host_id").eq("status", "live").gte("started_at", since).order("started_at", { ascending: false }).limit(15) as { data: { id: string; host_id: string }[] | null };
      if (!data?.length) { setLives([]); return; }
      const { data: profs } = await supabase.from("profiles").select("user_id,display_name,username,avatar_url").in("user_id", data.map(d => d.host_id));
      const pm = new Map((profs ?? []).map(p => [p.user_id, p]));
      setLives(data.map(d => ({ id: d.id, host_id: d.host_id, name: pm.get(d.host_id)?.username || pm.get(d.host_id)?.display_name || "Live", avatar: pm.get(d.host_id)?.avatar_url ?? null })));
    };
    void load();
    const ch = supabase.channel("live-now").on("postgres_changes", { event: "*", schema: "public", table: "live_streams" }, () => { void load(); }).subscribe();
    return () => { void supabase.removeChannel(ch); };
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
      paint(p);
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

  // Preload whatever comes next so tapping forward (or a video ending) starts instantly instead of stalling.
  useEffect(() => {
    if (!viewingStory) return;
    const next = flat[flat.findIndex(x => x.id === viewingStory.id) + 1];
    if (!next?.image_url) return;
    if (isVideoMedia(next.image_url)) {
      const v = document.createElement("video");
      v.preload = "auto"; v.muted = true; v.src = next.image_url; v.load();
      return () => { v.removeAttribute("src"); v.load(); };
    }
    const img = new Image(); img.src = next.image_url;
  }, [viewingStory, flat]);

  const handleAddStory = () => fileRef.current?.click();

  const searchStoryMusic = async () => {
    const query = musicQuery.trim();
    if (query.length < 2) { toast.error("Enter at least two letters to search for a song."); return; }
    setSearchingMusic(true);
    try {
      setMusicResults(await searchGlobalMusic(query, 8));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Music search is unavailable.");
    } finally {
      setSearchingMusic(false);
    }
  };

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !user) return;
    const uid = user.id;
    const name = user.user_metadata?.full_name || "You";
    const track = storyTrack;
    const isVideo = file.type.startsWith("video/");
    setUploading(true);
    runInBackground("Posting your story", async (progress) => {
      progress("Uploading story…");
      const ext = file.name.split(".").pop();
      const path = `${uid}/story_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("media").upload(path, file, { cacheControl: UPLOAD_CACHE });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      const { data: post, error } = await supabase.from("posts").insert({
        user_id: uid,
        media_url: publicUrl,
        media_type: "story",
        caption: "Story",
        music_title: track?.title ?? null,
        music_artist: track?.artist ?? null,
        music_art_url: track?.artwork ?? null,
        music_url: track?.streamUrl ?? null,
        music_youtube_id: track?.id ?? null,
      } as any).select("id").single();
      if (error) throw error;
      return { id: post.id, publicUrl };
    }, (r) => {
      setUploading(false);
      setStories(prev => [{
        id: r.id,
        user_id: uid,
        image_url: r.publicUrl,
        cover_url: isVideo ? null : r.publicUrl,
        display_name: name,
        created_at: new Date().toISOString(),
        music_title: track?.title,
        music_artist: track?.artist,
        music_art_url: track?.artwork,
        music_url: track?.streamUrl,
        music_youtube_id: track?.id,
      }, ...prev]);
    }, () => setUploading(false));
  };

  // ---- Story comments ----
  const [commentText, setCommentText] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [storyComments, setStoryComments] = useState<{ id: string; content: string; user_id: string; name: string }[]>([]);
  const loadStoryComments = useCallback(async (storyId: string) => {
    const { data } = await supabase.from("story_comments" as any).select("id, content, user_id").eq("story_id", storyId).order("created_at", { ascending: true }).limit(100);
    const rows = (data ?? []) as any[];
    const ids = [...new Set(rows.map(r => r.user_id))];
    const { data: profs } = ids.length ? await supabase.from("profiles").select("user_id, username, display_name").in("user_id", ids) : { data: [] as any[] };
    const pm = new Map((profs ?? []).map(p => [p.user_id, p]));
    setStoryComments(rows.map(r => ({ ...r, name: pm.get(r.user_id)?.username || pm.get(r.user_id)?.display_name || "user" })));
  }, []);
  useEffect(() => {
    setCommentsOpen(false); setCommentText("");
    if (!viewingStory) { setStoryComments([]); return; }
    void loadStoryComments(viewingStory.id);
    const ch = supabase.channel(`story-comments-${viewingStory.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "story_comments", filter: `story_id=eq.${viewingStory.id}` }, () => { void loadStoryComments(viewingStory.id); }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [viewingStory?.id, loadStoryComments]); // eslint-disable-line react-hooks/exhaustive-deps
  const sendStoryComment = async () => {
    if (!viewingStory || !user || !commentText.trim()) return;
    const text = commentText.trim();
    const { error } = await supabase.from("story_comments" as any).insert({ story_id: viewingStory.id, user_id: user.id, content: text } as any);
    if (error) { toast.error("Couldn't post your comment"); return; }
    setCommentText("");
    if (viewingStory.user_id !== user.id) {
      void supabase.from("messages").insert({ sender_id: user.id, receiver_id: viewingStory.user_id, content: `Commented on your story: ${text}` });
    }
    void loadStoryComments(viewingStory.id);
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
      <div className="px-4 py-3">
        <div className="flex gap-3 overflow-x-auto scrollbar-none">
          <StoryBubble name={uploading ? "Posting..." : "Your Story"} initial="+" gradient="linear-gradient(135deg, hsl(210, 100%, 60%), hsl(260, 80%, 60%))" hasNew={false} index={0} onClick={handleAddStory} isAdd />
          {lives.map(l => (
            <button key={l.id} onClick={() => navigate(`/live/${l.id}`)} className="flex shrink-0 flex-col items-center gap-1.5" aria-label={`Watch ${l.name} live`}>
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-red-600 to-fuchsia-500 p-[3px]">
                <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-background bg-secondary text-sm font-bold">{l.avatar ? <img src={l.avatar} alt="" className="h-full w-full object-cover" /> : l.name[0]?.toUpperCase()}</span>
                <span className="absolute -bottom-1 rounded bg-red-600 px-1.5 text-[9px] font-bold uppercase tracking-wide text-white">Live</span>
              </span>
              <span className="w-16 truncate text-center text-[11px] text-foreground">{l.name}</span>
            </button>
          ))}
          {groups.map((g, i) => (
            <div key={g[0].user_id} className="relative shrink-0">
              <StoryBubble name={g[0].display_name} imageUrl={g[0].cover_url} initial={g[0].display_name[0]} gradient="linear-gradient(135deg, hsl(350, 80%, 58%), hsl(280, 70%, 55%))" hasNew index={i + 1} onClick={() => openStory(g[0])} />
              {g.length > 1 && <span aria-label={`${g.length} stories`} className="pointer-events-none absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-bold text-primary-foreground">{g.length}</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => setMusicOpen(open => !open)} className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-foreground">
            <Music2 className="h-4 w-4 text-primary" />
            {storyTrack ? `Story music: ${storyTrack.title}` : "Add music to your story"}
          </button>
          {storyTrack && <button type="button" onClick={() => setStoryTrack(null)} className="text-xs text-muted-foreground">Remove</button>}
        </div>
        {musicOpen && (
          <div className="mt-3 rounded-2xl border border-border bg-card p-3">
            <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void searchStoryMusic(); }}>
              <label className="sr-only" htmlFor="story-music-search">Search songs</label>
              <input id="story-music-search" value={musicQuery} onChange={event => setMusicQuery(event.target.value)} placeholder="Search songs or artists" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" />
              <Button type="submit" size="icon" aria-label="Search music" disabled={searchingMusic}><Search /></Button>
            </form>
            {storyTrack && <p className="mt-2 text-xs text-muted-foreground">Selected: {storyTrack.title} · {storyTrack.artist}</p>}
            {searchingMusic && <p role="status" className="mt-3 text-xs text-muted-foreground">Searching music…</p>}
            <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
              {musicResults.map(track => (
                <button key={track.id} type="button" onClick={() => { setStoryTrack(track); setMusicOpen(false); }} className="flex items-center gap-3 rounded-xl p-2 text-left hover:bg-muted">
                  {track.artwork ? <img src={track.artwork} alt="" className="size-9 rounded-lg object-cover" /> : <Music2 className="size-5 text-primary" />}
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{track.title}</span><span className="block truncate text-xs text-muted-foreground">{track.artist}</span></span>
                </button>
              ))}
            </div>
          </div>
        )}
        {uploading && <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" role="status"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />Your story is posting in the background. You can keep browsing.</div>}
      </div>

      {createPortal(<AnimatePresence>
        {viewingStory && (
          <motion.div role="dialog" aria-label="Story viewer" aria-modal="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-background flex flex-col">
            {/* Progress bar */}
            <div className="absolute top-4 safe-area-top left-4 right-4 z-20 bg-background/70 rounded-lg p-3">
              <div className="flex gap-1">
                {(viewingGroup.length ? viewingGroup : [viewingStory]).map((x, i) => (
                  <div key={x.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-muted">
                    {i === Math.max(0, viewingIndex)
                      ? <div ref={barRef} className="h-full rounded-full bg-primary" style={{ width: "0%" }} />
                      : <div className="h-full rounded-full bg-primary" style={{ width: i < viewingIndex ? "100%" : "0%" }} />}
                  </div>
                ))}
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
            {viewingStory.music_title && (
              <div className="absolute left-3 right-3 top-24 z-20 rounded-2xl bg-background/85 p-2 backdrop-blur-xl">
                <PostMusicPlayer autoStart paused={paused || commentsOpen} music={{
                  title: viewingStory.music_title,
                  artist: viewingStory.music_artist,
                  art_url: viewingStory.music_art_url,
                  stream_url: viewingStory.music_url,
                  youtube_id: viewingStory.music_youtube_id,
                  start: viewingStory.music_start,
                  len: viewingStory.music_len,
                  volume: viewingStory.music_volume,
                }} />
              </div>
            )}
            {!storyCover && !isVideoMedia(viewingStory.image_url) && <img src={viewingStory.image_url} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />}
            <div className="absolute inset-0 flex items-center justify-center">
              {isVideoMedia(viewingStory.image_url) ? (
                <video ref={videoRef} key={viewingStory.id} src={viewingStory.image_url} poster={viewingStory.cover_url || BLANK_POSTER} autoPlay playsInline preload="auto" disablePictureInPicture className={`h-full w-full ${fit}`} onLoadedMetadata={e => setStoryCover(e.currentTarget.videoHeight / Math.max(1, e.currentTarget.videoWidth) >= 1.2)} onEnded={advance} onTimeUpdate={event => {
                  const video = event.currentTarget;
                  if (Number.isFinite(video.duration)) {
                    const progress = video.currentTime / video.duration;
                    paint(progress);
                  }
                }} />
              ) : (
                <img src={viewingStory.image_url} alt="Story" className={`h-full w-full ${fit}`} onLoad={e => setStoryCover(e.currentTarget.naturalHeight / Math.max(1, e.currentTarget.naturalWidth) >= 1.2)} />
              )}
              <div role="presentation" onPointerDown={zoneDown} onPointerUp={zoneUp} onPointerLeave={() => { window.clearTimeout(holdTimer.current); if (held.current) { setPaused(false); held.current = false; } }} className="absolute inset-0 z-10 touch-manipulation select-none">
              </div>
            </div>
            <div className="absolute bottom-4 left-4 right-28 z-20 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {["❤️", "😂", "😮", "🔥", "👏"].map((emoji) => (
                  <button key={emoji} type="button" aria-label={`React ${emoji}`} disabled={viewingStory.user_id === user?.id} onClick={() => void handleReaction(emoji)} className="rounded-full bg-background/70 px-2.5 py-1.5 text-lg backdrop-blur-md disabled:opacity-50">
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input value={commentText} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === "Enter" && void sendStoryComment()} placeholder="Add a comment…" maxLength={500} className="min-w-0 flex-1 rounded-full bg-background/80 px-4 py-2 text-sm text-foreground outline-none backdrop-blur-md" />
                <button type="button" aria-label="Send comment" onClick={() => void sendStoryComment()} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><Send className="h-4 w-4" /></button>
                <button type="button" aria-label="View comments" onClick={() => { setCommentsOpen(o => !o); setPaused(true); }} className="relative flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-foreground"><MessageCircle className="h-4 w-4" />{storyComments.length > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{storyComments.length}</span>}</button>
              </div>
            </div>
            {commentsOpen && (
              <div className="absolute inset-x-0 bottom-0 z-30 max-h-[55%] overflow-y-auto rounded-t-3xl bg-background/95 p-4 backdrop-blur-xl">
                <div className="mb-2 flex items-center justify-between"><span className="font-semibold text-foreground">Comments</span><button onClick={() => { setCommentsOpen(false); setPaused(false); }} aria-label="Close comments"><X className="h-5 w-5 text-foreground" /></button></div>
                {storyComments.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No comments yet</p> : storyComments.map(c => (
                  <div key={c.id} className="flex items-start gap-2 py-1.5 text-sm"><span className="font-semibold text-foreground">{c.name}</span><span className="flex-1 text-foreground/90">{c.content}</span>
                    {(c.user_id === user?.id || viewingStory.user_id === user?.id) && <button aria-label="Delete comment" onClick={async () => { await supabase.from("story_comments" as any).delete().eq("id", c.id); void loadStoryComments(viewingStory.id); }} className="text-xs text-muted-foreground">✕</button>}
                  </div>
                ))}
              </div>
            )}
            <Button variant="secondary" size="icon" aria-label="Previous story" onClick={back} className="absolute right-16 bottom-5 z-20"><ChevronLeft /></Button>
            <Button variant="secondary" size="icon" aria-label="Next story" onClick={advance} className="absolute right-4 bottom-5 z-20"><ChevronRight /></Button>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </>
  );
};

export default StoriesBar;
