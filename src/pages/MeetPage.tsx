import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, Video, Shuffle, Loader2, Users } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

/** Umingle-style random video chat: tap Start, get paired with the next person, tap Next to skip. */
const MeetPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const mode = "general" as const;
  const [audio, setAudio] = useState(params.get("audio") === "1");
  const [searching, setSearching] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const [camOk, setCamOk] = useState<boolean | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const matchedRef = useRef(false);

  const stopPreview = useCallback(() => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; }, []);

  useEffect(() => {
    let cancelled = false;
    if (audio) { stopPreview(); setCamOk(true); return; }
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user" }, audio: false }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream; setCamOk(true);
      if (previewRef.current) previewRef.current.srcObject = stream;
    }).catch(() => setCamOk(false));
    return () => { cancelled = true; stopPreview(); };
  }, [audio, stopPreview]);

  const stop = useCallback(async () => {
    clearInterval(timerRef.current);
    setSearching(false);
    if (!matchedRef.current) await supabase.rpc("chat_leave" as any);
  }, []);

  const poll = useCallback(async () => {
    const { data, error } = await supabase.rpc("chat_find" as any, { _mode: mode, _audio: audio } as any);
    if (error) { clearInterval(timerRef.current); setSearching(false); toast.error(error.message); return; }
    const row = (data as any[])?.[0];
    if (row?.call_id && row.peer_id) {
      matchedRef.current = true;
      clearInterval(timerRef.current);
      stopPreview();
      navigate(`/call/${row.peer_id}?call=${row.call_id}&random=1&mode=${mode}${audio ? "&audio=1" : ""}${row.is_caller ? "" : "&incoming=1"}`);
    } else setWaiting(row?.waiting ?? 0);
  }, [mode, audio, navigate, stopPreview]);

  const start = useCallback(() => {
    if (!user) { navigate("/auth"); return; }
    matchedRef.current = false;
    setSearching(true);
    void poll();
    timerRef.current = setInterval(() => void poll(), 2000);
  }, [user, poll, navigate]);

  useEffect(() => { if (params.get("auto") === "1" && user && camOk) start(); /* auto-start after "Next" */ }, [camOk]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { clearInterval(timerRef.current); if (!matchedRef.current) void supabase.rpc("chat_leave" as any); }, []);

  return (
    <div className={`flex h-dvh flex-col bg-background text-foreground`}>
      <header className="safe-area-top flex items-center gap-3 px-5 py-4">
        <button onClick={() => { void stop(); navigate("/"); }} aria-label="Back" className="depth-press"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-lg font-bold">Meet</h1>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <div className={`relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-[2rem] border border-border bg-black`}>
          {audio ? <div className="flex h-full items-center justify-center"><Mic className="h-14 w-14 text-white/50" /></div>
            : camOk === false ? <p className="flex h-full items-center justify-center px-6 text-sm text-white/70">Allow camera access to meet people</p>
            : <video ref={previewRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />}
          {searching && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
              <p className="text-sm text-white">Finding someone…</p>
              <p className="flex items-center gap-1 text-xs text-white/70"><Users className="h-3 w-3" />{waiting > 1 ? `${waiting} people searching` : "You're first in line"}</p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant={!audio ? "default" : "secondary"} size="sm" disabled={searching} onClick={() => setAudio(false)}><Video className="mr-1 h-4 w-4" />Video</Button>
          <Button variant={audio ? "default" : "secondary"} size="sm" disabled={searching} onClick={() => setAudio(true)}><Mic className="mr-1 h-4 w-4" />Voice only</Button>
        </div>
        {searching
          ? <Button size="lg" variant="secondary" onClick={() => void stop()} className="w-full max-w-xs">Cancel</Button>
          : <Button size="lg" onClick={start} disabled={camOk === null || camOk === false} className="w-full max-w-xs gap-2"><Shuffle className="h-5 w-5" />Start</Button>}
        <p className="max-w-xs text-[11px] text-muted-foreground">Be respectful. You can report or skip anyone during the chat. Never share personal details.</p>
      </main>
    </div>
  );
};
export default MeetPage;
