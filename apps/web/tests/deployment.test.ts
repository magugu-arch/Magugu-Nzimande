import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What a deployment has to be told, and what it must never be told.
 *
 * Every feature on this site fails closed without its secret, which is the
 * right behaviour and an invisible one: a deployment that forgets a variable
 * gets a working site with payments switched off and no error anywhere. The
 * defence is that the variables are documented, that the documentation cannot
 * silently fall behind the code, and that no secret is ever committed.
 */

const WEB = path.resolve(__dirname, '..');
const REPO = path.resolve(WEB, '../..');
const EXAMPLE = readFileSync(path.join(WEB, '.env.example'), 'utf8');

/** Every source file that could read an environment variable. */
function sourceFiles(): string[] {
  const roots = [path.join(WEB, 'src'), path.join(REPO, 'infra'), path.join(REPO, 'packages')];
  const walk = (directory: string): string[] => {
    if (!statSync(directory).isDirectory()) return [directory];
    return readdirSync(directory).flatMap((entry) => {
      if (entry === 'node_modules' || entry === '.next') return [];
      return walk(path.join(directory, entry));
    });
  };
  return roots.flatMap(walk).filter((file) => /\.(ts|tsx|mjs)$/.test(file));
}

const SOURCE = sourceFiles();

describe('the environment template', () => {
  /**
   * The check that stops the documentation rotting.
   *
   * A variable added to the code and not to this file is one a deployment
   * cannot know about, and the failure is silent by design — the feature simply
   * never switches on. Read out of the source rather than listed here, so
   * adding a variable is what makes this fail.
   */
  it('documents every BBQ_ variable the code reads', () => {
    const used = new Set<string>();
    for (const file of SOURCE) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\bBBQ_[A-Z_]+\b/g)) {
        used.add(match[0]);
      }
    }

    // Matched as a whole assignment at the start of a line, not as a substring.
    // `toContain` passed a rename of BBQ_SESSION_SECRET to BBQ_SESSION_SECRET_X,
    // because the longer name contains the shorter one — the mutation that
    // found this looked like it had been caught, by a different test.
    const documented = new Set(
      [...EXAMPLE.matchAll(/^([A-Z_]+)=/gm)].map((match) => match[1] as string),
    );

    expect(used.size, 'no variables found, so this test is checking nothing').toBeGreaterThan(0);
    for (const variable of used) {
      expect(
        documented.has(variable),
        `${variable} is read by the code and not documented in .env.example`,
      ).toBe(true);
    }
  });

  /** And the other way: a documented variable nothing reads is a false promise. */
  it('documents nothing the code does not read', () => {
    const documented = [...EXAMPLE.matchAll(/^([A-Z_]+)=/gm)].map((match) => match[1] as string);
    const source = SOURCE.map((file) => readFileSync(file, 'utf8')).join('\n');

    expect(documented.length).toBeGreaterThan(0);
    for (const variable of documented) {
      expect(source, `${variable} is documented and read by nothing`).toContain(variable);
    }
  });

  /**
   * Nothing here reaches the browser bundle, and a secret that did would be a
   * published secret with no build step to warn about it — brief §7.
   */
  it('exposes nothing to the browser', () => {
    for (const [, variable] of EXAMPLE.matchAll(/^([A-Z_]+)=/gm)) {
      expect(variable, 'NEXT_PUBLIC_ makes a value public').not.toMatch(/^NEXT_PUBLIC_/);
    }
  });

  /** A template with a value filled in is a template somebody has leaked into. */
  it('carries no value of its own', () => {
    for (const line of EXAMPLE.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const [name, value] = line.split('=');

      // BBQ_STATE_FILE names a path rather than a secret, and an example path
      // is the useful thing to show.
      if (name === 'BBQ_STATE_FILE') continue;
      expect(value, `${name} has a value in the committed template`).toBe('');
    }
  });
});

describe('the repository', () => {
  it('ignores the file real values go in', () => {
    const ignored = readFileSync(path.join(REPO, '.gitignore'), 'utf8');
    expect(ignored).toMatch(/\.env(\.local|\*)?/);
  });

  /**
   * Nothing that looks like a credential in the source.
   *
   * Deliberately narrow: it looks for assignment of a long literal to a name
   * that sounds like a secret, not for high-entropy strings, which would flag
   * every hash in every test. The point is to catch the copy-paste, not to be
   * a scanner.
   */
  it('has no secret assigned to a secret-sounding name', () => {
    const pattern =
      /\b(?:secret|password|passphrase|apiKey|api_key|token)\s*[:=]\s*['"][A-Za-z0-9+/=_-]{20,}['"]/gi;

    for (const file of SOURCE) {
      const found = readFileSync(file, 'utf8').match(pattern) ?? [];
      expect(found, `${path.relative(REPO, file)} assigns a literal credential`).toEqual([]);
    }
  });
});
