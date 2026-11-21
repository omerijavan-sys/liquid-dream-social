import { Play } from "lucide-react";

/** Shows a real video frame instead of stored generic play-button artwork. */
const VideoThumb = ({ src, poster, className = "h-full w-full object-cover", showPlay = false }: { src?: string | null; poster?: string | null; className?: string; showPlay?: boolean }) => (
  <>
    {src ? (
      <video
        src={`${src}#t=1.2`}
        muted
        playsInline
        preload="auto"
        className={className}
        aria-hidden="true"
        poster={undefined}
      />
    ) : poster ? <img src={poster} alt="Video cover" loading="lazy" className={className} /> : null}
    {showPlay && <span className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 backdrop-blur"><Play className="h-4 w-4 fill-white text-white" /></span></span>}
  </>
);
export default VideoThumb;
