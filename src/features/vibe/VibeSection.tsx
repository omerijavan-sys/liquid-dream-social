import { useState } from "react";
import { CalendarDays, Palette, Share2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { glass } from "../shared/ui";
import InviteProgress from "../referrals/InviteProgress";
import AestheticsEditor from "./AestheticsEditor";
import ShareVibeCard from "./ShareVibeCard";
import WeeklyWrapped from "./WeeklyWrapped";
import { useAesthetics } from "./aesthetics";

/** Profile-page block: customise vibe, share the Vibe Card, and track invite perks. */
const VibeSection = () => {
  const { user } = useAuth();
  const { a, save } = useAesthetics(user?.id);
  const [edit, setEdit] = useState(false);
  const [share, setShare] = useState(false);
  const [wrapped, setWrapped] = useState(false);
  if (!user) return null;
  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setEdit(true)} className={`${glass} flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white`} style={{ boxShadow: `0 0 16px ${a.accent}44` }}><Palette className="h-4 w-4" style={{ color: a.accent }} />Customize vibe</button>
        <button onClick={() => setShare(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-2.5 text-xs font-bold text-white"><Share2 className="h-4 w-4" />Share Vibe Card</button>
      </div>
      <button onClick={() => setWrapped(true)} className={`${glass} flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white`}><CalendarDays className="h-4 w-4 text-pink-300" />My week on Primegram</button>
      <InviteProgress />
      {edit && <AestheticsEditor value={a} onSave={save} onClose={() => setEdit(false)} />}
      {wrapped && <WeeklyWrapped onClose={() => setWrapped(false)} />}
      {share && <ShareVibeCard a={a} onClose={() => setShare(false)} />}
    </div>
  );
};
export default VibeSection;
