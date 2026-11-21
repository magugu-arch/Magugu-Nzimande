import {
  type ApplicationCase,
  ApplicationCaseSchema,
  type CaseEvent,
  CaseEventSchema,
  ChannelPreferenceSchema,
  DEMO,
  InboxMessageSchema,
  type MessageEvent,
  MessageEventSchema,
  ServiceAlertSchema,
} from '@hao/api-contracts';
import { createLocalPlatform } from '@hao/local-platform';
import { CHANNELS, GatewayError, maskReference, STATUS_INFO } from '@hao/shared-types';
import { createWhatsAppService, type WhatsAppAdapter } from '@hao/whatsapp-adapter';
import { describe, expect, it } from 'vitest';
import { createNotificationsService } from './index';

const NOW = new Date('2026-11-21T08:00:00Z');
const NOW_ISO = '2026-11-21T10:00:00+02:00';
const KEY = { idempotencyKey: 'test-key' };
const { thandi, sipho, lerato, aisha } = DEMO.persons;
const NEW_PERSON = 'PERSON-DEMO-9ZZZ';
const CASE_ID = 'CASE-DEMO-001234';
const MASKED = maskReference(CASE_ID);

function makeCase(overrides: Partial<ApplicationCase> = {}): ApplicationCase {
  return ApplicationCaseSchema.parse({
    caseId: CASE_ID,
    serviceCode: 'TEST_SERVICE',
    serviceTitle: 'Replace a sample card',
    applicantToken: thandi,
    onBehalfOfLinkId: null,
    status: 'IN_VALIDATION',
    statusDetail: 'Identity and evidence checks',
    statusUpdatedAt: NOW_ISO,
    submittedAt: NOW_ISO,
    nextAction: null,
    milestones: [],
    assignedQueue: 'Identity documents',
    servicePointId: null,
    appointmentId: null,
    paymentRef: null,
    decision: null,
    dataClassification: 'RESTRICTED',
    sourceOfTruth: 'DHA_WORKFLOW_ADAPTER_MOCK',
    ...overrides,
  });
}

let eventCounter = 5000;
function makeEvent(overrides: Partial<CaseEvent> = {}): CaseEvent {
  eventCounter += 1;
  return CaseEventSchema.parse({
    eventId: `EVT-DEMO-${eventCounter}`,
    caseId: CASE_ID,
    type: 'VALIDATION_STARTED',
    at: NOW_ISO,
    status: 'IN_VALIDATION',
    title: 'Checks started',
    detail: 'We are checking the details and evidence you gave us.',
    actor: 'SYSTEM',
    correlationId: 'CORR-5001',
    ...overrides,
  });
}

const ACTION_CASE = makeCase({
  status: 'ACTION_REQUIRED',
  statusDetail: 'We need something from you',
  nextAction: {
    type: 'SELECT_SERVICE_POINT',
    description: 'Choose an approved service point for the next step',
    dueAt: null,
  },
});
const actionEvent = () =>
  makeEvent({
    type: 'INFORMATION_REQUESTED',
    status: 'ACTION_REQUIRED',
    title: 'Choose where to complete your application',
    detail: 'The next step happens in person. Choose an approved service point to continue.',
  });

function setup(
  options: {
    subject?: ApplicationCase;
    whatsapp?: (real: WhatsAppAdapter) => WhatsAppAdapter;
  } = {},
) {
  const platform = createLocalPlatform({ now: () => NOW });
  const realWhatsApp = createWhatsAppService(platform);
  const whatsapp = options.whatsapp ? options.whatsapp(realWhatsApp) : realWhatsApp;
  const cases = new Map<string, ApplicationCase>();
  const subject = options.subject ?? makeCase();
  cases.set(subject.caseId, subject);
  const workflow = {
    getCase: async (caseId: string) => {
      const found = cases.get(caseId);
      if (!found) throw new GatewayError('NOT_FOUND');
      return found;
    },
  };
  const notifications = createNotificationsService(platform, { whatsapp, workflow });
  return { platform, whatsapp: realWhatsApp, cases, notifications };
}

type Notifications = ReturnType<typeof createNotificationsService>;

/** Delivery records and inbox messages written since `before` was taken. */
async function added(
  notifications: Notifications,
  person: string,
  before: { events: MessageEvent[]; inbox: number },
) {
  const events = (await notifications.listMessageEvents(person)).filter(
    (event) => !before.events.some((earlier) => earlier.eventId === event.eventId),
  );
  const inbox = await notifications.listInbox(person);
  return { events, messages: inbox.slice(0, inbox.length - before.inbox) };
}

async function snapshot(notifications: Notifications, person: string) {
  return {
    events: await notifications.listMessageEvents(person),
    inbox: (await notifications.listInbox(person)).length,
  };
}

function byChannel(events: MessageEvent[]) {
  return Object.fromEntries(events.map((event) => [event.channel, event])) as Record<
    MessageEvent['channel'],
    MessageEvent
  >;
}

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

describe('seed data', () => {
  it('gives Thandi five valid messages across the categories, newest first', async () => {
    const { notifications } = setup();
    const inbox = await notifications.listInbox(thandi);
    for (const message of inbox) {
      InboxMessageSchema.parse(message);
      expect(message.contentVersion).toBe(DEMO.contentVersion);
      expect(message.templateKey).not.toBe('');
      expect(message.body.length).toBeGreaterThanOrEqual(1);
      expect(message.body.length).toBeLessThanOrEqual(3);
    }
    expect(inbox.map((message) => message.category)).toEqual([
      'ACTION_REQUIRED',
      'CASE_UPDATE',
      'SECURITY',
      'SERVICE_NOTICE',
      'RECEIPT',
    ]);
    const times = inbox.map((message) => Date.parse(message.sentAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('seeds the unread action for the Smart ID case with its link', async () => {
    const { notifications } = setup();
    const [first] = await notifications.listInbox(thandi);
    expect(first).toMatchObject({
      category: 'ACTION_REQUIRED',
      caseId: DEMO.cases.smartIdActionRequired,
      readAt: null,
      action: {
        label: 'Choose a service point',
        href: `/applications/case/?id=${DEMO.cases.smartIdActionRequired}`,
      },
    });
  });

  it('words the passport update without promising a date or an outcome', async () => {
    const { notifications } = setup();
    const update = (await notifications.listInbox(thandi)).find(
      (message) => message.category === 'CASE_UPDATE',
    );
    expect(update?.subject).toBe('Your passport application has moved to document production');
    expect(update?.caseId).toBe(DEMO.cases.passportInProduction);
    const text = update?.body.join(' ') ?? '';
    expect(text).not.toMatch(/\b(by|within|in)\s+\d|\bdays?\b|\bweeks?\b|approved|valid\b/i);
  });

  it('labels the sample receipt and the sample notice, and warns about sharing PINs', async () => {
    const { notifications } = setup();
    const inbox = await notifications.listInbox(thandi);
    const find = (category: string) => inbox.find((message) => message.category === category);
    expect(find('RECEIPT')?.body.join(' ')).toMatch(/sandbox/i);
    expect(find('RECEIPT')?.body.join(' ')).not.toMatch(/R\s?\d|\d+\.\d\d/);
    expect(find('SERVICE_NOTICE')?.subject).toMatch(/^Sample notice/);
    expect(find('SECURITY')?.subject).toBe('New sign-in to your account');
    expect(find('SECURITY')?.body.join(' ')).toMatch(
      /never ask for your password or a one-time PIN/,
    );
  });

  it('gives Sipho and Lerato a message or two, and Aisha an empty inbox', async () => {
    const { notifications } = setup();
    const siphoInbox = await notifications.listInbox(sipho);
    const leratoInbox = await notifications.listInbox(lerato);
    for (const message of [...siphoInbox, ...leratoInbox]) InboxMessageSchema.parse(message);
    expect(siphoInbox).toHaveLength(2);
    expect(siphoInbox.every((message) => message.caseId === DEMO.cases.birthInValidation)).toBe(
      true,
    );
    expect(leratoInbox).toHaveLength(1);
    expect(leratoInbox[0]).toMatchObject({
      category: 'APPOINTMENT',
      caseId: DEMO.cases.passportAbroadScheduled,
    });
    expect(await notifications.listInbox(aisha)).toEqual([]);
    expect(await notifications.listMessageEvents(aisha)).toEqual([]);
  });

  it('seeds a valid delivery log that keeps case references off external channels', async () => {
    const { notifications } = setup();
    for (const person of [thandi, sipho, lerato]) {
      const events = await notifications.listMessageEvents(person);
      expect(events.length).toBeGreaterThan(0);
      for (const event of events) {
        MessageEventSchema.parse(event);
        if (event.channel === 'SECURE_INBOX') continue;
        expect(event.caseId).toBeNull();
        expect(event.maskedReference).toMatch(/^••••[A-Za-z0-9]{4}$/);
        expect(JSON.stringify(event)).not.toMatch(/CASE-DEMO-/);
      }
      const times = events.map((event) => Date.parse(event.at));
      expect(times).toEqual([...times].sort((a, b) => b - a));
    }
  });

  it('seeds three sample alerts', async () => {
    const { notifications } = setup();
    const alerts = await notifications.listAlerts();
    for (const alert of alerts) {
      ServiceAlertSchema.parse(alert);
      expect(alert.sample).toBe(true);
      expect(Date.parse(alert.publishedAt)).toBeLessThan(NOW.getTime());
    }
    expect(alerts.map((alert) => [alert.kind, alert.severity, alert.title])).toEqual([
      ['FRAUD_WARNING', 'attention', 'We will never ask for your password or one-time PIN'],
      ['DISRUPTION', 'info', 'Sample notice: planned maintenance'],
      ['TRAVEL', 'info', 'Sample notice: check travel guidance before you fly'],
    ]);
    expect(alerts[0]?.body).toMatch(/phone, WhatsApp, SMS or email/);
    expect(alerts[0]?.body).toMatch(/inside the secure service/);
    // Alerts keep their published time between reads.
    expect(await notifications.listAlerts()).toEqual(alerts);
  });
});

/* ------------------------------------------------------------------ */
/* Preferences                                                         */
/* ------------------------------------------------------------------ */

describe('preferences', () => {
  it('default to the secure inbox only: every other channel is opt-in', async () => {
    const { notifications } = setup();
    const preferences = await notifications.listPreferences(NEW_PERSON);
    for (const preference of preferences) ChannelPreferenceSchema.parse(preference);
    expect(preferences.map((preference) => preference.channel)).toEqual([...CHANNELS]);
    expect(preferences.map((preference) => [preference.channel, preference.enabled])).toEqual([
      ['SECURE_INBOX', true],
      ['PUSH', false],
      ['WHATSAPP', false],
      ['EMAIL', false],
      ['SMS', false],
    ]);
    for (const preference of preferences) {
      expect(preference.purpose).toBe('TRANSACTIONAL');
      if (preference.enabled) {
        expect(preference.consentRef).toMatch(/^CONSENT-DEMO-\d+$/);
        expect(preference.consentedAt).not.toBeNull();
      } else {
        expect(preference.consentRef).toBeNull();
        expect(preference.consentedAt).toBeNull();
      }
    }
    // The defaults are created once, not on every read.
    expect(await notifications.listPreferences(NEW_PERSON)).toEqual(preferences);
  });

  it('seed Thandi with WhatsApp on under her recorded consent, and the others with it off', async () => {
    const { notifications } = setup();
    const whatsAppFor = async (person: string) =>
      (await notifications.listPreferences(person)).find((row) => row.channel === 'WHATSAPP');
    expect(await whatsAppFor(thandi)).toMatchObject({
      enabled: true,
      consentRef: DEMO.consents.thandiWhatsApp,
    });
    expect((await whatsAppFor(thandi))?.consentedAt).not.toBeNull();
    for (const person of [sipho, lerato, aisha]) {
      expect(await whatsAppFor(person)).toMatchObject({ enabled: false, consentRef: null });
    }
  });

  it('never let the secure inbox be switched off', async () => {
    const { notifications } = setup();
    await expect(
      notifications.setPreference(thandi, 'SECURE_INBOX', false, KEY),
    ).rejects.toMatchObject({
      category: 'VALIDATION',
      safeMessage: 'The secure inbox stays on so you never miss an official notice.',
    });
    const preferences = await notifications.setPreference(thandi, 'SECURE_INBOX', true, KEY);
    expect(preferences.find((row) => row.channel === 'SECURE_INBOX')?.enabled).toBe(true);
  });

  it('withdraw consent when a channel is switched off and record new consent when it is switched on', async () => {
    const { notifications } = setup();
    const before = (await notifications.listPreferences(thandi)).find(
      (row) => row.channel === 'EMAIL',
    );

    const off = (await notifications.setPreference(thandi, 'EMAIL', false, KEY)).find(
      (row) => row.channel === 'EMAIL',
    );
    expect(off).toMatchObject({
      enabled: false,
      consentRef: null,
      consentedAt: null,
      updatedAt: NOW_ISO,
    });

    const on = (await notifications.setPreference(thandi, 'EMAIL', true, KEY)).find(
      (row) => row.channel === 'EMAIL',
    );
    expect(on).toMatchObject({ enabled: true, consentedAt: NOW_ISO });
    expect(on?.consentRef).toMatch(/^CONSENT-DEMO-\d+$/);
    expect(on?.consentRef).not.toBe(before?.consentRef);

    // Asking for the state a channel is already in records nothing new.
    const again = await notifications.setPreference(thandi, 'EMAIL', true, KEY);
    expect(again.find((row) => row.channel === 'EMAIL')).toEqual(on);
    for (const preference of again) ChannelPreferenceSchema.parse(preference);
  });

  it('refuse a channel that does not exist', async () => {
    const { notifications } = setup();
    await expect(
      notifications.setPreference(thandi, 'FAX' as (typeof CHANNELS)[number], true, KEY),
    ).rejects.toMatchObject({ category: 'VALIDATION' });
  });

  it('keep the WhatsApp preference and the adapter opt-in in step', async () => {
    const { notifications, whatsapp } = setup();
    const whatsAppRow = async () =>
      (await notifications.listPreferences(sipho)).find((row) => row.channel === 'WHATSAPP');

    const on = (await notifications.setPreference(sipho, 'WHATSAPP', true, KEY)).find(
      (row) => row.channel === 'WHATSAPP',
    );
    const optIn = await whatsapp.getOptIn(sipho);
    expect(optIn.optedIn).toBe(true);
    expect(on).toMatchObject({
      enabled: true,
      consentRef: optIn.consentRef,
      consentedAt: optIn.changedAt,
    });
    expect(on?.consentRef).toMatch(/^CONSENT-DEMO-\d+$/);
    expect((await whatsapp.listWebhookEvents(sipho)).map((event) => event.kind)).toEqual([
      'OPT_IN',
    ]);

    await notifications.setPreference(sipho, 'WHATSAPP', false, KEY);
    expect(await whatsapp.getOptIn(sipho)).toMatchObject({ optedIn: false, consentRef: null });
    expect(await whatsAppRow()).toMatchObject({
      enabled: false,
      consentRef: null,
      consentedAt: null,
    });

    // A change made on the adapter side shows up here too.
    const direct = await whatsapp.setOptIn(sipho, true, KEY);
    expect(await whatsAppRow()).toMatchObject({ enabled: true, consentRef: direct.consentRef });
    await whatsapp.setOptIn(thandi, false, KEY);
    expect(
      (await notifications.listPreferences(thandi)).find((row) => row.channel === 'WHATSAPP'),
    ).toMatchObject({ enabled: false, consentRef: null });
  });
});

/* ------------------------------------------------------------------ */
/* Inbox                                                               */
/* ------------------------------------------------------------------ */

describe('inbox', () => {
  it('marks a message read once and keeps the first time', async () => {
    let now = NOW;
    const platform = createLocalPlatform({ now: () => now });
    const notifications = createNotificationsService(platform, {
      whatsapp: createWhatsAppService(platform),
      workflow: { getCase: async () => makeCase() },
    });
    const [unread] = await notifications.listInbox(thandi);
    const messageId = unread?.messageId ?? '';
    expect(unread?.readAt).toBeNull();

    const read = await notifications.markRead(messageId, KEY);
    expect(read.readAt).toBe(NOW_ISO);
    now = new Date(NOW.getTime() + 60_000);
    expect((await notifications.markRead(messageId, KEY)).readAt).toBe(NOW_ISO);
    expect(await notifications.getMessage(messageId)).toEqual(read);
  });

  it('reports a message that does not exist', async () => {
    const { notifications } = setup();
    await expect(notifications.getMessage('MSG-DEMO-9999')).rejects.toMatchObject({
      category: 'NOT_FOUND',
    });
    await expect(notifications.markRead('MSG-DEMO-9999', KEY)).rejects.toMatchObject({
      category: 'NOT_FOUND',
    });
  });
});

/* ------------------------------------------------------------------ */
/* Case events                                                         */
/* ------------------------------------------------------------------ */

describe('handleCaseEvent', () => {
  it('writes exactly one inbox message and one delivery record per channel', async () => {
    const { notifications, whatsapp } = setup();
    const before = await snapshot(notifications, thandi);
    const chatBefore = await whatsapp.listWebhookEvents(thandi);

    await notifications.handleCaseEvent(makeEvent());
    const { events, messages } = await added(notifications, thandi, before);

    expect(messages).toHaveLength(1);
    expect(InboxMessageSchema.parse(messages[0])).toMatchObject({
      recipientToken: thandi,
      caseId: CASE_ID,
      category: 'CASE_UPDATE',
      subject: 'Checks started',
      sentAt: NOW_ISO,
      readAt: null,
      action: { label: 'View application', href: `/applications/case/?id=${CASE_ID}` },
      templateKey: 'application_status_changed_v1',
      contentVersion: DEMO.contentVersion,
    });
    expect(messages[0]?.body.join(' ')).toContain(STATUS_INFO.IN_VALIDATION.rule);
    expect(messages[0]?.body.join(' ')).toContain('Replace a sample card');
    expect(new Set(messages[0]?.body).size).toBe(messages[0]?.body.length);

    expect(events).toHaveLength(CHANNELS.length);
    for (const event of events) {
      MessageEventSchema.parse(event);
      expect(event).toMatchObject({
        recipientToken: thandi,
        templateKey: 'application_status_changed_v1',
        maskedReference: MASKED,
        at: NOW_ISO,
        contentVersion: DEMO.contentVersion,
      });
    }
    const log = byChannel(events);
    expect(Object.keys(log).sort()).toEqual([...CHANNELS].sort());
    expect(log.SECURE_INBOX).toMatchObject({
      deliveryStatus: 'DELIVERED',
      consentState: 'NOT_REQUIRED',
      note: null,
    });
    for (const channel of ['PUSH', 'EMAIL', 'SMS', 'WHATSAPP'] as const) {
      expect(log[channel]).toMatchObject({
        deliveryStatus: 'DELIVERED',
        consentState: 'CONSENTED',
        note: null,
      });
    }

    // Thandi has opted in, so the approved template went out on WhatsApp.
    const chat = (await whatsapp.listWebhookEvents(thandi)).filter(
      (entry) => !chatBefore.some((earlier) => earlier.webhookId === entry.webhookId),
    );
    expect(chat.map((entry) => [entry.kind, entry.templateKey])).toEqual([
      ['TEMPLATE_SENT', 'application_status_changed_v1'],
      ['DELIVERED', 'application_status_changed_v1'],
    ]);
    expect(chat[0]?.text).toContain(MASKED);
    expect(chat[0]?.text).not.toContain(CASE_ID);
  });

  it('keeps the case reference off every external channel', async () => {
    const { notifications } = setup();
    const before = await snapshot(notifications, thandi);
    await notifications.handleCaseEvent(makeEvent());
    const { events } = await added(notifications, thandi, before);

    const external = events.filter((event) => event.channel !== 'SECURE_INBOX');
    expect(external).toHaveLength(4);
    for (const event of external) {
      expect(event.caseId).toBeNull();
      expect(event.maskedReference).toBe(MASKED);
    }
    expect(JSON.stringify(external)).not.toContain(CASE_ID);
    // The secure inbox sits behind sign-in, so its own record may name the case.
    expect(byChannel(events).SECURE_INBOX.caseId).toBe(CASE_ID);
  });

  it('suppresses a channel that was switched off, and says why', async () => {
    const { notifications } = setup();
    await notifications.setPreference(thandi, 'SMS', false, KEY);
    await notifications.setPreference(thandi, 'PUSH', false, KEY);
    const before = await snapshot(notifications, thandi);

    await notifications.handleCaseEvent(makeEvent());
    const { events, messages } = await added(notifications, thandi, before);
    const log = byChannel(events);

    for (const channel of ['SMS', 'PUSH'] as const) {
      expect(log[channel]).toMatchObject({
        deliveryStatus: 'SUPPRESSED',
        consentState: 'NOT_CONSENTED',
        note: 'You have switched this channel off.',
      });
    }
    expect(log.EMAIL.deliveryStatus).toBe('DELIVERED');
    expect(log.SECURE_INBOX.deliveryStatus).toBe('DELIVERED');
    expect(messages).toHaveLength(1);
  });

  it('sends nothing on WhatsApp without an opt-in, and logs the reason', async () => {
    const { notifications, whatsapp } = setup({ subject: makeCase({ applicantToken: sipho }) });
    const before = await snapshot(notifications, sipho);

    await notifications.handleCaseEvent(makeEvent());
    const { events, messages } = await added(notifications, sipho, before);

    expect(byChannel(events).WHATSAPP).toMatchObject({
      deliveryStatus: 'SUPPRESSED',
      consentState: 'NOT_CONSENTED',
      caseId: null,
    });
    expect(byChannel(events).WHATSAPP.note).toMatch(/not opted in to WhatsApp/);
    expect(await whatsapp.listWebhookEvents(sipho)).toEqual([]);
    expect(messages).toHaveLength(1);
    expect(events).toHaveLength(CHANNELS.length);
  });

  it('follows a WhatsApp opt-out made through the preferences', async () => {
    const { notifications, whatsapp } = setup();
    await notifications.setPreference(thandi, 'WHATSAPP', false, KEY);
    const chatBefore = await whatsapp.listWebhookEvents(thandi);
    const before = await snapshot(notifications, thandi);

    await notifications.handleCaseEvent(makeEvent());
    const { events } = await added(notifications, thandi, before);
    expect(byChannel(events).WHATSAPP.deliveryStatus).toBe('SUPPRESSED');
    expect(await whatsapp.listWebhookEvents(thandi)).toEqual(chatBefore);
  });

  it('treats a suppressed send from the adapter as suppressed', async () => {
    const { notifications } = setup({
      whatsapp: (real) => ({ ...real, sendTemplate: async () => null }),
    });
    const before = await snapshot(notifications, thandi);
    await notifications.handleCaseEvent(makeEvent());
    const { events } = await added(notifications, thandi, before);
    expect(byChannel(events).WHATSAPP).toMatchObject({
      deliveryStatus: 'SUPPRESSED',
      consentState: 'NOT_CONSENTED',
    });
  });

  it('records a WhatsApp failure and carries on with the other channels', async () => {
    const { notifications } = setup({
      whatsapp: (real) => ({
        ...real,
        sendTemplate: async () => {
          throw new Error('provider unavailable');
        },
      }),
    });
    const before = await snapshot(notifications, thandi);

    await notifications.handleCaseEvent(makeEvent());
    const { events, messages } = await added(notifications, thandi, before);
    const log = byChannel(events);

    expect(log.WHATSAPP).toMatchObject({
      deliveryStatus: 'FAILED',
      consentState: 'CONSENTED',
      caseId: null,
    });
    expect(log.WHATSAPP.note).toMatch(/Sent on your other channels instead\.$/);
    expect(log.WHATSAPP.note).not.toContain('provider unavailable');
    for (const channel of ['SECURE_INBOX', 'PUSH', 'EMAIL', 'SMS'] as const) {
      expect(log[channel].deliveryStatus).toBe('DELIVERED');
    }
    expect(messages).toHaveLength(1);
    expect(events).toHaveLength(CHANNELS.length);
  });

  it('flags an action, says what to do, and uses the action template', async () => {
    const { notifications, whatsapp } = setup({ subject: ACTION_CASE });
    const before = await snapshot(notifications, thandi);

    await notifications.handleCaseEvent(actionEvent());
    const { events, messages } = await added(notifications, thandi, before);

    expect(messages[0]).toMatchObject({
      category: 'ACTION_REQUIRED',
      subject: 'Choose where to complete your application',
      action: { label: 'Choose a service point', href: `/applications/case/?id=${CASE_ID}` },
      templateKey: 'action_required_v1',
    });
    const body = messages[0]?.body.join(' ') ?? '';
    expect(body).toContain(STATUS_INFO.ACTION_REQUIRED.rule);
    expect(body).toContain('Choose an approved service point for the next step.');
    expect(events.every((event) => event.templateKey === 'action_required_v1')).toBe(true);
    const sent = (await whatsapp.listWebhookEvents(thandi)).filter(
      (entry) => entry.kind === 'TEMPLATE_SENT',
    );
    expect(sent.at(-1)?.templateKey).toBe('action_required_v1');
  });

  it('files appointment events under appointments', async () => {
    const { notifications } = setup({
      subject: makeCase({ status: 'SCHEDULED', statusDetail: 'Appointment confirmed' }),
    });
    const before = await snapshot(notifications, thandi);
    for (const type of ['APPOINTMENT_BOOKED', 'APPOINTMENT_CHANGED'] as const) {
      await notifications.handleCaseEvent(
        makeEvent({ type, status: 'SCHEDULED', title: 'Appointment booked' }),
      );
    }
    const { messages } = await added(notifications, thandi, before);
    expect(messages.map((message) => message.category)).toEqual(['APPOINTMENT', 'APPOINTMENT']);
    expect(messages[0]?.templateKey).toBe('application_status_changed_v1');
  });

  it('uses the status the event recorded, even if the case has since moved on', async () => {
    // The case is already waiting on the person, but this older event was only the start of checks.
    const { notifications } = setup({ subject: ACTION_CASE });
    const before = await snapshot(notifications, thandi);
    await notifications.handleCaseEvent(makeEvent());
    const { messages } = await added(notifications, thandi, before);
    expect(messages[0]).toMatchObject({
      category: 'CASE_UPDATE',
      action: { label: 'View application' },
    });
    expect(messages[0]?.body.join(' ')).not.toContain('What to do next');
  });

  it('handles each event once, however often it arrives', async () => {
    const { notifications } = setup();
    const before = await snapshot(notifications, thandi);
    const event = makeEvent();
    await notifications.handleCaseEvent(event);
    await notifications.handleCaseEvent(event);
    await Promise.all([notifications.handleCaseEvent(event), notifications.handleCaseEvent(event)]);
    const { events, messages } = await added(notifications, thandi, before);
    expect(messages).toHaveLength(1);
    expect(events).toHaveLength(CHANNELS.length);
  });

  it('fails without writing anything when the case cannot be found, and can be retried', async () => {
    const { notifications, cases } = setup();
    const event = makeEvent({ caseId: 'CASE-DEMO-005678' });
    const before = await snapshot(notifications, thandi);

    await expect(notifications.handleCaseEvent(event)).rejects.toMatchObject({
      category: 'NOT_FOUND',
    });
    expect((await added(notifications, thandi, before)).messages).toEqual([]);

    cases.set('CASE-DEMO-005678', makeCase({ caseId: 'CASE-DEMO-005678' }));
    await notifications.handleCaseEvent(event);
    const { events, messages } = await added(notifications, thandi, before);
    expect(messages).toHaveLength(1);
    expect(events).toHaveLength(CHANNELS.length);
  });

  it('lists the delivery log newest first', async () => {
    const { notifications } = setup();
    await notifications.handleCaseEvent(makeEvent());
    const events = await notifications.listMessageEvents(thandi);
    const times = events.map((event) => Date.parse(event.at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(events.slice(0, CHANNELS.length).every((event) => event.at === NOW_ISO)).toBe(true);
  });
});
