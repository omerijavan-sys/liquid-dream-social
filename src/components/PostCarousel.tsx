import { INLINE_VIDEO_ATTRS } from "@/utils/media";
import { useRef, useState } from "react";
import { BLANK_POSTER } from "@/lib/blankPoster";

export type CarouselItem = { url: string; type: string; thumb?: string | null };

/** Several photos/videos in one post: swipe sideways to move to the next one. */
const PostCarousel = ({ items, alt }: { items: CarouselItem[]; alt: string }) => {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative w-full">
      <div ref={ref} className="flex w-full snap-x snap-mandatory overflow-x-auto scrollbar-none" onScroll={(e) => { const el = e.currentTarget; setI(Math.round(el.scrollLeft / el.clientWidth)); }}>
        {items.map((m, n) => (
          <div key={n} className="flex w-full shrink-0 snap-center items-center justify-center bg-background/40">
            {m.type === "video"
              ? <video src={n === i ? m.url : undefined} poster={m.thumb || BLANK_POSTER} controls {...INLINE_VIDEO_ATTRS} muted loop preload="none" className="h-auto max-h-[75vh] w-full object-contain" />
              : <img src={m.url} alt={`${alt} (${n + 1} of ${items.length})`} loading={n === 0 ? "eager" : "lazy"} decoding="async" className="h-auto max-h-[75vh] w-full object-contain" />}
          </div>
        ))}
      </div>
      <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">{i + 1}/{items.length}</span>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {items.map((_, n) => <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-4 bg-primary" : "w-1.5 bg-white/60"}`} />)}
      </div>
    </div>
  );
};
export default PostCarousel;
