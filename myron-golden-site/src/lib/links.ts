/**
 * Outbound links to the official platforms carry UTM parameters so the team
 * can see which page sent each visitor (brief §6, Programs). Existing query
 * strings and fragments are preserved; existing UTM values are not
 * overwritten.
 */
export function withUtm(href: string, campaign: string, content?: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return href;
  const set = (key: string, value: string) => {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  };
  set('utm_source', 'myrongolden-site');
  set('utm_medium', 'referral');
  set('utm_campaign', campaign);
  if (content) set('utm_content', content);
  return url.toString();
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** Articles live under /insights; videos and resources under /learn. */
export function contentHref(item: {
  type: 'video' | 'article' | 'resource';
  slug: string;
}): string {
  return item.type === 'article' ? `/insights/${item.slug}` : `/learn/${item.slug}`;
}
