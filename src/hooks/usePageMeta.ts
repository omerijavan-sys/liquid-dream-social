import { useEffect } from "react";

type PageMeta = {
  title: string;
  description: string;
  path: string;
};

const SITE_URL = "https://primegramx.co.ke";

export function usePageMeta({ title, description, path }: PageMeta) {
  useEffect(() => {
    const canonicalUrl = `${SITE_URL}${path}`;
    document.title = title;

    let descriptionMeta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!descriptionMeta) {
      descriptionMeta = document.createElement("meta");
      descriptionMeta.name = "description";
      document.head.appendChild(descriptionMeta);
    }
    descriptionMeta.content = description;

    let ogUrlMeta = document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (!ogUrlMeta) {
      ogUrlMeta = document.createElement("meta");
      ogUrlMeta.setAttribute("property", "og:url");
      document.head.appendChild(ogUrlMeta);
    }
    ogUrlMeta.content = canonicalUrl;

    let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonicalUrl;
  }, [description, path, title]);
}
