/**
 * Guardrail scan over the source tree (brief §18, Appendix A):
 * synthetic data only, no secrets, no network calls, no real hosts.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');
const SOURCE_DIRS = ['apps/web/src', 'packages', 'services', 'infrastructure'];
const SKIP = new Set(['node_modules', '.next', 'out', 'generated']);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx|css|json|yaml)$/.test(entry.name) ? [full] : [];
  });
}

const files = SOURCE_DIRS.flatMap((dir) => walk(path.join(root, dir))).map((file) => ({
  name: path.relative(root, file),
  text: readFileSync(file, 'utf8'),
  isTest: /\.test\.tsx?$/.test(file),
}));
const manifest = readFileSync(path.join(root, 'assets', 'manifest.json'), 'utf8');

function offenders(pattern: RegExp, where = files): string[] {
  return where.flatMap((file) => {
    const match = file.text.match(pattern);
    return match ? [`${file.name}: ${match[0].slice(0, 60)}`] : [];
  });
}

describe('source tree guardrails', () => {
  it('scans a meaningful number of files', () => {
    expect(files.length).toBeGreaterThan(60);
  });

  it('contains nothing shaped like a South African identity number', () => {
    expect(offenders(/(?<![\d.])\d{13}(?![\d.])/)).toEqual([]);
    expect(manifest).not.toMatch(/(?<![\d.])\d{13}(?![\d.])/);
  });

  it('only uses example addresses for email', () => {
    const emails = files.flatMap((file) =>
      [...file.text.matchAll(/[\w.+-]+@([\w-]+\.)+[a-z]{2,}/gi)]
        .map((match) => match[0])
        .filter((email) => !/@example\.(org|com|gov\.za)$/i.test(email))
        .filter(
          (email) =>
            !/@(hao|fontsource|tanstack|testing-library|playwright|axe-core|vitejs)\b/i.test(email),
        )
        .map((email) => `${file.name}: ${email}`),
    );
    expect(emails).toEqual([]);
  });

  it('links only to example hosts', () => {
    const allowed = /^(example\.(gov\.za|org|com)|www\.w3\.org|127\.0\.0\.1|localhost)$/;
    const hosts = files.flatMap((file) =>
      [...file.text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)]
        .map((match) => match[1] ?? '')
        .filter((host) => !allowed.test(host))
        .map((host) => `${file.name}: ${host}`),
    );
    expect(hosts).toEqual([]);
  });

  it('makes no network calls from application code', () => {
    const production = files.filter((file) => !file.isTest);
    expect(
      offenders(
        /(?<![\w.])fetch\(|XMLHttpRequest|new WebSocket|sendBeacon|EventSource\(/,
        production,
      ),
    ).toEqual([]);
  });

  it('holds no credentials', () => {
    expect(
      offenders(/(api[_-]?key|secret|password)\s*[:=]\s*['"][A-Za-z0-9+/_-]{12,}['"]/i),
    ).toEqual([]);
    // Common live-key shapes, whatever the variable is called.
    expect(
      offenders(
        /\b(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|EAA[A-Za-z0-9]{30,})\b/,
      ),
    ).toEqual([]);
    expect(offenders(/-----BEGIN [A-Z ]*PRIVATE KEY-----/)).toEqual([]);
  });

  it('never accepts a real file upload', () => {
    expect(offenders(/type=["']file["']/)).toEqual([]);
  });

  it('draws no QR codes or barcodes', () => {
    expect(
      offenders(
        /qrcode|barcode\w*\s*\(|<QR/i,
        files.filter((file) => !file.isTest),
      ),
    ).toEqual([]);
  });
});
