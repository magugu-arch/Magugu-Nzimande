'use client';

import { announce } from '@hao/accessibility';
import type { ChannelPreference, MessageEvent as DeliveryEvent } from '@hao/api-contracts';
import {
  Button,
  Card,
  Container,
  Notice,
  PageHeader,
  Section,
  Stack,
  Switch,
  Tag,
} from '@hao/design-system';
import { CHANNEL_INFO, CHANNELS, type Channel, type GatewayError } from '@hao/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { formatDateTime } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useGatewayMutation, useGatewayQuery } from '@/lib/queries';
import { usePersonToken } from '@/lib/session';
import shared from '../messages.module.css';
import { CHANNEL_ICON, templateInWords } from '../words';
import styles from './preferences.module.css';

/** How each channel reads inside "Send me … reminders". */
const REMINDER_NAME: Record<Channel, string> = {
  SECURE_INBOX: 'secure inbox',
  PUSH: 'app notification',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'email',
  SMS: 'SMS',
};

function switchLabel(channel: Channel): string {
  return channel === 'SECURE_INBOX'
    ? 'Send official notices to my secure inbox'
    : `Send me ${REMINDER_NAME[channel]} reminders`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type ResultTone = 'neutral' | 'info' | 'attention' | 'success';

const RESULT: Record<DeliveryEvent['deliveryStatus'], { label: string; tone: ResultTone }> = {
  QUEUED: { label: 'Queued', tone: 'neutral' },
  SENT: { label: 'Sent', tone: 'info' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  READ: { label: 'Read', tone: 'success' },
  FAILED: { label: 'Could not send', tone: 'attention' },
  SUPPRESSED: { label: 'Not sent', tone: 'neutral' },
};

interface ToggleInput {
  channel: Channel;
  enabled: boolean;
  idempotencyKey: string;
}

/* Channel card ------------------------------------------------------ */

function ChannelCard({
  channel,
  preference,
  savingTo,
  error,
  onToggle,
}: {
  channel: Channel;
  preference: ChannelPreference | undefined;
  /** The state being saved for this channel, or `null` when nothing is in flight. */
  savingTo: boolean | null;
  error: GatewayError | null;
  onToggle: (enabled: boolean) => void;
}) {
  const info = CHANNEL_INFO[channel];
  const stored = info.optional ? (preference?.enabled ?? false) : true;
  const checked = savingTo ?? stored;

  let receipt: string;
  if (savingTo !== null) receipt = 'Saving your choice…';
  else if (!info.optional) receipt = 'Detailed notices are only ever written here.';
  else if (!stored) receipt = 'Off. You can still use every service.';
  else if (preference?.consentedAt && preference.consentRef) {
    receipt = `Consent recorded ${formatDateTime(preference.consentedAt)} · reference ${preference.consentRef}`;
  } else receipt = 'On.';

  return (
    <Card className={styles.channel}>
      <div className={styles.channelHead}>
        <span className={styles.channelIcon} aria-hidden="true">
          {CHANNEL_ICON[channel]}
        </span>
        <h2 className={styles.channelTitle}>{info.label}</h2>
        {info.optional ? null : <Tag tone="info">Always on</Tag>}
      </div>

      <div className={styles.facts}>
        <p>
          <strong>Best for:</strong> {info.bestFor}
        </p>
        <p>
          <strong>Carries:</strong> {info.carries}
        </p>
        <p>
          <strong>Never carries:</strong> {info.neverCarries}
        </p>
      </div>

      <div className={styles.setting}>
        <Switch
          label={switchLabel(channel)}
          hint={info.optional ? undefined : 'Always on, so you never miss an official notice.'}
          checked={checked}
          onChange={onToggle}
          disabled={!info.optional}
          stateLabels={{ on: 'On', off: 'Off' }}
        />
        <p className={styles.receipt}>{receipt}</p>
        {error ? (
          <Notice
            tone="danger"
            role="alert"
            title={`We could not change your ${REMINDER_NAME[channel]} reminders`}
          >
            <p>{error.safeMessage}</p>
            <p>Reference for support: {error.traceRef}</p>
          </Notice>
        ) : null}
      </div>
    </Card>
  );
}

/* Delivery log ------------------------------------------------------ */

const PAGE_SIZE = 25;

function DeliveryLog({ events }: { events: DeliveryEvent[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  // After "Show more", focus moves to the first newly shown entry.
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const focusRow = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (focusIndex !== null) focusRow.current?.focus();
  }, [focusIndex]);

  const shown = events.slice(0, visible);
  const showMore = () => {
    const next = Math.min(visible + PAGE_SIZE, events.length);
    setFocusIndex(visible);
    setVisible(next);
    announce(`Showing ${next} of ${events.length} entries.`);
  };

  return (
    <div className={styles.logWrap}>
      <table className={styles.log}>
        <caption>What was sent on each channel, newest first</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Channel</th>
            <th scope="col">Message type</th>
            <th scope="col">Result</th>
            <th scope="col">Reference</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((event, index) => {
            const result = RESULT[event.deliveryStatus];
            return (
              <tr
                key={event.eventId}
                ref={index === focusIndex ? focusRow : undefined}
                tabIndex={index === focusIndex ? -1 : undefined}
              >
                <td>
                  <span className={styles.cellLabel}>When</span>
                  <span className={styles.cellValue}>
                    <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                  </span>
                </td>
                <td>
                  <span className={styles.cellLabel}>Channel</span>
                  <span className={styles.cellValue}>{CHANNEL_INFO[event.channel].label}</span>
                </td>
                <td>
                  <span className={styles.cellLabel}>Message type</span>
                  <span className={styles.cellValue}>{templateInWords(event.templateKey)}</span>
                </td>
                <td>
                  <span className={styles.cellLabel}>Result</span>
                  <span className={styles.cellValue}>
                    <Tag tone={result.tone}>{result.label}</Tag>
                    {event.note ? <span className={styles.note}>{event.note}</span> : null}
                  </span>
                </td>
                <td>
                  <span className={styles.cellLabel}>Reference</span>
                  <span className={styles.cellValue}>
                    {event.maskedReference ?? (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="visually-hidden">None</span>
                      </>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className={styles.logFoot}>
        <p>
          Showing {shown.length} of {events.length}
        </p>
        {visible < events.length ? (
          <Button variant="secondary" size="sm" onClick={showMore}>
            Show more
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* Screen ------------------------------------------------------------ */

export function PreferencesScreen() {
  const token = usePersonToken();
  const queryClient = useQueryClient();

  const preferences = useGatewayQuery(
    ['preferences', token],
    (g) => g.notifications.listPreferences(token ?? ''),
    { enabled: Boolean(token) },
  );
  const deliveries = useGatewayQuery(
    ['deliveries', token],
    (g) => g.notifications.listMessageEvents(token ?? ''),
    { enabled: Boolean(token) },
  );
  const change = useGatewayMutation((g, input: ToggleInput) =>
    g.notifications.setPreference(token ?? '', input.channel, input.enabled, {
      idempotencyKey: input.idempotencyKey,
    }),
  );

  const toggle = (channel: Channel, enabled: boolean) => {
    // One change at a time: the choice in flight is shown as "Saving your choice…".
    if (change.isPending) return;
    change.mutate(
      // Each toggle is a new intent, so it gets a new key.
      { channel, enabled, idempotencyKey: newIdempotencyKey('set-preference') },
      {
        onSuccess: (rows) => {
          // Show the saved state straight away rather than waiting for the refresh.
          queryClient.setQueryData<ChannelPreference[]>(['preferences', token], rows);
          announce(
            `${capitalise(REMINDER_NAME[channel])} reminders switched ${enabled ? 'on' : 'off'}.`,
          );
        },
      },
    );
  };

  const saving = change.isPending ? change.variables : undefined;
  const failed = change.isError ? change.variables : undefined;

  return (
    <Container>
      <div className={shared.layout}>
        <div>
          <PageHeader
            back={{ href: '/messages/', label: 'Messages' }}
            title="Choose how we contact you"
            lede="The secure inbox always has the full notice. You choose which reminders point you back to it."
          />

          <Stack gap={5}>
            <QueryBoundary
              query={preferences}
              loadingLabel="Loading your contact choices"
              loadingRows={5}
            >
              {(rows) => (
                <Stack gap={4}>
                  {CHANNELS.map((channel) => (
                    <ChannelCard
                      key={channel}
                      channel={channel}
                      preference={rows.find((row) => row.channel === channel)}
                      savingTo={saving?.channel === channel ? saving.enabled : null}
                      error={failed?.channel === channel ? change.error : null}
                      onToggle={(enabled) => toggle(channel, enabled)}
                    />
                  ))}
                </Stack>
              )}
            </QueryBoundary>

            <Notice tone="info">
              <p>
                We only message you about your applications and your account. No marketing.
                Switching a channel off never affects your access to a service.
              </p>
            </Notice>
          </Stack>
        </div>

        <aside className={shared.photoAside} aria-label="About your contact choices">
          <Photo asset="A29" ratio="4 / 3" shape="soft" sizes="20rem" />
        </aside>
      </div>

      <div className={styles.logSection}>
        <Section
          title="What we sent, and what we held back"
          id="delivery-log"
          intro="Outside channels (app notifications, WhatsApp, email and SMS) only ever receive a masked reference and a secure link. The full notice stays in your secure inbox."
        >
          <QueryBoundary
            query={deliveries}
            loadingLabel="Loading your delivery log"
            headingLevel={3}
            isEmpty={(events) => events.length === 0}
            empty={
              <Notice tone="neutral">
                <p>
                  Nothing has been sent yet. When we send you a notice, this log shows which
                  channels it went to and which were held back.
                </p>
              </Notice>
            }
          >
            {/* Keyed on the person so "Show more" starts again for a different account. */}
            {(events) => <DeliveryLog key={token ?? 'none'} events={events} />}
          </QueryBoundary>
        </Section>
      </div>
    </Container>
  );
}
