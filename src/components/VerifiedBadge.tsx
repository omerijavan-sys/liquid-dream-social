import { BadgeCheck, Gem, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  isVerified?: boolean | null;
  isOfficial?: boolean | null;
  /** Tier badge an admin granted: blue | gold | black | all_access. Colours are fixed and never follow the app theme. */
  badge?: string | null;
  className?: string;
}

/** Blue tick, official shield, or a tier badge. Fixed colours — they do not change with the theme. */
const VerifiedBadge = ({ isVerified, isOfficial, badge, className }: VerifiedBadgeProps) => {
  const wrap = (title: string, node: React.ReactNode) => (
    <span title={title} className={cn("inline-flex items-center align-middle", className)}>{node}</span>
  );
  if (isOfficial) return wrap("Official Primegram account", <ShieldCheck className="h-4 w-4 text-[#F5B800] drop-shadow-[0_0_6px_rgba(245,184,0,0.8)]" />);
  if (badge === "gold") return wrap("Prime Gold", <BadgeCheck className="h-4 w-4 text-[#F5B800] drop-shadow-[0_0_6px_rgba(245,184,0,0.8)]" />);
  if (badge === "black") return wrap("Founder Black", <BadgeCheck className="h-4 w-4 text-black fill-white/90 drop-shadow-[0_0_4px_rgba(255,255,255,0.7)]" />);
  if (badge === "all_access") return wrap("Prime All Access", <Gem className="h-4 w-4 text-[#F5B800] drop-shadow-[0_0_6px_rgba(236,72,153,0.8)]" />);
  if (badge === "blue" || isVerified) return wrap(badge === "blue" ? "Prime Blue" : "Verified", <BadgeCheck className="h-4 w-4 text-[#1D9BF0]" />);
  return null;
};

export default VerifiedBadge;
