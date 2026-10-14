import { describe, expect, it } from 'vitest';
import { contentHref, withUtm } from '@/lib/links';
import { createRateLimiter } from '@/lib/rate-limit';
import { normalise, search, type SearchDoc } from '@/lib/search';
import { buildSearchIndex } from '@/lib/search-index';

const docs: SearchDoc[] = [
  {
    id: '1',
    kind: 'Program',
    title: 'Make More Offers Challenge',
    href: '/a',
    summary: 'Five days on offers.',
  },
  {
    id: '2',
    kind: 'Article',
    title: 'Selling as service',
    href: '/b',
    summary: 'Sales conversations that serve.',
    keywords: ['sales'],
  },
  {
    id: '3',
    kind: 'Page',
    title: 'Speaking',
    href: '/c',
    summary: 'Book Myron to speak about offers.',
  },
];

describe('search', () => {
  it('ranks title matches above summary matches', () => {
    expect(search(docs, 'offers').map((h) => h.id)).toEqual(['1', '3']);
  });

  it('requires every word to match somewhere', () => {
    expect(search(docs, 'offers sales')).toHaveLength(0);
    expect(search(docs, 'selling service').map((h) => h.id)).toEqual(['2']);
  });

  it('ignores case, accents and punctuation', () => {
    expect(normalise('Café — OFFERS!')).toBe('cafe offers');
    expect(search(docs, 'MAKE-more')[0]?.id).toBe('1');
  });

  it('returns nothing for an empty query', () => {
    expect(search(docs, '   ')).toEqual([]);
  });

  it('finds the real catalogue', () => {
    const hits = search(buildSearchIndex(), 'offers');
    expect(hits[0]?.title).toBe('Make More Offers Challenge');
  });
});

describe('withUtm', () => {
  it('tags outbound links without clobbering existing values', () => {
    const url = new URL(
      withUtm('https://example.com/page?utm_source=keep#top', 'program-x', 'cta'),
    );
    expect(url.searchParams.get('utm_source')).toBe('keep');
    expect(url.searchParams.get('utm_medium')).toBe('referral');
    expect(url.searchParams.get('utm_campaign')).toBe('program-x');
    expect(url.searchParams.get('utm_content')).toBe('cta');
    expect(url.hash).toBe('#top');
  });

  it('leaves relative and non-web links alone', () => {
    expect(withUtm('/books', 'x')).toBe('/books');
    expect(withUtm('mailto:team@example.com', 'x')).toBe('mailto:team@example.com');
  });
});

describe('contentHref', () => {
  it('puts articles under insights and everything else under learn', () => {
    expect(contentHref({ type: 'article', slug: 'a' })).toBe('/insights/a');
    expect(contentHref({ type: 'video', slug: 'v' })).toBe('/learn/v');
  });
});

describe('rate limiter', () => {
  it('allows the limit then blocks until the window resets', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limiter.check('ip', 0)).toBe(true);
    expect(limiter.check('ip', 10)).toBe(true);
    expect(limiter.check('ip', 20)).toBe(false);
    expect(limiter.check('other', 20)).toBe(true);
    expect(limiter.check('ip', 1001)).toBe(true);
  });
});
