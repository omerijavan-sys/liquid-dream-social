import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Film, ImagePlus, Radio, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MediaEditor, { type EditorMode } from "@/components/MediaEditor";

/** The "what do you want to create?" menu that opens from the + button. */
const CreateSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const wanted = useRef<EditorMode>("post");
  const [editing, setEditing] = useState<{ files: File[]; mode: EditorMode } | null>(null);

  const go = (path: string) => { onClose(); navigate(path); };
  /** Opens the gallery (inside the app on Android) so one or several photos/videos can be chosen, then the editor. */
  const pick = (mode: EditorMode) => { wanted.current = mode; fileRef.current?.click(); };
  const onPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); e.target.value = "";
    if (!files.length) return;
    onClose();
    setEditing({ files, mode: wanted.current });
  };

  const Option = ({ icon: Icon, title, sub, onClick, tone }: { icon: typeof Film; title: string; sub: string; onClick: () => void; tone: string }) => (
    <button onClick={onClick} className="depth-press flex w-full items-center gap-4 rounded-2xl liquid-glass-subtle p-4 text-left">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-6 w-6" /></span>
      <span className="min-w-0"><span className="block text-sm font-semibold text-foreground">{title}</span><span className="block text-xs text-muted-foreground">{sub}</span></span>
    </button>
  );

  return createPortal(
    <>
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={onPicked} />
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[90] flex items-end bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 420, damping: 38 }} onClick={(e) => e.stopPropagation()} className="liquid-glass-elevated max-h-[88vh] w-full space-y-2.5 overflow-y-auto rounded-t-[2rem] p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-foreground/20" />
              <p className="px-1 pb-1 text-sm font-semibold text-foreground">Create</p>
              <Option icon={Camera} title="Use camera" sub="Shoot with effects, filters and music" tone="bg-emerald-400/15 text-emerald-300" onClick={() => go("/create?camera=1")} />
              <Option icon={ImagePlus} title="Post" sub="Pick photos or videos — they stay separate, swipe to see each" tone="bg-sky-400/15 text-sky-300" onClick={() => pick("post")} />
              <Option icon={Film} title="Reel" sub="Pick clips — they are joined into one reel" tone="bg-fuchsia-400/15 text-fuchsia-300" onClick={() => pick("reel")} />
              <Option icon={Sparkles} title="Story" sub="Disappears after 24 hours · add music" tone="bg-amber-400/15 text-amber-300" onClick={() => pick("story")} />
              <Option icon={Radio} title="Live" sub="Broadcast from your camera right now" tone="bg-red-500/15 text-red-400" onClick={() => go("/live/new")} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {editing && <MediaEditor files={editing.files} mode={editing.mode} onClose={() => setEditing(null)} />}
    </>,
    document.body,
  );
};
export default CreateSheet;
