import { useEffect } from 'react';
import { pageSeo, type PageSeo } from '../data/seo';

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Keep <head> in step with the page as the visitor moves around the site:
 * title, description, the social-preview tags and the canonical address.
 * The build writes the same values into each page's HTML (see seo.ts).
 */
export function useSeo({ title, description }: PageSeo) {
  useEffect(() => {
    document.title = title;
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    // The offline preview runs from file://, where a canonical address means nothing.
    if (!location.protocol.startsWith('http')) return;
    const url = location.origin + location.pathname;
    setMeta('meta[property="og:url"]', 'property', 'og:url', url);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;
  }, [title, description]);
}

/**
 * For pages outside search (booking steps, errors, the dashboard): a plain
 * title, and the home page's description. null → the home page's title.
 */
export function useTitle(title: string | null, description: string = pageSeo['/'].description) {
  useSeo({ title: title ? `${title} | Grateful` : pageSeo['/'].title, description });
}
