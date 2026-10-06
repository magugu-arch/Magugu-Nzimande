import { describe, expect, it } from 'vitest';
import { publicState, toPublicCalendar } from '@/lib/booking/availability';
import { addDays, daysBetween, isIsoDate, monthGrid } from '@/lib/booking/dates';
import { calculateQuote, formatZar, parseRandToCents } from '@/lib/booking/quote';
import { BookingRequest } from '@/lib/booking/schemas';
import { availabilityFor, canTransition, TRANSITIONS } from '@/lib/booking/status';
import { BOOKING_STATUSES } from '@/lib/booking/types';
import { formatReference } from '@/lib/booking/service';

describe('quote arithmetic', () => {
  const lines = [
    { kind: 'performance' as const, description: 'Headline set', amountCents: 25_000_000 },
    { kind: 'travel' as const, description: 'Flights', amountCents: 1_234_567 },
  ];

  it('adds VAT once on the subtotal and splits deposit and balance exactly', () => {
    const t = calculateQuote(lines, { taxApplicable: true, taxRateBps: 1500, depositPercent: 50 });
    expect(t.subtotalCents).toBe(26_234_567);
    expect(t.taxCents).toBe(3_935_185);
    expect(t.totalCents).toBe(30_169_752);
    expect(t.depositCents + t.balanceCents).toBe(t.totalCents);
  });

  it('leaves tax off when not applicable', () => {
    const t = calculateQuote(lines, { taxApplicable: false, taxRateBps: 1500, depositPercent: 30 });
    expect(t.taxCents).toBe(0);
    expect(t.totalCents).toBe(26_234_567);
    expect(t.depositCents).toBe(Math.round(26_234_567 * 0.3));
  });

  it('rejects fractional cents and impossible deposits', () => {
    expect(() => calculateQuote([{ kind: 'travel', description: 'x', amountCents: 1.5 }], { taxApplicable: false, taxRateBps: 0, depositPercent: 50 })).toThrow();
    expect(() => calculateQuote(lines, { taxApplicable: false, taxRateBps: 0, depositPercent: 120 })).toThrow();
  });

  it('parses rand amounts as typed by people', () => {
    expect(parseRandToCents('R 12 500')).toBe(1_250_000);
    expect(parseRandToCents('12500,50')).toBe(1_250_050);
    expect(parseRandToCents('12,500.5')).toBe(1_250_050);
    expect(parseRandToCents('twelve')).toBeNull();
    expect(formatZar(1_250_050)).toMatch(/12\s?500,50/);
  });
});

describe('status machine', () => {
  it('never skips straight to confirmed', () => {
    for (const s of ['NEW', 'IN_REVIEW', 'ON_HOLD', 'QUOTE_SENT'] as const) expect(canTransition(s, 'CONFIRMED')).toBe(false);
    expect(canTransition('AWAITING_DEPOSIT', 'CONFIRMED')).toBe(true);
  });

  it('treats completed and cancelled as final', () => {
    expect(TRANSITIONS.COMPLETED).toEqual([]);
    expect(TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('defines a move list for every status', () => {
    for (const s of BOOKING_STATUSES) expect(Array.isArray(TRANSITIONS[s])).toBe(true);
  });

  it('holds the date from quote to deposit and blocks it once confirmed', () => {
    expect(availabilityFor('NEW')).toBeNull();
    expect(availabilityFor('QUOTE_SENT')).toBe('ON_HOLD');
    expect(availabilityFor('CONFIRMED')).toBe('CONFIRMED');
    expect(availabilityFor('CANCELLED')).toBeNull();
  });
});

describe('public calendar', () => {
  it('never distinguishes a confirmed booking from travel or a blackout', () => {
    expect(publicState('CONFIRMED')).toBe('unavailable');
    expect(publicState('TRAVEL')).toBe('unavailable');
    expect(publicState('UNAVAILABLE')).toBe('unavailable');
    expect(publicState('ON_HOLD')).toBe('limited');
    expect(publicState(undefined)).toBe('available');
  });

  it('exposes only a state per day', () => {
    const cal = toPublicCalendar(
      [{ date: '2030-01-02', state: 'CONFIRMED' }],
      ['2030-01-01', '2030-01-02', '2030-01-03'],
      '2030-01-02',
    );
    expect(cal).toEqual({ '2030-01-01': 'past', '2030-01-02': 'unavailable', '2030-01-03': 'available' });
  });
});

describe('dates', () => {
  it('validates real calendar days only', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2027-13-01')).toBe(false);
  });

  it('walks days without timezone drift', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-03-28', '2026-04-04')).toBe(7);
  });

  it('builds Monday-first month grids', () => {
    const grid = monthGrid(2026, 10);
    expect(grid[0]![0]).toBe('2026-09-28');
    expect(grid.flat()).toContain('2026-10-31');
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });
});

describe('references', () => {
  it('formats ZB-YYYY-XXXX', () => {
    expect(formatReference(2026, 7)).toBe('ZB-2026-0007');
    expect(formatReference(2026, 12345)).toBe('ZB-2026-12345');
  });
});

describe('booking request validation', () => {
  const valid = {
    eventDate: '2030-06-12',
    startTime: '19:30',
    endTime: '',
    eventType: 'corporate',
    performanceFormat: 'headline',
    expectedAttendance: '800',
    budgetRange: 'discuss',
    venue: 'Sandton Convention Centre',
    city: 'Johannesburg',
    country: 'South Africa',
    fullName: 'Thandi Mokoena',
    email: 'thandi@example.com',
    phone: '+27 82 000 0000',
    privacyConsent: 'on',
  };

  it('accepts a complete request and normalises it', () => {
    const r = BookingRequest.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.expectedAttendance).toBe(800);
      expect(r.data.travelRequired).toBe(false);
      expect(r.data.endTime).toBeUndefined();
      expect(r.data.organisation).toBeNull();
    }
  });

  it('requires consent, a real date and a reachable phone', () => {
    const r = BookingRequest.safeParse({ ...valid, privacyConsent: undefined, eventDate: '2030-02-30', phone: 'call me' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'));
      expect(paths).toEqual(expect.arrayContaining(['privacyConsent', 'eventDate', 'phone']));
    }
  });

  it('rejects anything in the honeypot', () => {
    expect(BookingRequest.safeParse({ ...valid, website: 'http://spam' }).success).toBe(false);
  });
});
