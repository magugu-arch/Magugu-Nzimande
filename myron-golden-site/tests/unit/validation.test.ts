import { describe, expect, it } from 'vitest';
import {
  bookingSchema,
  contactSchema,
  fieldErrors,
  formDataToObject,
  newsletterSchema,
  speakingEnquirySchema,
} from '@/lib/validation';

const validEnquiry = {
  name: 'Ada Organiser',
  organisation: 'Example Association',
  email: 'ada@example.com',
  country: 'United States',
  eventType: 'Conference or keynote',
  requestedDate: '2027-03-10',
  alternativeDate: '',
  timezone: 'America/Chicago',
  format: 'In person',
  location: 'Dallas, TX',
  audienceSize: '200–500',
  audienceProfile: 'Small business owners',
  topic: 'Making offers',
  duration: '30–60 minutes',
  budget: '',
  travel: '',
  notes: '',
  consent: 'on',
};

describe('speaking enquiry', () => {
  it('accepts a complete enquiry and drops empty optional fields', () => {
    const r = speakingEnquirySchema.safeParse(validEnquiry);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.budget).toBeUndefined();
      expect(r.data.alternativeDate).toBeUndefined();
      expect(r.data.notes).toBeUndefined();
    }
  });

  it('requires consent, with a message that says what to do', () => {
    const r = speakingEnquirySchema.safeParse({ ...validEnquiry, consent: undefined });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).consent).toMatch(/^Confirm/);
  });

  // Regression: an unticked checkbox sends no key at all, and Zod 4 skips
  // refinements on absent optional keys — every form must still refuse it.
  it('refuses a form posted with the consent box unticked', () => {
    const post = (fields: Record<string, string>) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      return formDataToObject(fd);
    };
    const enquiry: Record<string, string> = { ...validEnquiry };
    delete enquiry.consent;
    const cases = [
      speakingEnquirySchema.safeParse(post(enquiry)),
      contactSchema.safeParse(
        post({
          category: 'general',
          name: 'Ada',
          email: 'ada@example.com',
          subject: 'Hello',
          message: 'A message long enough to send.',
        }),
      ),
      newsletterSchema.safeParse(post({ email: 'ada@example.com' })),
      bookingSchema.safeParse(
        post({ eventSlug: 'x', quantity: '1', name: 'Ada', email: 'ada@example.com' }),
      ),
    ];
    for (const r of cases) {
      expect(r.success).toBe(false);
      if (!r.success) expect(fieldErrors(r.error).consent).toMatch(/^Confirm/);
    }
  });

  it('rejects a malformed email and an invalid date', () => {
    const r = speakingEnquirySchema.safeParse({
      ...validEnquiry,
      email: 'not-an-email',
      requestedDate: '10/03/2027',
      alternativeDate: 'soon',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = fieldErrors(r.error);
      expect(Object.keys(e).sort()).toEqual(['alternativeDate', 'email', 'requestedDate']);
    }
  });

  it('rejects values outside the offered choices', () => {
    const r = speakingEnquirySchema.safeParse({ ...validEnquiry, format: 'Hologram' });
    expect(r.success).toBe(false);
  });

  it('caps field lengths', () => {
    const r = speakingEnquirySchema.safeParse({ ...validEnquiry, notes: 'x'.repeat(2001) });
    expect(r.success).toBe(false);
  });
});

describe('contact', () => {
  it('asks for enough detail to help', () => {
    const r = contactSchema.safeParse({
      category: 'support',
      name: 'A',
      email: 'a@example.com',
      subject: 'Help',
      message: 'hi',
      consent: 'on',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).message).toMatch(/more detail/);
  });
});

describe('newsletter', () => {
  it('accepts topic choices from the taxonomy only', () => {
    expect(
      newsletterSchema.safeParse({
        email: 'a@example.com',
        topics: ['offers-value'],
        consent: 'on',
      }).success,
    ).toBe(true);
    expect(
      newsletterSchema.safeParse({ email: 'a@example.com', topics: ['crypto'], consent: 'on' })
        .success,
    ).toBe(false);
  });
});

describe('formDataToObject', () => {
  it('turns repeated keys into arrays and skips framework fields', () => {
    const fd = new FormData();
    fd.append('email', 'a@example.com');
    fd.append('topics', 'offers-value');
    fd.append('topics', 'sales-closing');
    fd.append('$ACTION_ID_abc', '');
    expect(formDataToObject(fd, ['topics'])).toEqual({
      email: 'a@example.com',
      topics: ['offers-value', 'sales-closing'],
    });
  });

  it('gives an empty array when no box was ticked', () => {
    expect(formDataToObject(new FormData(), ['topics'])).toEqual({ topics: [] });
  });
});
