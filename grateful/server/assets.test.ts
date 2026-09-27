import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { images } from '../src/data/images';
import { serviceSeed } from '../src/data/services';
import { work } from '../src/data/work';

/**
 * Every photograph the site asks for must exist in all three sizes, and the
 * images the client has retired must not creep back in.
 */

const RETIRED = /IMG_2438|whiteGarment/;

const onDisk = (src: string) => src.replace(/^.*images\//, 'public/images/');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|html|sql)$/.test(f) ? [p] : [];
  });
}

describe('site photography', () => {
  it('has all three sizes on disk for every catalogued image', () => {
    for (const img of Object.values(images)) {
      const base = onDisk(img.src);
      for (const suffix of ['-640.webp', '-1280.webp', '.jpeg']) expect(existsSync(base + suffix), base + suffix).toBe(true);
    }
  });

  it('only refers to catalogued images from work, services and the database seed', () => {
    const keys = new Set(Object.keys(images));
    for (const w of work) expect(keys.has(w.image), w.slug).toBe(true);
    for (const s of serviceSeed) expect(keys.has(s.image), s.id).toBe(true);
    const seedKeys = [...readFileSync('supabase/seed.sql', 'utf8').matchAll(/'(\w+(?:Gown|Look|Detail|Garment))'/g)].map((m) => m[1]!);
    for (const k of seedKeys) expect(keys.has(k), `seed.sql: ${k}`).toBe(true);
  });

  it('no longer references the retired white-shirt photograph anywhere', () => {
    const offenders = [...files('src'), ...files('server'), ...files('supabase'), 'index.html']
      .filter((f) => !f.endsWith('assets.test.ts'))
      .filter((f) => RETIRED.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('gives every image descriptive alt text', () => {
    for (const img of Object.values(images)) expect(img.alt.length).toBeGreaterThan(40);
  });
});
