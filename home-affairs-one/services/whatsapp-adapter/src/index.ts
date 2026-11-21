/**
 * WhatsApp adapter (mock).
 *
 * A stand-in for an official WhatsApp Business channel (brief §8). Nothing is
 * sent anywhere: there is no network call, no provider account and no provider
 * branding. The mock exists to show the rules a real adapter would enforce:
 *
 *   - nothing is sent without a recorded opt-in
 *   - only approved templates go out, carrying a masked reference and a
 *     short-lived secure link — never case details, documents or one-time PINs
 *   - the menu handles low-risk routing only; anything personal is answered
 *     with a hand-off link back to the signed-in app
 */
import {
  DEMO,
  type SafeNotificationPayload,
  SafeNotificationPayloadSchema,
  type WhatsAppMenuChoice,
  type WhatsAppOptIn,
  type WhatsAppPort,
  type WhatsAppTemplate,
  type WhatsAppWebhookEvent,
} from '@hao/api-contracts';
import { createCollection, HOUR, MINUTE, type Platform } from '@hao/local-platform';
import { GatewayError, maskReference } from '@hao/shared-types';

export interface WhatsAppAdapter extends WhatsAppPort {
  /** Sends an approved template if (and only if) the person has opted in. Returns the safe payload, or null when suppressed. */
  sendTemplate(input: {
    personToken: string;
    templateKey: string;
    maskedReference: string;
    consentRef: string;
  }): Promise<SafeNotificationPayload | null>;
}

/* ------------------------------------------------------------------ */
/* Content rules                                                       */
/* ------------------------------------------------------------------ */

/** A placeholder link. A real one would be single-use and expire with the payload. */
const SECURE_CASE_LINK = 'https://example.gov.za/app/case/short-lived-token';
const SECURE_APPLICATIONS_LINK = 'https://example.gov.za/app/applications';
const SERVICE_POINTS_LINK = 'https://example.gov.za/service-points';
const LINK_LIFETIME = 20 * MINUTE;

const UNSAFE_MESSAGE = 'That message could not be sent safely, so it was not sent.';

const UNSAFE_PATTERNS: ReadonlyArray<RegExp> = [
  /CASE-DEMO-/i, // an unmasked case reference
  /PERSON-DEMO-/i, // a person token
  /@/, // an email address or handle
  /\d{6,}/, // anything long enough to be an identity number, phone number or one-time PIN
];

/**
 * The last check before any text leaves for an external channel. Throws rather
 * than trying to clean the text up: unsafe content is never sent in part.
 */
export function assertSafeForExternalChannel(text: string): void {
  if (UNSAFE_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new GatewayError('VALIDATION', { safeMessage: UNSAFE_MESSAGE });
  }
}

/**
 * The template registry. Template text may contain only the `{{maskedReference}}`
 * and `{{link}}` placeholders, and never says what the update is.
 */
export const WHATSAPP_TEMPLATES: ReadonlyArray<WhatsAppTemplate> = [
  {
    templateKey: 'application_status_changed_v1',
    category: 'UTILITY',
    purpose: 'Says there is an update on an application, without saying what it is.',
    text: 'There is an update to your Home Affairs application {{maskedReference}}. Sign in to view details: {{link}}',
    approved: true,
    version: 'v1',
  },
  {
    templateKey: 'action_required_v1',
    category: 'UTILITY',
    purpose: 'Says an application is waiting for the person, without saying what is needed.',
    text: 'We need something from you to continue your Home Affairs application {{maskedReference}}. Sign in to see what to do: {{link}}',
    approved: true,
    version: 'v1',
  },
  {
    templateKey: 'appointment_reminder_v1',
    category: 'UTILITY',
    purpose: 'Reminds a person about an appointment. The time and place stay in the app.',
    text: 'A reminder about your Home Affairs appointment for application {{maskedReference}}. Sign in to view the time and place: {{link}}',
    approved: true,
    version: 'v1',
  },
  {
    templateKey: 'ready_for_collection_v1',
    category: 'UTILITY',
    purpose: 'Points a person to collection details in the app. It does not state an outcome.',
    text: 'There is a collection update for your Home Affairs application {{maskedReference}}. Sign in to view details: {{link}}',
    approved: true,
    version: 'v1',
  },
  {
    templateKey: 'callback_confirmed_v1',
    category: 'UTILITY',
    purpose: 'Confirms a call-back request made from the menu. It carries no personal detail.',
    text: 'We have your call-back request. An adviser will phone the number saved on your account. They will never ask for your password or a one-time PIN.',
    approved: true,
    version: 'v1',
  },
  {
    templateKey: 'one_time_pin_not_used_v1',
    category: 'AUTHENTICATION_NOT_USED',
    purpose:
      'One-time PINs and sign-in codes are never sent on WhatsApp. This entry records that the category is left unused on purpose.',
    text: 'Not used. Sign-in codes are never sent on WhatsApp.',
    approved: false,
    version: 'v1',
  },
];

function fillTemplate(template: WhatsAppTemplate, maskedReference: string, link: string): string {
  return template.text
    .replaceAll('{{maskedReference}}', maskedReference)
    .replaceAll('{{link}}', link);
}

/** The payload message carries the link in its own field, so the sentence is rendered without it. */
function fillTemplateWithoutLink(template: WhatsAppTemplate, maskedReference: string): string {
  const text = template.text
    .replace(/[:\s]*\{\{link\}\}/g, '')
    .replaceAll('{{maskedReference}}', maskedReference)
    .trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/**
 * The provider is given an opaque contact handle (brief, Appendix B), never the
 * person token the rest of the platform uses.
 */
function contactTokenFor(personToken: string): string {
  let hash = 0;
  for (const char of personToken) hash = (hash * 31 + char.charCodeAt(0)) % 9000;
  return `CONTACT-DEMO-${1000 + hash}`;
}

type Reply = Pick<WhatsAppWebhookEvent, 'kind' | 'text' | 'templateKey'>;

function templateText(templateKey: string): string {
  return WHATSAPP_TEMPLATES.find((template) => template.templateKey === templateKey)?.text ?? '';
}

/** Button label and scripted replies for each menu choice. Low-risk routing only. */
const MENU: Record<WhatsAppMenuChoice, { button: string; replies: ReadonlyArray<Reply> }> = {
  FIND_SERVICE_POINT: {
    button: 'Find a service point',
    replies: [
      {
        kind: 'MENU_CHOICE',
        text: 'You can search for a service point by area and see what each one offers before you go.',
        templateKey: null,
      },
      {
        kind: 'HANDOFF_LINK_SENT',
        text: `Find a service point: ${SERVICE_POINTS_LINK}`,
        templateKey: null,
      },
    ],
  },
  GENERAL_GUIDANCE: {
    button: 'General guidance',
    replies: [
      {
        kind: 'MENU_CHOICE',
        text: 'This is sample guidance. Each service page in the app explains what you need, where to go and what happens next. We will never ask for your password or a one-time PIN in this chat.',
        templateKey: null,
      },
    ],
  },
  REQUEST_CALLBACK: {
    button: 'Request a call-back',
    replies: [
      {
        kind: 'TEMPLATE_SENT',
        text: templateText('callback_confirmed_v1'),
        templateKey: 'callback_confirmed_v1',
      },
    ],
  },
  MY_APPLICATION: {
    button: 'My application',
    replies: [
      {
        kind: 'HANDOFF_LINK_SENT',
        text: `For your privacy we do not show application details in WhatsApp. Sign in to the app to see them: ${SECURE_APPLICATIONS_LINK}`,
        templateKey: null,
      },
    ],
  },
  SEND_DOCUMENT: {
    button: 'Send a document',
    replies: [
      {
        kind: 'BLOCKED_UNSAFE_CONTENT',
        text: 'Please do not send documents, ID numbers or one-time PINs here. Use the secure upload in the app.',
        templateKey: null,
      },
    ],
  },
};

const OPT_IN_TEXT =
  'You will now get Home Affairs updates here. We will never ask for your password, a one-time PIN or documents in this chat. You can switch this off at any time.';
const OPT_OUT_TEXT =
  'You will no longer get Home Affairs updates on WhatsApp. Official notices stay in your secure inbox.';

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

export function createWhatsAppService(platform: Platform): WhatsAppAdapter {
  const optIns = createCollection<WhatsAppOptIn>(
    platform,
    'whatsapp.optIns',
    (optIn) => optIn.personToken,
  );
  const log = createCollection<WhatsAppWebhookEvent>(
    platform,
    'whatsapp.webhookEvents',
    (event) => event.webhookId,
  );

  /** Builds one conversation entry. Every text is checked, whichever direction it travels. */
  function entry(
    personToken: string,
    direction: WhatsAppWebhookEvent['direction'],
    reply: Reply,
    at: Date,
  ): WhatsAppWebhookEvent {
    assertSafeForExternalChannel(reply.text);
    return {
      webhookId: platform.ids.next('WA-DEMO', 0),
      personToken,
      direction,
      kind: reply.kind,
      text: reply.text,
      templateKey: reply.templateKey,
      at: platform.clock.iso(at),
    };
  }

  function ensureSeeded(): void {
    if (optIns.exists()) return;
    const now = platform.clock.now().getTime();
    const ago = (ms: number) => new Date(now - ms);
    const thandi = DEMO.persons.thandi;
    const actionRequired = WHATSAPP_TEMPLATES.find(
      (template) => template.templateKey === 'action_required_v1',
    );

    // Thandi opted in yesterday evening; the others have not opted in.
    optIns.replaceAll([
      {
        personToken: thandi,
        optedIn: true,
        consentRef: DEMO.consents.thandiWhatsApp,
        changedAt: platform.clock.iso(ago(18 * HOUR)),
      },
    ]);

    const seeded: WhatsAppWebhookEvent[] = [
      entry(
        thandi,
        'OUTBOUND',
        { kind: 'OPT_IN', text: OPT_IN_TEXT, templateKey: null },
        ago(18 * HOUR),
      ),
    ];
    if (actionRequired) {
      const sent: Reply = {
        kind: 'TEMPLATE_SENT',
        text: fillTemplate(
          actionRequired,
          maskReference(DEMO.cases.smartIdActionRequired),
          SECURE_CASE_LINK,
        ),
        templateKey: actionRequired.templateKey,
      };
      seeded.push(
        entry(thandi, 'OUTBOUND', sent, ago(40 * MINUTE)),
        entry(
          thandi,
          'OUTBOUND',
          { kind: 'DELIVERED', text: 'Delivered', templateKey: actionRequired.templateKey },
          ago(40 * MINUTE - 1000),
        ),
        entry(
          thandi,
          'OUTBOUND',
          { kind: 'READ', text: 'Read', templateKey: actionRequired.templateKey },
          ago(35 * MINUTE),
        ),
      );
    }
    log.replaceAll(seeded);
  }

  function optInFor(personToken: string): WhatsAppOptIn {
    return (
      optIns.get(personToken) ?? { personToken, optedIn: false, consentRef: null, changedAt: null }
    );
  }

  function record(events: WhatsAppWebhookEvent[]): WhatsAppWebhookEvent[] {
    log.replaceAll([...log.all(), ...events]);
    return events;
  }

  return {
    async getOptIn(personToken) {
      ensureSeeded();
      return optInFor(personToken);
    },

    async setOptIn(personToken, optedIn, _options) {
      ensureSeeded();
      if (personToken.trim() === '') {
        throw new GatewayError('VALIDATION', {
          safeMessage: 'Sign in before changing your WhatsApp updates.',
        });
      }
      const current = optInFor(personToken);
      // Asking for the state that is already recorded changes nothing and logs nothing.
      if (current.optedIn === optedIn) return current;

      const now = platform.clock.now();
      const next: WhatsAppOptIn = {
        personToken,
        optedIn,
        consentRef: optedIn ? platform.ids.next('CONSENT-DEMO', 0) : null,
        changedAt: platform.clock.iso(now),
      };
      const confirmation: Reply = optedIn
        ? { kind: 'OPT_IN', text: OPT_IN_TEXT, templateKey: null }
        : { kind: 'OPT_OUT', text: OPT_OUT_TEXT, templateKey: null };
      const event = entry(personToken, 'OUTBOUND', confirmation, now);
      optIns.put(next);
      record([event]);
      return next;
    },

    async listTemplates() {
      return WHATSAPP_TEMPLATES.map((template) => ({ ...template }));
    },

    async listWebhookEvents(personToken) {
      ensureSeeded();
      return log
        .find((event) => event.personToken === personToken)
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    },

    async simulateInbound(personToken, choice, _options) {
      ensureSeeded();
      if (!optInFor(personToken).optedIn) {
        throw new GatewayError('FORBIDDEN', {
          safeMessage:
            'Opt in first. Switch on WhatsApp updates in your notification settings, then try again.',
        });
      }
      const menu = Object.hasOwn(MENU, choice) ? MENU[choice] : undefined;
      if (!menu) {
        throw new GatewayError('VALIDATION', {
          safeMessage: 'That menu option is not available. Choose one of the buttons shown.',
        });
      }
      const now = platform.clock.now();
      const events = [
        entry(
          personToken,
          'INBOUND',
          { kind: 'MENU_CHOICE', text: menu.button, templateKey: null },
          now,
        ),
        ...menu.replies.map((reply) => entry(personToken, 'OUTBOUND', reply, now)),
      ];
      return record(events);
    },

    async sendTemplate(input) {
      ensureSeeded();
      const optIn = optInFor(input.personToken);
      // No opt-in, no message — and nothing appears in the chat.
      if (!optIn.optedIn) return null;

      const template = WHATSAPP_TEMPLATES.find(
        (candidate) => candidate.templateKey === input.templateKey,
      );
      if (!template || !template.approved || template.category !== 'UTILITY') {
        throw new GatewayError('VALIDATION', {
          safeMessage: 'That message template is not approved for WhatsApp, so nothing was sent.',
        });
      }

      const now = platform.clock.now();
      const message = fillTemplateWithoutLink(template, input.maskedReference);
      const chatText = fillTemplate(template, input.maskedReference, SECURE_CASE_LINK);
      assertSafeForExternalChannel(message);
      assertSafeForExternalChannel(chatText);

      const payload = SafeNotificationPayloadSchema.safeParse({
        eventId: platform.ids.next('EVT-DEMO', 0),
        channel: 'WHATSAPP_TEMPLATE',
        recipientToken: contactTokenFor(input.personToken),
        templateKey: template.templateKey,
        maskedReference: input.maskedReference,
        message,
        secureDeepLink: SECURE_CASE_LINK,
        // The adapter's own opt-in record is the authority for this channel.
        consentRef: optIn.consentRef ?? input.consentRef,
        expiresAt: platform.clock.iso(new Date(now.getTime() + LINK_LIFETIME)),
      } satisfies SafeNotificationPayload);
      if (!payload.success) {
        throw new GatewayError('VALIDATION', { safeMessage: UNSAFE_MESSAGE });
      }

      record([
        entry(
          input.personToken,
          'OUTBOUND',
          { kind: 'TEMPLATE_SENT', text: chatText, templateKey: template.templateKey },
          now,
        ),
        entry(
          input.personToken,
          'OUTBOUND',
          { kind: 'DELIVERED', text: 'Delivered', templateKey: template.templateKey },
          new Date(now.getTime() + 1000),
        ),
      ]);
      return payload.data;
    },
  };
}
