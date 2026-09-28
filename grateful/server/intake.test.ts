import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contentFromIntake, emptyContent, PHOTO_KEYS, WORK_SLUGS } from '../shared/intake';
import { images } from '../src/data/images';
import { work } from '../src/data/work';

describe('launch checklist import', () => {
  it('turns no answers into empty content, and lists every photo permission still to confirm', () => {
    const { content, problems, followUp } = contentFromIntake({});
    expect(content).toEqual(emptyContent());
    expect(problems).toEqual([]);
    expect(followUp.filter((f) => f.startsWith('Photo permission'))).toHaveLength(PHOTO_KEYS.length);
  });

  it('uses good answers, tidying spacing and completing web addresses', () => {
    const { content, problems } = contentFromIntake({
      work01_name: '  Crimson   Hour ',
      work01_year: '2025',
      credit_greenGown: 'Photo: Studio Lens',
      rights_greenGown: true,
      social_instagram: 'instagram.com/gratefulstudio',
      social_facebook: 'https://facebook.com/grateful',
      privacy_officer: 'Director, Grateful (Pty) Ltd',
      privacy_email: 'privacy@grateful.co.za',
      privacy_retention: 'Invoices 5 years, enquiries 12 months',
    });
    expect(problems).toEqual([]);
    expect(content.work['garment-study-01']).toEqual({ title: 'Crimson Hour', year: 2025 });
    expect(content.credits.greenGown).toBe('Photo: Studio Lens');
    expect(content.social.instagram).toBe('https://instagram.com/gratefulstudio');
    expect(content.social.facebook).toBe('https://facebook.com/grateful');
    expect(content.privacy).toEqual({ officer: 'Director, Grateful (Pty) Ltd', email: 'privacy@grateful.co.za', retention: 'Invoices 5 years, enquiries 12 months' });
  });

  it('refuses answers the site cannot use safely, and says why', () => {
    const { content, problems } = contentFromIntake({
      work02_year: 'last year',
      social_tiktok: 'http://tiktok.com/@grateful',
      social_other: 'javascript:alert(1)',
      privacy_email: 'not an email',
    });
    expect(content.work['garment-study-02']!.year).toBeNull();
    expect(content.social.tiktok).toBeNull();
    expect(content.social.other).toBeNull();
    expect(content.privacy.email).toBeNull();
    expect(problems).toHaveLength(4);
  });

  it('sends dashboard answers (hours, prices) to the follow-up list, not the site file', () => {
    const { followUp } = contentFromIntake({ hours_text: 'Tue–Fri 09:00–17:00', prices_text: 'Consultation R500' });
    expect(followUp.some((f) => f.includes('Tue–Fri'))).toBe(true);
    expect(followUp.some((f) => f.includes('Consultation R500'))).toBe(true);
  });

  it('keeps studio-content.json in the shape the site reads, covering every garment study and photo', () => {
    const file = JSON.parse(readFileSync('src/data/studio-content.json', 'utf8'));
    expect(Object.keys(file).sort()).toEqual(Object.keys(emptyContent()).sort());
    expect(Object.keys(file.work).sort()).toEqual([...WORK_SLUGS].sort());
    expect(WORK_SLUGS.every((s) => work.some((w) => w.slug === s))).toBe(true);
    expect(Object.keys(file.credits).sort()).toEqual(Object.keys(images).sort());
  });
});
