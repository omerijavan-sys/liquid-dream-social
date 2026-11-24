import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPage } from "@/utils/telemetry";

const PAGES: Record<string, { title: string; desc: string }> = {
  "/": { title: "Primegram Extreme (Primegram X) – Social Network for Reels, Music & Chat", desc: "Primegram Extreme, also written Primegram X, is a social network for Reels, photos, messaging, music discovery and creator communities. Join free on web and Android." },
  "/about": { title: "About Primegram Extreme (Primegram X) – Who We Are", desc: "Learn about Primegram X, the social network built by Java Prime in Kenya for creators, music lovers and friends." },
  "/help": { title: "Help Center – Primegram X", desc: "Get help with your Primegram X account, posting, messaging, wallet, safety and reporting." },
  "/privacy": { title: "Privacy Policy – Primegram X", desc: "How Primegram X collects, uses and protects your personal data, and your rights over it." },
  "/terms": { title: "Terms of Service & Community Rules – Primegram X", desc: "The Primegram X terms of service, community rules, copyright and takedown policy, and Primempire requirements." },
};
const set = (sel: string, make: () => HTMLElement, attr: string, val: string) => {
  let el = document.head.querySelector<HTMLElement>(sel);
  if (!el) { el = make(); document.head.appendChild(el); }
  el.setAttribute(attr, val);
};

/** Keeps title, description, canonical and OG tags correct per public route (crawlers run JS). */
const RouteSeo = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const path = pathname.replace(/\/+$/, "") || "/";
    const p = PAGES[path];
    // usage count by screen type only (profile/user ids are collapsed so no one is tracked by name)
    trackPage(path.replace(/^\/(u|user|profile|post|reel|chat)\/.+$/, "/$1/:id"));
    if (p) {
      set('meta[name="robots"]', () => Object.assign(document.createElement("meta"), { name: "robots" }), "content", "index, follow, max-image-preview:large, max-snippet:-1");
    } else {
      set('meta[name="robots"]', () => Object.assign(document.createElement("meta"), { name: "robots" }), "content", "noindex, nofollow");
    }
  }, [pathname]);
  return null;
};
export default RouteSeo;
