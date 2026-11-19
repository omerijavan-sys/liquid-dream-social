import { BadgeCheck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  isVerified?: boolean | null;
  isOfficial?: boolean | null;
  className?: string;
}

/** Blue verified tick, or the tri-colour official Primegram shield. */
const VerifiedBadge = ({ isVerified, isOfficial, className }: VerifiedBadgeProps) => {
  if (isOfficial) {
    return (
      <span
        title="Official Primegram account"
        className={cn("inline-flex items-center align-middle", className)}
      >
        <ShieldCheck className="h-4 w-4 text-[#F5B800] drop-shadow-[0_0_6px_rgba(245,184,0,0.8)]" />
      </span>
    );
  }
  if (!isVerified) return null;
  return (
    <span title="Verified" className={cn("inline-flex items-center align-middle", className)}>
      <BadgeCheck className="h-4 w-4 text-[#1D9BF0]" />
    </span>
  );
};

export default VerifiedBadge;
