import {
  DEMO,
  SafeNotificationPayloadSchema,
  WhatsAppOptInSchema,
  WhatsAppTemplateSchema,
  WhatsAppWebhookEventSchema,
} from '@hao/api-contracts';
import { createLocalPlatform } from '@hao/local-platform';
import { maskReference } from '@hao/shared-types';
import { describe, expect, it } from 'vitest';
import { assertSafeForExternalChannel, createWhatsAppService, WHATSAPP_TEMPLATES } from './index';

const NOW = new Date('2026-11-21T08:00:00Z');
const KEY = { idempotencyKey: 'test-key' };
const { thandi, sipho } = DEMO.persons;
const MASKED = maskReference(DEMO.cases.passportInProduction);

function setup() {
  const platform = createLocalPlatform({ now: () => NOW });
  return { platform, whatsapp: createWhatsAppService(platform) };
}

function send(whatsapp: ReturnType<typeof createWhatsAppService>, personToken: string) {
  return whatsapp.sendTemplate({
    personToken,
    templateKey: 'application_status_changed_v1',
    maskedReference: MASKED,
    consentRef: DEMO.consents.thandiWhatsApp,
  });
}

describe('seed data', () => {
  it('opts Thandi in with her recorded consent and nobody else', async () => {
    const { whatsapp } = setup();
    const optIn = WhatsAppOptInSchema.parse(await whatsapp.getOptIn(thandi));
    expect(optIn).toMatchObject({ optedIn: true, consentRef: DEMO.consents.thandiWhatsApp });

    for (const person of [sipho, DEMO.persons.aisha, DEMO.persons.lerato]) {
      expect(await whatsapp.getOptIn(person)).toEqual({
        personToken: person,
        optedIn: false,
        consentRef: null,
        changedAt: null,
      });
    }
  });

  it('seeds a valid conversation for Thandi: an opt-in, then a template that was delivered and read', async () => {
    const { whatsapp } = setup();
    const events = await whatsapp.listWebhookEvents(thandi);
    for (const event of events) WhatsAppWebhookEventSchema.parse(event);
    expect(events.map((event) => event.kind)).toEqual([
      'OPT_IN',
      'TEMPLATE_SENT',
      'DELIVERED',
      'READ',
    ]);
    const times = events.map((event) => Date.parse(event.at));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times.every((time) => time < NOW.getTime())).toBe(true);
    expect(await whatsapp.listWebhookEvents(sipho)).toEqual([]);
  });
});

describe('template registry', () => {
  it('lists approved utility templates and one unused authentication entry', async () => {
    const { whatsapp } = setup();
    const templates = await whatsapp.listTemplates();
    for (const template of templates) WhatsAppTemplateSchema.parse(template);

    const utility = templates.filter((template) => template.category === 'UTILITY');
    expect(utility.length).toBeGreaterThanOrEqual(5);
    expect(utility.every((template) => template.approved)).toBe(true);
    expect(utility.map((template) => template.templateKey)).toEqual(
      expect.arrayContaining([
        'application_status_changed_v1',
        'action_required_v1',
        'appointment_reminder_v1',
        'ready_for_collection_v1',
        'callback_confirmed_v1',
      ]),
    );

    const unused = templates.filter((template) => template.category === 'AUTHENTICATION_NOT_USED');
    expect(unused).toHaveLength(1);
    expect(unused[0]?.approved).toBe(false);
    expect(unused[0]?.purpose).toMatch(/never sent on WhatsApp/);
  });

  it('keeps the status template wording exactly as approved', () => {
    const template = WHATSAPP_TEMPLATES.find(
      (candidate) => candidate.templateKey === 'application_status_changed_v1',
    );
    expect(template?.text).toBe(
      'There is an update to your Home Affairs application {{maskedReference}}. Sign in to view details: {{link}}',
    );
  });

  it('uses only the masked-reference and link placeholders, and safe wording', () => {
    for (const template of WHATSAPP_TEMPLATES) {
      const placeholders = [...template.text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]);
      for (const placeholder of placeholders) {
        expect(['maskedReference', 'link']).toContain(placeholder);
      }
      expect(() => assertSafeForExternalChannel(template.text)).not.toThrow();
    }
  });

  it('returns copies, so a caller cannot change the registry', async () => {
    const { whatsapp } = setup();
    const [first] = await whatsapp.listTemplates();
    if (first) first.approved = false;
    expect((await whatsapp.listTemplates())[0]?.approved).toBe(true);
  });
});

describe('assertSafeForExternalChannel', () => {
  it.each([
    ['an unmasked case reference', `Update on ${DEMO.cases.passportInProduction}`],
    ['a person token', `Hello ${thandi}`],
    ['an email address', 'Write to someone@example.org'],
    ['six or more digits in a row', 'Your code is 123456'],
    ['a long number', 'Call 0000000000 now'],
  ])('refuses %s', (_label, text) => {
    expect(() => assertSafeForExternalChannel(text)).toThrow(
      expect.objectContaining({ category: 'VALIDATION' }),
    );
  });

  it.each([
    'There is an update to your Home Affairs application ••••2481. Sign in to view details.',
    'Find a service point: https://example.gov.za/service-points',
    'Your appointment is at 10:30 on 21 November.',
  ])('allows %s', (text) => {
    expect(() => assertSafeForExternalChannel(text)).not.toThrow();
  });
});

describe('opting in and out', () => {
  it('records a consent reference and a chat confirmation when someone opts in', async () => {
    const { whatsapp } = setup();
    const optIn = WhatsAppOptInSchema.parse(await whatsapp.setOptIn(sipho, true, KEY));
    expect(optIn.optedIn).toBe(true);
    expect(optIn.consentRef).toMatch(/^CONSENT-DEMO-\d+$/);
    expect(optIn.changedAt).not.toBeNull();
    expect(await whatsapp.getOptIn(sipho)).toEqual(optIn);
    expect((await whatsapp.listWebhookEvents(sipho)).map((event) => event.kind)).toEqual([
      'OPT_IN',
    ]);
  });

  it('clears the consent reference and logs the opt-out', async () => {
    const { whatsapp } = setup();
    const optOut = await whatsapp.setOptIn(thandi, false, KEY);
    expect(optOut).toMatchObject({ optedIn: false, consentRef: null });
    expect((await whatsapp.listWebhookEvents(thandi)).at(-1)?.kind).toBe('OPT_OUT');
  });

  it('does nothing when the requested state is already recorded', async () => {
    const { whatsapp } = setup();
    const before = await whatsapp.listWebhookEvents(thandi);
    const optIn = await whatsapp.setOptIn(thandi, true, KEY);
    expect(optIn.consentRef).toBe(DEMO.consents.thandiWhatsApp);
    expect(await whatsapp.listWebhookEvents(thandi)).toEqual(before);
  });

  it('issues a new consent reference after opting out and back in', async () => {
    const { whatsapp } = setup();
    await whatsapp.setOptIn(thandi, false, KEY);
    const again = await whatsapp.setOptIn(thandi, true, KEY);
    expect(again.consentRef).toMatch(/^CONSENT-DEMO-\d+$/);
    expect(again.consentRef).not.toBe(DEMO.consents.thandiWhatsApp);
  });
});

describe('sendTemplate', () => {
  it('returns a safe payload and logs sent then delivered', async () => {
    const { whatsapp } = setup();
    const before = await whatsapp.listWebhookEvents(thandi);
    const payload = SafeNotificationPayloadSchema.parse(await send(whatsapp, thandi));

    expect(payload).toMatchObject({
      channel: 'WHATSAPP_TEMPLATE',
      templateKey: 'application_status_changed_v1',
      maskedReference: MASKED,
      message: `There is an update to your Home Affairs application ${MASKED}. Sign in to view details.`,
      secureDeepLink: 'https://example.gov.za/app/case/short-lived-token',
      consentRef: DEMO.consents.thandiWhatsApp,
    });
    expect(payload.eventId).toMatch(/^EVT-DEMO-\d+$/);
    expect(payload.message.length).toBeLessThanOrEqual(160);
    expect(payload.message).not.toContain('http');
    // Twenty minutes after 10:00 SAST.
    expect(payload.expiresAt).toBe('2026-11-21T10:20:00+02:00');

    const added = (await whatsapp.listWebhookEvents(thandi)).filter(
      (event) => !before.some((earlier) => earlier.webhookId === event.webhookId),
    );
    expect(added.map((event) => event.kind)).toEqual(['TEMPLATE_SENT', 'DELIVERED']);
    expect(added[0]?.text).toBe(
      `There is an update to your Home Affairs application ${MASKED}. Sign in to view details: https://example.gov.za/app/case/short-lived-token`,
    );
    expect(Date.parse(added[1]?.at ?? '') - Date.parse(added[0]?.at ?? '')).toBe(1000);
  });

  it('never gives the provider the person token or the case reference', async () => {
    const { whatsapp } = setup();
    const payload = await send(whatsapp, thandi);
    const outbound = JSON.stringify(payload);
    expect(outbound).not.toContain(thandi);
    expect(outbound).not.toContain(DEMO.cases.passportInProduction);
    expect(payload?.recipientToken).toMatch(/^CONTACT-DEMO-\d{4}$/);
  });

  it('sends nothing and logs nothing without an opt-in', async () => {
    const { whatsapp } = setup();
    expect(await send(whatsapp, sipho)).toBeNull();
    expect(await whatsapp.listWebhookEvents(sipho)).toEqual([]);

    await whatsapp.setOptIn(thandi, false, KEY);
    const before = await whatsapp.listWebhookEvents(thandi);
    expect(await send(whatsapp, thandi)).toBeNull();
    expect(await whatsapp.listWebhookEvents(thandi)).toEqual(before);
  });

  it.each(['no_such_template_v1', 'one_time_pin_not_used_v1'])(
    'refuses the template %s',
    async (templateKey) => {
      const { whatsapp } = setup();
      const before = await whatsapp.listWebhookEvents(thandi);
      await expect(
        whatsapp.sendTemplate({
          personToken: thandi,
          templateKey,
          maskedReference: MASKED,
          consentRef: DEMO.consents.thandiWhatsApp,
        }),
      ).rejects.toMatchObject({ category: 'VALIDATION' });
      expect(await whatsapp.listWebhookEvents(thandi)).toEqual(before);
    },
  );

  it.each([DEMO.cases.passportInProduction, '2481', '••••24810000'])(
    'refuses the unmasked or malformed reference %s',
    async (maskedReference) => {
      const { whatsapp } = setup();
      const before = await whatsapp.listWebhookEvents(thandi);
      await expect(
        whatsapp.sendTemplate({
          personToken: thandi,
          templateKey: 'application_status_changed_v1',
          maskedReference,
          consentRef: DEMO.consents.thandiWhatsApp,
        }),
      ).rejects.toMatchObject({ category: 'VALIDATION' });
      expect(await whatsapp.listWebhookEvents(thandi)).toEqual(before);
    },
  );

  it('can send every approved template', async () => {
    const { whatsapp } = setup();
    for (const template of WHATSAPP_TEMPLATES.filter((candidate) => candidate.approved)) {
      const payload = await whatsapp.sendTemplate({
        personToken: thandi,
        templateKey: template.templateKey,
        maskedReference: MASKED,
        consentRef: DEMO.consents.thandiWhatsApp,
      });
      SafeNotificationPayloadSchema.parse(payload);
      expect(payload?.message).not.toMatch(/\{\{|\}\}/);
    }
  });
});

describe('simulateInbound', () => {
  const choices = [
    'FIND_SERVICE_POINT',
    'GENERAL_GUIDANCE',
    'REQUEST_CALLBACK',
    'MY_APPLICATION',
    'SEND_DOCUMENT',
  ] as const;

  it('needs an opt-in first', async () => {
    const { whatsapp } = setup();
    await expect(whatsapp.simulateInbound(sipho, 'GENERAL_GUIDANCE', KEY)).rejects.toMatchObject({
      category: 'FORBIDDEN',
      safeMessage: expect.stringMatching(/^Opt in first/),
    });
    expect(await whatsapp.listWebhookEvents(sipho)).toEqual([]);
  });

  it.each(choices)('answers %s with the button tap and a safe reply', async (choice) => {
    const { whatsapp } = setup();
    const events = await whatsapp.simulateInbound(thandi, choice, KEY);
    for (const event of events) WhatsAppWebhookEventSchema.parse(event);

    expect(events[0]).toMatchObject({ direction: 'INBOUND', kind: 'MENU_CHOICE' });
    const replies = events.slice(1);
    expect(replies.length).toBeGreaterThan(0);
    for (const reply of replies) {
      expect(reply.direction).toBe('OUTBOUND');
      expect(() => assertSafeForExternalChannel(reply.text)).not.toThrow();
    }
    expect((await whatsapp.listWebhookEvents(thandi)).slice(-events.length)).toEqual(events);
  });

  it('hands off to the service-point finder', async () => {
    const { whatsapp } = setup();
    const events = await whatsapp.simulateInbound(thandi, 'FIND_SERVICE_POINT', KEY);
    const handoff = events.find((event) => event.kind === 'HANDOFF_LINK_SENT');
    expect(handoff?.text).toContain('https://example.gov.za/service-points');
  });

  it('confirms a call-back with the approved template and no personal detail', async () => {
    const { whatsapp } = setup();
    const events = await whatsapp.simulateInbound(thandi, 'REQUEST_CALLBACK', KEY);
    expect(events[1]).toMatchObject({
      kind: 'TEMPLATE_SENT',
      templateKey: 'callback_confirmed_v1',
    });
  });

  it('never shows application details in the chat', async () => {
    const { whatsapp } = setup();
    const events = await whatsapp.simulateInbound(thandi, 'MY_APPLICATION', KEY);
    expect(events).toHaveLength(2);
    expect(events[1]?.kind).toBe('HANDOFF_LINK_SENT');
    expect(events[1]?.text).toMatch(
      /^For your privacy we do not show application details in WhatsApp\. Sign in to the app to see them: https:\/\/example\.gov\.za\//,
    );
  });

  it('blocks an attempt to send a document', async () => {
    const { whatsapp } = setup();
    const events = await whatsapp.simulateInbound(thandi, 'SEND_DOCUMENT', KEY);
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      direction: 'OUTBOUND',
      kind: 'BLOCKED_UNSAFE_CONTENT',
      text: 'Please do not send documents, ID numbers or one-time PINs here. Use the secure upload in the app.',
    });
  });

  it('refuses a choice that is not on the menu', async () => {
    const { whatsapp } = setup();
    await expect(
      whatsapp.simulateInbound(thandi, 'SHARE_PASSWORD' as (typeof choices)[number], KEY),
    ).rejects.toMatchObject({ category: 'VALIDATION' });
  });
});

describe('the whole log', () => {
  it('holds only text that is safe for an external channel, oldest first', async () => {
    const { whatsapp } = setup();
    await send(whatsapp, thandi);
    await whatsapp.simulateInbound(thandi, 'MY_APPLICATION', KEY);
    await whatsapp.setOptIn(thandi, false, KEY);

    const events = await whatsapp.listWebhookEvents(thandi);
    for (const event of events) {
      expect(() => assertSafeForExternalChannel(event.text)).not.toThrow();
      expect(event.text).not.toContain(DEMO.cases.passportInProduction);
    }
    const times = events.map((event) => Date.parse(event.at));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('survives a new service instance on the same storage', async () => {
    const { platform, whatsapp } = setup();
    await whatsapp.setOptIn(sipho, true, KEY);
    const again = createWhatsAppService(platform);
    expect((await again.getOptIn(sipho)).optedIn).toBe(true);
    expect(await again.listWebhookEvents(thandi)).toEqual(await whatsapp.listWebhookEvents(thandi));
  });
});
