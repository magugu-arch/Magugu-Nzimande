import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

/**
 * INVENTORY.md against the repository it describes.
 *
 * The brief asks for a route map, a component inventory and an asset manifest
 * as deliverables. All three are the kind of document that is true the day it
 * is written and wrong a fortnight later — and a stale inventory is worse than
 * no inventory, because someone acts on it.
 *
 * So it is generated, and this re-runs the generator and fails if the result
 * differs from what is checked in. Adding a route or a component without
 * regenerating breaks the build rather than quietly desynchronising the docs.
 */
describe('INVENTORY.md', () => {
  it('exists and is marked generated', () => {
    const doc = fs.readFileSync(path.join(root, 'INVENTORY.md'), 'utf8');
    expect(doc.startsWith('<!-- GENERATED FILE')).toBe(true);
  });

  it('matches the repository it describes', () => {
    // `--check` exits non-zero, and prints how to fix it, when the two differ.
    expect(() =>
      execFileSync('node', ['scripts/generate-inventory.mjs', '--check'], {
        cwd: root,
        encoding: 'utf8',
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  it('is wired into the verify script, so CI regenerates it too', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['docs:inventory']).toBe('node scripts/generate-inventory.mjs');
  });
});
