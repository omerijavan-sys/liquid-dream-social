import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Film, GalleryHorizontalEnd, MapPin, Loader2, Music2, Scissors, SlidersHorizontal, Sparkles, Trash2, Wand2, X, Type, LayoutTemplate, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { runInBackground } from "@/utils/backgroundUpload";
import { composeVideo, detectKeepRanges, type Seg } from "@/utils/compose";
import { bakeImageFilter } from "@/utils/bakeVideo";
import { uploadVideoCover } from "@/utils/videoThumb";
import FilterStrip from "@/components/FilterStrip";
import MusicPicker, { type PickedTrack } from "@/components/MusicPicker";
import MusicClipPicker from "@/components/MusicClipPicker";
import { REEL_TEMPLATES, type ReelTemplate } from "@/utils/reelTemplates";

export type EditorMode = "post" | "reel" | "story";
type Item = {
  id: string; file: File; url: string; kind: "image" | "video"; duration: number;
  filter: string; bright: number; contrast: number; sat: number;
  trim: [number, number]; cut: [number, number][] | null; cutOn: boolean; secs: number;
};
type Tab = "templates" | "filters" | "adjust" | "trim" | "cut" | "sound" | "music";

const adjustCss = (it: Item) => `${it.filter === "none" ? "" : it.filter + " "}brightness(${it.bright}) contrast(${it.contrast}) saturate(${it.sat})`.trim();
const needsBake = (it: Item) => adjustCss(it) !== "brightness(1) contrast(1) saturate(1)" || it.trim[0] > 0.05 || (it.duration && it.trim[1] < it.duration - 0.05) || (it.cutOn && it.cut);
const rangesOf = (it: Item): [number, number][] => {
  const base: [number, number][] = it.cutOn && it.cut ? it.cut : [[0, it.duration]];
  return base.map(([a, b]) => [Math.max(a, it.trim[0]), Math.min(b, it.trim[1])] as [number, number]).filter(([a, b]) => b - a > 0.15);
};
const fmt = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

const readMeta = (f: File, url: string) => new Promise<number>((res) => {
  if (f.type.startsWith("image/")) return res(0);
  const v = document.createElement("video"); v.preload = "metadata"; v.src = url;
  v.onloadedmetadata = () => {
    if (Number.isFinite(v.duration)) { res(v.duration); return; }
    // Recordings (webm) don't store their length: jump to the end so the browser works it out.
    v.ontimeupdate = () => { if (Number.isFinite(v.duration)) { v.ontimeupdate = null; res(v.duration); } };
    v.currentTime = 1e101;
    setTimeout(() => res(Number.isFinite(v.duration) ? v.duration : 0), 4000);
  };
  v.onerror = () => res(0);
});

/**
 * Full-screen editor: filters, adjustments, trim, auto-cut and music for one or many photos/videos.
 * Posts keep every item separate (swipe through them); a reel joins them into one video.
 */
const MediaEditor = ({ files, mode: initialMode, onClose }: { files: File[]; mode: EditorMode; onClose: () => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [cur, setCur] = useState(0);
  const [mode, setMode] = useState<EditorMode>(initialMode);
  const [tab, setTab] = useState<Tab>(initialMode === "reel" ? "templates" : "filters");
  const [caption, setCaption] = useState("");
  const [track, setTrack] = useState<PickedTrack | null>(null);
  const [clip, setClip] = useState({ start: 0, len: 15 });
  const [pickMusic, setPickMusic] = useState(false);
  const [vol, setVol] = useState({ video: 1, music: 1 });
  const [tplId, setTplId] = useState<string | null>(null);
  const [cutting, setCutting] = useState(false);
  const [step, setStep] = useState<"edit" | "options">("edit");
  const [opts, setOpts] = useState({ allow_comments: true, allow_download: true, hide_likes: false, visibility: "public" as "public" | "followers", location: "" });
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let dead = false;
    void (async () => {
      const made: Item[] = [];
      for (const f of files) {
        const url = URL.createObjectURL(f);
        const duration = await readMeta(f, url);
        made.push({ id: `${Date.now()}-${Math.random()}`, file: f, url, kind: f.type.startsWith("image/") ? "image" : "video", duration, filter: "none", bright: 1, contrast: 1, sat: 1, trim: [0, duration], cut: null, cutOn: false, secs: 3 });
      }
      if (!dead) setItems(made);
    })();
    return () => { dead = true; };
  }, [files]);
  useEffect(() => () => { items.forEach((i) => URL.revokeObjectURL(i.url)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const it = items[cur];
  const patch = (p: Partial<Item>) => setItems((a) => a.map((x, i) => (i === cur ? { ...x, ...p } : x)));
  const css = it ? adjustCss(it) : "none";
  const anyVideo = items.some((i) => i.kind === "video");

  useEffect(() => { if (videoRef.current) videoRef.current.volume = vol.video; }, [vol.video, it]);
  const applyTemplate = (t: ReelTemplate) => {
    setItems((a) => a.map((x) => ({ ...x, filter: t.filter, bright: t.bright, contrast: t.contrast, sat: t.sat, secs: t.secs })));
    setVol({ video: t.videoVol, music: t.musicVol });
    setClip((c) => ({ ...c, len: t.clipLen }));
    setTplId(t.id);
    toast.success(`${t.name} template applied`);
  };

  // preview loop respects trim / cuts
  useEffect(() => {
    const v = videoRef.current; if (!v || !it || it.kind !== "video") return;
    const rs = rangesOf(it); if (!rs.length) return;
    const onTime = () => {
      const t = v.currentTime;
      const inside = rs.find(([a, b]) => t >= a - 0.05 && t < b);
      if (!inside) { const next = rs.find(([a]) => a > t); v.currentTime = next ? next[0] : rs[0][0]; }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [it]);

  const runAutoCut = async () => {
    if (!it || it.kind !== "video") return;
    setCutting(true);
    const r = await detectKeepRanges(it.file, it.duration);
    setCutting(false);
    const kept = r.reduce((n, [a, b]) => n + (b - a), 0);
    if (r.length === 1 && r[0][0] === 0 && r[0][1] >= it.duration - 0.05) { patch({ cut: null, cutOn: false }); toast("Nothing to cut — this clip has no long silences."); return; }
    patch({ cut: r, cutOn: true });
    toast.success(`Auto-cut removed ${fmt(it.duration - kept)} of silence`);
  };

  const remove = () => { if (items.length === 1) { onClose(); return; } setItems((a) => a.filter((_, i) => i !== cur)); setCur((c) => Math.max(0, c - 1)); };

  const publish = () => {
    if (!user || !items.length) return;
    const uid = user.id, vl = vol, list = items, m = mode, t = track, c = clip, cap = caption.trim(), o = opts, loc = opts.location.trim() || null;
    onClose();
    navigate("/");
    const label = m === "reel" ? "Posting your reel" : m === "story" ? "Posting your story" : "Sharing your post";
    runInBackground(label, async (progress) => {
      const upload = async (f: File, prefix: string) => {
        const ext = f.name.split(".").pop() || "bin";
        const path = `${uid}/${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from("media").upload(path, f);
        if (error) throw error;
        return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      };
      const finalOf = async (x: Item, n: number): Promise<File> => {
        if (!needsBake(x)) return x.file;
        progress(`Editing ${n + 1} of ${list.length}…`);
        if (x.kind === "image") return bakeImageFilter(x.file, adjustCss(x));
        return composeVideo([{ file: x.file, kind: "video", css: adjustCss(x), ranges: rangesOf(x) }], { width: 720, height: 1280, onProgress: (p) => progress(`Editing ${n + 1} of ${list.length}… ${p}%`) }).catch(() => x.file);
      };
      const music = t ? { music_title: t.title, music_artist: t.artist, music_art_url: t.artUrl, music_url: t.streamUrl, music_youtube_id: t.youtubeId, music_start: c.start, music_len: c.len, music_volume: vl.music } : {};

      if (m === "reel") {
        const segs: Seg[] = list.map((x) => ({ file: x.file, kind: x.kind, css: adjustCss(x), ranges: x.kind === "video" ? rangesOf(x) : undefined, secs: x.secs }));
        progress("Joining your clips…");
        const video = list.length === 1 && !needsBake(list[0]) && list[0].kind === "video" ? list[0].file : await composeVideo(segs, { width: 720, height: 1280, onProgress: (p) => progress(`Joining your clips… ${p}%`) });
        progress("Uploading reel…");
        const thumbnail_url = await uploadVideoCover(uid, video);
        const video_url = await upload(video, "reel");
        const { error } = await supabase.from("reels").insert({ user_id: uid, caption: cap || null, video_url, thumbnail_url, music_title: t?.title ?? null, music_artist: t?.artist ?? null, music_art_url: t?.artUrl ?? null, music_url: t?.streamUrl ?? null, ...(t ? { music_start: c.start, music_len: c.len } : {}), music_volume: vl.music, video_volume: vl.video, allow_comments: o.allow_comments, allow_download: o.allow_download, hide_likes: o.hide_likes, visibility: o.visibility, location: loc } as never);
        if (error) throw error;
        window.dispatchEvent(new Event("prime:posted"));
        return;
      }
      if (m === "story") {
        for (let n = 0; n < list.length; n++) {
          const f = await finalOf(list[n], n);
          progress(`Uploading story ${n + 1} of ${list.length}…`);
          const thumbnail_url = list[n].kind === "video" ? await uploadVideoCover(uid, f) : null;
          const media_url = await upload(f, "story");
          const { error } = await supabase.from("posts").insert({ user_id: uid, media_url, media_type: "story", caption: cap || "Story", thumbnail_url, visibility: o.visibility, ...music } as never);
          if (error) throw error;
        }
        window.dispatchEvent(new CustomEvent("prime:stories-changed"));
        return;
      }
      // post: every photo/video stays separate inside one swipeable post
      const media: { url: string; type: string; thumb: string | null }[] = [];
      for (let n = 0; n < list.length; n++) {
        const f = await finalOf(list[n], n);
        progress(`Uploading ${n + 1} of ${list.length}…`);
        const thumb = list[n].kind === "video" ? await uploadVideoCover(uid, f) : null;
        media.push({ url: await upload(f, "post"), type: list[n].kind, thumb });
      }
      const { error } = await supabase.from("posts").insert({ user_id: uid, caption: cap || null, media_url: media[0].url, media_type: media[0].type, thumbnail_url: media[0].thumb, media_items: media.length > 1 ? media : null, allow_comments: o.allow_comments, allow_download: o.allow_download, hide_likes: o.hide_likes, visibility: o.visibility, location: loc, ...music } as never);
      if (error) throw error;
      window.dispatchEvent(new Event("prime:posted"));
    });
  };

  const tabs: { id: Tab; icon: typeof Sparkles; label: string; show: boolean }[] = useMemo(() => [
    { id: "templates", icon: LayoutTemplate, label: "Templates", show: true },
    { id: "filters", icon: Sparkles, label: "Filters", show: true },
    { id: "adjust", icon: SlidersHorizontal, label: "Adjust", show: true },
    { id: "trim", icon: Scissors, label: "Trim", show: !!it && it.kind === "video" },
    { id: "cut", icon: Wand2, label: "Auto-cut", show: !!it && it.kind === "video" },
    { id: "music", icon: Music2, label: "Music", show: true },
    { id: "sound", icon: Volume2, label: "Volume", show: true },
  ], [it]);

  const Slider = ({ label, v, min, max, step, on }: { label: string; v: number; min: number; max: number; step: number; on: (n: number) => void }) => (
    <label className="flex items-center gap-3 text-xs text-muted-foreground"><span className="w-16">{label}</span><input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(Number(e.target.value))} className="flex-1 accent-[hsl(var(--primary))]" /><span className="w-8 text-right tabular-nums">{v.toFixed(2)}</span></label>
  );

  const PctSlider = ({ label, v, on }: { label: string; v: number; on: (n: number) => void }) => (
    <label className="flex items-center gap-3 text-xs text-muted-foreground"><span className="w-20">{label}</span><input type="range" min={0} max={1} step={0.05} value={v} onChange={(e) => on(Number(e.target.value))} className="flex-1 accent-[hsl(var(--primary))]" /><span className="w-10 text-right tabular-nums">{Math.round(v * 100)}%</span></label>
  );

  return createPortal(
    <div className="fixed inset-0 z-[96] flex flex-col bg-background text-foreground">
      <div className="flex items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={onClose} aria-label="Close editor" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary"><X className="h-5 w-5" /></button>
        <div className="mx-auto flex rounded-full bg-secondary p-0.5 text-xs font-semibold">
          {(["post", "reel", "story"] as EditorMode[]).map((x) => (
            <button key={x} onClick={() => setMode(x)} className={`rounded-full px-3.5 py-1.5 capitalize ${mode === x ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{x}</button>
          ))}
        </div>
        <button onClick={() => setStep("options")} disabled={!items.length} className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">Next</button>
      </div>

      <div className="relative min-h-0 flex-1 bg-black">
        {!it ? <div className="flex h-full items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div> : it.kind === "video"
          ? <video ref={videoRef} key={it.id} src={it.url} style={{ filter: css }} className="h-full w-full object-contain" autoPlay loop playsInline controls={false} onClick={(e) => { const v = e.currentTarget; if (v.paused) void v.play(); else v.pause(); }} />
          : <img key={it.id} src={it.url} alt="" style={{ filter: css }} className="h-full w-full object-contain" />}
        {items.length > 1 && <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[11px] text-white"><GalleryHorizontalEnd className="h-3 w-3" />{cur + 1}/{items.length}{mode === "reel" ? " · joined into one reel" : mode === "post" ? " · swipe post" : " · separate stories"}</span>}
        {it && <button onClick={remove} aria-label="Remove this item" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"><Trash2 className="h-4 w-4" /></button>}
      </div>

      <div className="space-y-2.5 bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {items.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {items.map((x, i) => (
              <button key={x.id} onClick={() => setCur(i)} className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-2 ${i === cur ? "ring-primary" : "ring-transparent"}`}>
                {x.kind === "image" ? <img src={x.url} alt="" className="h-full w-full object-cover" style={{ filter: adjustCss(x) }} /> : <video src={x.url} className="h-full w-full object-cover" muted preload="metadata" />}
                {x.kind === "video" && <Film className="absolute bottom-0.5 right-0.5 h-3 w-3 text-white drop-shadow" />}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {tabs.filter((t) => t.show).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}><t.icon className="h-3.5 w-3.5" />{t.label}</button>
          ))}
        </div>

        {tab === "templates" && (
          <div className="space-y-1.5">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {REEL_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => applyTemplate(t)} className={`flex w-24 shrink-0 flex-col items-center gap-1 rounded-2xl p-2 text-center ring-2 ${tplId === t.id ? "ring-primary" : "ring-transparent"} bg-gradient-to-br ${t.gradient}`}>
                  <span className="text-2xl">{t.emoji}</span><span className="text-[11px] font-bold text-white">{t.name}</span><span className="text-[9px] leading-3 text-white/80">{t.blurb}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">A template sets the look, photo pace and sound mix in one tap. You can still fine-tune everything.</p>
          </div>
        )}
        {tab === "sound" && (
          <div className="space-y-2">
            {anyVideo ? <PctSlider label="Reel sound" v={vol.video} on={(n) => setVol((x) => ({ ...x, video: n }))} /> : <p className="text-[11px] text-muted-foreground">Photos have no original sound.</p>}
            {track ? <PctSlider label="Music" v={vol.music} on={(n) => setVol((x) => ({ ...x, music: n }))} /> : <p className="text-[11px] text-muted-foreground">Add a song in the Music tab to set its volume.</p>}
            <p className="text-[11px] text-muted-foreground">Viewers hear your mix at these levels. Drag to 0% to silence either one.</p>
          </div>
        )}
        {it && tab === "filters" && <FilterStrip value={it.filter} onChange={(f) => patch({ filter: f })} thumb={it.kind === "image" ? it.url : null} />}
        {it && tab === "adjust" && (
          <div className="space-y-2">
            <Slider label="Brightness" v={it.bright} min={0.5} max={1.5} step={0.05} on={(n) => patch({ bright: n })} />
            <Slider label="Contrast" v={it.contrast} min={0.5} max={1.5} step={0.05} on={(n) => patch({ contrast: n })} />
            <Slider label="Saturation" v={it.sat} min={0} max={2} step={0.05} on={(n) => patch({ sat: n })} />
            {it.kind === "image" && mode === "reel" && <Slider label="Seconds" v={it.secs} min={1} max={10} step={0.5} on={(n) => patch({ secs: n })} />}
          </div>
        )}
        {it && tab === "trim" && it.kind === "video" && (
          <div className="space-y-2">
            <Slider label="Start" v={it.trim[0]} min={0} max={Math.max(0.1, it.trim[1] - 0.5)} step={0.1} on={(n) => { patch({ trim: [n, it.trim[1]] }); if (videoRef.current) videoRef.current.currentTime = n; }} />
            <Slider label="End" v={it.trim[1]} min={Math.min(it.duration, it.trim[0] + 0.5)} max={it.duration} step={0.1} on={(n) => patch({ trim: [it.trim[0], n] })} />
            <p className="text-[11px] text-muted-foreground">Length {fmt(Math.max(0, it.trim[1] - it.trim[0]))} of {fmt(it.duration)}</p>
          </div>
        )}
        {it && tab === "cut" && it.kind === "video" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Auto-cut listens to your video and removes the silent or dead parts, so only the moments with sound stay.</p>
            <div className="flex gap-2">
              <button onClick={() => void runAutoCut()} disabled={cutting} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{cutting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}{cutting ? "Listening…" : it.cut ? "Run again" : "Auto-cut this clip"}</button>
              {it.cut && <button onClick={() => patch({ cutOn: !it.cutOn })} className="rounded-xl bg-secondary px-4 text-sm font-medium">{it.cutOn ? "Undo cut" : "Apply cut"}</button>}
            </div>
            {it.cut && it.cutOn && <p className="text-[11px] text-emerald-400">{it.cut.length} part{it.cut.length === 1 ? "" : "s"} kept · {fmt(it.cut.reduce((n, [a, b]) => n + (b - a), 0))} of {fmt(it.duration)}</p>}
          </div>
        )}
        {tab === "music" && (
          <div className="space-y-2">
            <button onClick={() => setPickMusic(true)} className="flex w-full items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-medium"><Music2 className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1 truncate text-left">{track ? `${track.title} · ${track.artist}` : "Add music"}</span>{track && <span onClick={(e) => { e.stopPropagation(); setTrack(null); }} className="text-xs text-muted-foreground">Remove</span>}</button>
            {track && <MusicClipPicker track={track} start={clip.start} len={clip.len} onChange={(start, len) => setClip({ start, len })} />}
          </div>
        )}
        <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2"><Type className="h-4 w-4 text-muted-foreground" /><input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} placeholder={mode === "story" ? "Add a caption…" : "Write a caption…"} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
        {mode === "reel" && items.length > 1 && <p className="text-[11px] text-muted-foreground">Your {items.length} clips will be joined into one reel{anyVideo ? "" : ", each photo shown for a few seconds"}.</p>}
      </div>
      {step === "options" && (
        <div className="absolute inset-0 z-10 flex flex-col overflow-y-auto bg-background">
          <div className="flex items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button onClick={() => setStep("edit")} aria-label="Back to editing" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary"><ChevronLeft className="h-5 w-5" /></button>
            <p className="flex-1 text-center text-sm font-bold capitalize">New {mode}</p>
            <button onClick={publish} className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Share</button>
          </div>
          <div className="space-y-3 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="flex gap-3 rounded-2xl bg-secondary/60 p-3">
              <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-black">
                {items[0] && (items[0].kind === "image" ? <img src={items[0].url} alt="" className="h-full w-full object-cover" style={{ filter: adjustCss(items[0]) }} /> : <video src={items[0].url} className="h-full w-full object-cover" muted preload="metadata" style={{ filter: adjustCss(items[0]) }} />)}
              </div>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} placeholder="Write a caption… use #hashtags and @mentions" className="min-h-[5rem] flex-1 resize-none bg-transparent text-sm outline-none" />
            </div>
            <p className="text-right text-[11px] text-muted-foreground">{caption.length}/2200</p>
            <label className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-4 py-3 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" /><input value={opts.location} onChange={(e) => setOpts((o) => ({ ...o, location: e.target.value }))} maxLength={80} placeholder="Add location" className="min-w-0 flex-1 bg-transparent outline-none" /></label>
            {track && <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-4 py-3 text-sm"><Music2 className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1 truncate">{track.title} · {track.artist}</span></div>}
            <div className="space-y-3.5 rounded-2xl bg-secondary/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Audience &amp; limits</p>
              <label className="flex items-center justify-between text-sm">Who can see this
                <select value={opts.visibility} onChange={(e) => setOpts((o) => ({ ...o, visibility: e.target.value as "public" | "followers" }))} className="rounded-lg bg-background px-2 py-1.5 text-sm"><option value="public">Everyone</option><option value="followers">Followers only</option></select>
              </label>
              {mode !== "story" && ([["allow_comments", "Allow comments"], ["allow_download", "Allow downloads"], ["hide_likes", "Hide like count"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between text-sm">{label}<input type="checkbox" checked={opts[k]} onChange={(e) => setOpts((o) => ({ ...o, [k]: e.target.checked }))} className="h-5 w-5 accent-[hsl(var(--primary))]" /></label>
              ))}
            </div>
            <p className="px-1 text-[11px] text-muted-foreground">By sharing you confirm you own or have permission to use this content and the music, and that it follows the <a href="/terms" className="underline">Terms</a>.</p>
          </div>
        </div>
      )}
      <MusicPicker open={pickMusic} onClose={() => setPickMusic(false)} onPick={(x) => { setTrack(x); setPickMusic(false); }} />
    </div>,
    document.body,
  );
};
export default MediaEditor;
