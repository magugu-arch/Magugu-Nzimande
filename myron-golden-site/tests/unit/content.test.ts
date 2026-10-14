import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assetList, assets } from '@/content/assets';
import { books } from '@/content/books';
import { events } from '@/content/events';
import { content } from '@/content/learn';
import { programs } from '@/content/programs';
import { socialAccounts, verifiedSocials } from '@/content/site';
import {
  getBooks,
  getContent,
  getEvents,
  getPrograms,
  getTestimonials,
  isPublishable,
} from '@/lib/content';

/**
 * The brief's content rules, as tests: nothing demo or draft reaches
 * production, nothing is invented, and every record is sourced.
 */

describe('publishing rules', () => {
  it('never publishes demo records in production', () => {
    expect(isPublishable({ isDemo: true, status: 'active' }, 'production')).toBe(false);
    expect(getEvents('production')).toHaveLength(0);
    expect(getContent('production')).toHaveLength(0);
    expect(getTestimonials('production')).toHaveLength(0);
  });

  it('never publishes drafts or archived records in production', () => {
    const live = getPrograms('production');
    expect(live.map((p) => p.slug)).toEqual([
      'make-more-offers-challenge',
      'king-solomons-court',
      'vip-day-plus',
    ]);
    expect(getBooks('production').map((b) => b.slug)).not.toContain('million-dollar-identity');
  });

  it('shows drafts in preview so they can be reviewed, but never archived ones', () => {
    expect(isPublishable({ status: 'draft' }, 'preview')).toBe(true);
    expect(isPublishable({ status: 'archived' }, 'preview')).toBe(false);
    expect(getPrograms('preview').map((p) => p.slug)).not.toContain('offer-mastery');
  });
});

describe('nothing invented', () => {
  it('states no prices', () => {
    for (const p of programs) expect(p.priceDisplay).toBeNull();
  });

  it('writes no testimonial words', () => {
    for (const t of getTestimonials('preview')) {
      expect(t.quote).toBeNull();
      expect(t.approved).toBe(false);
    }
  });

  it('invents no ISBNs or publishers', () => {
    for (const b of books) {
      expect(b.isbn).toBeNull();
      expect(b.publisher).toBeNull();
    }
  });

  it('marks every event and library item as demo until real ones are supplied', () => {
    expect(events.every((e) => e.isDemo)).toBe(true);
    expect(content.every((c) => c.isDemo)).toBe(true);
  });
});

describe('sourcing', () => {
  it('gives every record a source and a review date', () => {
    for (const r of [...programs, ...books, ...events, ...content]) {
      expect(r.source.length).toBeGreaterThan(0);
      expect(r.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('routes every offer to an official https destination', () => {
    for (const p of programs) expect(p.cta.href).toMatch(/^https:\/\//);
  });
});

describe('social accounts', () => {
  it('publishes only the owner-confirmed TikTok handle', () => {
    expect(verifiedSocials.map((s) => s.handle)).toEqual(['@myrongoldenofficial']);
    expect(JSON.stringify(socialAccounts)).not.toContain('onlymanifested');
  });
});

describe('asset register', () => {
  it('has a file on disk for every asset', () => {
    for (const a of assetList) {
      expect(existsSync(path.join('public/images/myron', a.file)), a.file).toBe(true);
    }
  });

  it('resolves every image a record points at', () => {
    const ids = [
      ...programs.map((p) => p.image),
      ...books.flatMap((b) => (b.cover ? [b.cover] : [])),
      ...events.map((e) => e.image),
      ...content.map((c) => c.image),
    ];
    for (const id of ids) expect(assets[id], id).toBeDefined();
  });

  it('flags the book mock-ups as placeholders, never official covers', () => {
    for (const b of books.filter((b) => b.cover)) {
      expect(assets[b.cover!]!.status).toBe('placeholder-not-official');
      expect(assets[b.cover!]!.productArtwork).toBe(true);
    }
  });

  it('does not publish the identity reference', () => {
    expect(assets['MG-01']).toBeUndefined();
  });

  it('has nothing marked approved before the owner signs off', () => {
    expect(assetList.some((a) => a.status === 'approved')).toBe(false);
  });
});
