import { useEffect, useRef, useState } from "react";
import {
  Activity, AudioLines, Braces, Check, ChevronRight, Cloud, Cpu, FlaskConical,
  Gauge, Github, Link2, Loader2, Mic, Monitor, Music2, Radio, RefreshCw,
  Sparkles, Waves,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { readPreference, savePreference } from "@/utils/preferences";

type DeveloperPreferences = {
  fpsOverlay: boolean;
  logDiagnostics: boolean;
  betaFeatures: string[];
  ambientMatch: boolean;
  vibeIntensity: number;
};

const PREFERENCE_KEY = "advanced-developer-hub";
const BETA_FEATURES = [
  { id: "summarizer", title: "AI Post Summarizer (Beta)", description: "Preview a shorter summary before sharing." },
  { id: "gestures", title: "Gesture Navigation Test", description: "Try experimental swipe navigation controls." },
  { id: "themes", title: "Custom Chat Themes (Beta)", description: "Explore new colors for your conversations." },
];
const BASE_WAVE = [20, 35, 18, 54, 72, 26, 42, 84, 36, 22, 63, 48, 92, 40, 24, 71, 34, 52, 88, 31, 45, 76, 25, 58, 38, 82, 29, 49, 68, 32, 90, 43, 21, 60, 36, 74, 28, 54, 86, 34, 47, 70, 24, 56, 38, 80, 31, 50];
const randomTelemetry = (center: number, spread: number) =>
  Array.from({ length: 36 }, (_, index) =>
    Math.max(5, Math.min(95, center + Math.sin(index * 0.8 + Date.now() / 1200) * spread + Math.random() * spread * 0.55)),
  );
const chartPoints = (values: number[]) =>
  values.map((value, index) => `${(index / (values.length - 1)) * 300},${100 - value}`).join(" ");

const AdvancedDeveloperHub = () => {
  const [preferences, setPreferences] = useState<DeveloperPreferences>(() =>
    readPreference(PREFERENCE_KEY, {
      fpsOverlay: false,
      logDiagnostics: false,
      betaFeatures: [],
      ambientMatch: false,
      vibeIntensity: 55,
    }),
  );
  const [telemetry, setTelemetry] = useState(() => ({
    cpu: randomTelemetry(34, 18),
    memory: randomTelemetry(57, 12),
    network: randomTelemetry(22, 11),
  }));
  const [fps, setFps] = useState(0);
  const [stressRunning, setStressRunning] = useState(false);
  const [webhookRevision, setWebhookRevision] = useState(1);
  const [appsOpen, setAppsOpen] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [wave, setWave] = useState(BASE_WAVE);
  const micStream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);

  const updatePreference = (update: Partial<DeveloperPreferences>) => {
    setPreferences(current => {
      const next = { ...current, ...update };
      savePreference(PREFERENCE_KEY, next);
      return next;
    });
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTelemetry({
        cpu: randomTelemetry(34, 18),
        memory: randomTelemetry(57, 12),
        network: randomTelemetry(22, 11),
      });
    }, 1400);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!preferences.fpsOverlay) {
      setFps(0);
      return;
    }
    let frame = 0;
    let frames = 0;
    let last = performance.now();
    let stopped = false;
    const measure = (now: number) => {
      if (stopped) return;
      frames++;
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }, [preferences.fpsOverlay]);

  useEffect(() => {
    if (!micEnabled || !analyser.current) return;
    const currentAnalyser = analyser.current;
    const samples = new Uint8Array(currentAnalyser.frequencyBinCount);
    const timer = window.setInterval(() => {
      currentAnalyser.getByteFrequencyData(samples);
      const nextWave = BASE_WAVE.map((base, index) => {
        const signal = samples[Math.floor(index * samples.length / BASE_WAVE.length)] ?? 0;
        const scaled = (signal / 255) * 90 + base * 0.15;
        return Math.max(8, Math.min(100, scaled * (preferences.vibeIntensity / 55)));
      });
      setWave(nextWave);
    }, 90);
    return () => window.clearInterval(timer);
  }, [micEnabled, preferences.vibeIntensity]);

  useEffect(() => () => {
    micStream.current?.getTracks().forEach(track => track.stop());
    void audioContext.current?.close();
  }, []);

  const toggleMicrophone = async (enabled: boolean) => {
    if (!enabled) {
      micStream.current?.getTracks().forEach(track => track.stop());
      micStream.current = null;
      analyser.current = null;
      void audioContext.current?.close();
      audioContext.current = null;
      setMicEnabled(false);
      setWave(BASE_WAVE);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone access is not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const nextAnalyser = context.createAnalyser();
      nextAnalyser.fftSize = 128;
      source.connect(nextAnalyser);
      micStream.current = stream;
      audioContext.current = context;
      analyser.current = nextAnalyser;
      setMicEnabled(true);
      toast.success("Microphone connected for on-device visualizer only.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Microphone permission was denied.");
    }
  };

  const runStressTest = () => {
    if (stressRunning) return;
    setStressRunning(true);
    toast.info("Running a lightweight simulated diagnostics check.");
    window.setTimeout(() => {
      setStressRunning(false);
      toast.success("Diagnostics check complete. No issues detected.");
    }, 1800);
  };

  const toggleBeta = (featureId: string) => {
    const enabled = preferences.betaFeatures.includes(featureId);
    updatePreference({
      betaFeatures: enabled
        ? preferences.betaFeatures.filter(id => id !== featureId)
        : [...preferences.betaFeatures, featureId],
    });
    toast.success(enabled ? "Beta opt-in removed" : "Beta opt-in saved on this device");
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4 text-white shadow-[0_0_30px_rgba(255,0,51,0.12)] backdrop-blur-xl sm:p-5">
      {preferences.fpsOverlay && (
        <div className="fixed right-3 top-20 z-[80] rounded-lg border border-cyan-400/40 bg-black/80 px-3 py-1.5 font-mono text-xs text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,.3)]">
          {fps} FPS
        </div>
      )}

      <header className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 text-red-300 shadow-[0_0_16px_rgba(255,0,51,.24)]">
          <Braces className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold tracking-wide text-white sm:text-base">Advanced Developer Tools</h2>
          <p className="text-[11px] text-white/45">Local previews · no server integrations configured</p>
        </div>
        <span className="rounded-full border border-red-400/30 px-2 py-1 text-[9px] font-semibold uppercase tracking-widest text-red-300">Extreme</span>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <article className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-cyan-300" />
              <h3 className="text-xs font-semibold text-white">Real-time Performance</h3>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> SIMULATED</span>
            </div>
            <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/60 p-2">
              <div className="absolute inset-0 grid grid-cols-6 grid-rows-4">
                {Array.from({ length: 24 }, (_, i) => <span key={i} className="border-b border-r border-white/[0.045]" />)}
              </div>
              <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="relative h-24 w-full">
                <polyline points={chartPoints(telemetry.cpu)} fill="none" stroke="#22d3ee" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <polyline points={chartPoints(telemetry.memory)} fill="none" stroke="#d946ef" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <polyline points={chartPoints(telemetry.network)} fill="none" stroke="#4ade80" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="relative mt-1 flex justify-between font-mono text-[9px]">
                <span className="text-cyan-300">CPU</span><span className="text-fuchsia-300">Memory</span><span className="text-emerald-300">Network latency</span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={runStressTest}
              disabled={stressRunning}
              className="mt-2 h-9 w-full border-red-500/50 bg-gradient-to-r from-red-950/60 to-fuchsia-950/40 text-xs text-red-100 shadow-[0_0_14px_rgba(255,0,51,.15)] hover:bg-red-950"
            >
              {stressRunning ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Checking…</> : <><Activity className="mr-2 h-3.5 w-3.5" />Run System Stress Test</>}
            </Button>
            <p className="mt-1 text-center text-[9px] text-white/35">Runs a lightweight UI check; it does not stress your device.</p>
            <div className="mt-3 space-y-2">
              <SettingSwitch icon={<Gauge />} label="Show FPS Overlay" checked={preferences.fpsOverlay} onChange={value => updatePreference({ fpsOverlay: value })} />
              <SettingSwitch icon={<Cpu />} label="Log Diagnostics" checked={preferences.logDiagnostics} onChange={value => updatePreference({ logDiagnostics: value })} />
            </div>
          </article>

          <article className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-violet-300" />
              <h3 className="text-xs font-semibold text-white">Beta Lab Access</h3>
            </div>
            <div className="space-y-2">
              {BETA_FEATURES.map(feature => {
                const optedIn = preferences.betaFeatures.includes(feature.id);
                return (
                  <div key={feature.id} className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-white">{feature.title}</p>
                      <p className="text-[9px] text-white/45">{feature.description}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => toggleBeta(feature.id)} className="h-7 shrink-0 border-white/15 bg-white/5 px-2 text-[10px] text-white hover:bg-white/10">
                      {optedIn ? <><Check className="mr-1 h-3 w-3" />Opted in</> : "Opt-in"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </article>
        </div>

        <div className="space-y-3">
          <article className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex items-center gap-2">
              <Cloud className="h-4 w-4 text-cyan-300" />
              <h3 className="text-xs font-semibold text-white">Webhook & Connected Apps</h3>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/35 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-white/75">Webhook status</span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Active · local preview</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/3 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" /></div>
                <Button size="sm" variant="outline" onClick={() => {
                  setWebhookRevision(value => value + 1);
                  toast.info("Local preview refreshed. No external webhook key was changed.");
                }} className="h-7 border-white/15 bg-white/5 px-2 text-[10px] text-white">
                  <RefreshCw className="mr-1 h-3 w-3" />Regenerate
                </Button>
              </div>
              <p className="mt-1 font-mono text-[9px] text-white/35">preview-{String(webhookRevision).padStart(3, "0")} · not a real webhook endpoint</p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="flex-1 text-[11px] text-white/75">Connected apps</span>
              {[{ icon: Github, color: "text-white" }, { icon: Link2, color: "text-indigo-300" }, { icon: Radio, color: "text-violet-300" }, { icon: Music2, color: "text-pink-300" }].map(({ icon: Icon, color }, index) => (
                <span key={index} className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5" aria-hidden="true"><Icon className={`h-3.5 w-3.5 ${color}`} /></span>
              ))}
              <Button size="sm" variant="outline" onClick={() => setAppsOpen(true)} className="h-7 border-white/15 bg-white/5 px-2 text-[10px] text-white">Manage</Button>
            </div>
            <p className="mt-2 text-[9px] text-white/35">App tiles are previews; no third-party accounts are currently connected.</p>
          </article>

          <article className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex items-center gap-2">
              <AudioLines className="h-4 w-4 text-red-300" />
              <h3 className="text-xs font-semibold text-white">Vibe Engine</h3>
              <span className="ml-auto text-[9px] uppercase tracking-wider text-red-300">{micEnabled ? "Mic reactive" : "Preview"}</span>
            </div>
            <div className="flex h-20 items-center justify-center gap-[3px] overflow-hidden rounded-lg border border-red-400/15 bg-gradient-to-r from-red-950/40 via-fuchsia-950/20 to-red-950/40 px-2 shadow-[inset_0_0_24px_rgba(255,0,51,.08)]">
              {wave.map((height, index) => (
                <span
                  key={index}
                  className="w-1.5 shrink-0 rounded-full bg-gradient-to-t from-red-600 via-rose-400 to-pink-200 shadow-[0_0_8px_rgba(255,75,110,.65)] transition-[height] duration-100"
                  style={{ height: `${Math.max(8, height * preferences.vibeIntensity / 55)}%` }}
                />
              ))}
            </div>
            <p className="mt-1 text-[9px] text-white/40">Microphone audio is analyzed on-device for the visualizer and is never recorded or uploaded.</p>
            <div className="mt-3 space-y-2">
              <SettingSwitch icon={<Mic />} label="Microphone Access for Vibe" checked={micEnabled} onChange={toggleMicrophone} />
              <SettingSwitch icon={<Waves />} label="Background Ambient Vibe Match" checked={preferences.ambientMatch} onChange={value => updatePreference({ ambientMatch: value })} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="shrink-0 text-[10px] text-white/70">Vibe intensity</span>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[preferences.vibeIntensity]}
                onValueChange={([value]) => updatePreference({ vibeIntensity: value })}
                aria-label="Vibe intensity"
                className="[&_[data-radix-slider-range]]:bg-gradient-to-r [&_[data-radix-slider-range]]:from-red-500 [&_[data-radix-slider-range]]:to-fuchsia-400 [&_[data-radix-slider-thumb]]:border-red-300"
              />
              <span className="w-8 text-right font-mono text-[10px] text-red-200">{preferences.vibeIntensity}</span>
            </div>
          </article>
        </div>
      </div>

      <Dialog open={appsOpen} onOpenChange={setAppsOpen}>
        <DialogContent>
          <DialogTitle>Connected apps</DialogTitle>
          <p className="text-sm text-muted-foreground">Third-party integrations are not configured for this account yet.</p>
          <div className="space-y-2">
            {["GitHub", "Primegram API", "Discord", "Music services"].map(name => (
              <div key={name} className="flex items-center justify-between rounded-xl bg-secondary/60 p-3 text-sm">
                <span>{name}</span><span className="text-xs text-muted-foreground">Not connected</span>
              </div>
            ))}
          </div>
          <Button variant="secondary" onClick={() => setAppsOpen(false)}><ChevronRight className="mr-2 h-4 w-4" />Done</Button>
        </DialogContent>
      </Dialog>
    </section>
  );
};

const SettingSwitch = ({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void | Promise<void>;
}) => (
  <div className="flex items-center gap-2">
    <span className="text-white/45 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
    <span className="flex-1 text-[10px] text-white/75">{label}</span>
    <Switch checked={checked} onCheckedChange={onChange} aria-label={label} className="scale-90 data-[state=checked]:bg-red-500" />
  </div>
);

export default AdvancedDeveloperHub;
