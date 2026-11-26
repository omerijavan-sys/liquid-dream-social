import type { CSSProperties, ReactNode } from "react";
import { ArrowUpRight, Mail } from "lucide-react";
import { Link } from "react-router-dom";

const TrustPageLayout = ({ children }: { children: ReactNode }) => (
  <main
    className="relative min-h-screen overflow-hidden bg-background text-foreground selection:bg-primary/25"
    style={{
      "--background": "228 55% 4%",
      "--foreground": "0 0% 98%",
      "--primary": "270 90% 68%",
      "--primary-foreground": "0 0% 100%",
      "--muted-foreground": "220 9% 68%",
      "--glass-bg": "225 25% 8%",
      "--glass-opacity": "0.52",
      "--glass-border-opacity": "0.13",
    } as CSSProperties}
  >
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-48 top-20 size-[34rem] rounded-full bg-violet-600/[0.18] blur-[140px]" />
      <div className="absolute -right-48 top-[28rem] size-[36rem] rounded-full bg-fuchsia-500/[0.10] blur-[150px]" />
    </div>

    <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <Link to="/" className="flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Primegram X home">
        <img src="/icons/x-logo-128.webp" alt="" width={42} height={42} className="h-[42px] w-[42px] rounded-xl shadow-[0_0_24px_rgba(168,85,247,.5)]" />
        <span className="text-sm font-extrabold tracking-[0.12em]">PRIMEGRAM <span className="text-primary">X</span></span>
      </Link>
      <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-5">
        <Link to="/about" className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">About</Link>
        <Link to="/auth" className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          Launch App <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </nav>
    </header>

    <div className="relative z-10">{children}</div>

    <footer className="relative z-10 border-t border-white/[0.09] px-5 py-7 sm:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="font-bold tracking-[0.12em] text-foreground">PRIMEGRAM <span className="text-primary">X</span></Link>
        <nav aria-label="Legal pages" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link className="transition-colors hover:text-foreground" to="/about">About</Link>
          <Link className="transition-colors hover:text-foreground" to="/privacy">Privacy</Link>
          <Link className="transition-colors hover:text-foreground" to="/terms">Terms</Link>
        </nav>
        <a className="inline-flex items-center gap-2 transition-colors hover:text-foreground" href="mailto:support@primegramx.co.ke">
          <Mail className="size-3.5" aria-hidden="true" /> support@primegramx.co.ke
        </a>
      </div>
      <p className="mx-auto mt-5 w-full max-w-7xl text-xs text-muted-foreground">© 2026 Aurora. Primegram X is a product of Aurora.</p>
    </footer>
  </main>
);

export default TrustPageLayout;
