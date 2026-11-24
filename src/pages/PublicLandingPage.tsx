import { Capacitor } from "@capacitor/core";
import { motion } from "framer-motion";
import { ArrowRight, Bookmark, Download, Flame, Heart, MessageCircle, Phone, Radio, Repeat2, Share2, ShieldCheck, Sparkles, Users, Wallet, Film, Lock } from "lucide-react";
import { ANDROID_APK_URL } from "@/components/AndroidDownloadCard";
import { usePageMeta } from "@/hooks/usePageMeta";

const features = [
  { icon: Film, title: "Reels that fly", text: "Full-screen video with repost, save and tips built in.", tone: "from-violet-500/25" },
  { icon: Flame, title: "Daily Drops", text: "One moment a day. Keep your streak alive and get seen.", tone: "from-amber-400/25" },
  { icon: Radio, title: "Go live", text: "Stream to your fans, chat with them and get tipped in real time.", tone: "from-rose-500/25" },
  { icon: Lock, title: "Pay-to-view", text: "Put a price on a post or send a paid message. You keep 85%.", tone: "from-fuchsia-500/25" },
  { icon: Phone, title: "Calls & chat", text: "Voice, video and group chats with friends, anywhere.", tone: "from-sky-500/25" },
  { icon: Users, title: "Invite & earn", text: "Bring friends. Earn a share when they pay or earn on Primegram.", tone: "from-emerald-500/25" },
];
const steps = [
  { n: "1", title: "Join in 30 seconds", text: "Sign up free, follow a few people and say hi with your first Drop." },
  { n: "2", title: "Share what you do", text: "Post Reels, go live and build a streak. Your people find you." },
  { n: "3", title: "Get paid", text: "Earn from tips, paid posts and friends you invite. Withdraw to M-Pesa." },
];

const Chip = ({ className, delay, children }: { className: string; delay: number; children: React.ReactNode }) => (
  <motion.div className={`absolute z-20 flex items-center gap-1.5 rounded-full border border-white/15 bg-[#14102a]/90 px-3 py-1.5 text-xs font-bold text-white shadow-xl ${className}`}
    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: [0, -8, 0] }} transition={{ opacity: { delay, duration: 0.5 }, y: { delay, duration: 4, repeat: Infinity, ease: "easeInOut" } }}>{children}</motion.div>
);

const PhoneMock = () => (
  <div className="relative mx-auto w-[260px] sm:w-[290px]">
    <div aria-hidden="true" className="absolute -inset-10 rounded-full bg-violet-600/30 blur-[80px]" />
    <div className="relative aspect-[9/19] overflow-hidden rounded-[2.4rem] border-[6px] border-[#1c1736] bg-[#0b0818] shadow-[0_30px_80px_rgba(124,58,237,.35)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,.85),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(236,72,153,.7),transparent_55%),linear-gradient(160deg,#1a0b3b,#0b0818)]" />
      <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
      <div className="absolute inset-x-3 top-10 flex gap-2">
        {["from-amber-300 to-rose-500", "from-violet-400 to-fuchsia-500", "from-sky-400 to-violet-500", "from-emerald-300 to-sky-500"].map((g, i) => (
          <div key={i} className={`h-9 w-9 rounded-full bg-gradient-to-br ${g} p-[2px]`}><div className="h-full w-full rounded-full bg-[#0b0818]" /></div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: "linear-gradient(to top, rgba(6,9,20,0.88), transparent)" }} />
      <div className="absolute bottom-5 left-4 right-14">
        <div className="flex items-center gap-2"><div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-300 to-rose-500" /><p className="text-sm font-bold text-white">aura.kisii</p></div>
        <p className="mt-2 text-xs text-white/85">Friday vibes in Kisii 🔥 Drop your streak below</p>
      </div>
      <div className="absolute bottom-6 right-3 flex flex-col items-center gap-3.5 text-white">
        <Heart className="h-6 w-6 fill-rose-400 text-rose-400" /><MessageCircle className="h-6 w-6" /><Repeat2 className="h-6 w-6" /><Bookmark className="h-6 w-6" /><Share2 className="h-6 w-6" />
      </div>
    </div>
    <Chip className="-left-6 top-24 sm:-left-12" delay={0.4}><Flame className="h-3.5 w-3.5 text-amber-300" />12-day streak</Chip>
    <Chip className="-right-4 top-48 sm:-right-12" delay={0.8}><Wallet className="h-3.5 w-3.5 text-emerald-300" />+KES 1,200 tip</Chip>
    <Chip className="-left-4 bottom-28 sm:-left-14" delay={1.2}><span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />LIVE · 2.4k watching</Chip>
  </div>
);

const PublicLandingPage = () => {
  usePageMeta({
    title: "Primegram Extreme (Primegram X) – Social Network for Reels, Music & Chat",
    description: "Primegram Extreme, also written Primegram X, is a social network for Reels, photos, messaging, music discovery and creator communities. Join free on web and Android.",
    path: "/",
  });
  const native = Capacitor.isNativePlatform();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07060f] text-white selection:bg-violet-500/30">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-10 h-[34rem] w-[34rem] rounded-full bg-violet-600/20 blur-[140px]" />
        <div className="absolute -right-48 top-72 h-[36rem] w-[36rem] rounded-full bg-fuchsia-500/15 blur-[150px]" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <a href="/" className="flex items-center gap-3" aria-label="Primegram X home">
          <img src="/icons/x-logo-128.webp" alt="" width={40} height={40} className="h-10 w-10 rounded-xl shadow-[0_0_24px_rgba(168,85,247,.5)]" />
          <span className="text-sm font-black tracking-[0.18em]">PRIMEGRAM <span className="text-fuchsia-400">X</span></span>
        </a>
        <div className="flex items-center gap-2">
          {!native && (
            <a href={ANDROID_APK_URL} download aria-label="Download Primegram X for Android" title="Download APK" className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:bg-white/10"><Download className="size-4" /></a>
          )}
          <a href="/auth" className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10">Sign in</a>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-16 pt-8 md:grid-cols-[1.1fr_.9fr] md:pb-24 md:pt-14">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-semibold text-violet-200"><Sparkles className="h-4 w-4" />Made in Kisii, Kenya 🇰🇪</p>
          <h1 className="text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
            Post. Go live.<br /><span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-400 bg-clip-text text-transparent">Get paid.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
            Primegram X (Primegram Extreme) is the social app for Reels, Daily Drops, live rooms and chat, where creators earn from every post.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/auth" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-7 py-3.5 text-sm font-bold text-white shadow-[0_10px_40px_rgba(168,85,247,.45)] transition-transform hover:scale-[1.03]">Join free <ArrowRight className="h-4 w-4" /></a>
            {!native && <a href={ANDROID_APK_URL} download className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-white/10"><Download className="h-4 w-4" />Get the Android app</a>}
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/60">
            <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-violet-300" />Free to join</li>
            <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-violet-300" />Web + Android</li>
            <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-violet-300" />You choose who sees what</li>
          </ul>
        </div>
        <PhoneMock />
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Everything in one app</p>
        <h2 className="mt-3 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">Built for creators, loved by friends.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text, tone }) => (
            <article key={title} className={`rounded-3xl border border-white/10 bg-gradient-to-br ${tone} to-transparent p-6 transition-transform hover:-translate-y-1`}>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-5 text-lg font-bold">{title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-white/65">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-16 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-black">{s.n}</span>
              <div><h3 className="text-lg font-bold">{s.title}</h3><p className="mt-1 text-sm leading-6 text-white/65">{s.text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-20">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-600/30 via-fuchsia-600/15 to-transparent px-6 py-14 text-center sm:px-12">
          <img src="/icons/x-logo-256.webp" alt="" width={72} height={72} className="mx-auto h-[72px] w-[72px] rounded-2xl shadow-[0_0_50px_rgba(168,85,247,.6)]" />
          <h2 className="mx-auto mt-6 max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">Come earn at Primegram.</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/70">Make a profile, share what moves you and let your people find you.</p>
          <a href="/auth" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-black transition-transform hover:scale-[1.03]">Get started <ArrowRight className="h-4 w-4" /></a>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-5 py-6 text-xs text-white/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Primegram X</p>
          <nav aria-label="Trust and legal pages" className="flex flex-wrap gap-x-5 gap-y-2">
            <a className="transition-colors hover:text-white" href="/about">About</a>
            <a className="transition-colors hover:text-white" href="/privacy">Privacy</a>
            <a className="transition-colors hover:text-white" href="/terms">Terms</a>
          </nav>
        </div>
      </footer>
    </main>
  );
};

export default PublicLandingPage;
