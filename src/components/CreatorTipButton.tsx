import { useState } from "react";
import { HandCoins } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TIP_AMOUNTS } from "@/lib/extreme";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const CreatorTipButton = ({ creatorId, creatorName, compact = false }: { creatorId: string; creatorName: string; compact?: boolean }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const tip = async (amount: number) => {
    if (!user) {
      toast.error("Sign in to tip creators");
      return;
    }
    if (user.id === creatorId) {
      toast.error("You can't tip your own content");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.rpc("prime_tip", { _recipient: creatorId, _amount: amount });
      if (error) throw error;
      toast.success(`${Number(data).toLocaleString()} KES sent to ${creatorName}`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send tip");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={user?.id === creatorId}
          aria-label={`Tip ${creatorName}`}
          title={`Tip ${creatorName}`}
          onClick={(event) => event.stopPropagation()}
          className={compact
            ? "flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur disabled:opacity-40"
            : "depth-press flex items-center gap-1.5 text-muted-foreground disabled:opacity-40"}
        >
          <HandCoins className={compact ? "h-5 w-5" : "h-5 w-5"} />
          {!compact && <span className="text-xs">Tip</span>}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Tip {creatorName}</DialogTitle>
        <p className="text-sm text-muted-foreground">Choose an amount to send from your Primegram wallet.</p>
        <div className="grid grid-cols-3 gap-2">
          {TIP_AMOUNTS.map((amount) => (
            <Button key={amount} variant="secondary" disabled={sending} onClick={() => void tip(amount)}>
              {amount.toLocaleString()} KES
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Creators receive 95% of the tip; Primegram keeps a 5% fee.</p>
      </DialogContent>
    </Dialog>
  );
};

export default CreatorTipButton;
