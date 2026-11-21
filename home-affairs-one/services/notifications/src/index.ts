/**
 * Notification orchestrator (mock).
 *
 * The workflow owns case status; this service turns each case event into one
 * detailed message in the secure inbox and a minimal alert on every channel
 * the person has agreed to, and keeps a delivery record for each (brief §8).
 *
 * Rules it keeps:
 *   - the secure inbox is always on and is the only place details are written
 *   - other channels need consent, and switching one off withdraws it
 *   - external channels carry an approved template and a masked reference only
 *   - a channel that fails does not stop the others
 */
import {
  type CaseEvent,
  type ChannelPreference,
  type InboxMessage,
  type MessageEvent,
  type NotificationsPort,
  type ServiceAlert,
  type WorkflowPort,
} from '@hao/api-contracts';
import { createCollection, type Platform } from '@hao/local-platform';
import { type Channel, CHANNELS, GatewayError, maskReference } from '@hao/shared-types';
import { type WhatsAppAdapter } from '@hao/whatsapp-adapter';
import {
  caseMessage,
  type CaseNotice,
  type DeliveryOutcome,
  deliveryRecord,
  OUTCOMES,
  templateKeyFor,
} from './content';
import {
  buildNotificationsSeed,
  DEFAULT_LANGUAGE,
  defaultPreferences,
  type PersonPreferences,
} from './seed';

export { caseMessage, type CaseNotice, deliveryRecord, NOTES } from './content';

export interface NotificationsService extends NotificationsPort {
  /** Called for every workflow event: writes the secure-inbox message and fans out to consented channels. */
  handleCaseEvent(event: CaseEvent): Promise<void>;
}

function byNewest<T>(timeOf: (item: T) => string): (a: T, b: T) => number {
  return (a, b) => Date.parse(timeOf(b)) - Date.parse(timeOf(a));
}

export function createNotificationsService(
  platform: Platform,
  deps: { whatsapp: WhatsAppAdapter; workflow: Pick<WorkflowPort, 'getCase'> },
): NotificationsService {
  const preferences = createCollection<PersonPreferences>(
    platform,
    'notifications.preferences',
    (entry) => entry.personToken,
  );
  const inbox = createCollection<InboxMessage>(
    platform,
    'notifications.inbox',
    (message) => message.messageId,
  );
  const deliveries = createCollection<MessageEvent>(
    platform,
    'notifications.messageEvents',
    (event) => event.eventId,
  );
  const alerts = createCollection<ServiceAlert>(
    platform,
    'notifications.alerts',
    (alert) => alert.alertId,
  );
  /** Case events already turned into notifications, so a replayed event is not sent twice. */
  const handled = createCollection<{ eventId: string }>(
    platform,
    'notifications.handledCaseEvents',
    (entry) => entry.eventId,
  );

  function ensureSeeded(): void {
    if (inbox.exists()) return;
    const seed = buildNotificationsSeed(platform);
    preferences.replaceAll(seed.preferences);
    deliveries.replaceAll(seed.deliveries);
    alerts.replaceAll(seed.alerts);
    inbox.replaceAll(seed.inbox);
  }

  /** This service's own record for a person, created with the defaults the first time it is needed. */
  function storedPreferences(personToken: string): ChannelPreference[] {
    const existing = preferences.get(personToken);
    if (existing) return existing.preferences;
    const created = defaultPreferences(platform, platform.clock.iso());
    preferences.put({ personToken, preferences: created });
    return created;
  }

  function storePreference(personToken: string, changed: ChannelPreference): void {
    preferences.put({
      personToken,
      preferences: storedPreferences(personToken).map((preference) =>
        preference.channel === changed.channel ? changed : preference,
      ),
    });
  }

  /**
   * One preference per channel, in `CHANNELS` order. The WhatsApp adapter holds
   * the opt-in for its own channel, so that row is read from it: the two cannot
   * drift apart, whichever side a change was made on.
   */
  async function preferencesFor(personToken: string): Promise<ChannelPreference[]> {
    const stored = storedPreferences(personToken);
    const now = platform.clock.iso();
    const rows = CHANNELS.map(
      (channel): ChannelPreference =>
        stored.find((preference) => preference.channel === channel) ?? {
          channel,
          enabled: false,
          purpose: 'TRANSACTIONAL',
          language: DEFAULT_LANGUAGE,
          consentRef: null,
          consentedAt: null,
          updatedAt: now,
        },
    );
    try {
      const optIn = await deps.whatsapp.getOptIn(personToken);
      return rows.map((row) =>
        row.channel === 'WHATSAPP'
          ? {
              ...row,
              enabled: optIn.optedIn,
              consentRef: optIn.optedIn ? optIn.consentRef : null,
              consentedAt: optIn.optedIn ? (optIn.changedAt ?? row.consentedAt) : null,
              updatedAt: optIn.changedAt ?? row.updatedAt,
            }
          : row,
      );
    } catch {
      // The adapter could not be reached: show the last state this service recorded.
      return rows;
    }
  }

  function requireMessage(messageId: string): InboxMessage {
    const message = inbox.get(messageId);
    if (!message) {
      throw new GatewayError('NOT_FOUND', { safeMessage: 'We could not find that message.' });
    }
    return message;
  }

  /** Sends the WhatsApp template and reports what happened. It never throws. */
  async function sendWhatsApp(
    notice: CaseNotice,
    preference: ChannelPreference | undefined,
  ): Promise<DeliveryOutcome> {
    if (!preference?.enabled) return OUTCOMES.whatsAppNotOptedIn;
    try {
      const payload = await deps.whatsapp.sendTemplate({
        personToken: notice.recipientToken,
        templateKey: templateKeyFor(notice),
        maskedReference: maskReference(notice.caseId),
        consentRef: preference.consentRef ?? '',
      });
      return payload === null ? OUTCOMES.whatsAppNotOptedIn : OUTCOMES.delivered;
    } catch {
      // Fallback: the other consented channels still carry the alert.
      return OUTCOMES.whatsAppFailed;
    }
  }

  return {
    async listPreferences(personToken) {
      ensureSeeded();
      return preferencesFor(personToken);
    },

    async setPreference(personToken, channel, enabled, options) {
      ensureSeeded();
      if (!CHANNELS.includes(channel)) {
        throw new GatewayError('VALIDATION', { safeMessage: 'That channel is not available.' });
      }
      if (channel === 'SECURE_INBOX') {
        if (!enabled) {
          throw new GatewayError('VALIDATION', {
            safeMessage: 'The secure inbox stays on so you never miss an official notice.',
          });
        }
        return preferencesFor(personToken);
      }

      const current = (await preferencesFor(personToken)).find((row) => row.channel === channel);
      if (!current || current.enabled === enabled) return preferencesFor(personToken);

      const now = platform.clock.iso();
      if (channel === 'WHATSAPP') {
        // The adapter records the opt-in for its own channel; its consent reference is the one kept.
        const optIn = await deps.whatsapp.setOptIn(personToken, enabled, {
          idempotencyKey: options.idempotencyKey,
        });
        storePreference(personToken, {
          ...current,
          enabled: optIn.optedIn,
          consentRef: optIn.optedIn ? optIn.consentRef : null,
          consentedAt: optIn.optedIn ? (optIn.changedAt ?? now) : null,
          updatedAt: now,
        });
      } else {
        // Switching a channel on records consent; switching it off withdraws it.
        storePreference(personToken, {
          ...current,
          enabled,
          consentRef: enabled ? platform.ids.next('CONSENT-DEMO', 0) : null,
          consentedAt: enabled ? now : null,
          updatedAt: now,
        });
      }
      return preferencesFor(personToken);
    },

    async listInbox(personToken) {
      ensureSeeded();
      return inbox
        .find((message) => message.recipientToken === personToken)
        .sort(byNewest((message) => message.sentAt));
    },

    async getMessage(messageId) {
      ensureSeeded();
      return requireMessage(messageId);
    },

    async markRead(messageId, _options) {
      ensureSeeded();
      const message = requireMessage(messageId);
      // The first time it was read is the one that is kept.
      if (message.readAt !== null) return message;
      return inbox.put({ ...message, readAt: platform.clock.iso() });
    },

    async listMessageEvents(personToken) {
      ensureSeeded();
      return deliveries
        .find((event) => event.recipientToken === personToken)
        .sort(byNewest((event) => event.at));
    },

    async listAlerts() {
      ensureSeeded();
      return alerts.all().sort(byNewest((alert) => alert.publishedAt));
    },

    async handleCaseEvent(event) {
      ensureSeeded();
      if (handled.get(event.eventId)) return;
      handled.put({ eventId: event.eventId });

      try {
        const subject = await deps.workflow.getCase(event.caseId);
        const notice: CaseNotice = {
          recipientToken: subject.applicantToken,
          caseId: subject.caseId,
          serviceTitle: subject.serviceTitle,
          eventType: event.type,
          status: event.status,
          title: event.title,
          detail: event.detail,
          // The case may have moved on since this event; only use its next action if it still fits.
          nextAction: subject.status === event.status ? subject.nextAction : null,
        };
        const rows = await preferencesFor(notice.recipientToken);
        const whatsApp = await sendWhatsApp(
          notice,
          rows.find((row) => row.channel === 'WHATSAPP'),
        );

        const at = platform.clock.iso();
        inbox.put(caseMessage(notice, { messageId: platform.ids.next('MSG-DEMO', 0), sentAt: at }));

        const outcomeFor = (channel: Channel): DeliveryOutcome => {
          if (channel === 'SECURE_INBOX') return OUTCOMES.inbox;
          if (channel === 'WHATSAPP') return whatsApp;
          const enabled = rows.find((row) => row.channel === channel)?.enabled ?? false;
          return enabled ? OUTCOMES.delivered : OUTCOMES.switchedOff;
        };
        deliveries.replaceAll([
          ...deliveries.all(),
          ...CHANNELS.map((channel) =>
            deliveryRecord(
              { ...notice, templateKey: templateKeyFor(notice) },
              channel,
              outcomeFor(channel),
              { eventId: platform.ids.next('NTF-DEMO', 0), at },
            ),
          ),
        ]);
      } catch (error) {
        // Nothing was sent, so let a retry of the same event through.
        handled.remove(event.eventId);
        throw error;
      }
    },
  };
}
