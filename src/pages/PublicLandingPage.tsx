import { ArrowRight, Bot, Film, Globe2, MessageCircle, Music2, ShieldCheck, Sparkles } from "lucide-react";

const features = [
  {
    icon: Film,
    title: "Share moments",
    description: "Post photos, videos, and Reels, then discover what the community is creating.",
  },
  {
    icon: MessageCircle,
    title: "Stay connected",
    description: "Chat with friends, follow creators, and keep up with conversations.",
  },
  {
    icon: Music2,
    title: "Explore sounds",
    description: "Find music from around the world and add tracks to your posts.",
  },
  {
    icon: Bot,
    title: "More to explore",
    description: "Discover AI companions, entertainment, sports, and creator features.",
  },
];

const PublicLandingPage = () => (
  <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute -right-40 top-64 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />
    </div>

    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
      <a href="/" className="flex items-center gap-2 text-sm font-black tracking-wide text-primary" aria-label="Primegram home">
        <Sparkles className="h-5 w-5" />
        PRIMEGRAM EXTREME
      </a>
      <a href="/auth" className="rounded-full border border-primary/40 px-4 py-2 text-sm font-semibold transition-colors hover:bg-primary/10">
        Sign in
      </a>
    </header>

    <section className="relative z-10 mx-auto grid min-h-[65vh] w-full max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-[1.2fr_.8fr] md:py-24">
      <div>
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
          <Globe2 className="h-4 w-4" /> A social world for what you love
        </p>
        <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Connect, create, and discover on <span className="text-primary">Primegram</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Share photos and Reels, message friends, explore music, and find new creators and communities — all in one social app.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="/auth" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02]">
            Get started <ArrowRight className="h-4 w-4" />
          </a>
          <a href="/auth" className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold transition-colors hover:bg-secondary">
            Sign in or browse as guest
          </a>
        </div>
      </div>

      <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="absolute -inset-px -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-blue-500/20 blur-sm" />
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-bold">Your next connection starts here</h2>
            <p className="text-sm text-muted-foreground">A place to share and be discovered.</p>
          </div>
        </div>
        <ul className="mt-7 space-y-4">
          {features.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" /> Choose what you share and connect at your own pace.
        </p>
      </div>
    </section>

    <footer className="relative z-10 border-t border-white/10 px-5 py-6 text-center text-xs text-muted-foreground">
      © {new Date().getFullYear()} Primegram Extreme
    </footer>
  </main>
);

export default PublicLandingPage;
