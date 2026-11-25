import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shaped like a feed post, so the page doesn't jump when real posts arrive. */
const PostSkeleton = () => (
  <div className="mb-5 overflow-hidden rounded-3xl border border-white/10 bg-card/40 p-3" aria-hidden="true">
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-2.5 w-16" /></div>
    </div>
    <Skeleton className="mt-3 aspect-[4/5] w-full rounded-2xl" />
    <div className="mt-3 flex gap-3"><Skeleton className="h-6 w-6 rounded-full" /><Skeleton className="h-6 w-6 rounded-full" /><Skeleton className="h-6 w-6 rounded-full" /></div>
    <Skeleton className="mt-3 h-3 w-3/4" />
  </div>
);

export const FeedSkeleton = () => (<div role="status" aria-label="Loading posts"><PostSkeleton /><PostSkeleton /></div>);
export default PostSkeleton;
