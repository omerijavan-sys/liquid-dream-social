import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import type { CSSProperties } from "react";

export default function ProfileAvatarPreview({
  open,
  onOpenChange,
  src,
  name,
  glowStyle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src?: string | null;
  name?: string | null;
  glowStyle?: CSSProperties;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh w-screen max-w-none items-center justify-center overflow-hidden rounded-none border-0 bg-black/95 p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">{name ? `${name}'s profile picture` : "Profile picture"}</DialogTitle>
        <button onClick={() => onOpenChange(false)} aria-label="Close profile picture" className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white ring-1 ring-white/20 backdrop-blur">
          <X className="h-5 w-5" />
        </button>
        {src ? (
          <div style={glowStyle} className="relative h-[min(76vw,420px)] w-[min(76vw,420px)] rounded-full p-1 shadow-[0_0_24px_rgba(217,70,239,0.65),0_0_64px_rgba(56,189,248,0.35)] ring-2 ring-fuchsia-300/70">
            <div className="h-full w-full rounded-full bg-gradient-to-br from-fuchsia-400 via-violet-400 to-cyan-300 p-1">
              <img src={src} alt={name ? `${name}'s profile picture` : "Profile picture"} className="h-full w-full rounded-full border-2 border-black/70 object-cover" />
            </div>
          </div>
        ) : (
          <div style={glowStyle} className="flex h-64 w-64 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-400 text-7xl font-bold text-white shadow-[0_0_32px_rgba(217,70,239,0.7)] ring-4 ring-white/70">
            {(name || "U")[0].toUpperCase()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
