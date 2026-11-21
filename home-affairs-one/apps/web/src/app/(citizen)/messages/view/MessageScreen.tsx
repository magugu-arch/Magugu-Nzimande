'use client';

import type { InboxMessage } from '@hao/api-contracts';
import {
  Card,
  Cluster,
  Container,
  EmptyState,
  LinkButton,
  PageHeader,
  Stack,
} from '@hao/design-system';
import { ArrowRight, MailQuestion, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { QueryBoundary } from '@/components/QueryBoundary';
import { formatDateTime } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useGatewayMutation, useGatewayQuery } from '@/lib/queries';
import { usePersonToken } from '@/lib/session';
import styles from '../messages.module.css';
import { caseHref, CATEGORY_INFO, isInAppHref } from '../words';

const MESSAGE_ID = /^MSG-DEMO-\d+$/;

/** True when the message's own button already opens this application. */
function opensCase(href: string, caseId: string): boolean {
  const [path, query = ''] = href.split('?');
  return path === '/applications/case/' && new URLSearchParams(query).get('id') === caseId;
}

function MessageBody({ message }: { message: InboxMessage }) {
  const action = message.action && isInAppHref(message.action.href) ? message.action : null;
  const showCaseLink =
    message.caseId !== null && !(action && opensCase(action.href, message.caseId));

  return (
    <Stack gap={5}>
      <Card as="article" className={styles.notice} aria-label="Official notice">
        <div className={styles.body}>
          {message.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        {action || showCaseLink ? (
          <Cluster gap={3}>
            {action ? (
              <LinkButton href={action.href} iconEnd={<ArrowRight aria-hidden="true" />}>
                {action.label}
              </LinkButton>
            ) : null}
            {showCaseLink && message.caseId ? (
              <LinkButton href={caseHref(message.caseId)} variant="secondary">
                Open the application
              </LinkButton>
            ) : null}
          </Cluster>
        ) : null}
      </Card>

      <Card tone="sunken" padding="compact" className={styles.footer}>
        <ShieldCheck aria-hidden="true" />
        <div>
          <p className={styles.footerMeta}>
            This is an official notice in your secure inbox. Template {message.templateKey}, content{' '}
            {message.contentVersion}.
          </p>
          <p>We will never ask for your password or one-time PIN.</p>
        </div>
      </Card>
    </Stack>
  );
}

export function MessageScreen() {
  const id = useSearchParams().get('id') ?? '';
  const token = usePersonToken();
  const validId = MESSAGE_ID.test(id);

  const query = useGatewayQuery(['message', id], (g) => g.notifications.getMessage(id), {
    enabled: validId && Boolean(token),
  });
  const { mutate: markAsRead } = useGatewayMutation(
    (g, input: { messageId: string; idempotencyKey: string }) =>
      g.notifications.markRead(input.messageId, { idempotencyKey: input.idempotencyKey }),
  );

  // A message that does not exist and a message addressed to someone else look
  // exactly the same, so this page never confirms that another person's message exists.
  const notFound =
    !validId ||
    (query.isError && query.error.category === 'NOT_FOUND') ||
    (query.data !== undefined && query.data.recipientToken !== token);
  const message = !notFound && query.data ? query.data : null;

  // Mark as read once per message, on open. It is not worth interrupting
  // someone's reading if this fails: the message simply stays unread.
  const unreadId = message && message.readAt === null ? message.messageId : null;
  const marked = useRef<string | null>(null);
  useEffect(() => {
    if (!unreadId || marked.current === unreadId) return;
    marked.current = unreadId;
    markAsRead({ messageId: unreadId, idempotencyKey: newIdempotencyKey('mark-read') });
  }, [unreadId, markAsRead]);

  return (
    <Container width="narrow">
      <PageHeader
        back={{ href: '/messages/', label: 'Messages' }}
        eyebrow={message ? CATEGORY_INFO[message.category].label : undefined}
        title={message ? message.subject : 'Message'}
      >
        {message ? (
          <p className={styles.sent}>
            Sent <time dateTime={message.sentAt}>{formatDateTime(message.sentAt)}</time>
          </p>
        ) : null}
      </PageHeader>

      {notFound ? (
        <EmptyState
          title="We could not find that message"
          icon={<MailQuestion />}
          actions={<LinkButton href="/messages/">Back to messages</LinkButton>}
        >
          <p>
            It may have been opened from an old link, or it belongs to a different account. Your
            notices are all listed in your secure inbox.
          </p>
        </EmptyState>
      ) : (
        <QueryBoundary query={query} loadingLabel="Loading message" loadingRows={2}>
          {(loaded) => <MessageBody message={loaded} />}
        </QueryBoundary>
      )}
    </Container>
  );
}
