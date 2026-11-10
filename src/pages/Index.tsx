import { useState, useEffect } from "react";
import TopNavBar from "@/components/TopNavBar";
import GlassTabBar from "@/components/GlassTabBar";
import StoriesBar from "@/components/StoriesBar";
import FloatingActions from "@/components/FloatingActions";
import FeedPost from "@/components/FeedPost";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgo } from "@/utils/timeAgo";

const Index = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    let active = true;
    const fetchPosts = async () => {
      const [{ data }, { data: follows }] = await Promise.all([
        supabase
          .from("posts")
          .select("*")
          .neq("media_type", "story")
          .order("created_at", { ascending: false })
          .limit(50),
        user
          ? supabase.from("follows").select("following_id").eq("follower_id", user.id)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      if (!active) return;
      if (data && data.length > 0) {
        const followed = new Set((follows || []).map(f => f.following_id));
        // People you follow come first, then everyone else — newest first within each group.
        const sorted = [...data].sort((a, b) => {
          const af = followed.has(a.user_id) ? 0 : 1;
          const bf = followed.has(b.user_id) ? 0 : 1;
          return af - bf;
        });
        const userIds = [...new Set(sorted.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url, is_verified, is_official")
          .in("user_id", userIds);

        if (!active) return;
        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        setPosts(sorted.map(post => ({ ...post, profile: profileMap.get(post.user_id) || null })));
      } else {
        setPosts([]);
      }
    };
    fetchPosts();
    const channel = supabase.channel("home-posts").on("postgres_changes", { event: "*", schema: "public", table: "posts" }, fetchPosts).subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background relative">
      <TopNavBar />

      <main className="relative z-10 pt-14 pb-24">
        <div className="mt-2 mb-4">
          <StoriesBar />
        </div>
        <div className="px-4">
          {posts.length === 0 ? (
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
        </div>
      </main>

      <FloatingActions />
      <GlassTabBar />
    </div>
  );
};

export default Index;
