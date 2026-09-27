import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { indexablePages, pageSeo, withPageHead, workSeo } from '../src/data/seo';
import { nav } from '../src/data/site';
import { work } from '../src/data/work';

const pages = indexablePages(work);

describe('search metadata', () => {
  it('covers every page in the menu, the home page and each garment study', () => {
    const paths = pages.map((p) => p.path);
    for (const n of nav) expect(paths, n.to).toContain(n.to);
    expect(paths).toContain('/');
    for (const w of work) expect(paths).toContain(`/work/${w.slug}`);
  });

  it('keeps titles and descriptions within what Google shows, and unique per page', () => {
    for (const { path, meta } of pages) {
      expect(meta.title.length, `${path} title`).toBeLessThanOrEqual(62);
      expect(meta.description.length, `${path} description`).toBeGreaterThanOrEqual(70);
      expect(meta.description.length, `${path} description`).toBeLessThanOrEqual(160);
    }
    expect(new Set(pages.map((p) => p.meta.title)).size).toBe(pages.length);
    expect(new Set(pages.map((p) => p.meta.description)).size).toBe(pages.length);
  });

  it('names Johannesburg on every page a local client would search for', () => {
    for (const path of ['/', '/services', '/work', '/about', '/booking', '/contact'] as const) {
      expect(`${pageSeo[path].title} ${pageSeo[path].description}`, path).toMatch(/Johannesburg/);
    }
    for (const w of work) expect(workSeo(w).title).toMatch(/Johannesburg/);
  });

  it('rewrites a built page head: title, description, social tags and canonical', () => {
    const html = readFileSync('index.html', 'utf8');
    const out = withPageHead(html, { title: 'A & B | Grateful', description: 'Costs $1 "quoted" <here>' }, 'https://grateful.co.za/about');
    expect(out).toContain('<title>A &amp; B | Grateful</title>');
    expect(out).toContain('<meta name="description" content="Costs $1 &quot;quoted&quot; &lt;here&gt;"');
    expect(out).toContain('<meta property="og:title" content="A &amp; B | Grateful"');
    expect(out).toContain('<link rel="canonical" href="https://grateful.co.za/about" />');
    expect(out).toContain('<meta property="og:url" content="https://grateful.co.za/about" />');
    expect(withPageHead(out, pageSeo['/work'], null)).not.toMatch(/canonical|og:url/);
  });
});
