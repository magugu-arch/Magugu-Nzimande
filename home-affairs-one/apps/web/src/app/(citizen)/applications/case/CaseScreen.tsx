'use client';

import { announce } from '@hao/accessibility';
import type {
  ApplicationCase,
  Appointment,
  CaseEvent,
  PaymentRecord,
  ServicePoint,
} from '@hao/api-contracts';
import {
  AppLink,
  Button,
  Card,
  Container,
  cx,
  DescriptionList,
  Dialog,
  EmptyState,
  Eyebrow,
  LinkButton,
  Notice,
  PageHeader,
  Section,
  Split,
  Textarea,
  Timeline,
  type CardProps,
} from '@hao/design-system';
import { STATUS_INFO, type GatewayError } from '@hao/shared-types';
import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowRight, FileSearch, Printer, Send } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { StatusTag } from '@/components/StatusTag';
import { formatDate, formatDateTime, formatSampleAmount, formatTime } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useGatewayMutation, useGatewayQuery } from '@/lib/queries';
import { usePersonToken } from '@/lib/session';
import {
  AppointmentStatusTag,
  AppointmentWhen,
  bookingHref,
  isCaptureDone,
  sentence,
  servicePointHref,
} from '../case-helpers';
import styles from './case.module.css';

type Decision = NonNullable<ApplicationCase['decision']>;

const OUTCOME_WORDS: Record<Decision['outcome'], string> = {
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  REFERRED: 'Referred for review',
};

const EVENT_BY: Record<CaseEvent['actor'], string> = {
  SYSTEM: 'Automatic update',
  APPLICANT: 'You',
  STAFF: 'An official',
};

const PAYMENT_STATUS: Record<PaymentRecord['status'], string> = {
  PENDING: 'Not completed',
  APPROVED: 'Approved (sandbox)',
  DECLINED: 'Declined (sandbox)',
  TIMED_OUT: 'Timed out (sandbox)',
};

function statusTone(item: ApplicationCase): CardProps['tone'] {
  if (item.status === 'ACTION_REQUIRED') return 'attention';
  if (item.status === 'FULFILMENT') return 'success';
  if (item.status === 'CLOSED') return item.statusDetail === 'Completed' ? 'success' : 'default';
  return 'info';
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function CaseScreen() {
  const id = useSearchParams().get('id') ?? '';
  const token = usePersonToken() ?? '';
  const found = useGatewayQuery(['case', id], (g) => g.workflow.getCase(id), {
    enabled: id !== '',
  });
  // Only the applicant's own case is ever shown.
  const own = found.data?.applicantToken === token ? found.data : null;

  return (
    <Container>
      <PageHeader
        back={{ href: '/applications/', label: 'My applications' }}
        eyebrow={own?.serviceTitle}
        title="Track your application"
      >
        {own ? (
          <p className={styles.reference}>
            Reference <strong>{own.caseId}</strong> · Submitted {formatDate(own.submittedAt)}
          </p>
        ) : null}
      </PageHeader>

      {id === '' ? (
        <Missing />
      ) : (
        <QueryBoundary query={found} loadingLabel="Loading your application">
          {(item) =>
            item.applicantToken === token ? (
              <CaseView key={item.caseId} item={item} token={token} />
            ) : (
              <Missing />
            )
          }
        </QueryBoundary>
      )}
    </Container>
  );
}

function Missing() {
  return (
    <EmptyState
      title="We could not find that application"
      icon={<FileSearch />}
      actions={<LinkButton href="/applications/">Back to my applications</LinkButton>}
    >
      <p>Check the link, or open the application from your list.</p>
    </EmptyState>
  );
}

/* ------------------------------------------------------------------ */
/* One case                                                            */
/* ------------------------------------------------------------------ */

function CaseView({ item, token }: { item: ApplicationCase; token: string }) {
  const id = item.caseId;
  const [flash, setFlash] = useState<{ title: string; body: string } | null>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  const events = useGatewayQuery(['case', id, 'events'], (g) => g.workflow.listCaseEvents(id));
  const appointment = useGatewayQuery(
    ['appointment', item.appointmentId],
    (g) => g.appointments.getAppointment(item.appointmentId ?? ''),
    { enabled: item.appointmentId !== null },
  );
  const point = useGatewayQuery(
    ['point', item.servicePointId],
    (g) => g.appointments.getServicePoint(item.servicePointId ?? ''),
    { enabled: item.servicePointId !== null },
  );
  // Seeded cases carry no payment reference, so fall back to the sandbox payment recorded for the case.
  const payment = useGatewayQuery(['payment', id, item.paymentRef], async (g) => {
    if (item.paymentRef) return g.payments.getPayment(item.paymentRef);
    const mine = await g.payments.listPayments(token);
    return mine.find((record) => record.caseId === id) ?? null;
  });

  // After an action the control that was used may be gone, so focus moves to the confirmation.
  useEffect(() => {
    if (flash) flashRef.current?.focus();
  }, [flash]);

  const confirm = (title: string, body: string) => {
    setFlash({ title, body });
    announce(`${title}. ${body}`);
  };

  const visited = isCaptureDone(item);
  const open = item.status !== 'CLOSED';
  const completed = item.status === 'CLOSED' && item.statusDetail === 'Completed';
  const booking = appointment.data;
  const attend = item.nextAction?.type === 'ATTEND_APPOINTMENT';
  // The workflow mock is not told about a cancellation, so the screen points to the way forward.
  const needsNewBooking =
    booking?.status === 'CANCELLED' && open && !visited && (attend || item.status === 'SCHEDULED');
  const showPayment = item.paymentRef !== null || Boolean(payment.data);

  return (
    <>
      <Split gap={5}>
        <div className={styles.main}>
          {flash ? (
            <div ref={flashRef} tabIndex={-1} className={styles.flash}>
              <Notice tone="success" role="status" title={flash.title}>
                <p>{flash.body}</p>
              </Notice>
            </div>
          ) : null}

          <StatusCard item={item} />

          {completed ? (
            <Card tone="success">
              <div className={cx(styles.media, styles.mediaRound)}>
                <Photo asset="A53" ratio="1 / 1" shape="circle" sizes="5rem" decorative />
                <div className={styles.card}>
                  <h2>Nothing more to do</h2>
                  <p>This application is complete. The record stays in your history.</p>
                </div>
              </div>
            </Card>
          ) : null}

          <NextStep
            item={item}
            point={point.data}
            needsNewBooking={needsNewBooking}
            onReplied={() => confirm('Reply sent', 'Your application is back with us for checks.')}
          />

          {item.decision ? <DecisionCard decision={item.decision} /> : null}

          <Section id="progress" title="Progress">
            <Timeline
              label="Application progress"
              items={item.milestones.map((step) => ({
                key: step.key,
                label: step.label,
                state: step.state,
                meta: step.at ? formatDateTime(step.at) : undefined,
              }))}
            />
          </Section>

          <div className={styles.activitySlot}>
            <Section id="activity" title="Activity" intro="Every update, newest first.">
              <QueryBoundary
                query={events}
                loadingLabel="Loading activity"
                headingLevel={3}
                isEmpty={(items) => items.length === 0}
                empty={<Notice tone="neutral">No activity has been recorded yet.</Notice>}
              >
                {(items) => (
                  <ul className={styles.activity}>
                    {[...items].reverse().map((event) => (
                      <li key={event.eventId}>
                        <span className={styles.activityTitle}>{event.title}</span>
                        {event.detail ? (
                          <span className={styles.activityDetail}>{event.detail}</span>
                        ) : null}
                        <span className={styles.activityMeta}>
                          {formatDateTime(event.at)} · {EVENT_BY[event.actor]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </QueryBoundary>
            </Section>
          </div>
        </div>

        <div className={styles.side}>
          {/* Text only: on phones this card is shown after blocks that come later in the page. */}
          <Card className={cx(styles.card, styles.sideRest)}>
            <h2>Application details</h2>
            <DescriptionList
              className={styles.fill}
              items={[
                { term: 'Reference', description: id },
                { term: 'Service', description: item.serviceTitle },
                { term: 'Submitted', description: formatDate(item.submittedAt) },
                { term: 'Last update', description: formatDateTime(item.statusUpdatedAt) },
                ...(point.data ? [{ term: 'Service point', description: point.data.name }] : []),
                ...(item.onBehalfOfLinkId
                  ? [{ term: 'Applied for', description: 'Someone linked to your profile' }]
                  : []),
              ]}
            />
          </Card>

          {item.appointmentId ? (
            <div className={styles.appointmentSlot}>
              <AppointmentCard
                item={item}
                query={appointment}
                visited={visited}
                isAction={attend && booking?.status === 'BOOKED' && !visited}
              />
            </div>
          ) : null}

          {showPayment ? (
            <div className={styles.sideRest}>
              <PaymentCard query={payment} />
            </div>
          ) : null}

          <Card tone="attention" className={cx(styles.card, styles.sideRest)}>
            <h2>Need assistance?</h2>
            <p>Message us or request a call-back.</p>
            <LinkButton href={`/help/callback/?case=${encodeURIComponent(id)}`} variant="secondary">
              Request a call-back
            </LinkButton>
            <AppLink href="/messages/">Go to your messages</AppLink>
          </Card>
        </div>
      </Split>

      <div className={cx(styles.after, 'no-print')}>
        {/* Stays mounted after the case closes, so the confirmation still runs. */}
        <Withdraw
          item={item}
          booking={booking?.status === 'BOOKED' ? booking : null}
          onWithdrawn={() =>
            confirm(
              'Application withdrawn',
              'It is now closed. The history stays in your list of applications.',
            )
          }
        />
        <PrototypeControl caseId={id} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

function StatusCard({ item }: { item: ApplicationCase }) {
  const info = STATUS_INFO[item.status];
  return (
    <Card tone={statusTone(item)} className={styles.card}>
      <p className={styles.statusLabel}>{item.serviceTitle}</p>
      <h2 className={styles.statusText}>
        <span className="visually-hidden">Status: </span>
        {item.statusDetail}
      </h2>
      {item.statusDetail === info.userLabel ? null : <StatusTag status={item.status} />}
      <p className={styles.statusUpdated}>
        Updated {formatTime(item.statusUpdatedAt)} · {formatDate(item.statusUpdatedAt)}
      </p>
      <p>{info.rule}</p>
      <p className={styles.quiet}>
        We only show timeframes when they come from live operational data.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Next action                                                         */
/* ------------------------------------------------------------------ */

function NextStep({
  item,
  point,
  needsNewBooking,
  onReplied,
}: {
  item: ApplicationCase;
  point: ServicePoint | undefined;
  needsNewBooking: boolean;
  onReplied: () => void;
}) {
  const id = item.caseId;
  const action = item.nextAction;

  if (needsNewBooking) {
    return (
      <Card tone="attention" className={styles.card}>
        <h2>Book a new appointment</h2>
        <p>
          The appointment linked to this application was cancelled. Book a new time to continue. The
          status above updates once you have booked.
        </p>
        <LinkButton href={bookingHref(id)} iconEnd={<ArrowRight aria-hidden="true" />}>
          Book an appointment
        </LinkButton>
      </Card>
    );
  }
  if (!action) return null;

  switch (action.type) {
    case 'SELECT_SERVICE_POINT':
      return (
        <Card tone="attention" className={styles.card}>
          <h2>Choose where to complete your application</h2>
          <p>{sentence(action.description)}</p>
          <LinkButton href={bookingHref(id)} iconEnd={<ArrowRight aria-hidden="true" />}>
            Choose a service point
          </LinkButton>
        </Card>
      );

    case 'BOOK_APPOINTMENT':
      return (
        <Card tone="attention" className={styles.card}>
          <h2>Book your appointment</h2>
          <p>{sentence(action.description)}</p>
          {point ? (
            <p>
              Your chosen service point: <strong>{point.name}</strong>
            </p>
          ) : null}
          <LinkButton href={bookingHref(id)} iconEnd={<ArrowRight aria-hidden="true" />}>
            Book an appointment
          </LinkButton>
        </Card>
      );

    case 'PROVIDE_INFORMATION':
      return (
        <Card tone="attention" className={styles.card}>
          <h2>We need more information from you</h2>
          <p>An official asked for the following. Your application is paused until you reply.</p>
          <p className={styles.request}>{action.description}</p>
          {/* A new request starts a new form, with its own idempotency key. */}
          <ReplyForm key={item.statusUpdatedAt} caseId={id} onSent={onReplied} />
        </Card>
      );

    case 'ATTEND_APPOINTMENT':
      // The appointment card is the action. Without a linked booking, point to the booking flow.
      if (item.appointmentId) return null;
      return (
        <Card tone="attention" className={styles.card}>
          <h2>Attend your appointment</h2>
          <p>{sentence(action.description)}</p>
          <LinkButton href={bookingHref(id)} iconEnd={<ArrowRight aria-hidden="true" />}>
            See or book your appointment
          </LinkButton>
        </Card>
      );

    case 'COLLECT':
      return (
        <Card tone="attention">
          <div className={cx(styles.media, styles.mediaWide)}>
            <Photo
              asset="A17"
              ratio="4 / 3"
              shape="soft"
              sizes="(min-width: 36rem) 12rem, 100vw"
              decorative
            />
            <div className={styles.card}>
              <h2>Ready to collect</h2>
              <p>{sentence(action.description)}</p>
              {point ? (
                <p className={styles.place}>
                  <span className={styles.quiet}>Your chosen service point</span>
                  <strong>{point.name}</strong>
                </p>
              ) : null}
              <p>Identity is checked again at handover.</p>
              {item.servicePointId ? (
                <LinkButton href={servicePointHref(item.servicePointId)}>
                  See service point details
                </LinkButton>
              ) : (
                <LinkButton href="/service-points/">Find a service point</LinkButton>
              )}
            </div>
          </div>
        </Card>
      );
  }
}

function ReplyForm({ caseId, onSent }: { caseId: string; onSent: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => newIdempotencyKey('provide-information'));
  const form = useRef<HTMLFormElement>(null);
  const send = useGatewayMutation((g, response: string) =>
    g.workflow.provideInformation(caseId, response, { idempotencyKey }),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const response = text.trim();
    if (response === '') {
      setError('Write your reply before you send it.');
      form.current?.querySelector('textarea')?.focus();
      return;
    }
    send.mutate(response, { onSuccess: onSent });
  };

  return (
    <form ref={form} className={styles.form} onSubmit={submit} noValidate>
      <Textarea
        label="Your reply"
        hint="Write in your own words. Do not include ID numbers or paste documents here."
        rows={5}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
        error={error}
      />
      {send.error ? (
        <Notice tone="danger" role="alert" title="We could not send your reply">
          <p>{send.error.safeMessage}</p>
          <p>Reference for support: {send.error.traceRef}</p>
        </Notice>
      ) : null}
      <Button type="submit" loading={send.isPending} iconEnd={<Send aria-hidden="true" />}>
        Send
      </Button>
      <p className={styles.quiet}>Prototype: your reply is acknowledged but not stored anywhere.</p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Decision, appointment, payment                                      */
/* ------------------------------------------------------------------ */

function DecisionCard({ decision }: { decision: Decision }) {
  return (
    <Card className={styles.card}>
      <h2>Decision</h2>
      <p>
        A decision has been recorded: <strong>{OUTCOME_WORDS[decision.outcome]}</strong>
      </p>
      <p>Recorded by an authorised official on {formatDate(decision.decidedAt)}.</p>
      <p>{decision.reviewRoute}</p>
      <AppLink href="/messages/">Read the notice in your messages</AppLink>
    </Card>
  );
}

function AppointmentCard({
  item,
  query,
  visited,
  isAction,
}: {
  item: ApplicationCase;
  query: UseQueryResult<Appointment, GatewayError>;
  visited: boolean;
  isAction: boolean;
}) {
  return (
    <Card tone={isAction ? 'attention' : 'default'} className={styles.card}>
      <h2>{isAction ? 'Attend your appointment' : 'Appointment'}</h2>
      <div className={styles.fill}>
        <QueryBoundary
          query={query}
          loadingLabel="Loading your appointment"
          loadingRows={1}
          headingLevel={3}
        >
          {(booking) => (
            <div className={styles.card}>
              {isAction ? <p>This is your next step.</p> : null}
              <AppointmentWhen startsAt={booking.startsAt} timeZone={booking.timeZone} />
              <p className={styles.place}>
                <strong>{booking.servicePointName}</strong>
                <AppLink href={servicePointHref(booking.servicePointId)}>
                  Service point details
                </AppLink>
              </p>
              <AppointmentStatusTag appointment={booking} visited={visited} />
              {booking.status === 'BOOKED' && !visited && item.status !== 'CLOSED' ? (
                <LinkButton href={bookingHref(item.caseId)} variant="secondary">
                  Change or cancel
                </LinkButton>
              ) : null}
            </div>
          )}
        </QueryBoundary>
      </div>
    </Card>
  );
}

function PaymentCard({ query }: { query: UseQueryResult<PaymentRecord | null, GatewayError> }) {
  return (
    <Card className={styles.card}>
      <h2>Payment</h2>
      <div className={styles.fill}>
        <QueryBoundary
          query={query}
          loadingLabel="Loading payment details"
          loadingRows={1}
          headingLevel={3}
        >
          {(record) =>
            record ? (
              <div className={styles.card}>
                <DescriptionList
                  className={styles.fill}
                  items={[
                    { term: 'Sample amount', description: formatSampleAmount(record.amountCents) },
                    { term: 'Status', description: PAYMENT_STATUS[record.status] },
                    {
                      term: 'Receipt number',
                      description: record.receiptNumber ?? 'No receipt yet',
                    },
                  ]}
                />
                <p className={styles.quiet}>Payment sandbox — no money moved.</p>
                <Button
                  variant="secondary"
                  className="no-print"
                  iconStart={<Printer aria-hidden="true" />}
                  onClick={() => window.print()}
                >
                  Print receipt
                </Button>
              </div>
            ) : null
          }
        </QueryBoundary>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Withdraw                                                            */
/* ------------------------------------------------------------------ */

function Withdraw({
  item,
  booking,
  onWithdrawn,
}: {
  item: ApplicationCase;
  booking: Appointment | null;
  onWithdrawn: () => void;
}) {
  // A key exists while the dialog is open: one key for this decision to withdraw.
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const withdraw = useGatewayMutation(async (g, key: string) => {
    const closed = await g.workflow.withdrawCase(item.caseId, { idempotencyKey: key });
    if (booking) {
      // The workflow mock does not release the booking, so the screen does. If this fails the
      // person can still cancel it from My appointments.
      await g.appointments
        .cancel(booking.appointmentId, { idempotencyKey: key })
        .catch(() => undefined);
    }
    return closed;
  });

  const close = () => setIdempotencyKey(null);

  return (
    <div>
      {item.status === 'CLOSED' ? null : (
        <Button
          variant="quiet"
          className={styles.dangerQuiet}
          onClick={() => {
            withdraw.reset();
            setIdempotencyKey(newIdempotencyKey('withdraw-case'));
          }}
        >
          Withdraw this application
        </Button>
      )}

      <Dialog
        open={idempotencyKey !== null}
        onClose={close}
        title="Withdraw this application?"
        actions={
          <>
            <Button variant="secondary" onClick={close}>
              Keep application
            </Button>
            <Button
              variant="danger"
              loading={withdraw.isPending}
              onClick={() => {
                if (!idempotencyKey) return;
                withdraw.mutate(idempotencyKey, {
                  onSuccess: () => {
                    close();
                    onWithdrawn();
                  },
                });
              }}
            >
              Withdraw application
            </Button>
          </>
        }
      >
        <p>
          Withdrawing closes “{item.serviceTitle}”. It cannot be undone here: to continue later you
          would start a new application.
        </p>
        {booking ? <p>Your booked appointment for this application will be cancelled.</p> : null}
        <p>The history of this application stays in your list.</p>
        {withdraw.error ? (
          <Notice tone="danger" role="alert" title="We could not withdraw the application">
            <p>{withdraw.error.safeMessage}</p>
            <p>Reference for support: {withdraw.error.traceRef}</p>
          </Notice>
        ) : null}
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Prototype control                                                   */
/* ------------------------------------------------------------------ */

function PrototypeControl({ caseId }: { caseId: string }) {
  const simulate = useGatewayMutation((g, idempotencyKey: string) =>
    g.workflow.simulateNextEvent(caseId, { idempotencyKey }),
  );

  const run = () => {
    // Every press is a new intent, so it gets a new key.
    simulate.mutate(newIdempotencyKey('simulate-event'), {
      onSuccess: (next) =>
        announce(`Status updated: ${next.statusDetail}. A notice was added to Messages.`),
    });
  };

  return (
    <Card tone="sunken" className={styles.card}>
      <Eyebrow>Prototype control — not part of the real service</Eyebrow>
      <h2>Simulate the next update</h2>
      <p>
        In a real service, updates arrive from the case system as they happen. Here you can move
        this sample application one step along to see the status, timeline and messages respond. It
        never records a decision: only an authorised official can do that.
      </p>
      <Button variant="secondary" loading={simulate.isPending} onClick={run}>
        Simulate the next update
      </Button>

      {simulate.isSuccess ? (
        <Notice
          tone="success"
          role="status"
          title={`Status updated: ${simulate.data.statusDetail}`}
        >
          <p>
            A notice was added to Messages. <AppLink href="/messages/">Open messages</AppLink>
          </p>
        </Notice>
      ) : null}

      {simulate.error?.category === 'CONFLICT' ? (
        // Expected behaviour, not a failure: the workflow is waiting for a person.
        <Notice tone="info" role="status" title="Nothing to simulate right now">
          <p>{simulate.error.safeMessage}</p>
          <p>
            Steps that need an official, such as recording a decision, are done in the staff
            console. <AppLink href="/staff/">Open the staff console</AppLink>
          </p>
        </Notice>
      ) : null}

      {simulate.error && simulate.error.category !== 'CONFLICT' ? (
        <Notice tone="danger" role="alert" title="We could not simulate an update">
          <p>{simulate.error.safeMessage}</p>
          <p>Reference for support: {simulate.error.traceRef}</p>
        </Notice>
      ) : null}
    </Card>
  );
}
