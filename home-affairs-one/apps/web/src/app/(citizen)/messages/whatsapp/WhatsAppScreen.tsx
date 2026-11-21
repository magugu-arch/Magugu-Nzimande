'use client';

import { announce } from '@hao/accessibility';
import type {
  ChannelPreference,
  WhatsAppMenuChoice,
  WhatsAppOptIn,
  WhatsAppTemplate,
  WhatsAppWebhookEvent,
} from '@hao/api-contracts';
import {
  AppLink,
  Button,
  Card,
  Container,
  cx,
  Notice,
  PageHeader,
  Section,
  Stack,
  Switch,
  Tag,
} from '@hao/design-system';
import { CHANNEL_INFO, type GatewayError } from '@hao/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  Check,
  CircleCheck,
  FileCheck,
  LockKeyhole,
  MapPinned,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { formatDateTime, formatDay, formatTime } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useGatewayMutation, useGatewayQuery } from '@/lib/queries';
import { usePersonToken } from '@/lib/session';
import shared from '../messages.module.css';
import styles from './whatsapp.module.css';

/* Words --------------------------------------------------------------- */

const QUICK_REPLIES: ReadonlyArray<{ choice: WhatsAppMenuChoice; label: string }> = [
  { choice: 'FIND_SERVICE_POINT', label: 'Find a service point' },
  { choice: 'GENERAL_GUIDANCE', label: 'General guidance' },
  { choice: 'REQUEST_CALLBACK', label: 'Request a call-back' },
  { choice: 'MY_APPLICATION', label: 'My application' },
  { choice: 'SEND_DOCUMENT', label: 'Try to send a document' },
];

const KIND_WORDS: Record<WhatsAppWebhookEvent['kind'], string> = {
  OPT_IN: 'Opt-in recorded',
  OPT_OUT: 'Opt-out recorded',
  TEMPLATE_SENT: 'Template sent',
  DELIVERED: 'Delivered',
  READ: 'Read',
  MENU_CHOICE: 'Menu choice',
  HANDOFF_LINK_SENT: 'Hand-off link sent',
  BLOCKED_UNSAFE_CONTENT: 'Unsafe content blocked',
};

const DIRECTION_WORDS: Record<WhatsAppWebhookEvent['direction'], string> = {
  OUTBOUND: 'Outbound (to you)',
  INBOUND: 'Inbound (from you)',
};

/** "Documents, one-time PINs, biometrics or final decisions." → four list items. */
function toList(sentence: string): string[] {
  const items = sentence
    .trim()
    .replace(/\.$/, '')
    .split(/,\s*|\s+(?:and|or)\s+/)
    .map((item) => item.trim())
    .filter((item) => item !== '')
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1));
  return items.length > 1 ? items : [sentence];
}

/* Transcript ------------------------------------------------------------ */

type DeliveryState = 'Sent' | 'Delivered' | 'Read';

interface HandoffLink {
  href: string;
  label: string;
  icon: ReactNode;
}

type ChatLine =
  | { type: 'day'; id: string; label: string }
  | { type: 'system'; id: string; title: string; text: string; at: string }
  | {
      type: 'bubble';
      id: string;
      from: 'service' | 'person';
      variant: 'plain' | 'template' | 'blocked';
      templateKey: string | null;
      text: string;
      link: HandoffLink | null;
      at: string;
      /** Outbound only. */
      state: DeliveryState | null;
    };

const LINK_PATTERN = /https?:\/\/\S+/;

/**
 * The mock's chat text ends with a placeholder web address. The address is
 * taken out of the sentence and shown as a clearly marked chip that opens the
 * matching screen in this app.
 */
function splitLink(text: string): { text: string; link: HandoffLink | null } {
  const match = LINK_PATTERN.exec(text);
  if (!match) return { text, link: null };
  const before = text.slice(0, match.index).replace(/[:\s]+$/, '');
  const after = text.slice(match.index + match[0].length).trim();
  const sentence = [before, after].filter((part) => part !== '').join(' ');
  const aboutServicePoints = /service[- ]points?/i.test(text);
  return {
    text: /[.!?]$/.test(sentence) ? sentence : `${sentence}.`,
    link: aboutServicePoints
      ? {
          href: '/service-points/',
          label: 'Secure link — opens service points in the app',
          icon: <MapPinned aria-hidden="true" />,
        }
      : {
          href: '/applications/',
          label: 'Secure link — opens the app after sign-in',
          icon: <LockKeyhole aria-hidden="true" />,
        },
  };
}

/** Oldest first. Delivery receipts are folded into the template bubble they belong to. */
function buildTranscript(events: WhatsAppWebhookEvent[]): ChatLine[] {
  const lines: ChatLine[] = [];
  let lastDay = '';

  for (const event of events) {
    if (event.kind === 'DELIVERED' || event.kind === 'READ') {
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index];
        if (line?.type !== 'bubble' || line.variant !== 'template') continue;
        if (event.templateKey !== null && line.templateKey !== event.templateKey) continue;
        if (event.kind === 'READ') line.state = 'Read';
        else if (line.state !== 'Read') line.state = 'Delivered';
        break;
      }
      continue;
    }

    const day = formatDay(event.at);
    if (day !== lastDay) {
      lines.push({ type: 'day', id: `day-${event.webhookId}`, label: day });
      lastDay = day;
    }

    if (event.kind === 'OPT_IN' || event.kind === 'OPT_OUT') {
      lines.push({
        type: 'system',
        id: event.webhookId,
        title: event.kind === 'OPT_IN' ? 'You opted in' : 'You opted out',
        text: event.text,
        at: event.at,
      });
      continue;
    }

    const outbound = event.direction === 'OUTBOUND';
    const { text, link } = outbound ? splitLink(event.text) : { text: event.text, link: null };
    lines.push({
      type: 'bubble',
      id: event.webhookId,
      from: outbound ? 'service' : 'person',
      variant:
        event.kind === 'TEMPLATE_SENT'
          ? 'template'
          : event.kind === 'BLOCKED_UNSAFE_CONTENT'
            ? 'blocked'
            : 'plain',
      templateKey: event.templateKey,
      text,
      link,
      at: event.at,
      state: outbound ? 'Sent' : null,
    });
  }
  return lines;
}

function Transcript({ events }: { events: WhatsAppWebhookEvent[] }) {
  const lines = useMemo(() => buildTranscript(events), [events]);

  // Keep the newest message in view. Only the transcript scrolls, never the page.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lines.length]);

  return (
    <div
      ref={scroller}
      className={styles.transcript}
      role="group"
      aria-label="Mock conversation"
      // A scrolling region has to be reachable from the keyboard.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
    >
      <ol className={styles.lines} aria-live="polite">
        {lines.length === 0 ? (
          <li className={styles.system}>
            <p>No messages yet. Nothing is sent on this channel until you opt in.</p>
          </li>
        ) : null}
        {lines.map((line) => {
          if (line.type === 'day') {
            return (
              <li key={line.id} className={styles.day}>
                <span>{line.label}</span>
              </li>
            );
          }
          if (line.type === 'system') {
            return (
              <li key={line.id} className={styles.system}>
                <p className={styles.systemTitle}>
                  {line.title} · <time dateTime={line.at}>{formatTime(line.at)}</time>
                </p>
                <p>{line.text}</p>
              </li>
            );
          }
          return (
            <li
              key={line.id}
              className={cx(
                styles.line,
                line.from === 'person' ? styles.fromPerson : styles.fromService,
              )}
            >
              <div className={cx(styles.bubble, line.variant === 'blocked' && styles.blocked)}>
                <span className="visually-hidden">
                  {line.from === 'person' ? 'You: ' : 'Home Affairs One: '}
                </span>
                {line.variant === 'template' ? (
                  <p className={styles.bubbleLabel}>
                    <FileCheck aria-hidden="true" />
                    Approved template
                  </p>
                ) : null}
                {line.variant === 'blocked' ? (
                  <p className={styles.bubbleLabel}>
                    <ShieldAlert aria-hidden="true" />
                    Blocked — documents are not accepted here
                  </p>
                ) : null}
                <p>{line.text}</p>
                {line.link ? (
                  <AppLink href={line.link.href} className={styles.chip}>
                    {line.link.icon}
                    <span>{line.link.label}</span>
                  </AppLink>
                ) : null}
                <p className={styles.bubbleMeta}>
                  <time dateTime={line.at}>{formatTime(line.at)}</time>
                  {line.state ? ` · ${line.state}` : null}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* Governance ------------------------------------------------------------ */

function templateStatus(template: WhatsAppTemplate): {
  label: string;
  tone: 'success' | 'neutral' | 'attention';
  icon: ReactNode;
} {
  if (template.category === 'AUTHENTICATION_NOT_USED') {
    return { label: 'Not used', tone: 'neutral', icon: <Ban aria-hidden="true" /> };
  }
  return template.approved
    ? { label: 'Approved', tone: 'success', icon: <CircleCheck aria-hidden="true" /> }
    : { label: 'Not approved', tone: 'attention', icon: <Ban aria-hidden="true" /> };
}

/** Shows `{{maskedReference}}` and `{{link}}` exactly as the registry holds them. */
function TemplateText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\{\{\w+\}\})/)
        .map((part, index) =>
          index % 2 === 1 ? (
            <code key={index}>{part}</code>
          ) : (
            <Fragment key={index}>{part}</Fragment>
          ),
        )}
    </>
  );
}

function TemplateList({ templates }: { templates: WhatsAppTemplate[] }) {
  return (
    <ul className={styles.templates}>
      {templates.map((template) => {
        const status = templateStatus(template);
        return (
          <li key={template.templateKey} className={styles.template}>
            <div className={styles.templateHead}>
              <h4 className={styles.templateKey}>{template.templateKey}</h4>
              <Tag tone={status.tone} icon={status.icon}>
                {status.label}
              </Tag>
            </div>
            <p className={styles.templatePurpose}>{template.purpose}</p>
            <p className={styles.templateText}>
              <span className="visually-hidden">Template text: </span>
              <TemplateText text={template.text} />
            </p>
            <p className={styles.templateMeta}>Version {template.version}</p>
          </li>
        );
      })}
    </ul>
  );
}

const LOG_PREVIEW = 8;

function WebhookLog({ events }: { events: WhatsAppWebhookEvent[] }) {
  const [showAll, setShowAll] = useState(false);
  const newestFirst = useMemo(() => [...events].reverse(), [events]);
  const shown = showAll ? newestFirst : newestFirst.slice(0, LOG_PREVIEW);

  return (
    <div className={styles.webhookWrap}>
      <table className={styles.webhooks}>
        <caption>Webhook events for this conversation, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Kind</th>
            <th scope="col">Direction</th>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((event) => (
            <tr key={event.webhookId}>
              <td>{KIND_WORDS[event.kind]}</td>
              <td>{DIRECTION_WORDS[event.direction]}</td>
              <td>
                <time dateTime={event.at}>{formatDateTime(event.at)}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {newestFirst.length > LOG_PREVIEW ? (
        <div>
          <Button
            variant="quiet"
            size="sm"
            aria-expanded={showAll}
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll ? 'Show fewer events' : `Show all ${newestFirst.length} events`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* Screen ---------------------------------------------------------------- */

function ErrorNotice({ title, error }: { title: string; error: GatewayError }) {
  return (
    <Notice tone="danger" role="alert" title={title}>
      <p>{error.safeMessage}</p>
      <p>Reference for support: {error.traceRef}</p>
    </Notice>
  );
}

export function WhatsAppScreen() {
  const token = usePersonToken();
  const queryClient = useQueryClient();
  const hintId = useId();
  const repliesLabelId = useId();
  const enabled = Boolean(token);

  const optIn = useGatewayQuery(
    ['whatsapp-opt-in', token],
    (g) => g.whatsapp.getOptIn(token ?? ''),
    { enabled },
  );
  const events = useGatewayQuery(
    ['whatsapp-events', token],
    (g) => g.whatsapp.listWebhookEvents(token ?? ''),
    { enabled },
  );
  const templates = useGatewayQuery(['whatsapp-templates'], (g) => g.whatsapp.listTemplates());

  // The preference is changed through the notification service, which records
  // the opt-in with the adapter, so the two can never disagree.
  const changeOptIn = useGatewayMutation((g, input: { enabled: boolean; idempotencyKey: string }) =>
    g.notifications.setPreference(token ?? '', 'WHATSAPP', input.enabled, {
      idempotencyKey: input.idempotencyKey,
    }),
  );
  const reply = useGatewayMutation(
    (g, input: { choice: WhatsAppMenuChoice; idempotencyKey: string }) =>
      g.whatsapp.simulateInbound(token ?? '', input.choice, {
        idempotencyKey: input.idempotencyKey,
      }),
  );

  const toggleOptIn = (next: boolean) => {
    if (changeOptIn.isPending || !token) return;
    changeOptIn.mutate(
      { enabled: next, idempotencyKey: newIdempotencyKey('whatsapp-opt-in') },
      {
        onSuccess: (rows) => {
          // Show the saved state straight away rather than waiting for the refresh.
          const row = rows.find((preference) => preference.channel === 'WHATSAPP');
          if (row) {
            queryClient.setQueryData<WhatsAppOptIn>(['whatsapp-opt-in', token], {
              personToken: token,
              optedIn: row.enabled,
              consentRef: row.consentRef,
              changedAt: row.updatedAt,
            });
          }
          queryClient.setQueryData<ChannelPreference[]>(['preferences', token], rows);
          announce(`WhatsApp reminders switched ${next ? 'on' : 'off'}.`);
        },
      },
    );
  };

  const sendReply = (choice: WhatsAppMenuChoice) => {
    if (reply.isPending) return;
    reply.mutate(
      // Every press is a new message, so every press gets a new key.
      { choice, idempotencyKey: newIdempotencyKey('whatsapp-reply') },
      {
        onSuccess: (added) => {
          // Add the replies to the transcript now; the refresh that follows confirms them.
          queryClient.setQueryData<WhatsAppWebhookEvent[]>(
            ['whatsapp-events', token],
            (current) => {
              if (!current) return current;
              const known = new Set(current.map((event) => event.webhookId));
              return [...current, ...added.filter((event) => !known.has(event.webhookId))];
            },
          );
        },
      },
    );
  };

  const savingOptIn = changeOptIn.isPending ? changeOptIn.variables.enabled : null;
  const canReply = optIn.data?.optedIn === true && savingOptIn !== false;
  const pendingChoice = reply.isPending ? reply.variables.choice : null;

  let replyHint: string;
  if (canReply) {
    replyHint =
      'Each button sends one menu choice to the mock channel. Nothing leaves this device.';
  } else if (optIn.data) {
    replyHint =
      'Switch on “Receive WhatsApp reminders” to use the menu. Nothing is sent on this channel without your opt-in.';
  } else {
    replyHint = 'The menu can be used once your opt-in has loaded.';
  }

  const info = CHANNEL_INFO.WHATSAPP;

  return (
    <Container>
      <div className={shared.layout}>
        <div>
          <PageHeader
            back={{ href: '/messages/', label: 'Messages' }}
            eyebrow="Mock adapter"
            title="WhatsApp channel"
            lede="A demonstration of how an official WhatsApp channel would behave safely: opt-in first, approved templates only, and a secure link back to this app for anything personal."
          />
          <Notice tone="neutral" title="Mock channel — no real messages are sent">
            <p>
              This page imitates the behaviour of a messaging channel inside your browser. It is not
              connected to WhatsApp, it has no phone number, and nothing leaves this device.
            </p>
          </Notice>
        </div>
        <aside className={shared.photoAside} aria-label="About this channel">
          <Photo asset="A57" ratio="4 / 3" shape="soft" sizes="20rem" />
        </aside>
      </div>

      <div className={styles.parts}>
        {/* Opt-in --------------------------------------------------- */}
        <Section title="Your opt-in" id="opt-in">
          <Card className={styles.optIn}>
            <QueryBoundary
              query={optIn}
              loadingLabel="Loading your opt-in"
              loadingRows={1}
              headingLevel={3}
            >
              {(current) => (
                <div className={styles.optInSetting}>
                  <Switch
                    label="Receive WhatsApp reminders"
                    hint="Optional. You can switch this off at any time."
                    checked={savingOptIn ?? current.optedIn}
                    onChange={toggleOptIn}
                    stateLabels={{ on: 'On', off: 'Off' }}
                  />
                  <p className={styles.receipt}>
                    {savingOptIn !== null
                      ? 'Saving your choice…'
                      : current.optedIn && current.changedAt && current.consentRef
                        ? `Consent recorded ${formatDateTime(current.changedAt)} · reference ${current.consentRef}`
                        : current.optedIn
                          ? 'On.'
                          : 'Off. You can still use every service, and official notices stay in your secure inbox.'}
                  </p>
                  {changeOptIn.isError ? (
                    <ErrorNotice
                      title="We could not change your WhatsApp reminders"
                      error={changeOptIn.error}
                    />
                  ) : null}
                </div>
              )}
            </QueryBoundary>

            <div className={styles.rules}>
              <div>
                <h3>
                  <Check aria-hidden="true" />
                  WhatsApp may carry
                </h3>
                <ul>
                  {toList(info.carries).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>
                  <Ban aria-hidden="true" />
                  WhatsApp never carries
                </h3>
                <ul>
                  {toList(info.neverCarries).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <p className={styles.receipt}>
              <AppLink href="/messages/preferences/">Choose how we contact you</AppLink> shows every
              channel and what was sent on each.
            </p>
          </Card>
        </Section>

        <div className={styles.columns}>
          {/* Conversation ------------------------------------------- */}
          <Section title="Conversation" id="conversation">
            <div className={styles.phone}>
              <div className={cx(styles.phoneHead, 'on-dark')}>
                <span className={styles.phoneAvatar} aria-hidden="true">
                  <MessageCircle />
                </span>
                <div>
                  <p className={styles.phoneTitle}>Home Affairs One · official channel (mock)</p>
                  <p className={styles.phoneSub}>Demonstration only</p>
                </div>
              </div>

              <div className={styles.screen}>
                <QueryBoundary
                  query={events}
                  loadingLabel="Loading the conversation"
                  headingLevel={3}
                >
                  {(items) => <Transcript events={items} />}
                </QueryBoundary>
              </div>

              <div className={styles.replies} role="group" aria-labelledby={repliesLabelId}>
                <p id={repliesLabelId} className={styles.repliesLabel}>
                  Quick replies
                </p>
                <p id={hintId} className={styles.repliesHint}>
                  {replyHint}
                </p>
                <div className={styles.replyButtons}>
                  {QUICK_REPLIES.map(({ choice, label }) => (
                    <Button
                      key={choice}
                      variant="secondary"
                      size="sm"
                      disabled={!canReply}
                      loading={pendingChoice === choice}
                      aria-describedby={hintId}
                      onClick={() => sendReply(choice)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {reply.isError ? (
                  <ErrorNotice title="That reply was not sent" error={reply.error} />
                ) : null}
              </div>
            </div>
          </Section>

          {/* Governance --------------------------------------------- */}
          <Section
            title="How it is governed"
            id="governance"
            intro="Only wording from an approved registry can be sent, and every event is logged."
          >
            <Stack gap={6}>
              <Stack gap={3}>
                <h3>Approved templates</h3>
                <p className={styles.sectionNote}>
                  A template never says what an update is. It carries a masked reference and a link,
                  shown here as placeholders.
                </p>
                <QueryBoundary
                  query={templates}
                  loadingLabel="Loading approved templates"
                  headingLevel={3}
                  isEmpty={(items) => items.length === 0}
                  empty={<Notice tone="neutral">No templates are registered.</Notice>}
                >
                  {(items) => <TemplateList templates={items} />}
                </QueryBoundary>
              </Stack>

              <Stack gap={3}>
                <h3>Webhook events</h3>
                <p className={styles.sectionNote}>
                  What a real integration would receive from the channel and reconcile with the
                  secure inbox: the kind of event, its direction and the time.
                </p>
                {/* The conversation above already shows loading, offline and error for this data. */}
                {events.isSuccess ? (
                  events.data.length === 0 ? (
                    <Notice tone="neutral">
                      <p>No events yet. The first one is recorded when you opt in.</p>
                    </Notice>
                  ) : (
                    <WebhookLog events={events.data} />
                  )
                ) : (
                  <p className={styles.sectionNote}>
                    The log appears here once the conversation has loaded.
                  </p>
                )}
              </Stack>
            </Stack>
          </Section>
        </div>

        <Card tone="brand" className={styles.rule}>
          <ShieldCheck aria-hidden="true" />
          <p>
            For anything personal, WhatsApp sends a masked reference and a secure link. You sign in
            to see the detail.
          </p>
        </Card>
      </div>
    </Container>
  );
}
