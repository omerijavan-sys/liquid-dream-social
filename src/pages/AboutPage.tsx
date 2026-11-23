import { useEffect } from "react";
import { ArrowDown, ArrowRight, Clock3, Globe2, Heart, LockKeyhole, Mail, MessageCircle, Music2, PhoneCall, Play, Radio, Sparkles, Trophy } from "lucide-react";
import TrustPageLayout from "@/components/TrustPageLayout";

const pillars = [
  { icon: Radio, number: "01", title: "Real-time social feeds", description: "Share updates, photos, and video, then follow the conversations moving through your community." },
  { icon: Clock3, number: "02", title: "24-hour stories", description: "Post everyday moments that stay in the spotlight for a day, then disappear from your story." },
  { icon: PhoneCall, number: "03", title: "Live audio and video rooms", description: "Meet face to face in WebRTC-powered calls and rooms for real-time conversations." },
  { icon: Music2, number: "04", title: "Music and sports hubs", description: "Discover sounds, entertainment, and sports content alongside the people you follow." },
  { icon: Trophy, number: "05", title: "Aura points and badges", description: "Build your Aura through participation, milestones, and profile badges." },
];

const AboutPage = () => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "About Primegram X | Built in Kisumu, Kenya";

    const metadata = [
      { selector: 'meta[name="description"]', attribute: "content", value: "Meet Primegram X, a next-generation social, entertainment, and real-time connection platform built in Kisumu, Kenya by MR. AURA." },
      { selector: 'link[rel="canonical"]', attribute: "href", value: "https://primegramx.co.ke/about" },
      { selector: 'meta[property="og:title"]', attribute: "content", value: "About Primegram X | Built in Kisumu, Kenya" },
      { selector: 'meta[property="og:description"]', attribute: "content", value: "Meet Primegram X, built in Kisumu, Kenya by MR. AURA." },
      { selector: 'meta[property="og:url"]', attribute: "content", value: "https://primegramx.co.ke/about" },
      { selector: 'meta[name="twitter:title"]', attribute: "content", value: "About Primegram X | Built in Kisumu, Kenya" },
      { selector: 'meta[name="twitter:description"]', attribute: "content", value: "Meet Primegram X, built in Kisumu, Kenya by MR. AURA." },
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
    <TrustPageLayout>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-48 top-16 size-[30rem] rounded-full bg-primary/[0.09] blur-[130px]" />
        <div className="absolute -right-48 top-[30rem] size-[32rem] rounded-full bg-slate-300/[0.06] blur-[140px]" />
      </div>

      <section className="relative z-10 mx-auto grid min-h-[78vh] w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 md:grid-cols-[1.05fr_.95fr] md:pb-28 md:pt-16">
        <div className="max-w-2xl">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.07] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-primary">
            <Sparkles className="size-4" aria-hidden="true" /> Built in Kisumu, Kenya by MR. AURA
          </p>
          <h1 className="text-5xl font-black leading-[1.02] tracking-[-0.055em] sm:text-6xl md:text-7xl">
            Social, in<br /><span className="bg-gradient-to-r from-primary via-slate-200 to-white bg-clip-text text-transparent">full colour.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Primegram X is a next-generation social, entertainment, and real-time connection platform for Gen Z. Built in Kisumu, Kenya by founder MR. AURA, it brings real-time feeds, stories, live rooms, music, sports, and creator communities together at primegramx.co.ke.
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
            <div className="liquid-glass mt-10 flex min-h-48 flex-col justify-between overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-slate-300/[0.07] to-transparent p-5 sm:min-h-56 sm:p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-slate-300/10 text-slate-200"><MessageCircle className="size-5" aria-hidden="true" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Connect</p><p className="mt-1 text-lg font-bold">Conversations that flow</p></div>
            </div>
            <div className="liquid-glass -mt-7 flex min-h-48 flex-col justify-between overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary/[0.08] to-transparent p-5 sm:min-h-56 sm:p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Heart className="size-5" aria-hidden="true" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Discover</p><p className="mt-1 text-lg font-bold">A feed that feels alive</p></div>
            </div>
            <div className="liquid-glass flex min-h-48 flex-col justify-between overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-slate-300/[0.07] to-transparent p-5 sm:min-h-56 sm:p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-slate-300/10 text-slate-200"><Trophy className="size-5" aria-hidden="true" /></span>
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Build your Aura</p><p className="mt-1 text-lg font-bold">Milestones worth earning</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="what-matters" className="relative z-10 border-y border-white/[0.08] bg-white/[0.02]">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-[.8fr_1.2fr] md:gap-20 md:py-28">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">The Primegram X experience</p>
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
          Founded and built in Kisumu, Kenya by MR. AURA, Primegram X brings Gen Z together through expressive social features, entertainment, and real-time connection.
        </p>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
        <div className="liquid-glass flex flex-col gap-5 rounded-[1.75rem] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Official contact &amp; verification</p>
            <h2 className="mt-2 text-xl font-bold">Need help or want to verify Primegram X?</h2>
            <p className="mt-2 text-sm text-muted-foreground">For support and official enquiries, contact the team directly.</p>
          </div>
          <div className="flex flex-col gap-3 text-sm sm:items-end">
            <a className="inline-flex items-center gap-2 font-semibold hover:text-primary" href="mailto:support@primegramx.co.ke"><Mail className="size-4 text-primary" aria-hidden="true" /> support@primegramx.co.ke</a>
            <a className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground" href="https://primegramx.co.ke"><Globe2 className="size-4" aria-hidden="true" /> https://primegramx.co.ke</a>
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

    </TrustPageLayout>
  );
};

export default AboutPage;
