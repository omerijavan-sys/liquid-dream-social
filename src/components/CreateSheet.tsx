import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Film, ImagePlus, Loader2, Music2, Radio, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { runInBackground } from "@/utils/backgroundUpload";
import { uploadVideoCover } from "@/utils/videoThumb";
import MusicPicker, { type PickedTrack } from "@/components/MusicPicker";
import MusicClipPicker from "@/components/MusicClipPicker";
import FilterStrip from "@/components/FilterStrip";
import { bakeImageFilter, bakeVideoFilter } from "@/utils/bakeVideo";

/** The "what do you want to create?" menu that opens from the + button. */
const CreateSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [track, setTrack] = useState<PickedTrack | null>(null);
  const [clip, setClip] = useState({ start: 0, len: 15 });
  const [pickMusic, setPickMusic] = useState(false);
  const [filter, setFilter] = useState("none");

  const go = (path: string) => { onClose(); navigate(path); };

  const onStoryPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setStoryFile(f); setPreview(URL.createObjectURL(f)); setFilter("none"); setTrack(null); setClip({ start: 0, len: 15 });
  };
  const closeStory = () => { if (preview) URL.revokeObjectURL(preview); setStoryFile(null); setPreview(null); setTrack(null); };

  const postStory = () => {
    if (!storyFile || !user) return;
    let file = storyFile; const uid = user.id, t = track, c = clip, fl = filter;
    const isVideo = file.type.startsWith("video/");
    closeStory(); onClose();
    navigate("/");
    runInBackground("Posting your story", async (progress) => {
      if (fl !== "none") {
        progress("Applying filter…");
        file = isVideo ? await bakeVideoFilter(file, fl, (p) => progress(`Applying filter… ${p}%`)) : await bakeImageFilter(file, fl);
      }
      let thumbnail_url: string | null = null;
      if (isVideo) { progress("Making cover…"); thumbnail_url = await uploadVideoCover(uid, file); }
      progress("Uploading story…");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${uid}/story_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      const { error } = await supabase.from("posts").insert({
        user_id: uid, media_url: publicUrl, media_type: "story", caption: "Story", thumbnail_url,
        music_title: t?.title ?? null, music_artist: t?.artist ?? null, music_art_url: t?.artUrl ?? null,
        music_url: t?.streamUrl ?? null, music_youtube_id: t?.youtubeId ?? null,
        ...(t ? { music_start: c.start, music_len: c.len } : {}),
      } as never);
      if (error) throw error;
    }, () => { window.dispatchEvent(new CustomEvent("prime:stories-changed")); });
  };

  const Option = ({ icon: Icon, title, sub, onClick, tone }: { icon: typeof Film; title: string; sub: string; onClick: () => void; tone: string }) => (
    <button onClick={onClick} className="depth-press flex w-full items-center gap-4 rounded-2xl liquid-glass-subtle p-4 text-left">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-6 w-6" /></span>
      <span className="min-w-0"><span className="block text-sm font-semibold text-foreground">{title}</span><span className="block text-xs text-muted-foreground">{sub}</span></span>
    </button>
  );

  return createPortal(
    <>
      <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onStoryPicked} />
      <AnimatePresence>
        {open && !storyFile && (
          <motion.div className="fixed inset-0 z-[90] flex items-end bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 420, damping: 38 }} onClick={(e) => e.stopPropagation()} className="liquid-glass-elevated w-full space-y-2.5 rounded-t-[2rem] p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-foreground/20" />
              <p className="px-1 pb-1 text-sm font-semibold text-foreground">Create</p>
              <Option icon={ImagePlus} title="Post" sub="Photo, video or text for your feed" tone="bg-sky-400/15 text-sky-300" onClick={() => go("/create")} />
              <Option icon={Film} title="Reel" sub="Short vertical video" tone="bg-fuchsia-400/15 text-fuchsia-300" onClick={() => go("/reels?new=1")} />
              <Option icon={Sparkles} title="Story" sub="Disappears after 24 hours · add music" tone="bg-amber-400/15 text-amber-300" onClick={() => fileRef.current?.click()} />
              <Option icon={Radio} title="Live" sub="Broadcast from your camera right now" tone="bg-red-500/15 text-red-400" onClick={() => go("/live/new")} />
            </motion.div>
          </motion.div>
        )}
        {storyFile && preview && (
          <motion.div className="fixed inset-0 z-[95] flex flex-col bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="relative min-h-0 flex-1">
              {storyFile.type.startsWith("video/") ? <video src={preview} style={{ filter }} className="h-full w-full object-contain" autoPlay loop muted playsInline /> : <img src={preview} alt="" style={{ filter }} className="h-full w-full object-contain" />}
              <button onClick={closeStory} aria-label="Cancel" className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <FilterStrip value={filter} onChange={setFilter} thumb={storyFile.type.startsWith("image/") ? preview : null} />
              <button onClick={() => setPickMusic(true)} className="flex w-full items-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm font-medium text-foreground">
                <Music2 className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1 truncate text-left">{track ? `${track.title} · ${track.artist}` : "Add music to your story"}</span>
                {track && <span onClick={(e) => { e.stopPropagation(); setTrack(null); }} className="text-xs text-muted-foreground">Remove</span>}
              </button>
              {track && <MusicClipPicker track={track} start={clip.start} len={clip.len} onChange={(start, len) => setClip({ start, len })} />}
              <button onClick={postStory} className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground">Share to your story</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <MusicPicker open={pickMusic} onClose={() => setPickMusic(false)} onPick={(t) => { setTrack(t); setPickMusic(false); }} />
    </>,
    document.body,
  );
};
export default CreateSheet;
