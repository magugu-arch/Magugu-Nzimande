import Link from 'next/link';
import type { Route } from 'next';
import { Suspense } from 'react';
import { setChatStatusAction, setEnquiryStatusAction } from '@/app/admin/actions';
import { AutoRefresh } from '@/components/admin/AutoRefresh';
import { StatusBadge } from '@/components/admin/BookingStatus';
import { PlainActionButton } from '@/components/admin/forms';
import { MarkRead, ReplyForm, TableActions, ThreadScroller } from '@/components/admin/InboxParts';
import styles from '@/components/admin/admin.module.css';
import { site } from '@/content/site';
import { requireStaff } from '@/lib/auth/session';
import { conversationThread, enquiryLabels, inboxCounts, listConversations, listEnquiries, listTableRequests } from '@/lib/data/admin';
import { formatDayShort, hmInSast, ymdInSast } from '@/lib/time';

export const metadata = { title: 'Inbox' };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

const stamp = (d: Date) => {
  const today = ymdInSast(new Date());
  const day = ymdInSast(d);
  return day === today ? hmInSast(d) : `${formatDayShort(day)} ${hmInSast(d)}`;
};

const waLink = (phone: string, text: string) => {
  const digits = phone.replace(/[^\d]/g, '').replace(/^0/, '27');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
};

const replySuggestions = [
  'Thanks for your message!',
  'You can book a timed slot at sowetotowers.co.za/book.',
  `Groups of 6 or more get the group rate automatically when you book.`,
  `We’re open Thursday 12:00 and Friday to Sunday 10:00, till sunset.`,
];

async function Chats({ selected }: { selected: string }) {
  const convs = await listConversations();
  const active = selected || convs.find((c) => c.status === 'open')?.id || convs[0]?.id || '';
  const thread = active ? await conversationThread(active) : null;
  return (
    <div className={styles.inbox}>
      <section className={styles.panel} aria-label="Conversations" style={{ padding: 8 }}>
        {convs.length === 0 ? (
          <p className={styles.empty}>No chats yet. Messages from “Ask the crew” on the website land here.</p>
        ) : (
          <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {convs.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/inbox?tab=chats&c=${c.id}` as Route}
                  className={styles.convLink}
                  aria-current={c.id === active ? 'true' : undefined}
                  scroll={false}
                >
                  <span className={styles.convTop}>
                    <span className={styles.rowTitle}>{c.name || c.contact || 'Website visitor'}</span>
                    <span className={styles.rowActions}>
                      {c.unreadForStaff > 0 && <span className={styles.count}>{c.unreadForStaff}</span>}
                      <span className={`${styles.small} ${styles.muted}`}>{stamp(c.lastMessageAt)}</span>
                    </span>
                  </span>
                  <span className={styles.convPreview}>
                    {c.last ? `${c.last.sender === 'staff' ? 'You: ' : c.last.sender === 'bot' ? 'Auto: ' : ''}${c.last.body}` : '—'}
                  </span>
                  {c.status === 'closed' && <StatusBadge status="closed" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {thread ? (
        <section className={styles.panel} aria-labelledby="thread-title">
          <MarkRead id={thread.conversation.id} unread={thread.conversation.unreadForStaff} />
          <div className={styles.panelHead}>
            <div>
              <h2 id="thread-title" className={styles.rowTitle}>
                {thread.conversation.name || 'Website visitor'}
              </h2>
              <p className={`${styles.small} ${styles.muted}`}>
                {thread.conversation.contact ? (
                  <a href={waLink(thread.conversation.contact, 'Hi, it’s Soweto Towers following up on your chat. ')} target="_blank" rel="noopener">
                    {thread.conversation.contact} · WhatsApp
                  </a>
                ) : (
                  'No contact number left'
                )}
                {thread.conversation.page ? ` · started on ${thread.conversation.page}` : ''}
              </p>
            </div>
            <PlainActionButton
              action={setChatStatusAction}
              fields={{ conversationId: thread.conversation.id, status: thread.conversation.status === 'open' ? 'closed' : 'open' }}
            >
              {thread.conversation.status === 'open' ? 'Close chat' : 'Reopen'}
            </PlainActionButton>
          </div>
          <ThreadScroller count={thread.messages.length}>
            {thread.messages.map((m) => (
              <div
                key={m.id}
                className={`${styles.bubble} ${m.sender === 'staff' ? styles.bubbleStaff : m.sender === 'bot' ? styles.bubbleBot : styles.bubbleVisitor}`}
              >
                <span className={styles.bubbleMeta}>
                  {m.sender === 'staff' ? m.staffName || 'Crew' : m.sender === 'bot' ? 'Automatic answer' : 'Visitor'} · {stamp(m.createdAt)}
                </span>
                {m.body}
              </div>
            ))}
          </ThreadScroller>
          <ReplyForm conversationId={thread.conversation.id} suggestions={replySuggestions} />
        </section>
      ) : null}
    </div>
  );
}

async function Enquiries({ filter }: { filter: string }) {
  const status = filter === 'new' || filter === 'replied' || filter === 'closed' ? filter : undefined;
  const rows = await listEnquiries(status);
  return (
    <section className={styles.panel} aria-label="Enquiries">
      <div className={styles.tabs}>
        {[
          ['', 'All'],
          ['new', 'New'],
          ['replied', 'Replied'],
          ['closed', 'Closed'],
        ].map(([v, l]) => (
          <Link
            key={v}
            href={`/admin/inbox?tab=enquiries${v ? `&status=${v}` : ''}` as Route}
            className={styles.tab}
            aria-current={(status ?? '') === v ? 'page' : undefined}
          >
            {l}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>No enquiries here.</p>
      ) : (
        <ul className={styles.rows} role="list">
          {rows.map((e) => (
            <li key={e.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  {e.name}
                  {e.company ? ` · ${e.company}` : ''}
                </span>
                <StatusBadge status={e.status} />
                <span className={styles.st}>{enquiryLabels[e.type]}</span>
              </div>
              <div className={styles.rowMeta}>
                <span>{stamp(e.createdAt)}</span>
                {e.groupSize ? <span>{e.groupSize} people</span> : null}
                {e.preferredDate ? <span>Wants {formatDayShort(e.preferredDate)}</span> : null}
              </div>
              <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.message}</p>
              <div className={styles.rowActions}>
                <a
                  className="btn btn--dark btn--sm"
                  href={`mailto:${e.email}?subject=${encodeURIComponent(`Your ${enquiryLabels[e.type].toLowerCase()} enquiry · Soweto Towers`)}&body=${encodeURIComponent(`Hi ${e.name.split(' ')[0]},\n\nThanks for getting in touch with Soweto Towers.\n\n`)}`}
                >
                  Email
                </a>
                {e.phone && (
                  <a
                    className="btn btn--light btn--sm"
                    href={waLink(e.phone, `Hi ${e.name.split(' ')[0]}, it’s Soweto Towers about your enquiry. `)}
                    target="_blank"
                    rel="noopener"
                  >
                    WhatsApp
                  </a>
                )}
                {e.status !== 'replied' && (
                  <PlainActionButton action={setEnquiryStatusAction} fields={{ id: e.id, status: 'replied' }}>
                    Mark replied
                  </PlainActionButton>
                )}
                {e.status !== 'closed' ? (
                  <PlainActionButton action={setEnquiryStatusAction} fields={{ id: e.id, status: 'closed' }} className={styles.linkBtn}>
                    Close
                  </PlainActionButton>
                ) : (
                  <PlainActionButton action={setEnquiryStatusAction} fields={{ id: e.id, status: 'new' }} className={styles.linkBtn}>
                    Reopen
                  </PlainActionButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function Tables() {
  const rows = await listTableRequests();
  const today = ymdInSast(new Date());
  return (
    <section className={styles.panel} aria-label="Table requests">
      <p className={`${styles.small} ${styles.muted}`}>
        Requests for Chaf-Pozi. Confirming sends the guest a WhatsApp. Check with the restaurant first if you’re unsure.
      </p>
      {rows.length === 0 ? (
        <p className={styles.empty}>No table requests yet.</p>
      ) : (
        <ul className={styles.rows} role="list">
          {rows.map((t) => (
            <li key={t.id} className={`${styles.row} ${styles.rowSplit}`} style={{ opacity: t.date < today ? 0.6 : 1 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    {formatDayShort(t.date)} · {t.time} · {t.partySize} {t.partySize === 1 ? 'person' : 'people'}
                  </span>
                  <StatusBadge status={t.status} />
                </span>
                <span className={styles.rowMeta}>
                  <span>{t.name}</span>
                  <a href={`tel:${t.phone.replace(/\s/g, '')}`}>{t.phone}</a>
                  {t.bookingRef && (
                    <Link href={`/admin/bookings/${t.bookingRef}` as Route} className={styles.mono}>
                      {t.bookingRef}
                    </Link>
                  )}
                </span>
                {t.notes && <span className={styles.small}>“{t.notes}”</span>}
              </div>
              {t.date >= today && <TableActions id={t.id} status={t.status} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function InboxContent({ searchParams }: { searchParams: SP }) {
  await requireStaff();
  const sp = await searchParams;
  const tab = one(sp.tab) === 'enquiries' || one(sp.tab) === 'tables' ? one(sp.tab) : 'chats';
  const counts = await inboxCounts();
  const tabs: [string, string, number][] = [
    ['chats', 'Chats', counts.chats],
    ['enquiries', 'Enquiries', counts.enquiries],
    ['tables', 'Tables', counts.tables],
  ];
  return (
    <>
      <AutoRefresh seconds={10} />
      <nav className={styles.tabs} aria-label="Inbox sections">
        {tabs.map(([v, l, n]) => (
          <Link key={v} href={`/admin/inbox?tab=${v}` as Route} className={styles.tab} aria-current={tab === v ? 'page' : undefined}>
            {l}
            {n > 0 && <span className={styles.count}>{n}</span>}
          </Link>
        ))}
      </nav>
      {tab === 'chats' && <Chats selected={/^[0-9a-f-]{36}$/i.test(one(sp.c)) ? one(sp.c) : ''} />}
      {tab === 'enquiries' && <Enquiries filter={one(sp.status)} />}
      {tab === 'tables' && <Tables />}
    </>
  );
}

export default function InboxPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow">Inbox</p>
          <h1 className={styles.pageTitle}>Messages</h1>
          <p className={styles.pageSub}>Website chats, group and partner enquiries, and table requests. Enquiry emails also go to {site.email}.</p>
        </div>
      </header>
      <Suspense fallback={<div className={styles.skeleton} />}>
        <InboxContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
