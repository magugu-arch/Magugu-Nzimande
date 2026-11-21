'use client';

import { announce } from '@hao/accessibility';
import type {
  AccessFeature,
  ApplicationCase,
  Appointment,
  AppointmentSlot,
  ServicePoint,
  ServicePointKind,
} from '@hao/api-contracts';
import {
  AppLink,
  Button,
  Card,
  Container,
  cx,
  EmptyState,
  LinkButton,
  Notice,
  PageHeader,
  SampleNotice,
  Section,
  Stack,
  Stepper,
  Tag,
  UnavailableState,
} from '@hao/design-system';
import { isGatewayError, maskReference } from '@hao/shared-types';
import {
  ArrowRight,
  Ban,
  CircleAlert,
  CircleCheck,
  CircleDot,
  FileSearch,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { formatTime, formatTimeInZone } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useGatewayMutation, useGatewayQuery } from '@/lib/queries';
import {
  AppointmentWhen,
  bookingLock,
  caseHref,
  formatAppointmentDay,
  SAST,
  servicePointHref,
} from '../applications/case-helpers';
import styles from './appointments.module.css';
import { CancelAppointment } from './CancelAppointment';

const STEPS = ['Choose a service point', 'Choose a time', 'Confirmed'];
const STEP_INDEX = { point: 0, time: 1, confirmed: 2 } as const;

const KIND_WORDS: Record<ServicePointKind, string> = {
  SERVICE_OFFICE: 'Service office',
  PARTNER_BANK: 'Partner bank point',
  MOBILE_UNIT: 'Mobile unit',
  KIOSK: 'Self-service kiosk',
  MISSION_ABROAD: 'Mission abroad',
};

const FEATURE_WORDS: Record<AccessFeature, string> = {
  STEP_FREE: 'Step-free access',
  ACCESSIBLE_PARKING: 'Accessible parking',
  HEARING_LOOP: 'Hearing loop',
  SIGN_LANGUAGE_BY_BOOKING: 'Sign language by booking',
  QUIET_HOUR: 'Quiet hour',
  ASSISTED_DIGITAL: 'Help with digital steps',
};

const AVAILABILITY: Record<
  ServicePoint['availability'],
  { label: string; tone: 'success' | 'attention' | 'neutral'; icon: ReactNode }
> = {
  OPEN: { label: 'Open', tone: 'success', icon: <CircleCheck aria-hidden="true" /> },
  LIMITED: {
    label: 'Limited service',
    tone: 'attention',
    icon: <TriangleAlert aria-hidden="true" />,
  },
  CLOSED_TODAY: { label: 'Closed today', tone: 'neutral', icon: <Ban aria-hidden="true" /> },
  NOT_REPORTED: {
    label: 'Status not reported',
    tone: 'neutral',
    icon: <CircleDot aria-hidden="true" />,
  },
};

/**
 * Where the person is in the flow. It starts from what the case and its
 * appointment say, and after that follows what the person does here, using the
 * records the mock services return.
 */
type Stage =
  | { name: 'point'; booked: Appointment | null }
  | { name: 'time'; pointId: string; booked: Appointment | null; cancelled?: boolean }
  | { name: 'confirmed'; appointment: Appointment; fresh: boolean };

function initialStage(item: ApplicationCase, linked: Appointment | null): Stage {
  const booked = linked?.status === 'BOOKED' ? linked : null;
  if (item.servicePointId === null) return { name: 'point', booked };
  if (booked) return { name: 'confirmed', appointment: booked, fresh: false };
  return { name: 'time', pointId: item.servicePointId, booked: null };
}

type HeadingRef = RefObject<HTMLHeadingElement | null>;

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function BookingFlow({ caseId, token }: { caseId: string; token: string }) {
  // One query for the case and its linked appointment, so the two never disagree.
  const found = useGatewayQuery(['case', caseId, 'booking'], async (g) => {
    const item = await g.workflow.getCase(caseId);
    if (!item.appointmentId) return { item, linked: null };
    try {
      return { item, linked: await g.appointments.getAppointment(item.appointmentId) };
    } catch (error) {
      if (isGatewayError(error) && error.category === 'NOT_FOUND') return { item, linked: null };
      throw error;
    }
  });
  // Only the applicant's own case is ever shown.
  const own = found.data?.item.applicantToken === token ? found.data.item : null;

  return (
    <Container width="narrow">
      <PageHeader
        back={
          own
            ? { href: caseHref(own.caseId), label: 'Your application' }
            : { href: '/applications/', label: 'My applications' }
        }
        eyebrow={own?.serviceTitle}
        title="Your appointment"
      >
        {own ? <p className={styles.reference}>Reference {maskReference(own.caseId)}</p> : null}
      </PageHeader>

      <QueryBoundary query={found} loadingLabel="Loading your application">
        {({ item, linked }) =>
          item.applicantToken === token ? (
            <Booking item={item} linked={linked} token={token} />
          ) : (
            <EmptyState
              title="We could not find that application"
              icon={<FileSearch />}
              actions={<LinkButton href="/applications/">Back to my applications</LinkButton>}
            >
              <p>Check the link, or open the application from your list.</p>
            </EmptyState>
          )
        }
      </QueryBoundary>
    </Container>
  );
}

function Booking({
  item,
  linked,
  token,
}: {
  item: ApplicationCase;
  linked: Appointment | null;
  token: string;
}) {
  const [stage, setStage] = useState<Stage | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // Each step replaces the last, so focus moves to the new step's heading.
  useEffect(() => {
    if (stage) heading.current?.focus();
  }, [stage]);

  const lock = bookingLock(item);
  if (lock) {
    const leftover = item.status === 'CLOSED' && linked?.status === 'BOOKED' ? linked : null;
    return (
      <Stack gap={5}>
        <Notice tone="info" title="There is nothing to book for this application">
          <p>{lock}</p>
        </Notice>
        {leftover ? (
          <Card>
            <Stack gap={3}>
              <h2 style={{ fontSize: 'var(--text-xl)' }}>An appointment is still booked</h2>
              <AppointmentWhen startsAt={leftover.startsAt} timeZone={leftover.timeZone} />
              <p>{leftover.servicePointName}</p>
              <div>
                <CancelAppointment
                  appointment={leftover}
                  consequence="The application is closed, so this time is no longer needed."
                />
              </div>
            </Stack>
          </Card>
        ) : null}
        <div>
          <LinkButton href={caseHref(item.caseId)}>Back to my application</LinkButton>
        </div>
      </Stack>
    );
  }

  const current = stage ?? initialStage(item, linked);

  return (
    <Stack gap={5}>
      <Stepper steps={STEPS} current={STEP_INDEX[current.name]} />

      {current.name === 'point' ? (
        <PointStep
          item={item}
          token={token}
          booked={current.booked}
          heading={heading}
          onChosen={(point, kept) => setStage({ name: 'time', pointId: point.id, booked: kept })}
          onKeep={(appointment) => setStage({ name: 'confirmed', appointment, fresh: false })}
        />
      ) : null}

      {current.name === 'time' ? (
        <TimeStep
          // A different place or booking starts the step afresh.
          key={`${current.pointId}:${current.booked?.appointmentId ?? 'new'}`}
          item={item}
          token={token}
          pointId={current.pointId}
          booked={current.booked}
          cancelled={current.cancelled === true}
          heading={heading}
          onConfirmed={(appointment) => setStage({ name: 'confirmed', appointment, fresh: true })}
          onChangePoint={() => setStage({ name: 'point', booked: current.booked })}
          onKeep={(appointment) => setStage({ name: 'confirmed', appointment, fresh: false })}
        />
      ) : null}

      {current.name === 'confirmed' ? (
        <ConfirmedStep
          key={`${current.appointment.appointmentId}:${current.appointment.startsAt}`}
          item={item}
          appointment={current.appointment}
          fresh={current.fresh}
          heading={heading}
          onChangeTime={() =>
            setStage({
              name: 'time',
              pointId: current.appointment.servicePointId,
              booked: current.appointment,
            })
          }
          onChangePoint={() => setStage({ name: 'point', booked: current.appointment })}
          onCancelled={() =>
            setStage({
              name: 'time',
              pointId: current.appointment.servicePointId,
              booked: null,
              cancelled: true,
            })
          }
        />
      ) : null}
    </Stack>
  );
}

function FieldError({ children }: { children: string }) {
  return (
    <p className={styles.fieldError} role="alert">
      <CircleAlert aria-hidden="true" />
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: choose a service point                                      */
/* ------------------------------------------------------------------ */

function PointStep({
  item,
  token,
  booked,
  heading,
  onChosen,
  onKeep,
}: {
  item: ApplicationCase;
  token: string;
  /** A booking that already exists. Choosing a different place cancels it. */
  booked: Appointment | null;
  heading: HeadingRef;
  onChosen: (point: ServicePoint, kept: Appointment | null) => void;
  onKeep: (appointment: Appointment) => void;
}) {
  const points = useGatewayQuery(['points', item.serviceCode, token], async (g) => {
    const [all, account] = await Promise.all([
      g.appointments.listServicePoints({ serviceCode: item.serviceCode }),
      g.identity.getAccount(token),
    ]);
    // People living abroad see missions first; everyone else sees them last.
    const abroad = account.residency === 'ABROAD';
    const rank = (point: ServicePoint) => Number((point.kind === 'MISSION_ABROAD') !== abroad);
    return [...all].sort((a, b) => rank(a) - rank(b));
  });

  const [selected, setSelected] = useState(item.servicePointId ?? '');
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLFieldSetElement>(null);
  // One key per choice: kept for a retry, replaced when the choice changes.
  const intentKey = useRef<string | null>(null);

  const choose = useGatewayMutation(async (g, input: { point: ServicePoint; key: string }) => {
    const options = { idempotencyKey: input.key };
    await g.workflow.selectServicePoint(item.caseId, input.point.id, options);
    const kept = booked?.servicePointId === input.point.id ? booked : null;
    // The workflow mock drops the old booking from the case but does not release it, so the screen does.
    if (booked && !kept) await g.appointments.cancel(booked.appointmentId, options);
    return kept;
  });

  const submit = (event: FormEvent, all: ServicePoint[]) => {
    event.preventDefault();
    const point = all.find((candidate) => candidate.id === selected);
    if (!point) {
      setError('Choose a service point to continue.');
      list.current?.querySelector('input')?.focus();
      return;
    }
    intentKey.current ??= newIdempotencyKey('select-service-point');
    choose.mutate(
      { point, key: intentKey.current },
      {
        onSuccess: (kept) => {
          intentKey.current = null;
          announce(`Service point chosen: ${point.name}. Now choose a time.`);
          onChosen(point, kept);
        },
      },
    );
  };

  return (
    <div className={styles.step}>
      <h2 ref={heading} tabIndex={-1} className={styles.focusTarget}>
        Where would you like to go?
      </h2>
      <p>
        These service points list “{item.serviceTitle}”. Choose the one that suits you; you pick a
        time next.
      </p>

      {booked ? (
        <Notice tone="attention" title="You already have an appointment">
          <p>
            It is at {booked.servicePointName}. If you choose a different service point, that
            appointment is cancelled and you choose a new time.
          </p>
          <p>
            <Button variant="secondary" size="sm" onClick={() => onKeep(booked)}>
              Keep my appointment
            </Button>
          </p>
        </Notice>
      ) : null}

      <QueryBoundary
        query={points}
        loadingLabel="Loading service points"
        isEmpty={(all) => all.length === 0}
        empty={
          <UnavailableState
            title="No service point offers this yet"
            reason={`None of the sample service points lists “${item.serviceTitle}”.`}
            whatNext="Your application is saved and stays open. Ask us to help you find another way to complete the in-person step."
            alternatives={[
              'Search all service points to see what each one offers.',
              'Request a call-back and an adviser will help you.',
            ]}
            actions={
              <>
                <LinkButton href={`/help/callback/?case=${encodeURIComponent(item.caseId)}`}>
                  Request a call-back
                </LinkButton>
                <LinkButton href="/service-points/" variant="secondary">
                  Search service points
                </LinkButton>
                <LinkButton href={caseHref(item.caseId)} variant="quiet">
                  Back to my application
                </LinkButton>
              </>
            }
          />
        }
      >
        {(all) => (
          <form className={styles.form} onSubmit={(event) => submit(event, all)} noValidate>
            <fieldset className={styles.points} ref={list}>
              <legend>Service points for this application</legend>
              <ul className={styles.pointList}>
                {all.map((point) => {
                  const availability = AVAILABILITY[point.availability];
                  return (
                    <li key={point.id} className={styles.point}>
                      <label className={styles.pointLabel}>
                        <input
                          type="radio"
                          name="service-point"
                          value={point.id}
                          checked={selected === point.id}
                          aria-describedby={`${point.id}-about`}
                          onChange={() => {
                            setSelected(point.id);
                            setError(null);
                            intentKey.current = null;
                          }}
                        />
                        <span className={styles.pointName}>{point.name}</span>
                      </label>
                      <div className={styles.pointExtra}>
                        <p id={`${point.id}-about`} className={styles.pointMeta}>
                          {KIND_WORDS[point.kind]} · {point.area}, {point.region}
                          {point.kind === 'MISSION_ABROAD' ? `, ${point.country}` : ''}
                        </p>
                        <p className={styles.pointStatus}>
                          <Tag tone={availability.tone} icon={availability.icon}>
                            {availability.label}
                          </Tag>
                          <span>{point.availabilityNote}</span>
                        </p>
                        {point.accessibility.length > 0 ? (
                          <ul className={styles.features} aria-label={`Access at ${point.name}`}>
                            {point.accessibility.map((feature) => (
                              <li key={feature}>
                                <Tag tone="teal">{FEATURE_WORDS[feature]}</Tag>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {point.timeZone === SAST ? null : (
                          <p>
                            Times here are shown in local time at the service point, with South
                            African time alongside.
                          </p>
                        )}
                        <AppLink href={servicePointHref(point.id)}>
                          Details<span className="visually-hidden"> of {point.name}</span>
                        </AppLink>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </fieldset>

            <SampleNotice>
              These locations are synthetic samples. Names, opening status and facilities are
              placeholders.
            </SampleNotice>

            {error ? <FieldError>{error}</FieldError> : null}
            {choose.error ? (
              <Notice tone="danger" role="alert" title="We could not save your choice">
                <p>{choose.error.safeMessage}</p>
                <p>Reference for support: {choose.error.traceRef}</p>
              </Notice>
            ) : null}

            <div className={styles.actions}>
              <Button
                type="submit"
                loading={choose.isPending}
                iconEnd={<ArrowRight aria-hidden="true" />}
              >
                Continue to choose a time
              </Button>
              <LinkButton href={caseHref(item.caseId)} variant="quiet">
                Back to my application
              </LinkButton>
            </div>
          </form>
        )}
      </QueryBoundary>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2: choose a time                                               */
/* ------------------------------------------------------------------ */

function groupByDay(slots: AppointmentSlot[], timeZone: string) {
  const days: Array<{ day: string; slots: AppointmentSlot[] }> = [];
  for (const slot of slots) {
    const day = formatAppointmentDay(slot.startsAt, timeZone);
    const last = days[days.length - 1];
    if (last?.day === day) last.slots.push(slot);
    else days.push({ day, slots: [slot] });
  }
  return days;
}

function TimeStep({
  item,
  token,
  pointId,
  booked,
  cancelled,
  heading,
  onConfirmed,
  onChangePoint,
  onKeep,
}: {
  item: ApplicationCase;
  token: string;
  pointId: string;
  /** A booking at this service point to move to a new time, if there is one. */
  booked: Appointment | null;
  /** True straight after a cancellation. */
  cancelled: boolean;
  heading: HeadingRef;
  onConfirmed: (appointment: Appointment) => void;
  onChangePoint: () => void;
  onKeep: (appointment: Appointment) => void;
}) {
  const calendar = useGatewayQuery(['slots', pointId], async (g) => {
    const [point, slots] = await Promise.all([
      g.appointments.getServicePoint(pointId),
      g.appointments.listSlots(pointId),
    ]);
    return { point, slots };
  });

  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const days = useRef<HTMLDivElement>(null);
  // One key per chosen time: kept for a retry, replaced when the choice changes.
  const intentKey = useRef<string | null>(null);

  const confirm = useGatewayMutation(async (g, input: { slotId: string; key: string }) => {
    const options = { idempotencyKey: input.key };
    const appointment = booked
      ? await g.appointments.reschedule(booked.appointmentId, input.slotId, options)
      : await g.appointments.book(
          {
            personToken: token,
            servicePointId: pointId,
            slotId: input.slotId,
            purpose: `${item.serviceTitle} — in-person step (sample)`,
            caseId: item.caseId,
          },
          options,
        );
    // Linking again after a change makes the workflow record "appointment changed".
    await g.workflow.linkAppointment(item.caseId, appointment.appointmentId, options);
    return appointment;
  });

  const pick = (slotId: string) => {
    setSelected(slotId);
    setError(null);
    intentKey.current = null;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (selected === '') {
      setError('Choose a time to continue.');
      days.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
      return;
    }
    intentKey.current ??= newIdempotencyKey('book-appointment');
    confirm.mutate(
      { slotId: selected, key: intentKey.current },
      {
        onSuccess: (appointment) => {
          intentKey.current = null;
          const time =
            appointment.timeZone === SAST
              ? formatTime(appointment.startsAt)
              : formatTimeInZone(appointment.startsAt, appointment.timeZone);
          announce(
            `Appointment confirmed for ${formatAppointmentDay(appointment.startsAt, appointment.timeZone)} at ${time}.`,
          );
          onConfirmed(appointment);
        },
        onError: (failure) => {
          if (failure.category !== 'CONFLICT') return;
          // Someone else has that time now: show the message and bring in the current slots.
          setSelected('');
          intentKey.current = null;
          void calendar.refetch();
        },
      },
    );
  };

  return (
    <div className={styles.step}>
      {/* Outside the boundary, so focus has somewhere to land while the times load. */}
      <h2 ref={heading} tabIndex={-1} className={styles.focusTarget}>
        {booked ? 'Choose a new time' : 'Choose a time'}
      </h2>

      {cancelled ? (
        <Notice tone="success" role="status" title="Appointment cancelled">
          <p>Book a new time when you are ready.</p>
        </Notice>
      ) : null}

      <QueryBoundary query={calendar} loadingLabel="Loading available times">
        {({ point, slots }) => {
          const abroad = point.timeZone !== SAST;
          const anyFree = slots.some((slot) => slot.available);
          return (
            <>
              <p>
                At <strong>{point.name}</strong>.{' '}
                <AppLink href={servicePointHref(point.id)}>Service point details</AppLink>
              </p>
              {booked ? (
                <p>
                  Your current time stays booked until you confirm a new one. It is marked “Your
                  current time” below.
                </p>
              ) : null}
              {abroad ? (
                <Notice tone="info" title="This service point is in another time zone">
                  <p>
                    Each time is shown in local time at the service point, with South African time
                    alongside.
                  </p>
                </Notice>
              ) : null}

              <form className={styles.form} onSubmit={submit} noValidate>
                <div className={styles.days} ref={days}>
                  {groupByDay(slots, point.timeZone).map((group) => (
                    <fieldset key={group.day} className={styles.day}>
                      <legend>{group.day}</legend>
                      <div className={cx(styles.slots, abroad && styles.slotsWide)}>
                        {group.slots.map((slot) => {
                          const mine = booked?.startsAt === slot.startsAt;
                          return (
                            <label key={slot.slotId} className={styles.slot}>
                              <input
                                type="radio"
                                name="slot"
                                value={slot.slotId}
                                checked={selected === slot.slotId}
                                disabled={!slot.available}
                                onChange={() => pick(slot.slotId)}
                              />
                              <span className={styles.slotText}>
                                <span className={styles.slotTime}>
                                  {abroad
                                    ? formatTimeInZone(slot.startsAt, point.timeZone)
                                    : formatTime(slot.startsAt)}
                                </span>
                                {abroad ? (
                                  <span className={styles.slotNote}>
                                    {formatTime(slot.startsAt)} South African time
                                  </span>
                                ) : null}
                                {slot.available ? null : (
                                  <span className={styles.slotNote}>
                                    {mine ? 'Your current time' : 'Taken'}
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                </div>

                <SampleNotice>
                  These times are synthetic samples. Nothing is booked at a real service point.
                </SampleNotice>

                {anyFree ? null : (
                  <Notice tone="attention" title="No times are free here right now">
                    <p>Choose a different service point, or come back later.</p>
                  </Notice>
                )}
                {error ? <FieldError>{error}</FieldError> : null}
                {confirm.error ? (
                  <Notice
                    tone={confirm.error.category === 'CONFLICT' ? 'attention' : 'danger'}
                    role="alert"
                    title={
                      confirm.error.category === 'CONFLICT'
                        ? 'That time is not available'
                        : 'We could not book that time'
                    }
                  >
                    <p>{confirm.error.safeMessage}</p>
                    {confirm.error.category === 'CONFLICT' ? (
                      <p>The times above have been refreshed.</p>
                    ) : (
                      <p>Reference for support: {confirm.error.traceRef}</p>
                    )}
                  </Notice>
                ) : null}

                <div className={styles.actions}>
                  <Button type="submit" loading={confirm.isPending}>
                    {booked ? 'Confirm new time' : 'Confirm appointment'}
                  </Button>
                  {booked ? (
                    <Button variant="secondary" onClick={() => onKeep(booked)}>
                      Keep my current time
                    </Button>
                  ) : null}
                  <Button variant="quiet" onClick={onChangePoint}>
                    Choose a different service point
                  </Button>
                </div>
              </form>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3: confirmed                                                   */
/* ------------------------------------------------------------------ */

function ConfirmedStep({
  item,
  appointment,
  fresh,
  heading,
  onChangeTime,
  onChangePoint,
  onCancelled,
}: {
  item: ApplicationCase;
  appointment: Appointment;
  /** True straight after booking; false when the page opens on an existing booking. */
  fresh: boolean;
  heading: HeadingRef;
  onChangeTime: () => void;
  onChangePoint: () => void;
  onCancelled: () => void;
}) {
  const [managing, setManaging] = useState(!fresh);

  return (
    <div className={styles.step}>
      <Card tone="success" padding="flush">
        <Photo
          asset="A49"
          ratio="5 / 2"
          shape="square"
          sizes="(min-width: 48rem) 44rem, 100vw"
          decorative
        />
        <div className={styles.confirmedBody}>
          <h2 ref={heading} tabIndex={-1} className={styles.focusTarget}>
            {fresh ? 'Appointment confirmed' : 'Your appointment is booked'}
          </h2>
          <AppointmentWhen startsAt={appointment.startsAt} timeZone={appointment.timeZone} />
          <p className={styles.place}>
            <strong>{appointment.servicePointName}</strong>
            <AppLink href={servicePointHref(appointment.servicePointId)}>
              Service point details
            </AppLink>
          </p>
          <p className={styles.quiet}>{appointment.purpose}</p>
        </div>
      </Card>

      <Section id="bring" title="What to bring">
        <ul className={styles.bring}>
          <li>Placeholder: the identity document this service asks for.</li>
          <li>Placeholder: any supporting documents listed on the service page.</li>
          <li>Placeholder: the reference for this application.</li>
        </ul>
        <SampleNotice />
      </Section>

      <Section id="reminders" title="Reminders">
        <p>
          We will remind you on the channels you have switched on.{' '}
          <AppLink href="/messages/preferences/">Choose how we contact you</AppLink>
        </p>
      </Section>

      <div className={styles.manage}>
        <div className={styles.actions}>
          <LinkButton href={caseHref(item.caseId)}>Back to my application</LinkButton>
          {fresh ? (
            <Button
              variant="secondary"
              aria-expanded={managing}
              onClick={() => setManaging((value) => !value)}
            >
              Change or cancel
            </Button>
          ) : null}
        </div>
        {managing ? (
          <div className={styles.actions}>
            <Button variant="secondary" onClick={onChangeTime}>
              Change time
            </Button>
            <Button variant="secondary" onClick={onChangePoint}>
              Choose a different service point
            </Button>
            <CancelAppointment
              appointment={appointment}
              consequence="Your application stays open. You will need to book a new time to continue."
              onCancelled={onCancelled}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
