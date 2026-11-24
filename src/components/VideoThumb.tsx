import { Play } from "lucide-react";

const VideoThumb = ({ poster, className = "h-full w-full object-cover", showPlay = false }: { src?: string | null; poster?: string | null; className?: string; showPlay?: boolean }) => (
  <div className="relative h-full w-full overflow-hidden bg-muted">
    {poster ? (
      <img src={poster} alt="Video cover" loading="lazy" decoding="async" className={className} />
    ) : (
      <div aria-hidden="true" className={`${className} flex items-center justify-center bg-gradient-to-br from-muted via-background to-muted`}>
        <span className="flex size-10 items-center justify-center rounded-full bg-black/55 text-white">
          <Play className="size-4 fill-current" />
        </span>
      </div>
    )}
    {showPlay && poster && <span className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 backdrop-blur"><Play className="h-4 w-4 fill-white text-white" /></span></span>}
  </div>
);
export default VideoThumb;
