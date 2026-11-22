import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

export interface Screen {
  name: string;
  path: string;
  /** Display name of the demo person, `staff:<name>`, `partner:<name>`, or `null` for signed out. */
  persona: string | null;
}

export const SCREENS: Screen[] = JSON.parse(
  readFileSync(path.resolve(__dirname, '..', 'routes.json'), 'utf8'),
) as Screen[];

/** Screens grouped by who is looking at them, so each test signs in once. */
export function screensByPersona(): Array<[string | null, Screen[]]> {
  const groups = new Map<string | null, Screen[]>();
  for (const screen of SCREENS) {
    groups.set(screen.persona, [...(groups.get(screen.persona) ?? []), screen]);
  }
  return [...groups.entries()];
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Signs in through the real mock sign-in screens — no shortcuts into storage. */
export async function signInAs(page: Page, persona: string): Promise<void> {
  const [kind, name] = persona.includes(':') ? persona.split(':') : ['citizen', persona];
  if (kind === 'staff' || kind === 'partner') {
    await page.goto(`/${kind}/`);
    await page
      .getByRole('button', { name: new RegExp(escape(name ?? '')) })
      .first()
      .click();
    await page.getByRole('button', { name: 'Sign out' }).first().waitFor();
    return;
  }
  await page.goto('/sign-in/');
  await page.getByRole('button', { name: new RegExp(escape(name ?? '')) }).click();
  const passkey = page.getByRole('button', { name: 'Continue with passkey' });
  if (await passkey.count()) {
    await passkey.click();
  } else {
    await page.getByLabel('6-digit code').fill('123456');
    await page.getByRole('button', { name: 'Sign in with code' }).click();
  }
  await page.waitForURL('**/home/');
}

/** Collects runtime errors, ignoring the 404s that come from prefetching optional routes. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
}
