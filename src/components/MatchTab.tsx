import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Heart, Loader2, RefreshCw, Sparkles, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface PoolUser {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface MatchResult {
  u: PoolUser;
  pct: number;
  vibe: number;
  energy: number;
  aura: number;
}

const MatchTab = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo);
  }, [photo]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = cameraStreamRef.current;
    if (!cameraOpen || !video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => toast.error("Could not start the camera preview. Check camera permissions and try again."));
    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [cameraOpen]);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
    setCameraStarting(false);
    setCameraReady(false);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Camera access is unavailable here. Open the app over HTTPS or use From gallery.");
      return;
    }
    setCameraStarting(true);
    try {
      cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setCameraOpen(true);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      const message = name === "NotAllowedError" || name === "PermissionDeniedError"
        ? "Camera permission was denied. Allow camera access in your browser or device settings, then try again."
        : name === "NotFoundError" || name === "DevicesNotFoundError"
          ? "No camera was found. You can choose a photo from your gallery instead."
          : name === "NotReadableError" || name === "TrackStartError"
            ? "The camera is already in use by another app. Close it and try again."
            : error instanceof Error ? error.message : "Could not access the camera. Try choosing a photo from your gallery.";
      toast.error(message);
    } finally {
      setCameraStarting(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast.error("Camera is still starting. Try again in a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      toast.error("Could not capture the photo. Please try again.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("Could not capture the photo. Please try again.");
        return;
      }
      closeCamera();
      void analyze(new File([blob], `crush-match-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  };

  const analyze = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Choose an image smaller than 10 MB");
      return;
    }
    setPhoto(URL.createObjectURL(file));
    setScanning(true);
    setResult(null);
    try {
      const [{ data: pool, error }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id,username,display_name,avatar_url")
          .neq("user_id", user?.id ?? "")
          .limit(50),
        new Promise((resolve) => setTimeout(resolve, 1800)),
      ]);
      if (error) throw error;
      const candidates = (pool ?? []).filter((profile) => profile.username);
      if (!candidates.length) {
        toast.error("No members to match with yet");
        return;
      }

      const candidate = candidates[Math.floor(Math.random() * candidates.length)];
      const pct = 68 + Math.floor(Math.random() * 30);
      const score = () => Math.min(99, Math.max(60, pct + Math.floor(Math.random() * 9) - 4));
      setResult({
        u: candidate,
        pct,
        vibe: score(),
        energy: score(),
        aura: score(),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't find a match");
    } finally {
      setScanning(false);
    }
  };

  const crush = async () => {
    if (!result) return;
    const { error } = await supabase
      .from("crushes")
      .insert({ target_id: result.u.user_id } as { target_id: string });
    if (error) {
      toast.error(error.code === "23505" ? "You already dropped a crush on them" : error.message);
      return;
    }
    toast.success("Anonymous crush dropped 💘");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-card/70 backdrop-blur-xl p-4 shadow-[0_0_30px_-12px_hsl(var(--primary)/0.6)]">
        <p className="font-bold flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" /> Vibe Match
        </p>
        <p className="text-sm text-muted-foreground mb-3">
          Photo matching and face recognition are not used. Your photo stays on this device; suggested members and scores are randomized for entertainment only.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.currentTarget.value = "";
            if (file) void analyze(file);
          }}
        />
        {!photo && !scanning && (
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => void openCamera()} className="gap-2" disabled={cameraStarting}>
              {cameraStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {cameraStarting ? "Starting camera…" : "Snap photo"}
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} className="gap-2">
              <Upload className="w-4 h-4" /> From gallery
            </Button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {(photo || scanning) && (
            <motion.div
              key="scan"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="relative mx-auto w-44 h-44 rounded-3xl overflow-hidden"
            >
              {photo && <img src={photo} alt="Your photo" className="w-full h-full object-cover" />}
              {scanning && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-3xl border-2 border-primary"
                    animate={{ opacity: [0.2, 1, 0.2], scale: [1, 1.04, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-primary/40 to-transparent"
                    animate={{ top: ["-10%", "100%"] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-background/70 backdrop-blur-sm text-center">
                    <p className="text-xs font-semibold text-foreground flex items-center justify-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      Finding a vibe match…
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {photo && !scanning && !result && (
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => setPhoto(null)}
          >
            Choose another photo
          </Button>
        )}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            key="match"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="rounded-2xl border border-primary/40 bg-card/80 backdrop-blur-xl p-5 shadow-[0_0_40px_-10px_hsl(var(--primary)/0.7)]"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-black tracking-wide text-primary flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />                 VIBE MATCH
              </p>
              <button
                onClick={() => {
                  setPhoto(null);
                  setResult(null);
                }}
                className="depth-press text-xs text-muted-foreground flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <button onClick={() => navigate(`/profile/${result.u.user_id}`)} aria-label={`Open ${result.u.username}'s profile`} className="w-16 h-16 rounded-2xl p-0.5 bg-gradient-to-br from-primary to-accent shrink-0">
                <img
                  src={result.u.avatar_url || "/favicon.png"}
                  alt=""
                  className="w-full h-full rounded-2xl object-cover bg-secondary"
                />
              </button>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => navigate(`/profile/${result.u.user_id}`)}
                  className="text-left text-lg font-bold text-foreground truncate"
                >
                  @{result.u.username}
                </button>
                <p className="text-sm text-muted-foreground">{result.u.display_name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-black text-primary">{result.pct}%</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">compatible</p>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {(
                [
                  ["Vibe", result.vibe],
                  ["Energy", result.energy],
                  ["Aura", result.aura],
                ] as const
              ).map(([label, v]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-14 shrink-0">{label}</span>
                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${v}%` }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-8 text-right shrink-0">{v}%</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" className="gap-1" onClick={crush}>
                <Heart className="w-3.5 h-3.5" /> Crush
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate("/messages")}
              >
                Message
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate("/discover")}>
                Discover
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 text-center">
              For entertainment only. Scores are randomized; your photo stays on this device and is never used for face recognition or sent to the server.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {cameraOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={(event) => { if (event.target === event.currentTarget) closeCamera(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="crush-camera-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between p-4">
              <h2 id="crush-camera-title" className="font-semibold">Take a photo</h2>
              <Button variant="ghost" size="icon" aria-label="Close camera" onClick={closeCamera}><X className="h-5 w-5" /></Button>
            </div>
            <div className="relative aspect-[3/4] bg-black">
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" onLoadedMetadata={() => setCameraReady(true)} />
              {!cameraReady && <div className="absolute inset-0 flex items-center justify-center text-sm text-white/75"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting camera…</div>}
            </div>
            <div className="p-4">
              <Button className="w-full gap-2" onClick={capturePhoto} disabled={!cameraReady}><Camera className="h-4 w-4" /> Capture photo</Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">Your photo stays on this device and is not uploaded.</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default MatchTab;
