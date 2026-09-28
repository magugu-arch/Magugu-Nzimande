import { describe, expect, it } from 'vitest';
import { checkLaunchConfig } from './launch.ts';
import { newSecrets } from './secrets.ts';

describe('npm run gen:secrets', () => {
  it('makes values that pass the studio-key, newsletter and reminder launch checks', () => {
    const checks = checkLaunchConfig(newSecrets());
    for (const id of ['studio-key', 'newsletter-secret', 'cron']) expect(checks.find((c) => c.id === id)?.ok, id).toBe(true);
  });

  it('makes a different, URL-safe value every time', () => {
    const a = newSecrets();
    const b = newSecrets();
    expect(new Set([...Object.values(a), ...Object.values(b)]).size).toBe(6);
    for (const v of Object.values(a)) expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
