import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { setupSql } from './setupSql.ts';

describe('supabase/setup-all.sql', () => {
  const file = readFileSync(new URL('../supabase/setup-all.sql', import.meta.url), 'utf8');

  it('matches the migrations and seed (run npm run build:setup-sql after changing them)', () => {
    expect(file).toBe(setupSql());
  });

  it('runs every migration in order, then the seed', () => {
    const order = [...file.matchAll(/^-- ===== (.+) =====$/gm)].map((m) => m[1]);
    expect(order).toEqual(['migrations/0001_init.sql', 'migrations/0002_reschedule.sql', 'migrations/0003_reminders.sql', 'seed.sql']);
  });

  it('sets no prices, since none have been supplied', () => {
    // The seed only mentions a price update in a comment, as an example.
    expect(file).not.toMatch(/^\s*update\s+(public\.)?services\s+set\s+price/im);
  });
});
