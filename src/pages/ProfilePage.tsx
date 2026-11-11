import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Settings, Grid3X3, Bookmark, Heart, Camera, Film, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import GlassTabBar from "@/components/GlassTabBar";
import VerifiedBadge from "@/components/VerifiedBadge";
import FollowListDialog, { FollowButton } from "@/components/FollowListDialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface Profile {
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_verified?: boolean | null;
  is_official?: boolean | null;
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [posts, setPosts] = useState<any[]>([]);
  const [tab, setTab] = useState<"posts" | "reels" | "saved" | "liked">(() =>
    new URLSearchParams(location.search).get("tab") === "reels" ? "reels" : "posts",
  );
  const avatarRef = useRef<HTMLInputElement>(null);
  const [myFollowing, setMyFollowing] = useState<Set<string>>(new Set());
  const [suggested, setSuggested] = useState<any[]>([]);
  const [listMode, setListMode] = useState<"followers" | "following" | null>(null);
  const [tabPosts, setTabPosts] = useState<any[]>([]);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);

  useEffect(() => {
    if (!user || tab === "posts") return;
    const load = async () => {
      if (tab === "reels") {
        const { data } = await supabase.from("reels").select("id, video_url, caption").eq("user_id", user.id).order("created_at", { ascending: false });
        setTabPosts((data || []).map((reel) => ({ ...reel, media_url: reel.video_url, media_type: "video" })));
        return;
      }
      let ids: string[] = [];
      if (tab === "saved") {
        try { ids = JSON.parse(localStorage.getItem("primegram:savedPosts") || "[]"); } catch { ids = []; }
      } else {
        const { data } = await supabase.from("post_likes").select("post_id").eq("user_id", user.id).order("created_at", { ascending: false });
        ids = (data || []).map(d => d.post_id);
      }
      if (ids.length === 0) { setTabPosts([]); return; }
      const { data: p } = await supabase.from("posts").select("*").in("id", ids.slice(0, 200));
      setTabPosts(p || []);
    };
    load();
  }, [user, tab]);
  const shown = tab === "posts" ? posts : tabPosts;

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, bio, avatar_url, is_verified, is_official")
        .eq("user_id", user.id)
        .single();
      if (data) setProfile(data);

      const { count: followers } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", user.id);
      setFollowersCount(followers || 0);

      const { data: fl } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
      const set = new Set((fl || []).map(r => r.following_id));
      setMyFollowing(set);
      setFollowingCount(set.size);
      const { data: sug } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").neq("user_id", user.id).limit(20);
      setSuggested((sug || []).filter(s => !set.has(s.user_id)));

      // Fetch user's actual posts
      const { data: userPosts } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", user.id)
        .neq("media_type", "story")
        .order("created_at", { ascending: false });
      setPosts(userPosts || []);
    };
    fetchData();
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("media").upload(path, file);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : prev);
      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload avatar");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sign in to view your profile</p>
          <button onClick={() => navigate("/auth")} className="depth-press px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold">Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="prime-profile min-h-screen pb-24">
      <div className="sticky top-0 z-30 border-b border-amber-200/20 bg-[#08090d]/85 backdrop-blur-xl safe-area-top">
        <div className="relative z-10 flex items-center gap-3 px-3 py-2.5">
          <button onClick={() => navigate(-1)} aria-label="Back" className="depth-press text-amber-100"><ArrowLeft className="h-4 w-4" /></button>
          <span className="flex flex-1 items-center gap-1 text-sm font-bold text-white">{profile?.username || "Profile"}<VerifiedBadge isVerified={profile?.is_verified} isOfficial={profile?.is_official} /></span>
          <button onClick={() => navigate("/settings")} aria-label="Settings" className="depth-press text-amber-200"><Settings className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="prime-profile-header px-3 pb-3 pt-4 md:px-5">
        <div className="mb-3 flex items-center gap-4">
          <div className="relative">
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            <button onClick={() => setAvatarOpen(true)} aria-label="View profile picture" className="depth-press relative">
              <div className="prime-profile-avatar flex h-16 w-16 items-center justify-center overflow-hidden rounded-full">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-primary relative z-10">
                    {(profile?.display_name || "U")[0].toUpperCase()}
                  </span>
                )}
              </div>
            </button>
            <button onClick={() => avatarRef.current?.click()} aria-label="Change profile picture" className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <Camera className="w-3 h-3 text-primary-foreground" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-around text-center">
            <div className="prime-profile-post-count flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center rounded-full"><p className="text-base font-bold text-white">{posts.length}</p><p className="text-[10px] text-white/65">Posts</p></div>
            <button onClick={() => setListMode("followers")} className="depth-press"><p className="text-base font-bold text-white">{followersCount}</p><p className="text-[10px] text-white/65">Followers</p></button>
            <button onClick={() => setListMode("following")} className="depth-press"><p className="text-base font-bold text-white">{myFollowing.size}</p><p className="text-[10px] text-white/65">Following</p></button>
          </div>
        </div>
        <p className="text-sm font-bold text-white">{profile?.display_name || "User"}<VerifiedBadge isVerified={profile?.is_verified} isOfficial={profile?.is_official} /></p>
        <p className="mt-1 text-xs text-white/60">{profile?.bio || "No bio yet"}</p>

        <div className="mt-3 flex gap-2">
          <button onClick={() => navigate("/settings")} className="prime-profile-action depth-press relative z-10 flex-1 rounded-xl py-2 text-xs font-semibold">
            Edit Profile
          </button>
          <button onClick={() => { const url = window.location.origin + "/profile"; navigator.share ? navigator.share({ url }).catch(() => {}) : (navigator.clipboard.writeText(url), toast.success("Link copied")); }} className="prime-profile-action depth-press relative z-10 flex-1 rounded-xl py-2 text-xs font-semibold">
            Share Profile
          </button>
        </div>

        {suggested.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-white/65">Suggested for you</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {suggested.map(s => (
                <div key={s.user_id} className="prime-suggested-card flex w-[88px] shrink-0 flex-col items-center gap-1 rounded-xl p-1.5">
                <button onClick={() => navigate(`/profile/${s.user_id}`)} aria-label={`Open ${s.username || "user"}'s profile`} className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-secondary font-bold">
                    {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover" /> : (s.username || "U")[0].toUpperCase()}
                </button>
                <button onClick={() => navigate(`/profile/${s.user_id}`)} className="w-full truncate text-center text-[10px] text-white/85">{s.username || s.display_name}</button>
                  <FollowButton targetId={s.user_id} following={myFollowing.has(s.user_id)} onChange={v => {
                    const n = new Set(myFollowing); v ? n.add(s.user_id) : n.delete(s.user_id); setMyFollowing(n);
                  }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {listMode && <FollowListDialog open onOpenChange={o => !o && setListMode(null)} mode={listMode} userId={user.id} myFollowing={myFollowing} setMyFollowing={setMyFollowing} />}

      <div className="prime-profile-tabs flex border-y border-white/10 bg-black/20">
        {[
          { id: "posts" as const, icon: Grid3X3 },
          { id: "reels" as const, icon: Film },
          { id: "saved" as const, icon: Bookmark },
          { id: "liked" as const, icon: Heart },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-label={t.id[0].toUpperCase() + t.id.slice(1)}
            className={`relative flex flex-1 justify-center py-2.5 ${tab === t.id ? "text-amber-200" : "text-white/45"}`}
          >
            <t.icon className="w-5 h-5" />
            {tab === t.id && (
              <motion.div layoutId="profile-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-200 to-transparent shadow-[0_0_8px_rgba(234,179,8,.6)]" />
            )}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-16 h-16 rounded-3xl liquid-glass flex items-center justify-center mb-4">
            <Camera className="w-8 h-8 text-muted-foreground relative z-10" />
          </div>
          <p className="text-foreground font-semibold mb-1">{tab === "posts" ? "No posts yet" : tab === "reels" ? "No reels yet" : tab === "saved" ? "No saved posts" : "No liked posts"}</p>
          <p className="text-sm text-muted-foreground mb-4">{tab === "posts" ? "Share your first photo or video" : tab === "reels" ? "Reels you post will appear here" : tab === "saved" ? "Tap the bookmark on any post to save it" : "Posts you like will show here"}</p>
          {tab === "posts" && (
          <button onClick={() => navigate("/create")} className="depth-press px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold">
            Create Post
          </button>
          )}
        </div>
      ) : (
        <div className="prime-profile-grid grid grid-cols-3 gap-0.5 p-0.5">
          {shown.map((post, i) => (
            <motion.button type="button" key={post.id} onClick={() => setSelectedMedia(post)} aria-label={`View ${post.media_type === "video" ? "reel" : "post"}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="aspect-square relative overflow-hidden">
              {post.media_type === "video" ? (
                <video src={post.media_url} className="w-full h-full object-cover" muted preload="metadata" />
              ) : (
                <img src={post.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              )}
              {post.media_type === "video" && <Film className="absolute right-2 top-2 h-4 w-4 text-white drop-shadow" />}
            </motion.button>
          ))}
        </div>
      )}
      <Dialog open={avatarOpen} onOpenChange={setAvatarOpen}>
        <DialogContent className="flex h-dvh w-screen max-w-none items-center justify-center rounded-none border-0 bg-black p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">Profile picture</DialogTitle>
          <button onClick={() => setAvatarOpen(false)} aria-label="Close profile picture" className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white">
            <X className="h-5 w-5" />
          </button>
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile picture" className="max-h-full max-w-full object-contain" /> : <p className="text-white">No profile picture</p>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!selectedMedia} onOpenChange={open => { if (!open) setSelectedMedia(null); }}>
        <DialogContent className="flex h-dvh w-screen max-w-none flex-col rounded-none border-0 bg-background p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">{tab === "reels" ? "Reel" : "Post"}</DialogTitle>
          <div className="flex items-center justify-end p-3">
            <button onClick={() => setSelectedMedia(null)} aria-label="Close media" className="rounded-full p-2 text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center bg-black/20">
            {selectedMedia?.media_type === "video" ? (
              <video src={selectedMedia.media_url} controls autoPlay playsInline className="max-h-full max-w-full object-contain" />
            ) : selectedMedia?.media_url ? (
              <img src={selectedMedia.media_url} alt="" className="max-h-full max-w-full object-contain" />
            ) : <p className="p-6 text-center text-foreground">{selectedMedia?.caption}</p>}
          </div>
          {selectedMedia?.caption && <p className="p-4 text-sm text-foreground">{selectedMedia.caption}</p>}
        </DialogContent>
      </Dialog>
      <GlassTabBar goldStyle />
    </div>
  );
};

export default ProfilePage;
