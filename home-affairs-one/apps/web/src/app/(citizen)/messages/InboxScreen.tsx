'use client';

import { announce } from '@hao/accessibility';
import type { InboxMessage } from '@hao/api-contracts';
import {
  AppLink,
  Card,
  Container,
  EmptyState,
  Grid,
  LinkButton,
  Notice,
  PageHeader,
  Section,
  SegmentedControl,
  Tag,
} from '@hao/design-system';
import { maskReference } from '@hao/shared-types';
import { ArrowRight, LifeBuoy, MessageCircle, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { IconTile, Row, Rows } from '@/components/cards';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { formatRelative } from '@/lib/format';
import { useGatewayQuery } from '@/lib/queries';
import { usePersonToken } from '@/lib/session';
import styles from './messages.module.css';
import { CATEGORY_INFO, messageHref } from './words';

type Filter = 'all' | 'unread';

const PREVIEW_LENGTH = 110;

/**
 * The first paragraph, shortened for the list. A case reference is masked here:
 * the full notice, with its reference, is only shown once the message is opened.
 */
function preview(message: InboxMessage): string {
  let text = (message.body[0] ?? '').trim();
  if (message.caseId) text = text.replaceAll(message.caseId, maskReference(message.caseId));
  if (text.length <= PREVIEW_LENGTH) return text;
  const cut = text.slice(0, PREVIEW_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  const whole = lastSpace > PREVIEW_LENGTH / 2 ? cut.slice(0, lastSpace) : cut;
  return `${whole.replace(/[\s,;:.]+$/, '')}…`;
}

function countLabel(unread: number, total: number): string {
  const messages = total === 1 ? '1 message' : `${total} messages`;
  return unread === 0 ? `${messages}, all read` : `${unread} unread of ${messages}`;
}

export function InboxScreen() {
  const token = usePersonToken();
  const inbox = useGatewayQuery(['inbox', token], (g) => g.notifications.listInbox(token ?? ''), {
    enabled: Boolean(token),
  });
  const [filter, setFilter] = useState<Filter>('all');

  const total = inbox.data?.length ?? 0;
  const unreadCount = inbox.data?.filter((message) => message.readAt === null).length ?? 0;

  const changeFilter = (value: string) => {
    const next: Filter = value === 'unread' ? 'unread' : 'all';
    setFilter(next);
    if (next === 'unread') {
      announce(
        unreadCount === 0
          ? 'You are up to date. No unread messages.'
          : `Showing ${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}.`,
      );
    } else {
      announce(`Showing all ${total} ${total === 1 ? 'message' : 'messages'}.`);
    }
  };

  return (
    <Container>
      <div className={styles.layout}>
        <div>
          <PageHeader
            title="Messages"
            lede="Official notices live here. Other channels only point you back to this inbox."
          />

          <div className={styles.sections}>
            <section className={styles.inbox} aria-labelledby="inbox-heading">
              <div className={styles.listHead}>
                <h2 id="inbox-heading">Secure inbox</h2>
                {total > 0 ? (
                  <SegmentedControl
                    label="Show"
                    name="inbox-filter"
                    value={filter}
                    onChange={changeFilter}
                    options={[
                      { value: 'all', label: 'All' },
                      { value: 'unread', label: 'Unread' },
                    ]}
                  />
                ) : null}
              </div>

              <QueryBoundary
                query={inbox}
                loadingLabel="Loading your messages"
                loadingRows={4}
                headingLevel={3}
                isEmpty={(messages) => messages.length === 0}
                empty={
                  <EmptyState
                    title="No messages yet"
                    headingLevel={3}
                    actions={<LinkButton href="/services/">Find a service</LinkButton>}
                  >
                    <p>
                      When you apply for something, official notices about it will appear here:
                      updates, requests for information, receipts and appointment details.
                    </p>
                  </EmptyState>
                }
              >
                {(messages) => {
                  const shown =
                    filter === 'unread'
                      ? messages.filter((message) => message.readAt === null)
                      : messages;
                  return (
                    <>
                      <p className={styles.count}>{countLabel(unreadCount, messages.length)}</p>
                      {shown.length === 0 ? (
                        <Notice tone="success" title="You are up to date.">
                          <p>There are no unread messages. Choose “All” to see earlier notices.</p>
                        </Notice>
                      ) : (
                        <Rows label={filter === 'unread' ? 'Unread messages' : 'All messages'}>
                          {shown.map((message) => {
                            const category = CATEGORY_INFO[message.category];
                            return (
                              <Row
                                key={message.messageId}
                                href={messageHref(message.messageId)}
                                title={message.subject}
                                unread={message.readAt === null}
                                lead={category.icon}
                                meta={
                                  <>
                                    <Tag tone={category.tone}>{category.label}</Tag>
                                    <span>{formatRelative(message.sentAt)}</span>
                                  </>
                                }
                                text={preview(message)}
                              />
                            );
                          })}
                        </Rows>
                      )}
                    </>
                  );
                }}
              </QueryBoundary>
            </section>

            <Section title="Manage your messages" id="manage">
              <Grid gap={3} min="12rem">
                <IconTile
                  href="/messages/preferences/"
                  icon={<SlidersHorizontal />}
                  title="Choose how we contact you"
                  hint="Switch reminders on or off for each channel"
                />
                <IconTile
                  href="/messages/whatsapp/"
                  icon={<MessageCircle />}
                  title="WhatsApp channel"
                  hint="See how an official channel would work (mock)"
                />
                <IconTile
                  href="/help/"
                  icon={<LifeBuoy />}
                  title="Get help"
                  hint="Ask a question or request a call-back"
                />
              </Grid>
            </Section>
          </div>
        </div>

        <aside className={styles.aside} aria-label="Staying safe">
          <div className={styles.photoWrap}>
            <Photo asset="A33" ratio="4 / 5" sizes="20rem" />
          </div>
          <Card tone="brand" className={styles.safety}>
            <ShieldCheck aria-hidden="true" size={28} />
            <h2>Never send ID documents in public messages.</h2>
            <p>
              Use secure Home Affairs One sign-in. We will never ask for your password or one-time
              PIN.
            </p>
            <AppLink href="/help/official-channels/">
              Check our official channels
              <ArrowRight aria-hidden="true" />
            </AppLink>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
