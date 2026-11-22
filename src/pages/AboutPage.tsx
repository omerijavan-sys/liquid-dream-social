import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { ArrowDown, ArrowRight, Download, Heart, LockKeyhole, MessageCircle, Music2, Play, Sparkles, Wallet } from "lucide-react";
import { ANDROID_APK_URL } from "@/components/AndroidDownloadCard";
import PrimeLogo from "@/components/PrimeLogo";

const pillars = [
  {
    icon: Play,
    number: "01",
    title: "Short Videos, Reels & Stories",
    description: "Share high-energy clips, daily moments, and creative edits with live view counters and instant feed discovery.",
  },
  {
    icon: Music2,
    number: "02",
    title: "In-Feed Music & Audio",
    description: "Attach background tracks to your posts and discover trending sounds directly inside the feed.",
  },
  {
    icon: MessageCircle,
    number: "03",
    title: "Instant Messaging & Live Calls",
    description: "Stay connected with friends and communities through fast chat and real-time audio and video calling.",
  },
  {
    icon: Sparkles,
    number: "04",
    title: "Primegram X Hub",
    description: "Explore interactive social features, AI-powered matching and assistants, and creator badges designed for a dynamic Gen Z experience.",
  },
];

const AboutPage = () => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "About Primegram X | Primegram X";

    const metadata = [
      { selector: 'meta[name="description"]', attribute: "content", value: "Welcome to Primegram X, a next-generation social platform for creators, music lovers, and communities. Share Reels, discover music, message, call, and connect at primegramx.co.ke." },
      { selector: 'link[rel="canonical"]', attribute: "href", value: "https://primegramx.co.ke/about" },
      { selector: 'meta[property="og:title"]', attribute: "content", value: "About Primegram X | Primegram X" },
      { selector: 'meta[property="og:description"]', attribute: "content", value: "Welcome to Primegram X, a next-generation social platform for creators, music lovers, and communities." },
      { selector: 'meta[property="og:url"]', attribute: "content", value: "https://primegramx.co.ke/about" },
      { selector: 'meta[name="twitter:title"]', attribute: "content", value: "About Primegram X | Primegram X" },
      { selector: 'meta[name="twitter:description"]', attribute: "content", value: "Welcome to Primegram X, a next-generation social platform for creators, music lovers, and communities." },
    ].map((item) => ({ ...item, element: document.querySelector(item.selector) }));
    const previousMetadata = metadata.map(({ element, attribute }) => element?.getAttribute(attribute) ?? null);
    metadata.forEach(({ element, attribute, value }) => element?.setAttribute(attribute, value));

    return () => {
      document.title = previousTitle;
      metadata.forEach(({ element, attribute }, index) => {
        const previousValue = previousMetadata[index];
        if (previousValue !== null) element?.setAttribute(attribute, previousValue);
      });
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground selection:bg-primary/30">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-48 top-16 size-[30rem] rounded-full bg-primary/[0.09] blur-[130px]" />
        <div className="absolute -right-48 top-[30rem] size-[32rem] rounded-full bg-blue-500/[0.08] blur-[140px]" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="/" className="flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Primegram home">
          <PrimeLogo size={40} glow={false} className="border-white/10" />
          <span className="text-sm font-extrabold tracking-[0.14em]">PRIMEGRAM X</span>
        </a>
        <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-5">
          <a href="/help" className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">Help</a>
          {!Capacitor.isNativePlatform() && (
            <a
              href={ANDROID_APK_URL}
              download
              aria-label="Download Primegram X for Android"
              title="Download APK"
              className="inline-flex size-10 items-center justify-center rounded-full border border-emerald-300/30 text-emerald-200 transition-colors hover:bg-emerald-400/10 hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <Download className="size-4" aria-hidden="true" />
            </a>
          )}
          <a href="/auth" className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Join Primegram <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[78vh] w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 md:grid-cols-[1.05fr_.95fr] md:pb-28 md:pt-16">
        <div className="max-w-2xl">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.07] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-primary">
            <Sparkles className="size-4" aria-hidden="true" /> Welcome to Primegram X
          </p>
          <h1 className="text-5xl font-black leading-[1.02] tracking-[-0.055em] sm:text-6xl md:text-7xl">
            Social, in<br /><span className="bg-gradient-to-r from-primary via-amber-200 to-sky-300 bg-clip-text text-transparent">full colour.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Primegram X is a next-generation social networking platform built for creators, music lovers, and communities who want fast, expressive connections in one place. Accessible directly at primegramx.co.ke, Primegram brings together short-form videos, Reels, photo feeds, music discovery, real-time messaging, and interactive social hubs inside a sleek, modern interface.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="/auth" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-[0_8px_30px_hsla(var(--primary)/.2)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              Come on in <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <a href="#what-matters" className="inline-flex items-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              What we&apos;re about <ArrowDown className="size-4" aria-hidden="true" />
            </a>
          </div>
          <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-4 text-primary" aria-hidden="true" /> You choose what to share and who can see it.</p>
        </div>

        <div aria-label="A glimpse of the Primegram community" className="relative mx-auto w-full max-w-lg">
          <div aria-hidden="true" className="absolute inset-8 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative grid grid-cols-2 gap-3 sm:gap-4">
            <div className="liquid-glass relative flex min-h-48 flex-col justify-between overflow-hidden rounded-[1.75rem] p-5 sm:min-h-56 sm:p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Play className="size-5 fill-current" aria-hidden="true" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Create</p><p className="mt-1 text-lg font-bold">Moments worth sharing</p></div>
            </div>
            <div className="liquid-glass mt-10 flex min-h-48 flex-col justify-between overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-sky-500/[0.08] to-transparent p-5 sm:min-h-56 sm:p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-300"><MessageCircle className="size-5" aria-hidden="true" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">Connect</p><p className="mt-1 text-lg font-bold">Conversations that flow</p></div>
            </div>
            <div className="liquid-glass -mt-7 flex min-h-48 flex-col justify-between overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-rose-500/[0.08] to-transparent p-5 sm:min-h-56 sm:p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-rose-400/15 text-rose-300"><Heart className="size-5" aria-hidden="true" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-300">Discover</p><p className="mt-1 text-lg font-bold">A feed that feels alive</p></div>
            </div>
            <div className="liquid-glass flex min-h-48 flex-col justify-between overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-5 sm:min-h-56 sm:p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300"><Wallet className="size-5" aria-hidden="true" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Support</p><p className="mt-1 text-lg font-bold">Creators you believe in</p></div>
            </div>
          </div>
          <div className="liquid-glass absolute -right-2 top-1/2 hidden -translate-y-1/2 items-center gap-3 rounded-2xl px-4 py-3 shadow-xl sm:flex">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><Music2 className="size-4" aria-hidden="true" /></span>
            <div><p className="text-xs font-semibold">Sound on</p><p className="text-[11px] text-muted-foreground">Find your next favorite</p></div>
          </div>
        </div>
      </section>

      <section id="what-matters" className="relative z-10 border-y border-white/[0.08] bg-white/[0.02]">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-[.8fr_1.2fr] md:gap-20 md:py-28">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">What you can do on Primegram</p>
            <h2 className="mt-4 max-w-md text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Everything you need to connect, create, and discover.</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">From short-form video and music to live conversations and interactive hubs, Primegram brings your social world together in one place.</p>
          </div>
          <div className="flex flex-col divide-y divide-white/[0.09]">
            {pillars.map(({ icon: Icon, number, title, description }) => (
              <article key={number} className="grid gap-4 py-6 first:pt-0 last:pb-0 sm:grid-cols-[3rem_1fr] sm:gap-5">
                <div className="flex items-center gap-3 sm:block"><span className="text-xs font-semibold text-muted-foreground/60">{number}</span><span className="flex size-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.07] text-primary sm:mt-3"><Icon className="size-4" aria-hidden="true" /></span></div>
                <div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid w-full max-w-7xl gap-8 px-5 py-20 sm:px-8 md:grid-cols-[.7fr_1.3fr] md:gap-20 md:py-24">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Our mission</p>
          <h2 className="mt-4 max-w-sm text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Make social feel more alive.</h2>
        </div>
        <p className="max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
          Built in Kenya for a global generation, Primegram X (also known as Primegram Extreme) was created to make social media feel more alive, visual, and personal—combining entertainment, music, and real-time communication without the clutter of legacy platforms.
        </p>
      </section>

      <section aria-labelledby="who-runs" className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-6 sm:px-8">
        <div className="liquid-glass rounded-[2rem] p-6 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Who we are</p>
          <h2 id="who-runs" className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">A Kenyan-built platform, run in the open.</h2>
          <div className="mt-5 grid gap-6 text-sm leading-7 text-muted-foreground sm:grid-cols-3">
            <div><h3 className="font-semibold text-foreground">Operator</h3><p>Primegram X (Primegram Extreme) is created and operated by Java Prime, Kenya, at primegramx.co.ke.</p></div>
            <div><h3 className="font-semibold text-foreground">Safety</h3><p>Adults only (18+). Content and people can be reported in the app, and we remove illegal content and act on copyright takedown requests. See our <a className="underline" href="/terms">Terms</a>.</p></div>
            <div><h3 className="font-semibold text-foreground">Your data and money</h3><p>We follow our <a className="underline" href="/privacy">Privacy Policy</a> and Kenya's Data Protection Act. Wallet payments and withdrawals use M-Pesa and Paystack. Contact us at <a className="underline" href="mailto:primegram.app@gmail.com">primegram.app@gmail.com</a> or through the <a className="underline" href="/help">Help centre</a>.</p></div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 md:py-28">
        <div className="liquid-glass relative overflow-hidden rounded-[2rem] px-6 py-12 text-center sm:px-12 sm:py-16">
          <div aria-hidden="true" className="absolute -right-20 -top-28 size-72 rounded-full bg-primary/10 blur-[90px]" />
          <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-primary">Your next chapter starts here</p>
          <h2 className="relative mx-auto mt-4 max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">Come as you are. Find your people.</h2>
          <p className="relative mx-auto mt-4 max-w-lg text-sm leading-6 text-muted-foreground">Make a profile, share what moves you, and explore a world of creators and communities.</p>
          <a href="/auth" className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">Get started <ArrowRight className="size-4" aria-hidden="true" /></a>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.08] px-5 py-7 sm:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <a href="/" className="font-bold tracking-[0.12em] text-foreground">PRIMEGRAM X</a>
          <p>Connect, create, and discover.</p>
          <nav aria-label="Legal links" className="flex gap-5"><a className="transition-colors hover:text-foreground" href="/privacy">Privacy</a><a className="transition-colors hover:text-foreground" href="/terms">Terms</a><a className="transition-colors hover:text-foreground" href="/help">Help</a></nav>
        </div>
      </footer>
    </main>
  );
};

export default AboutPage;
