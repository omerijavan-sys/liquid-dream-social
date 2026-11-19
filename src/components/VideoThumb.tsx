import { Play } from "lucide-react";

/**
 * Shows a still cover for a video instead of an empty player. Uses the stored
 * cover when there is one; older videos fall back to the frame at 0.1s so
 * Android WebViews paint a real picture instead of a grey play button.
 */
const VideoThumb = ({ src, poster, className = "h-full w-full object-cover", showPlay = false }: { src?: string | null; poster?: string | null; className?: string; showPlay?: boolean }) => (
  <>
    {poster
      ? <img src={poster} alt="" loading="lazy" className={className} />
      : src ? <video src={`${src}#t=0.1`} muted playsInline preload="metadata" className={className} /> : null}
    {showPlay && <span className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 backdrop-blur"><Play className="h-4 w-4 fill-white text-white" /></span></span>}
  </>
);
export default VideoThumb;
