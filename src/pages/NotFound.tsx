import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const NotFound = () => (
  <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060914] px-5 py-16 text-white selection:bg-red-500/30">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-36 top-1/4 size-[28rem] rounded-full bg-red-600/15 blur-[130px]" />
      <div className="absolute -right-40 bottom-0 size-[30rem] rounded-full bg-slate-300/[0.07] blur-[140px]" />
    </div>
    <section className="liquid-glass relative z-10 w-full max-w-xl rounded-[2rem] px-7 py-12 text-center sm:px-12 sm:py-16">
      <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-red-300 shadow-[0_0_35px_rgba(220,38,38,0.18)]">
        <Sparkles className="size-4" aria-hidden="true" /> <span>404 · Aura drift</span>
      </div>
      <p className="mt-7 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-7xl font-black tracking-[-0.08em] text-transparent sm:text-8xl">404</p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">This page drifted outside the Aura</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-300">The link may be old, or the page may have moved. Let&apos;s get you back to Primegram X.</p>
      <Link to="/" className="mt-8 inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-[0_8px_30px_rgba(220,38,38,0.22)] transition-transform hover:-translate-y-0.5 hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060914]">
        <ArrowLeft className="size-4" aria-hidden="true" /> Return to Primegram X
      </Link>
    </section>
  </main>
);

export default NotFound;
