import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { INLINE_VIDEO_ATTRS } from "@/utils/media";
import { useMute } from "@/contexts/MuteContext";
import { Trash2, Volume2, VolumeX, X } from "lucide-react";

type ProfileReel = {
  id: string;
  video_url: string;
  caption?: string | null;
  thumbnail_url?: string | null;
};

export default function ProfileReelsViewer({
  reels,
  initialReelId,
  username,
  open,
  onClose,
  onDelete,
}: {
  onDelete?: (id: string) => void;
  reels: ProfileReel[];
  initialReelId: string | null;
  open: boolean;
  username?: string | null;
  onClose: () => void;
}) {
  const { muted, toggleMuted } = useMute();
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const startIndex = Math.max(0, reels.findIndex((reel) => reel.id === initialReelId));

  useEffect(() => {
    if (!open || !reels.length) return;
    setActiveIndex(startIndex);
    listRef.current?.children[startIndex]?.scrollIntoView({ block: "start" });
  }, [open, startIndex, reels.length]);

  return (
    <Dialog open={open && reels.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-dvh w-screen max-w-none overflow-hidden rounded-none border-0 bg-black p-0 text-white [&>button]:hidden">
        <DialogTitle className="sr-only">{username ? `${username}'s reels` : "Profile reels"}</DialogTitle>
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <span className="rounded-full bg-black/45 px-3 py-1 text-sm font-semibold">{username || "Reels"}</span>
          <div className="flex gap-2">
            {onDelete && reels[activeIndex] && <button onClick={() => onDelete(reels[activeIndex].id)} aria-label="Delete reel" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-red-300"><Trash2 className="h-4 w-4" /></button>}
            <button onClick={toggleMuted} aria-label={muted ? "Unmute reels" : "Mute reels"} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose} aria-label="Close reels" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div
          ref={listRef}
          onScroll={(event) => {
            const height = event.currentTarget.clientHeight;
            if (height) setActiveIndex(Math.round(event.currentTarget.scrollTop / height));
          }}
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {reels.map((reel, index) => (
            <section key={reel.id} className="relative flex h-dvh snap-start items-center justify-center bg-black">
              <video
                src={reel.video_url}
                poster={reel.thumbnail_url || undefined}
                autoPlay={index === activeIndex}
                loop
                playsInline
                {...INLINE_VIDEO_ATTRS}
                muted={muted || index !== activeIndex}
                preload={index === activeIndex ? "auto" : "metadata"}
                className="h-full w-full object-contain"
              />
              {reel.caption && <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16 text-sm">{reel.caption}</p>}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
