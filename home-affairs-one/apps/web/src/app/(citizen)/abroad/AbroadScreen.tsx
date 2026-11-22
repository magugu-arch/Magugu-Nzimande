'use client';

import type { Appointment, ServicePoint } from '@hao/api-contracts';
import {
  AppLink,
  Card,
  Cluster,
  Container,
  EmptyState,
  FutureNotice,
  Grid,
  LinkButton,
  Notice,
  PageHeader,
  SampleNotice,
  Section,
  Stack,
  Tag,
  stretchedLinkClass,
} from '@hao/design-system';
import { maskReference, meetsTier } from '@hao/shared-types';
import { ArrowRight, CalendarClock, Globe } from 'lucide-react';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { findService, serviceHref } from '@/lib/catalogue';
import { formatTimeInZone } from '@/lib/format';
import { useHydrated } from '@/lib/hydration';
import { useGatewayQuery } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useNowIso } from '../service-points/use-now';
import {
  AvailabilityTag,
  SAST,
  formatDayInZone,
  pointHref,
  zoneLabel,
} from '../service-points/words';
import styles from './abroad.module.css';

function caseHref(caseId: string): string {
  return `/applications/case/?id=${encodeURIComponent(caseId)}`;
}

function MissionCard({ mission, nowIso }: { mission: ServicePoint; nowIso: string | null }) {
  return (
    <Card as="article" interactive className={styles.mission}>
      <h3 className={styles.missionName}>
        <AppLink href={pointHref(mission.id)} className={stretchedLinkClass}>
          {mission.name}
        </AppLink>
      </h3>
      <Cluster gap={2}>
        <Tag tone="teal">Sample mission</Tag>
        <AvailabilityTag availability={mission.availability} />
      </Cluster>
      <p className={styles.missionPlace}>{mission.country}</p>
      <p className={styles.small}>{mission.availabilityNote}</p>

      <div>
        <p className={styles.label}>Services offered there (sample)</p>
        <ul className={styles.services}>
          {mission.services.map((code) => (
            <li key={code}>{findService(code)?.title ?? code}</li>
          ))}
        </ul>
      </div>

      <dl className={styles.times}>
        <div>
          <dt>Local time there</dt>
          <dd>{nowIso ? formatTimeInZone(nowIso, mission.timeZone) : 'Checking…'}</dd>
        </div>
        <div>
          <dt>Time in South Africa</dt>
          <dd>{nowIso ? formatTimeInZone(nowIso, SAST) : 'Checking…'}</dd>
        </div>
      </dl>
    </Card>
  );
}

/** What a time-zone-aware appointment shows, described in words — no invented booking. */
function HowTimesAreShown({ signedIn }: { signedIn: boolean }) {
  return (
    <Notice tone="neutral" title="How an appointment at a mission is shown">
      <ul className={styles.plainList}>
        <li>The day and time at the mission, with its time zone.</li>
        <li>The same moment in South African time.</li>
        <li>The same moment where you are now, if your device is in a different time zone.</li>
      </ul>
      {signedIn ? null : (
        <p>
          <AppLink href={`/sign-in/?next=${encodeURIComponent('/abroad/')}`}>Sign in</AppLink> with
          a verified account to see your own appointments here.
        </p>
      )}
    </Notice>
  );
}

function MissionAppointment({
  appointment,
  deviceZone,
}: {
  appointment: Appointment;
  deviceZone: string | null;
}) {
  const { startsAt, timeZone } = appointment;
  const showDevice = deviceZone !== null && deviceZone !== timeZone && deviceZone !== SAST;
  return (
    <Card as="article" tone="info" className={styles.appointment}>
      <h3 className={styles.appointmentTitle}>
        <CalendarClock aria-hidden="true" />
        {appointment.servicePointName}
      </h3>
      <p className={styles.small}>{appointment.purpose}</p>
      <dl className={styles.times}>
        <div>
          <dt>At the mission</dt>
          <dd>
            {formatDayInZone(startsAt, timeZone)}, {formatTimeInZone(startsAt, timeZone)}
          </dd>
        </div>
        <div>
          <dt>In South Africa</dt>
          <dd>
            {formatDayInZone(startsAt, SAST)}, {formatTimeInZone(startsAt, SAST)}
          </dd>
        </div>
        {showDevice && deviceZone ? (
          <div>
            <dt>Where you are now ({zoneLabel(deviceZone)})</dt>
            <dd>
              {formatDayInZone(startsAt, deviceZone)}, {formatTimeInZone(startsAt, deviceZone)}
            </dd>
          </div>
        ) : null}
      </dl>
      {appointment.caseId ? (
        <p>
          <AppLink href={caseHref(appointment.caseId)}>
            See the application, reference {maskReference(appointment.caseId)}
          </AppLink>
        </p>
      ) : null}
    </Card>
  );
}

export function AbroadScreen() {
  const { session } = useSession();
  const signedIn = session?.role === 'citizen';
  const token = signedIn ? session.subjectRef : null;
  const verified = signedIn && meetsTier(session.tier, 'A2');

  const nowIso = useNowIso();
  // The device's own time zone only exists in the browser.
  const hydrated = useHydrated();
  const deviceZone = hydrated ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;

  const missions = useGatewayQuery(['points', { abroad: true }], (g) =>
    g.appointments.listServicePoints({ abroad: true }),
  );
  const appointments = useGatewayQuery(
    ['appointments', token],
    (g) => g.appointments.listAppointments(token ?? ''),
    { enabled: Boolean(token) && verified },
  );

  return (
    <Container>
      <div className={styles.hero}>
        <PageHeader
          eyebrow="South Africans abroad"
          title="One service across time zones"
          lede="The same account, the same timeline and the same secure inbox, wherever you live — with times shown where you are and where your mission is."
        >
          <FutureNotice>
            Overseas services are a later phase. Digital applications will only be offered where
            regulations, identity capture and delivery allow.
          </FutureNotice>
        </PageHeader>
        <Photo asset="A52" ratio="16 / 9" sizes="(min-width: 60rem) 34rem, 100vw" priority />
      </div>

      <Stack gap={8}>
        <Section
          title="Missions"
          id="missions"
          intro="Choose a mission to see what it offers and when it is open. These are sample missions, not real embassies or consulates."
        >
          <div className={styles.missions}>
            <QueryBoundary
              query={missions}
              loadingLabel="Loading sample missions"
              loadingRows={2}
              headingLevel={3}
              isEmpty={(items) => items.length === 0}
              empty={
                <EmptyState
                  title="No sample missions to show"
                  headingLevel={3}
                  icon={<Globe />}
                  actions={<LinkButton href="/help/">Get help</LinkButton>}
                >
                  <p>Missions will be listed here once the department supplies them.</p>
                </EmptyState>
              }
            >
              {(items) => (
                <Grid gap={4} min="16rem">
                  {items.map((mission) => (
                    <MissionCard key={mission.id} mission={mission} nowIso={nowIso} />
                  ))}
                </Grid>
              )}
            </QueryBoundary>
            <figure className={styles.figure}>
              <Photo asset="A26" ratio="4 / 3" sizes="(min-width: 60rem) 24rem, 100vw" />
              <figcaption>Illustrative image. It does not show a real mission.</figcaption>
            </figure>
          </div>
        </Section>

        <Section
          title="Time-zone-aware appointments"
          id="appointments"
          intro="An appointment abroad is always shown in the mission’s local time and in yours, so a morning slot there never turns into a surprise at home."
        >
          {token && verified ? (
            <QueryBoundary
              query={appointments}
              loadingLabel="Loading your appointments"
              loadingRows={1}
              headingLevel={3}
            >
              {(items) => {
                const abroad = items.filter(
                  (item) => item.status === 'BOOKED' && item.timeZone !== SAST,
                );
                if (abroad.length === 0) {
                  return (
                    <Stack gap={3}>
                      <p>You have no appointments booked at a mission abroad.</p>
                      <HowTimesAreShown signedIn />
                    </Stack>
                  );
                }
                return (
                  <Stack gap={3}>
                    {abroad.map((item) => (
                      <MissionAppointment
                        key={item.appointmentId}
                        appointment={item}
                        deviceZone={deviceZone}
                      />
                    ))}
                    <p className={styles.small}>
                      Sample appointment. In this prototype the slot times are simulated.
                    </p>
                  </Stack>
                );
              }}
            </QueryBoundary>
          ) : (
            <HowTimesAreShown signedIn={Boolean(token)} />
          )}
        </Section>

        <div className={styles.editorials}>
          <section className={styles.editorial} aria-labelledby="collecting-heading">
            <Photo asset="A17" ratio="4 / 3" sizes="(min-width: 60rem) 32rem, 100vw" />
            <div className={styles.editorialText}>
              <h2 id="collecting-heading">Collecting your document</h2>
              <p>
                Your identity is checked again at the handover, wherever that happens, so a finished
                document only ever reaches the right person.
              </p>
              <p>
                Whether you collect in person or a courier brings it depends on the mission. The
                options shown in this prototype are samples.
              </p>
              <div>
                <LinkButton
                  href={serviceHref('PASSPORT_COLLECTION')}
                  variant="quiet"
                  iconEnd={<ArrowRight aria-hidden="true" />}
                >
                  How collection works (sample)
                </LinkButton>
              </div>
            </div>
          </section>

          <section
            className={`${styles.editorial} ${styles.editorialFlip}`}
            aria-labelledby="travel-heading"
          >
            <Photo asset="A15" ratio="4 / 3" sizes="(min-width: 60rem) 32rem, 100vw" />
            <div className={styles.editorialText}>
              <h2 id="travel-heading">Travel-ready</h2>
              <p>
                Keep your documents somewhere secure, and never send a photograph of one over chat
                or email.
              </p>
              <p>Check the travel guidance before you fly — requirements can change.</p>
              <div>
                <LinkButton
                  href={serviceHref('TRAVEL_ALERTS')}
                  variant="quiet"
                  iconEnd={<ArrowRight aria-hidden="true" />}
                >
                  Travel and border updates
                </LinkButton>
              </div>
            </div>
          </section>
        </div>

        <Stack gap={4}>
          <SampleNotice />
          <Cluster gap={3}>
            <LinkButton href="/services/">Browse services</LinkButton>
            <LinkButton href="/help/" variant="secondary">
              Get help
            </LinkButton>
          </Cluster>
        </Stack>
      </Stack>
    </Container>
  );
}
