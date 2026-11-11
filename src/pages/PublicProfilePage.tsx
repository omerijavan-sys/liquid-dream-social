import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, Grid3X3, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FollowButton } from "@/components/FollowListDialog";
import CommentsSection from "@/components/CommentsSection";
import PostMusicPlayer from "@/components/PostMusicPlayer";
import GlassTabBar from "@/components/GlassTabBar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Profile = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
  is_official: boolean | null;
};

type ProfilePost = {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  likes_count: number;
  views_count: number;
  music_title: string | null;
  music_artist: string | null;
  music_art_url: string | null;
  music_url: string | null;
  music_youtube_id: string | null;
};

const PublicProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ProfilePost | null>(null);
  const [selectedViews, setSelectedViews] = useState(0);
  const [creatorPrice, setCreatorPrice] = useState<number | null>(null);
  const [subscribedUntil, setSubscribedUntil] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const loadSubscription = async () => {
      const [creator, subscription] = await Promise.all([
        supabase.from("creator_profiles").select("monthly_price").eq("user_id", userId).maybeSingle(),
        user && user.id !== userId
          ? supabase.from("creator_subscriptions").select("status, expires_at").eq("subscriber_id", user.id).eq("creator_id", userId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (cancelled) return;
      if (creator.error || subscription.error) {
        toast.error("Couldn't load creator subscription details");
        return;
      }
      setCreatorPrice(creator.data?.monthly_price ?? null);
      setSubscribedUntil(
        subscription.data?.status === "active" && new Date(subscription.data.expires_at) > new Date()
          ? subscription.data.expires_at
          : null,
      );
    };
    void loadSubscription();
    return () => { cancelled = true; };
  }, [user, userId]);

  const subscribe = async () => {
    if (!user || !userId) return;
    setSubscribing(true);
    try {
      const { data, error } = await supabase.rpc("creator_subscribe", { _creator_id: userId });
      if (error) throw error;
      setSubscribedUntil(data);
      toast.success("Subscription started for one prepaid month");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't subscribe");
    } finally {
      setSubscribing(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      const [profileRes, postsRes, followersRes, followingRes, followRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id,username,display_name,bio,avatar_url,is_verified,is_official")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("posts")
          .select("*")
          .eq("user_id", userId)
          .neq("media_type", "story")
          .order("created_at", { ascending: false })
          .limit(60),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
        user && user.id !== userId
          ? supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", userId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (cancelled) return;
      if (profileRes.error || postsRes.error || followersRes.error || followingRes.error || followRes.error) {
        toast.error("Couldn't load this profile");
      }
      setProfile(profileRes.data);
      setPosts(postsRes.data ?? []);
      setFollowers(followersRes.count ?? 0);
      setFollowingCount(followingRes.count ?? 0);
      setFollowing(!!followRes.data);
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [user, userId]);

  useEffect(() => {
    if (!selectedPost) return;
    setSelectedViews(selectedPost.views_count);
    let cancelled = false;
    supabase.rpc("register_post_view", { _post_id: selectedPost.id }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        toast.error("Couldn't record this view");
        return;
      }
      setSelectedViews(data);
      setPosts((current) =>
        current.map((post) => post.id === selectedPost.id ? { ...post, views_count: data } : post),
      );
    });
    return () => { cancelled = true; };
  }, [selectedPost]);

  const closePost = (open: boolean) => {
    if (!open) setSelectedPost(null);
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="liquid-glass-elevated safe-area-top sticky top-0 z-20">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="depth-press">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-headline text-foreground">
            {profile?.username ? `@${profile.username}` : "Profile"}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl">
        {loading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !profile ? (
          <p className="py-16 text-center text-sm text-muted-foreground">This profile is unavailable.</p>
        ) : (
          <>
            <section className="p-5">
              <div className="flex items-center gap-5">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent p-0.5">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-background text-2xl font-bold text-primary">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (profile.display_name || profile.username || "U")[0].toUpperCase()
                    )}
                  </div>
                </div>
                <div className="grid flex-1 grid-cols-3 text-center">
                  <div><p className="text-lg font-bold text-foreground">{posts.length}</p><p className="text-caption text-muted-foreground">Posts</p></div>
                  <div><p className="text-lg font-bold text-foreground">{followers.toLocaleString()}</p><p className="text-caption text-muted-foreground">Followers</p></div>
                  <div><p className="text-lg font-bold text-foreground">{followingCount.toLocaleString()}</p><p className="text-caption text-muted-foreground">Following</p></div>
                </div>
              </div>
              <div className="mt-4">
                <h2 className="flex items-center gap-1 font-semibold text-foreground">
                  {profile.display_name || profile.username || "User"}
                  <VerifiedBadge isVerified={profile.is_verified} isOfficial={profile.is_official} />
                </h2>
                {profile.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
                {profile.bio && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{profile.bio}</p>}
              </div>
              {user && user.id !== userId && (
                <div className="mt-4 flex gap-2">
                  <div className="flex-1 [&>button]:w-full">
                    <FollowButton targetId={userId!} following={following} onChange={setFollowing} />
                  </div>
                  <button
                    onClick={() => navigate("/messages")}
                    className="depth-press flex-1 rounded-xl liquid-glass py-2 text-sm font-semibold text-foreground"
                  >
                    Message
                  </button>
                  {creatorPrice !== null && (
                    <button
                      onClick={() => void subscribe()}
                      disabled={subscribing || !!subscribedUntil}
                      className="depth-press flex-1 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-70"
                    >
                      {subscribedUntil
                        ? `Subscribed until ${new Date(subscribedUntil).toLocaleDateString()}`
                        : subscribing ? "Starting..." : `Subscribe · ${creatorPrice.toLocaleString()} KES/month`}
                    </button>
                  )}
                </div>
              )}
            </section>

            <div className="flex items-center justify-center border-y border-border py-3 text-foreground">
              <Grid3X3 className="h-5 w-5" />
            </div>
            {posts.length ? (
              <div className="grid grid-cols-3 gap-0.5 p-0.5">
                {posts.map((post, index) => (
                  <motion.button
                    key={post.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(index * 0.02, 0.3) }}
                    onClick={() => setSelectedPost(post)}
                    aria-label={`Open post${post.caption ? `: ${post.caption}` : ""}`}
                    className="relative aspect-square overflow-hidden bg-secondary"
                  >
                    {post.media_type === "video" ? (
                      <video src={post.media_url || undefined} muted preload="metadata" className="h-full w-full object-cover" />
                    ) : post.media_url ? (
                      <img src={post.media_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="line-clamp-5 p-2 text-left text-xs text-foreground">{post.caption}</span>
                    )}
                    {post.media_type === "video" && (
                      <span className="absolute right-2 top-2 text-[10px] font-semibold text-white drop-shadow">VIDEO</span>
                    )}
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-muted-foreground">No posts yet.</div>
            )}
          </>
        )}
      </main>

      <Dialog open={!!selectedPost} onOpenChange={closePost}>
        <DialogContent className="flex h-dvh w-screen max-w-none flex-col rounded-none border-0 bg-background p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">Post by {profile?.display_name || profile?.username}</DialogTitle>
          <div className="flex items-center justify-between p-4">
            <span className="font-semibold text-foreground">{profile?.display_name || profile?.username}</span>
            <button onClick={() => setSelectedPost(null)} aria-label="Close post" className="depth-press">
              <X className="h-5 w-5 text-foreground" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center bg-black/20">
            {selectedPost?.media_type === "video" ? (
              <video src={selectedPost.media_url || undefined} controls autoPlay playsInline className="max-h-full max-w-full object-contain" />
            ) : selectedPost?.media_url ? (
              <img src={selectedPost.media_url} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <p className="p-6 text-center text-foreground">{selectedPost?.caption}</p>
            )}
          </div>
          <div className="max-h-[42vh] space-y-3 overflow-y-auto p-4">
            {selectedPost?.music_title && (
              <PostMusicPlayer music={{
                title: selectedPost.music_title,
                artist: selectedPost.music_artist,
                art_url: selectedPost.music_art_url,
                stream_url: selectedPost.music_url,
                youtube_id: selectedPost.music_youtube_id,
              }} />
            )}
            {selectedPost?.caption && <p className="text-sm text-foreground">{selectedPost.caption}</p>}
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> {selectedViews.toLocaleString()} views
              <span className="mx-1">·</span>{(selectedPost?.likes_count ?? 0).toLocaleString()} likes
            </p>
            {selectedPost && <CommentsSection postId={selectedPost.id} onCountChange={() => {}} />}
          </div>
        </DialogContent>
      </Dialog>
      <GlassTabBar />
    </div>
  );
};

export default PublicProfilePage;
