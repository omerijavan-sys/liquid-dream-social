import { useEffect } from "react";
import { ArrowDown, ArrowRight, Heart, LockKeyhole, MessageCircle, Music2, Play, Sparkles, Users, Wallet } from "lucide-react";
import PrimeLogo from "@/components/PrimeLogo";

const pillars = [
  {
    icon: Play,
    number: "01",
    title: "Make it yours",
    description: "Share photos, videos, and Reels that feel like you. Your perspective is the point.",
  },
  {
    icon: Users,
    number: "02",
    title: "Find your people",
    description: "Follow creators, meet communities, and build real connections around what you love.",
  },
  {
    icon: Music2,
    number: "03",
    title: "Follow the feeling",
    description: "Bring music into the mix and discover new sounds while you explore the feed.",
  },
];

const AboutPage = () => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "About Primegram | Connect, create, and discover";
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute("content");
    description?.setAttribute("content", "Get to know Primegram: a social space to share Reels and photos, discover music, connect with people, and support creators.");

    return () => {
      document.title = previousTitle;
      if (previousDescription) description?.setAttribute("content", previousDescription);
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
          <span className="text-sm font-extrabold tracking-[0.14em]">PRIMEGRAM<span className="text-primary">.</span></span>
        </a>
        <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-5">
          <a href="/help" className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">Help</a>
          <a href="/auth" className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Join Primegram <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[78vh] w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 md:grid-cols-[1.05fr_.95fr] md:pb-28 md:pt-16">
        <div className="max-w-2xl">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.07] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-primary">
            <Sparkles className="size-4" aria-hidden="true" /> A social space for every side of you
          </p>
          <h1 className="text-5xl font-black leading-[1.02] tracking-[-0.055em] sm:text-6xl md:text-7xl">
            Your world.<br />Your people.<br /><span className="bg-gradient-to-r from-primary via-amber-200 to-sky-300 bg-clip-text text-transparent">Your Primegram.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Primegram brings the things you love about being social into one place: sharing moments, discovering new sounds, and finding people who get you.
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
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">What matters here</p>
            <h2 className="mt-4 max-w-md text-3xl font-bold leading-tight tracking-tight sm:text-4xl">A little more connection. A lot more you.</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">Social should feel social. Primegram is a place to express yourself, stay close to your people, and make room for the creators who make your day.</p>
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
          <a href="/" className="font-bold tracking-[0.12em] text-foreground">PRIMEGRAM<span className="text-primary">.</span></a>
          <p>Connect, create, and discover.</p>
          <nav aria-label="Legal links" className="flex gap-5"><a className="transition-colors hover:text-foreground" href="/privacy">Privacy</a><a className="transition-colors hover:text-foreground" href="/terms">Terms</a><a className="transition-colors hover:text-foreground" href="/help">Help</a></nav>
        </div>
      </footer>
    </main>
  );
};

export default AboutPage;
