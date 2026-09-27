import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bookingConfirmedClient, contactNotificationStudio, newsletterWelcome } from './email/templates';

/**
 * Grateful is presented as a studio, not as one person (client instruction).
 * This guards the public copy and the emails against an individual's name
 * creeping back in, and checks every email is signed by the studio.
 */

const PERSONAL = /phindi|britou|nzimande/i;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|html|css)$/.test(f) ? [p] : [];
  });
}

describe('studio voice', () => {
  it('names no individual anywhere in the site, the server or the page head', () => {
    const offenders = [...files('src'), ...files('server'), ...files('shared'), 'index.html']
      .filter((f) => !f.endsWith('voice.test.ts'))
      .filter((f) => PERSONAL.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('signs every email as the studio', () => {
    const b = { bookingId: 'x', clientName: 'Lerato Dlamini', email: 'l@example.com', phone: '082', serviceName: 'Fittings & Alterations', durationMinutes: 45, date: '2026-10-06', time: '10:00', notes: '', paymentLabel: 'Not required' };
    const emails = [
      bookingConfirmedClient('https://grateful.example', b),
      contactNotificationStudio('https://grateful.example', { name: 'A', email: 'a@example.com', phone: '', subject: '', message: 'Hello there.' }, 'studio@example.com'),
      newsletterWelcome('https://grateful.example', 'a@example.com', 'https://grateful.example/unsubscribe'),
    ];
    for (const m of emails) {
      expect(m.html).toContain('Grateful Studio');
      expect(m.text).toContain('Grateful Studio');
      expect(PERSONAL.test(m.html + m.text)).toBe(false);
    }
  });
});
