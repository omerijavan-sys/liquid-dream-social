import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Copy, RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";
import { openLink } from "@/utils/openLink";

const OWN_HOSTS = [window.location.host];

/** Full-screen browser overlay. Listens for "prime:openLink" and turns external link clicks into in-app opens. */
const InAppBrowser = () => {
  const [url, setUrl] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onOpen = (e: Event) => { setUrl((e as CustomEvent<{ url: string }>).detail.url); setLoaded(false); setKey(k => k + 1); };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("data-external") || a.hasAttribute("download")) return;
      let u: URL;
      try { u = new URL(a.href, window.location.href); } catch { return; }
      if (!/^https?:$/.test(u.protocol) || OWN_HOSTS.includes(u.host)) return;
      e.preventDefault();
      void openLink(u.toString());
    };
    window.addEventListener("prime:openLink", onOpen);
    document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("prime:openLink", onOpen); document.removeEventListener("click", onClick, true); };
  }, []);

  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setUrl(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url]);

  if (!url) return null;
  let host = url;
  try { host = new URL(url).host; } catch { /* keep */ }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0b0a12] text-white">
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.06] px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-2xl">
        <button onClick={() => setUrl(null)} aria-label="Close browser" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs"><Lock className="h-3 w-3 shrink-0 text-emerald-300" /><span className="truncate">{host}</span></div>
        <button onClick={() => { setLoaded(false); setKey(k => k + 1); }} aria-label="Reload" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"><RefreshCw className="h-4 w-4" /></button>
        <button onClick={() => { void navigator.clipboard.writeText(url).then(() => toast.success("Link copied")); }} aria-label="Copy link" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"><Copy className="h-4 w-4" /></button>
        <a href={url} target="_blank" rel="noreferrer" data-external aria-label="Open in browser" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"><ExternalLink className="h-4 w-4" /></a>
      </div>
      <div className="relative flex-1 bg-white">
        <iframe key={key} src={url} title={host} onLoad={() => setLoaded(true)} className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" referrerPolicy="no-referrer-when-downgrade" />
        {!loaded && <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 animate-pulse bg-emerald-400" />}
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <a href={url} target="_blank" rel="noreferrer" data-external className="rounded-full bg-black/75 px-4 py-2 text-xs text-white backdrop-blur">Page blank? Open in your browser</a>
        </div>
      </div>
    </div>
  );
};

export default InAppBrowser;
