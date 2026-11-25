import { ArrowDown, ArrowRight, AtSign, Clock3, Globe2, Heart, LockKeyhole, Mail, MapPin, MessageCircle, Music2, PhoneCall, Play, Radio, Sparkles, Trophy, UserRound } from "lucide-react";
import TrustPageLayout from "@/components/TrustPageLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

const pillars = [
  { icon: Radio, number: "01", title: "Real-time social feeds", description: "Share updates, photos, and video, then follow the conversations moving through your community." },
  { icon: Clock3, number: "02", title: "24-hour stories", description: "Post everyday moments that stay in the spotlight for a day, then disappear from your story." },
  { icon: PhoneCall, number: "03", title: "Live audio and video rooms", description: "Meet face to face in WebRTC-powered calls and rooms for real-time conversations." },
  { icon: Music2, number: "04", title: "Music and sports hubs", description: "Discover sounds, entertainment, and sports content alongside the people you follow." },
  { icon: Trophy, number: "05", title: "Aura points and badges", description: "Build your Aura through participation, milestones, and profile badges." },
];

const founderStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://primegramx.co.ke/#website",
      name: "Primegram X",
      url: "https://primegramx.co.ke",
      publisher: { "@id": "https://primegramx.co.ke/#organization" },
    },
    {
      "@type": "Organization",
      "@id": "https://primegramx.co.ke/#organization",
      name: "Primegram X",
      url: "https://primegramx.co.ke",
      email: "support@primegramx.co.ke",
      founder: {
        "@type": "Person",
        name: "Javan Omeri",
        alternateName: ["MR. AURA", "JAVA PRIME ULTRA", "JP7 ULTRA"],
        homeLocation: { "@type": "Place", name: "Kisii, Kenya" },
        sameAs: ["@omerijavan", "java_prime_ultra"],
      },
    },
  ],
};

const AboutPage = () => {
  usePageMeta({
    title: "About Primegram X | Founded in Kisii, Kenya",
    description: "Meet Javan Omeri (MR. AURA), founder of Primegram X, a social, entertainment, and real-time connection platform created in Kisii, Kenya.",
    path: "/about",
  });

  return (
    <TrustPageLayout>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-48 top-16 size-[30rem] rounded-full bg-primary/[0.09] blur-[130px]" />
        <div className="absolute -right-48 top-[30rem] size-[32rem] rounded-full bg-slate-300/[0.06] blur-[140px]" />
      </div>

      <section className="relative z-10 mx-auto grid min-h-[78vh] w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 md:grid-cols-[1.05fr_.95fr] md:pb-28 md:pt-16">
        <div className="max-w-2xl">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.07] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-primary">
            <Sparkles className="size-4" aria-hidden="true" /> Created in Kisii, Kenya by Javan Omeri (MR. AURA)
          </p>
          <h1 className="text-5xl font-black leading-[1.02] tracking-[-0.055em] sm:text-6xl md:text-7xl">
            Social, in<br /><span className="bg-gradient-to-r from-primary via-fuchsia-300 to-white bg-clip-text text-transparent">full colour.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Primegram X is a next-generation social, entertainment, and real-time connection platform for Gen Z. Created in Kisii, Kenya by founder Javan Omeri (MR. AURA), it brings real-time feeds, stories, live rooms, music, sports, and creator communities together at primegramx.co.ke.
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

      <section aria-labelledby="founder-heading" className="relative z-10 border-y border-white/[0.08] bg-white/[0.02]">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 md:py-28">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/[0.07] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
              <Sparkles className="size-4" aria-hidden="true" /> MEET THE FOUNDER
            </p>
            <h2 id="founder-heading" className="text-3xl font-black tracking-tight sm:text-5xl">Built by Javan Omeri <span className="text-amber-200">(MR. AURA)</span></h2>
            <p className="mt-5 text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
              Primegram X was created in Kisii, Kenya by Javan Omeri—known across the digital and music space as MR. AURA (JAVA PRIME ULTRA / JP7 ULTRA). Built to merge refractive Liquid Glass design, real-time WebRTC connections, music discovery, and social feeds into one fast, expressive hub for Gen Z creators and communities.
            </p>
          </div>

          <article className="liquid-glass relative mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] md:grid-cols-[.78fr_1.22fr]">
            <div aria-hidden="true" className="absolute -left-16 -top-20 size-64 rounded-full bg-amber-300/[0.09] blur-[90px]" />
            <div className="relative flex flex-col justify-between gap-10 border-b border-white/[0.09] bg-gradient-to-br from-amber-300/[0.07] via-transparent to-primary/[0.06] p-7 sm:p-10 md:border-b-0 md:border-r">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200"><UserRound className="size-4" aria-hidden="true" /> Founder profile</div>
              <div>
                <img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/received_40112289315053478-VuqRS1IRIjnBXo3iIYNhyyJ3Q3E3D4.jpeg" alt="Javan Omeri at his gaming and development setup" className="mb-6 size-24 rounded-[1.8rem] border border-amber-200/25 object-cover shadow-[0_0_70px_hsla(45,90%,55%,.12)] sm:size-28" />
                <p className="text-2xl font-bold tracking-tight sm:text-3xl">Javan Omeri</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">MR. AURA <span className="px-1 text-amber-200">•</span> JAVA PRIME ULTRA <span className="px-1 text-amber-200">•</span> JP7 ULTRA</p>
                <p className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4 text-amber-200" aria-hidden="true" /> Kisii, Kenya</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-foreground/80">Founder</span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-foreground/80">Lead Developer</span>
                <span className="rounded-full border border-amber-200/20 bg-amber-200/[0.06] px-3 py-1.5 text-xs text-amber-100">Primegram X</span>
              </div>
            </div>

            <div className="relative flex flex-col gap-7 p-7 sm:p-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Founder &amp; Lead Developer, Primegram X</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">Independent digital creator &amp; music producer, bringing social technology and creative culture together.</p>
              </div>
              <div className="grid gap-5 border-y border-white/[0.09] py-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Handles</p>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium"><AtSign className="size-4 text-amber-200" aria-hidden="true" /> @omerijavan <span className="text-amber-200">•</span> java_prime_ultra</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Creative &amp; music</p>
                  <p className="mt-2 text-sm leading-6 text-foreground/90">Featured release: <span className="font-semibold italic">&quot;Golden Stay a Little&quot;</span> on YouTube</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-7">
                <a className="inline-flex items-center gap-2 font-semibold text-foreground transition-colors hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200" href="mailto:support@primegramx.co.ke"><Mail className="size-4 text-amber-200" aria-hidden="true" /> support@primegramx.co.ke</a>
                <a className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href="https://primegramx.co.ke"><Globe2 className="size-4" aria-hidden="true" /> https://primegramx.co.ke</a>
              </div>
            </div>
          </article>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(founderStructuredData) }} />

      <section className="relative z-10 mx-auto grid w-full max-w-7xl gap-8 px-5 py-20 sm:px-8 md:grid-cols-[.7fr_1.3fr] md:gap-20 md:py-24">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Our mission</p>
          <h2 className="mt-4 max-w-sm text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Make social feel more alive.</h2>
        </div>
        <p className="max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
          Founded and built in Kisii, Kenya by Javan Omeri (MR. AURA), Primegram X brings Gen Z together through expressive social features, entertainment, and real-time connection.
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
