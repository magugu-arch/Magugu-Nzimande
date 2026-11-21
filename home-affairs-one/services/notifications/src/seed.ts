/**
 * Sample inbox messages, delivery records, preferences and alerts.
 *
 * Everything is synthetic and dated relative to "now". Notices are samples:
 * they state no real fee, timeframe, requirement or rule.
 */
import {
  type ChannelPreference,
  DEMO,
  type InboxMessage,
  type MessageEvent,
  type ServiceAlert,
} from '@hao/api-contracts';
import { DAY, HOUR, MINUTE, type Platform } from '@hao/local-platform';
import { type Channel, CHANNELS, STATUS_INFO } from '@hao/shared-types';
import {
  caseHref,
  caseMessage,
  type CaseNotice,
  type DeliveryOutcome,
  deliveryRecord,
  OUTCOMES,
  TEMPLATE_KEYS,
  templateKeyFor,
} from './content';

export interface PersonPreferences {
  personToken: string;
  preferences: ChannelPreference[];
}

export const DEFAULT_LANGUAGE = 'en-ZA';

function preferencesWith(
  platform: Platform,
  consentedAt: string,
  isOn: (channel: Channel) => boolean,
): ChannelPreference[] {
  return CHANNELS.map((channel) => {
    const enabled = isOn(channel);
    return {
      channel,
      enabled,
      purpose: 'TRANSACTIONAL',
      language: DEFAULT_LANGUAGE,
      consentRef: enabled ? platform.ids.next('CONSENT-DEMO', 0) : null,
      consentedAt: enabled ? consentedAt : null,
      updatedAt: consentedAt,
    };
  });
}

/**
 * Preferences for someone who has not chosen yet: only the secure inbox, which
 * is always on. Every other channel is opt-in (brief §8: per-channel consent),
 * so nothing is sent outside the service until the person switches it on.
 */
export function defaultPreferences(platform: Platform, consentedAt: string): ChannelPreference[] {
  return preferencesWith(platform, consentedAt, (channel) => channel === 'SECURE_INBOX');
}

/**
 * The demo people's recorded choices: when they set up their accounts they
 * switched on app, email and SMS reminders. WhatsApp is a separate opt-in.
 */
function demoPersonPreferences(platform: Platform, consentedAt: string): ChannelPreference[] {
  return preferencesWith(platform, consentedAt, (channel) => channel !== 'WHATSAPP');
}

export interface NotificationsSeed {
  preferences: PersonPreferences[];
  inbox: InboxMessage[];
  deliveries: MessageEvent[];
  alerts: ServiceAlert[];
}

export function buildNotificationsSeed(platform: Platform): NotificationsSeed {
  const now = platform.clock.now().getTime();
  const ago = (ms: number) => platform.clock.iso(new Date(now - ms));
  const { thandi, sipho, lerato, aisha } = DEMO.persons;

  /* --------------------------- preferences --------------------------- */

  const accountSetUp = ago(60 * DAY);
  const whatsAppOptedIn = ago(18 * HOUR);
  const preferences: PersonPreferences[] = [thandi, sipho, lerato, aisha].map((personToken) => ({
    personToken,
    preferences: demoPersonPreferences(platform, accountSetUp).map((preference) =>
      personToken === thandi && preference.channel === 'WHATSAPP'
        ? {
            ...preference,
            enabled: true,
            consentRef: DEMO.consents.thandiWhatsApp,
            consentedAt: whatsAppOptedIn,
            updatedAt: whatsAppOptedIn,
          }
        : preference,
    ),
  }));

  /* ------------------------ inbox and delivery ----------------------- */

  const inbox: InboxMessage[] = [];
  const deliveries: MessageEvent[] = [];

  /** A case notice in the inbox, plus one delivery record per channel. */
  function caseNotice(
    notice: CaseNotice,
    sentAgo: number,
    readAgo: number | null,
    outcomes: Partial<Record<Channel, DeliveryOutcome>> = {},
  ): void {
    inbox.push(
      caseMessage(notice, {
        messageId: platform.ids.next('MSG-DEMO', 0),
        sentAt: ago(sentAgo),
        readAt: readAgo === null ? null : ago(readAgo),
      }),
    );
    for (const channel of CHANNELS) {
      const fallback = channel === 'SECURE_INBOX' ? OUTCOMES.inbox : OUTCOMES.delivered;
      deliveries.push(
        deliveryRecord(
          { ...notice, templateKey: templateKeyFor(notice) },
          channel,
          outcomes[channel] ?? fallback,
          { eventId: platform.ids.next('NTF-DEMO', 0), at: ago(sentAgo) },
        ),
      );
    }
  }

  /** A notice that is not about a case: receipts, security and service notices. */
  function notice(
    message: Pick<
      InboxMessage,
      'recipientToken' | 'category' | 'subject' | 'body' | 'templateKey'
    > &
      Partial<Pick<InboxMessage, 'caseId' | 'action'>>,
    sentAgo: number,
    readAgo: number | null,
  ): void {
    inbox.push({
      caseId: null,
      action: null,
      ...message,
      messageId: platform.ids.next('MSG-DEMO', 0),
      sentAt: ago(sentAgo),
      readAt: readAgo === null ? null : ago(readAgo),
      contentVersion: DEMO.contentVersion,
    });
  }

  // Thandi — five messages, one in each of the main categories.
  notice(
    {
      recipientToken: thandi,
      category: 'RECEIPT',
      caseId: DEMO.cases.passportInProduction,
      subject: 'Sample payment received',
      body: [
        'We received a sample payment for your application “Apply for an adult passport”.',
        'This is a sandbox receipt. No money moved and no card details were used.',
      ],
      action: { label: 'View application', href: caseHref(DEMO.cases.passportInProduction) },
      templateKey: TEMPLATE_KEYS.paymentReceived,
    },
    16 * DAY,
    16 * DAY - HOUR,
  );
  notice(
    {
      recipientToken: thandi,
      category: 'SERVICE_NOTICE',
      subject: 'Sample notice: planned maintenance',
      body: [
        'This is a sample notice.',
        'Some online services may be unavailable for a short time this weekend while we do maintenance. Your drafts and applications are not affected.',
      ],
      templateKey: TEMPLATE_KEYS.serviceNotice,
    },
    4 * DAY,
    null,
  );
  notice(
    {
      recipientToken: thandi,
      category: 'SECURITY',
      subject: 'New sign-in to your account',
      body: [
        'Your account was signed in to on a new device.',
        'If this was you, you do not need to do anything. If it was not you, change how you sign in and ask for help from the Help section.',
        'We will never ask for your password or a one-time PIN. Never share them with anyone, even someone who says they work for us.',
      ],
      templateKey: TEMPLATE_KEYS.newSignIn,
    },
    2 * DAY,
    2 * DAY - 10 * MINUTE,
  );
  // Sent before Thandi opted in to WhatsApp, so that channel was held back.
  caseNotice(
    {
      recipientToken: thandi,
      caseId: DEMO.cases.passportInProduction,
      serviceTitle: 'Apply for an adult passport',
      eventType: 'PRODUCTION_STARTED',
      status: 'FULFILMENT',
      title: 'Your passport application has moved to document production',
      detail: 'Your document is being produced. We will tell you when there is an update.',
      nextAction: null,
    },
    1 * DAY,
    23 * HOUR,
    { WHATSAPP: OUTCOMES.whatsAppNotOptedIn },
  );
  caseNotice(
    {
      recipientToken: thandi,
      caseId: DEMO.cases.smartIdActionRequired,
      serviceTitle: 'Replace a Smart ID',
      eventType: 'INFORMATION_REQUESTED',
      status: 'ACTION_REQUIRED',
      title: 'Choose where to complete your application',
      detail: 'The next step happens in person. Choose an approved service point to continue.',
      nextAction: {
        type: 'SELECT_SERVICE_POINT',
        description: 'Choose an approved service point for the next step',
        dueAt: null,
      },
    },
    40 * MINUTE,
    null,
    { WHATSAPP: OUTCOMES.read },
  );

  // Sipho — the birth registration he submitted for his linked child.
  caseNotice(
    {
      recipientToken: sipho,
      caseId: DEMO.cases.birthInValidation,
      serviceTitle: 'Register a birth',
      eventType: 'SUBMITTED',
      status: 'SUBMITTED',
      title: 'Application received',
      detail: STATUS_INFO.SUBMITTED.rule,
      nextAction: null,
    },
    1 * DAY,
    1 * DAY - 5 * MINUTE,
    { WHATSAPP: OUTCOMES.whatsAppNotOptedIn },
  );
  caseNotice(
    {
      recipientToken: sipho,
      caseId: DEMO.cases.birthInValidation,
      serviceTitle: 'Register a birth',
      eventType: 'VALIDATION_STARTED',
      status: 'IN_VALIDATION',
      title: 'Checks started',
      detail: STATUS_INFO.IN_VALIDATION.rule,
      nextAction: null,
    },
    20 * HOUR,
    null,
    { WHATSAPP: OUTCOMES.whatsAppNotOptedIn },
  );

  // Lerato — her passport appointment at a mission abroad.
  caseNotice(
    {
      recipientToken: lerato,
      caseId: DEMO.cases.passportAbroadScheduled,
      serviceTitle: 'Apply for an adult passport',
      eventType: 'APPOINTMENT_BOOKED',
      status: 'SCHEDULED',
      title: 'Appointment booked',
      detail: STATUS_INFO.SCHEDULED.rule,
      nextAction: null,
    },
    3 * DAY - 15 * MINUTE,
    null,
    { WHATSAPP: OUTCOMES.whatsAppNotOptedIn },
  );

  // Aisha has no messages yet, which shows the empty inbox.

  /* ------------------------------ alerts ----------------------------- */

  const alerts: ServiceAlert[] = [
    {
      alertId: 'ALERT-DEMO-1',
      kind: 'FRAUD_WARNING',
      severity: 'attention',
      title: 'We will never ask for your password or one-time PIN',
      body: 'Not by phone, WhatsApp, SMS or email. Payments are only ever made inside the secure service, never to a personal account. If a message asks for any of these, do not reply.',
      publishedAt: ago(3 * DAY),
      sample: true,
    },
    {
      alertId: 'ALERT-DEMO-2',
      kind: 'DISRUPTION',
      severity: 'info',
      title: 'Sample notice: planned maintenance',
      body: 'This is a sample notice. Some online services may be unavailable for a short time this weekend while we do maintenance. Your drafts and applications are not affected.',
      publishedAt: ago(4 * DAY),
      sample: true,
    },
    {
      alertId: 'ALERT-DEMO-3',
      kind: 'TRAVEL',
      severity: 'info',
      title: 'Sample notice: check travel guidance before you fly',
      body: 'This is a sample notice and states no real rules. Travel requirements can change, so check the official guidance for your trip before you book or fly.',
      publishedAt: ago(6 * DAY),
      sample: true,
    },
  ];

  return { preferences, inbox, deliveries, alerts };
}
