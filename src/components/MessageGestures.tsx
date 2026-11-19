import { motion } from "framer-motion";
import { Reply, Copy, Pencil, Trash2, Forward, Star, X, EyeOff } from "lucide-react";
import { Fragment, useRef, type ReactNode } from "react";
import { openLink } from "@/utils/openLink";

const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi;

export const firstUrl = (text: string): string | null => {
  const m = text.match(URL_RE);
  return m ? m[0] : null;
};

/** Turns URLs inside a message into tappable links that open in the in-app browser. */
export const linkify = (text: string): ReactNode[] =>
  text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part}
        data-external
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openLink(part); }}
        className="break-all text-sky-300 underline decoration-sky-300/50 underline-offset-2"
      >
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );

/** Wraps a bubble: long-press opens actions, swipe left replies. */
export const SwipeRow = ({ children, onReply, onLongPress, className = "" }: {
  children: ReactNode; onReply: () => void; onLongPress: () => void; className?: string;
}) => {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const clear = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = null; };
  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: -90, right: 0 }}
      dragElastic={{ left: 0.25, right: 0 }}
      dragSnapToOrigin
      dragDirectionLock
      onDragStart={clear}
      onDragEnd={(_, info) => { if (info.offset.x < -55) { navigator.vibrate?.(15); onReply(); } }}
      onPointerDown={(e) => {
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        clear();
        timer.current = window.setTimeout(() => { fired.current = true; navigator.vibrate?.(25); onLongPress(); }, 450);
      }}
      onPointerMove={(e) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => { e.preventDefault(); clear(); onLongPress(); }}
      className={`relative select-none touch-pan-y ${className}`}
      style={{ WebkitTouchCallout: "none" }}
    >
      {children}
      <Reply className="pointer-events-none absolute right-[-30px] top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/70" />
    </motion.div>
  );
};

export const REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "🔥", "🙏"];

export const MessageActionSheet = ({ mine, canEdit, onClose, onReact, onReply, onCopy, onEdit, onDeleteEveryone, onDeleteMe, onForward, onStar, starred }: {
  mine: boolean; canEdit: boolean; onClose: () => void; onReact: (e: string) => void; onReply: () => void; onCopy: () => void;
  onEdit: () => void; onDeleteEveryone: () => void; onDeleteMe: () => void; onForward: () => void; onStar: () => void; starred: boolean;
}) => {
  const item = "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-white hover:bg-white/10 active:bg-white/15";
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-2 p-3 safe-area-bottom"
      >
        <div className="flex items-center justify-between rounded-full border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-2xl">
          {REACTIONS.map((e) => (
            <button key={e} onClick={() => onReact(e)} className="text-2xl transition-transform active:scale-125" aria-label={`React ${e}`}>{e}</button>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/60 p-1 backdrop-blur-2xl">
          <button className={item} onClick={onReply}><Reply className="h-4 w-4" />Reply</button>
          <button className={item} onClick={onCopy}><Copy className="h-4 w-4" />Copy</button>
          <button className={item} onClick={onForward}><Forward className="h-4 w-4" />Forward</button>
          <button className={item} onClick={onStar}><Star className={`h-4 w-4 ${starred ? "fill-amber-300 text-amber-300" : ""}`} />{starred ? "Unstar" : "Star"}</button>
          {canEdit && <button className={item} onClick={onEdit}><Pencil className="h-4 w-4" />Edit</button>}
          <button className={item} onClick={onDeleteMe}><EyeOff className="h-4 w-4" />Delete for me</button>
          {mine && <button className={`${item} text-red-400`} onClick={onDeleteEveryone}><Trash2 className="h-4 w-4" />Delete for everyone</button>}
        </div>
        <button onClick={onClose} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black/60 py-3 text-sm text-white/80 backdrop-blur-2xl"><X className="h-4 w-4" />Cancel</button>
      </motion.div>
    </div>
  );
};
