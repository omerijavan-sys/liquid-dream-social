import { useRef } from "react";
import { ImagePlus } from "lucide-react";

/** Cover photo behind a profile header. It fades into the page so the stats and Follow / Message buttons sit on top of it. */
const ProfileCover = ({ url, onPick, height = 230 }: { url?: string | null; onPick?: (f: File) => void; height?: number }) => {
  const ref = useRef<HTMLInputElement>(null);
  const fade = "linear-gradient(to bottom, #000 0%, #000 35%, rgba(0,0,0,.55) 70%, transparent 100%)";
  return (
    <>
      {url && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden" style={{ height, WebkitMaskImage: fade, maskImage: fade }}>
          <img src={url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-background/40" />
        </div>
      )}
      {onPick && (
        <>
          <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />
          <button onClick={() => ref.current?.click()} aria-label={url ? "Change cover photo" : "Add cover photo"} className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md">
            <ImagePlus className="h-3.5 w-3.5" />{url ? "Change cover" : "Add cover"}
          </button>
        </>
      )}
    </>
  );
};
export default ProfileCover;
