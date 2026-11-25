import { useState } from "react";
import { HandCoins } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import TipAndSubscribeModal from "@/components/TipAndSubscribeModal";

const CreatorTipButton = ({ creatorId, creatorName, compact = false, trackId }: { creatorId: string; creatorName: string; compact?: boolean; trackId?: string }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={user?.id === creatorId}
        aria-label={`Tip ${creatorName}`}
        title={`Tip ${creatorName}`}
        onClick={(event) => {
          event.stopPropagation();
          if (!user) { toast.error("Sign in to tip creators"); return; }
          setOpen(true);
        }}
        className={compact
          ? "reel-glass flex h-11 w-11 items-center justify-center rounded-full text-white disabled:opacity-40"
          : "depth-press flex items-center gap-1.5 text-muted-foreground disabled:opacity-40"}
      >
        <HandCoins className="h-5 w-5" />
        {!compact && <span className="text-xs">Tip</span>}
      </button>
      <TipAndSubscribeModal open={open} onOpenChange={setOpen} mode="tip" creatorId={creatorId} creatorName={creatorName} trackId={trackId} />
    </>
  );
};

export default CreatorTipButton;
