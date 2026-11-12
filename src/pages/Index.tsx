import { useState, useEffect, useRef, useCallback } from "react";
import TopNavBar from "@/components/TopNavBar";
import GlassTabBar from "@/components/GlassTabBar";
import StoriesBar from "@/components/StoriesBar";
import FloatingActions from "@/components/FloatingActions";
import FeedPost from "@/components/FeedPost";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgo } from "@/utils/timeAgo";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const FEED_PAGE_SIZE = 20;

const Index = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const { user } = useAuth();
  const currentUserId = user?.id;
  const pageRef = useRef(0);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchPosts = useCallback(async (reset = false) => {
    if (loadingRef.current || (!reset && !hasMoreRef.current)) return;
    loadingRef.current = true;
    setLoading(true);
    if (reset) {
      pageRef.current = 0;
      hasMoreRef.current = true;
      setHasMore(true);
    }
    const page = reset ? 0 : pageRef.current;
    try {
      const [{ data, error }, { data: follows, error: followsError }] = await Promise.all([
        supabase
          .from("posts")
          .select("*")
          .neq("media_type", "story")
          .eq("is_adult", false)
          .order("created_at", { ascending: false })
          .range(page * FEED_PAGE_SIZE, page * FEED_PAGE_SIZE + FEED_PAGE_SIZE - 1),
        currentUserId
          ? supabase.from("follows").select("following_id").eq("follower_id", currentUserId)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (error) throw error;
      if (followsError) throw followsError;
      const rows = data ?? [];
      hasMoreRef.current = rows.length === FEED_PAGE_SIZE;
      setHasMore(hasMoreRef.current);
      pageRef.current = page + 1;
      if (rows.length) {
        const followed = new Set((follows || []).map(f => f.following_id));
        const sorted = [...rows].sort((a, b) => {
          const af = followed.has(a.user_id) ? 0 : 1;
          const bf = followed.has(b.user_id) ? 0 : 1;
          return af - bf;
        });
        const userIds = [...new Set(sorted.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url, is_verified, is_official")
          .in("user_id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        const nextPosts = sorted.map(post => ({ ...post, profile: profileMap.get(post.user_id) || null }));
        setPosts(current => {
          if (reset) return nextPosts;
          const known = new Set(current.map(post => post.id));
          return [...current, ...nextPosts.filter(post => !known.has(post.id))];
        });
      } else if (reset) {
        setPosts([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load posts");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void fetchPosts(true);
    const channel = supabase.channel("home-posts")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => void fetchPosts(true))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchPosts]);

  useEffect(() => {
    const end = endRef.current;
    if (!end || loading || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void fetchPosts();
    }, { rootMargin: "600px" });
    observer.observe(end);
    return () => observer.disconnect();
  }, [fetchPosts, hasMore, loading]);

  return (
    <div className="min-h-screen bg-background relative">
      <TopNavBar />

      <main className="relative z-10 pt-14 pb-24">
        <div className="mt-2 mb-4">
          <StoriesBar />
        </div>
        <div className="px-4">
          {posts.length === 0 && loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-3xl liquid-glass flex items-center justify-center mb-4">
                <span className="text-2xl relative z-10">📷</span>
              </div>
              <p className="text-foreground font-semibold mb-1">Your feed is ready</p>
              <p className="text-sm text-muted-foreground">No posts yet. Create your first post to get started.</p>
            </div>
          ) : (
            posts.map((post, i) => (
              <FeedPost
                key={post.id}
                image={post.media_url || ""}
                mediaType={post.media_type || "image"}
                username={post.profile?.display_name || "User"}
                avatar={post.profile?.avatar_url || (post.profile?.display_name || "U")[0].toUpperCase()}
                caption={post.caption || ""}
                likes={post.likes_count || 0}
                comments={0}
                timeAgo={timeAgo(post.created_at)}
                index={i}
                postId={post.id}
                authorId={post.user_id}
                isVerified={post.profile?.is_verified}
                isOfficial={post.profile?.is_official}
                views={post.views_count || 0}
                music={post.music_title ? {
                  title: post.music_title,
                  artist: post.music_artist,
                  art_url: post.music_art_url,
                  stream_url: post.music_url,
                  youtube_id: post.music_youtube_id,
                } : null}
              />
            ))
          )}
          {posts.length > 0 && (
            <div ref={endRef} className="flex min-h-12 items-center justify-center py-4">
              {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            </div>
          )}
        </div>
      </main>

      <FloatingActions />
      <GlassTabBar />
    </div>
  );
};

export default Index;
