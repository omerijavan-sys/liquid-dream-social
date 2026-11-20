import { useCallback, useEffect, useRef, useState } from "react";
import { Check, FolderOpen, Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";
import { Gallery, galleryAvailable, galleryItemToFile, type GalleryItem } from "@/services/Gallery";

type Filter = "all" | "image" | "video";
const PAGE = 60;

/**
 * Android app only. Intercepts every photo/video file input in the app and shows the phone's gallery inside Primegram
 * instead of opening the system file browser. Falls back to the normal picker if the gallery can't be read.
 */
const NativeMediaPicker = () => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [sel, setSel] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const target = useRef<HTMLInputElement | null>(null);
  const bypass = useRef(false);
  const multiple = !!target.current?.multiple;
  const lockType: Filter | null = (() => {
    const a = target.current?.accept ?? "";
    if (/video/.test(a) && !/image/.test(a)) return "video";
    if (/image/.test(a) && !/video/.test(a)) return "image";
    return null;
  })();

  const load = useCallback(async (f: Filter, offset: number) => {
    setLoading(true);
    try {
      const r = await Gallery.list({ type: f, limit: PAGE, offset });
      setItems(prev => offset === 0 ? r.items : [...prev, ...r.items]);
      setMore(r.items.length === PAGE);
    } catch { toast.error("Couldn't read your gallery."); }
    finally { setLoading(false); }
  }, []);

  const useSystemPicker = useCallback(() => {
    const el = target.current; setOpen(false);
    if (el) { bypass.current = true; el.click(); setTimeout(() => { bypass.current = false; }, 500); }
  }, []);

  useEffect(() => {
    if (!galleryAvailable()) return;
    const onClick = async (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!(el instanceof HTMLInputElement) || el.type !== "file" || bypass.current) return;
      const accept = el.accept || "";
      if (!/image|video/.test(accept) || /audio|pdf|application|text/.test(accept)) return; // only photo/video pickers
      e.preventDefault(); e.stopPropagation();
      target.current = el;
      try {
        const p = await Gallery.ensurePermission();
        if (!p.granted) { toast.error("Allow photo access to pick from your gallery."); bypass.current = true; el.click(); setTimeout(() => { bypass.current = false; }, 500); return; }
      } catch { bypass.current = true; el.click(); setTimeout(() => { bypass.current = false; }, 500); return; }
      const f: Filter = /video/.test(accept) && !/image/.test(accept) ? "video" : /image/.test(accept) && !/video/.test(accept) ? "image" : "all";
      setFilter(f); setSel([]); setItems([]); setMore(true); setOpen(true); void load(f, 0);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const b = (e: Event) => { const d = (e as CustomEvent).detail; if (d && !d.handled) { d.handled = true; setOpen(false); } };
    window.addEventListener("prime:back", b);
    return () => window.removeEventListener("prime:back", b);
  }, [open]);

  const toggle = (it: GalleryItem) => {
    if (!multiple) { setSel([it]); return; }
    setSel(s => s.some(x => x.uri === it.uri) ? s.filter(x => x.uri !== it.uri) : [...s, it].slice(0, 10));
  };

  const done = async () => {
    const el = target.current; if (!el || !sel.length) return;
    setBusy(true);
    try {
      const files = await Promise.all(sel.map(galleryItemToFile));
      const dt = new DataTransfer(); files.forEach(f => dt.items.add(f));
      el.files = dt.files;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      setOpen(false);
    } catch { toast.error("Couldn't open that file. Try again."); }
    finally { setBusy(false); }
  };

  if (!open) return null;
  const tabs: [Filter, string][] = [["all", "All"], ["image", "Photos"], ["video", "Videos"]];
  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-background">
      <div className="safe-area-top flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <button aria-label="Close" onClick={() => setOpen(false)} className="rounded-full p-2"><X className="h-5 w-5" /></button>
        <p className="flex-1 text-base font-semibold">Choose {lockType === "video" ? "a video" : lockType === "image" ? "a photo" : "photo or video"}</p>
        <button onClick={useSystemPicker} className="flex items-center gap-1 rounded-full bg-foreground/10 px-3 py-1.5 text-xs"><FolderOpen className="h-3.5 w-3.5" />Files</button>
      </div>
      {!lockType && (
        <div className="flex gap-2 px-3 py-2">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => { setFilter(k); setItems([]); void load(k, 0); }} className={`rounded-full px-4 py-1.5 text-sm ${filter === k ? "bg-primary text-primary-foreground" : "bg-foreground/10"}`}>{l}</button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-0.5">
          {items.map(it => {
            const idx = sel.findIndex(x => x.uri === it.uri);
            return (
              <button key={it.uri} onClick={() => toggle(it)} className="relative aspect-square overflow-hidden bg-foreground/10">
                {it.thumb ? <img src={it.thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">{it.type}</span>}
                {it.type === "video" && <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/60 px-1 text-[10px] text-white"><Play className="h-2.5 w-2.5 fill-current" />video</span>}
                {idx >= 0 && <span className="absolute inset-0 border-4 border-primary bg-primary/20" />}
                {idx >= 0 && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{multiple ? idx + 1 : <Check className="h-3 w-3" />}</span>}
              </button>
            );
          })}
        </div>
        {loading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {!loading && more && items.length > 0 && <button onClick={() => void load(filter, items.length)} className="mx-auto my-4 block rounded-full bg-foreground/10 px-5 py-2 text-sm">Load more</button>}
        {!loading && items.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">No photos or videos found.</p>}
      </div>
      <div className="safe-area-bottom border-t border-white/10 p-3">
        <button disabled={!sel.length || busy} onClick={() => void done()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{sel.length ? (multiple ? `Use ${sel.length} selected` : "Use this") : "Select something"}
        </button>
      </div>
    </div>
  );
};
export default NativeMediaPicker;
