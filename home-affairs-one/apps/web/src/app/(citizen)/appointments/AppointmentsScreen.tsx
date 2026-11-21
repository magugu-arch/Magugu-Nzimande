'use client';

import type { Appointment } from '@hao/api-contracts';
import { AppLink, Container, EmptyState, LinkButton, Section, Stack } from '@hao/design-system';
import { CalendarDays } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { useGatewayQuery } from '@/lib/queries';
import { usePersonToken } from '@/lib/session';
import {
  AppointmentStatusTag,
  AppointmentWhen,
  bookingHref,
  caseHref,
  isCaptureDone,
  isUpcoming,
  PhotoHeader,
  servicePointHref,
} from '../applications/case-helpers';
import styles from './appointments.module.css';
import { BookingFlow } from './BookingFlow';
import { CancelAppointment } from './CancelAppointment';

export function AppointmentsScreen() {
  const caseId = useSearchParams().get('case');
  const token = usePersonToken() ?? '';
  // A different case starts the guided flow afresh.
  if (caseId) return <BookingFlow key={caseId} caseId={caseId} token={token} />;
  return <MyAppointments token={token} />;
}

function AppointmentItem({
  appointment,
  upcoming,
  visited,
}: {
  appointment: Appointment;
  upcoming: boolean;
  visited: boolean;
}) {
  return (
    <li className={styles.appointment}>
      <div className={styles.appointmentMain}>
        <h3>{appointment.purpose}</h3>
        <AppointmentWhen startsAt={appointment.startsAt} timeZone={appointment.timeZone} />
        <p>
          {appointment.servicePointName} ·{' '}
          <AppLink href={servicePointHref(appointment.servicePointId)}>
            Details<span className="visually-hidden"> of {appointment.servicePointName}</span>
          </AppLink>
        </p>
        <AppointmentStatusTag appointment={appointment} visited={visited} />
      </div>
      <div className={styles.appointmentActions}>
        {upcoming && appointment.caseId ? (
          <LinkButton href={bookingHref(appointment.caseId)} variant="secondary" size="sm">
            Change or cancel
          </LinkButton>
        ) : null}
        {upcoming && !appointment.caseId ? (
          <CancelAppointment
            appointment={appointment}
            consequence="This appointment is not linked to a submitted application. You can book again from the application when you are ready."
          />
        ) : null}
        {appointment.caseId ? (
          <AppLink href={caseHref(appointment.caseId)}>
            View application<span className="visually-hidden"> for {appointment.purpose}</span>
          </AppLink>
        ) : null}
      </div>
    </li>
  );
}

function MyAppointments({ token }: { token: string }) {
  const appointments = useGatewayQuery(
    ['appointments', token],
    (g) => g.appointments.listAppointments(token),
    { enabled: token !== '' },
  );
  // The appointments mock never marks a booking as attended, so the case says whether the visit happened.
  const cases = useGatewayQuery(['cases', token], (g) => g.workflow.listCases(token), {
    enabled: token !== '',
  });
  const visitedCases = new Set((cases.data ?? []).filter(isCaptureDone).map((item) => item.caseId));
  const wasVisited = (appointment: Appointment) =>
    appointment.caseId !== null && visitedCases.has(appointment.caseId);

  return (
    <Container>
      <PhotoHeader
        title="My appointments"
        lede="Times you have booked at a service point, and what happened to earlier ones."
        photo={<Photo asset="A42" ratio="4 / 5" shape="soft" sizes="11rem" />}
      />

      <QueryBoundary
        query={appointments}
        loadingLabel="Loading your appointments"
        isEmpty={(items) => items.length === 0}
        empty={
          <EmptyState
            title="No appointments yet"
            icon={<CalendarDays />}
            actions={<LinkButton href="/applications/">Go to my applications</LinkButton>}
          >
            <p>
              When an application needs an in-person step, you choose a service point and book a
              time from that application.
            </p>
          </EmptyState>
        }
      >
        {(items) => {
          const upcoming = items.filter((item) => isUpcoming(item) && !wasVisited(item));
          // Most recent first.
          const earlier = items.filter((item) => !upcoming.includes(item)).reverse();
          return (
            <Stack gap={6}>
              <Section id="upcoming" title="Upcoming">
                {upcoming.length > 0 ? (
                  <ul className={styles.list} aria-label="Upcoming appointments">
                    {upcoming.map((item) => (
                      <AppointmentItem
                        key={item.appointmentId}
                        appointment={item}
                        upcoming
                        visited={false}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className={styles.quiet}>
                    Nothing booked right now. If an application needs an appointment, it says so on{' '}
                    <AppLink href="/applications/">My applications</AppLink>.
                  </p>
                )}
              </Section>

              {earlier.length > 0 ? (
                <Section id="earlier" title="Past and cancelled">
                  <ul className={styles.list} aria-label="Past and cancelled appointments">
                    {earlier.map((item) => (
                      <AppointmentItem
                        key={item.appointmentId}
                        appointment={item}
                        upcoming={false}
                        visited={wasVisited(item)}
                      />
                    ))}
                  </ul>
                </Section>
              ) : null}
            </Stack>
          );
        }}
      </QueryBoundary>
    </Container>
  );
}
