'use client';

import type { ApplicationCase, ApplicationDraft } from '@hao/api-contracts';
import {
  AppLink,
  Card,
  Container,
  EmptyState,
  Grid,
  LinkButton,
  Notice,
  Section,
  Tag,
} from '@hao/design-system';
import { ASSURANCE_TIER_INFO, maskReference, meetsTier } from '@hao/shared-types';
import {
  ArrowRight,
  Baby,
  BookUser,
  CalendarCheck,
  FileText,
  IdCard,
  LifeBuoy,
  MapPinned,
  Plane,
  ShieldCheck,
} from 'lucide-react';
import { IconTile, Row, Rows } from '@/components/cards';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { StatusTag } from '@/components/StatusTag';
import { findService, serviceHref } from '@/lib/catalogue';
import { formatRelative, greetingFor } from '@/lib/format';
import { useHydrated } from '@/lib/hydration';
import { useFlags } from '@/lib/prefs';
import { useGatewayQuery } from '@/lib/queries';
import { useSession } from '@/lib/session';
import styles from './home.module.css';

const ACTION_LABEL: Record<NonNullable<ApplicationCase['nextAction']>['type'], string> = {
  SELECT_SERVICE_POINT: 'Choose a service point',
  BOOK_APPOINTMENT: 'Book an appointment',
  PROVIDE_INFORMATION: 'Send the information',
  ATTEND_APPOINTMENT: 'See appointment details',
  COLLECT: 'See collection details',
};

function caseHref(caseId: string) {
  return `/applications/case/?id=${encodeURIComponent(caseId)}`;
}

/** The single most useful thing to do next. One dominant action per screen. */
function PrimaryAction({
  cases,
  drafts,
}: {
  cases: ApplicationCase[];
  drafts: ApplicationDraft[];
}) {
  const needsAction = cases.find((item) => item.status === 'ACTION_REQUIRED' && item.nextAction);
  if (needsAction?.nextAction) {
    return (
      <Card tone="attention" className={styles.action}>
        <div className={styles.actionMeta}>
          <StatusTag status={needsAction.status} />
          <span>Updated {formatRelative(needsAction.statusUpdatedAt)}</span>
        </div>
        <h2>{needsAction.serviceTitle}</h2>
        <p>{needsAction.nextAction.description}.</p>
        <p className={styles.actionMeta}>Reference {maskReference(needsAction.caseId)}</p>
        <div className={styles.actionFoot}>
          <LinkButton
            href={caseHref(needsAction.caseId)}
            iconEnd={<ArrowRight aria-hidden="true" />}
          >
            {ACTION_LABEL[needsAction.nextAction.type]}
          </LinkButton>
        </div>
      </Card>
    );
  }

  const scheduled = cases.find((item) => item.status === 'SCHEDULED');
  if (scheduled) {
    return (
      <Card tone="info" className={styles.action}>
        <div className={styles.actionMeta}>
          <StatusTag status={scheduled.status} />
          <span>Updated {formatRelative(scheduled.statusUpdatedAt)}</span>
        </div>
        <h2>{scheduled.serviceTitle}</h2>
        <p>Your appointment is booked. Check the time, place and what to bring.</p>
        <div className={styles.actionFoot}>
          <LinkButton
            href={caseHref(scheduled.caseId)}
            iconEnd={<CalendarCheck aria-hidden="true" />}
          >
            See appointment details
          </LinkButton>
        </div>
      </Card>
    );
  }

  const draft = drafts[0];
  if (draft) {
    const service = findService(draft.serviceCode);
    return (
      <Card className={styles.action}>
        <div className={styles.actionMeta}>
          <Tag>Not submitted</Tag>
          <span>Saved {formatRelative(draft.updatedAt)}</span>
        </div>
        <h2>Continue: {service?.title ?? 'your application'}</h2>
        <p>Your answers are saved on this device. Pick up where you left off.</p>
        <div className={styles.actionFoot}>
          <LinkButton
            href={`/apply/?service=${draft.serviceCode}&draft=${draft.draftId}`}
            iconEnd={<ArrowRight aria-hidden="true" />}
          >
            Continue application
          </LinkButton>
        </div>
      </Card>
    );
  }

  return (
    <Card className={styles.action}>
      <h2>What do you need to do today?</h2>
      <p>Find a service, see what it involves and start when you are ready.</p>
      <div className={styles.actionFoot}>
        <LinkButton href="/services/" iconEnd={<ArrowRight aria-hidden="true" />}>
          Find a service
        </LinkButton>
      </div>
    </Card>
  );
}

export function HomeScreen() {
  const { session } = useSession();
  const { flags } = useFlags();
  const token = session?.subjectRef ?? '';
  const verified = session ? meetsTier(session.tier, 'A2') : false;

  // The time-of-day greeting needs the person's clock, so it appears once the page is live.
  const greeting = useHydrated() ? greetingFor() : 'Welcome';

  const cases = useGatewayQuery(['cases', token], (g) => g.workflow.listCases(token), {
    enabled: Boolean(token) && verified,
  });
  const drafts = useGatewayQuery(['drafts', token], (g) => g.workflow.listDrafts(token), {
    enabled: Boolean(token),
  });
  const alerts = useGatewayQuery(['alerts'], (g) => g.notifications.listAlerts());

  if (!session) return null;
  const tier = ASSURANCE_TIER_INFO[session.tier];
  const completed = cases.data?.find(
    (item) => item.status === 'CLOSED' && item.statusDetail === 'Completed',
  );

  return (
    <Container>
      <header className={styles.greeting}>
        <h1>
          {greeting}, {session.givenName}
        </h1>
        <p>Your services. One secure place.</p>
      </header>

      <div className={styles.top}>
        {verified ? (
          <QueryBoundary query={cases} loadingLabel="Loading your next step" loadingRows={1}>
            {(items) => <PrimaryAction cases={items} drafts={drafts.data ?? []} />}
          </QueryBoundary>
        ) : (
          <Card tone="attention" className={styles.action}>
            <h2>Verify your account to see your applications</h2>
            <p>
              You are signed in with basic access. You can browse services and save drafts. To track
              applications or book appointments, sign in with a passkey on a verified account.
            </p>
            <div className={styles.actionFoot}>
              <LinkButton href="/profile/security/" variant="secondary">
                How verification works
              </LinkButton>
            </div>
          </Card>
        )}

        <Card tone="brand" className={styles.identity}>
          <p className={styles.identityLabel}>Your digital identity</p>
          <h2>Identity status: {verified ? 'Verified' : 'Basic account'}</h2>
          <p>
            {tier.label} ({session.tier}). {tier.summary}
          </p>
          {flags.wallet ? <p>Wallet availability is subject to legal approval.</p> : null}
          <AppLink href="/profile/security/">
            <ShieldCheck aria-hidden="true" size={18} />
            Sign-in and security
          </AppLink>
        </Card>
      </div>

      <div className={styles.sections}>
        <Section
          title="Quick services"
          action={{ href: '/services/', label: 'All services' }}
          id="quick"
        >
          <Grid gap={3} min="10.5rem">
            <IconTile
              href={serviceHref('SMART_ID_REPLACEMENT')}
              icon={<IdCard />}
              title="Smart ID"
              hint="Apply or replace"
            />
            <IconTile
              href={serviceHref('ADULT_PASSPORT')}
              icon={<BookUser />}
              title="Passport"
              hint="Apply or renew"
            />
            <IconTile
              href={serviceHref('BIRTH_REGISTRATION')}
              icon={<Baby />}
              title="Birth and family"
              hint="Register or request a certificate"
            />
            <IconTile
              href={serviceHref('ETA')}
              icon={<Plane />}
              title="Visas and ETA"
              hint="Travel to South Africa"
            />
            <IconTile
              href="/service-points/"
              icon={<MapPinned />}
              title="Service points"
              hint="Offices, banks and mobile units"
            />
            <IconTile
              href="/help/"
              icon={<LifeBuoy />}
              title="Get help"
              hint="Message, call-back or WhatsApp"
            />
          </Grid>
        </Section>

        <div className={styles.columns}>
          <Section
            title="Your applications"
            action={verified ? { href: '/applications/', label: 'See all' } : undefined}
            id="applications"
          >
            {verified ? (
              <QueryBoundary
                query={cases}
                loadingLabel="Loading your applications"
                isEmpty={(items) => items.length === 0}
                headingLevel={3}
                empty={
                  <EmptyState
                    title="No applications yet"
                    headingLevel={3}
                    icon={<FileText />}
                    actions={<LinkButton href="/services/">Find a service</LinkButton>}
                  >
                    <p>When you apply for something, you can follow every step here.</p>
                  </EmptyState>
                }
              >
                {(items) => (
                  <Rows label="Your applications">
                    {items.slice(0, 4).map((item) => (
                      <Row
                        key={item.caseId}
                        href={caseHref(item.caseId)}
                        title={item.serviceTitle}
                        lead={<FileText />}
                        meta={
                          <>
                            <StatusTag status={item.status} detail={item.statusDetail} />
                            <span>Updated {formatRelative(item.statusUpdatedAt)}</span>
                          </>
                        }
                        text={item.nextAction ? `Next: ${item.nextAction.description}` : undefined}
                      />
                    ))}
                  </Rows>
                )}
              </QueryBoundary>
            ) : (
              <Notice tone="info">
                <p>Applications appear here once your account is verified.</p>
              </Notice>
            )}

            {completed ? (
              <Card tone="success" padding="compact">
                <div className={styles.completed}>
                  <Photo asset="A53" ratio="1 / 1" parallax={false} sizes="6rem" decorative />
                  <div>
                    <p style={{ fontWeight: 700 }}>Completed: {completed.serviceTitle}</p>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-700)' }}>
                      The record of this application stays in{' '}
                      <AppLink href={caseHref(completed.caseId)}>your history</AppLink>.
                    </p>
                  </div>
                </div>
              </Card>
            ) : null}
          </Section>

          <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
            <Card padding="flush" className={styles.finder}>
              <Photo
                asset="A02"
                ratio="16 / 9"
                sizes="(min-width: 60rem) 26rem, 100vw"
                decorative
              />
              <div className={styles.finderBody}>
                <h2>Find a service point</h2>
                <p style={{ color: 'var(--color-text-muted)' }}>
                  Offices, partner banks and mobile units, with accessibility details and what each
                  one can do.
                </p>
                <div>
                  <LinkButton
                    href="/service-points/"
                    variant="secondary"
                    iconStart={<MapPinned aria-hidden="true" />}
                  >
                    Search service points
                  </LinkButton>
                </div>
              </div>
            </Card>

            <Section title="Official alerts" id="alerts" headingLevel={2}>
              <QueryBoundary
                query={alerts}
                loadingLabel="Loading alerts"
                loadingRows={2}
                headingLevel={3}
                isEmpty={(items) => items.length === 0}
                empty={<Notice tone="neutral">No alerts right now.</Notice>}
              >
                {(items) => (
                  <div className={styles.alerts}>
                    {items.map((alert) => (
                      <Notice
                        key={alert.alertId}
                        tone={alert.severity === 'attention' ? 'attention' : 'info'}
                        title={alert.title}
                      >
                        <p>{alert.body}</p>
                      </Notice>
                    ))}
                  </div>
                )}
              </QueryBoundary>
            </Section>
          </div>
        </div>

        <Card tone="sunken">
          <Grid gap={5} min="18rem" style={{ alignItems: 'center' }}>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)' }}>Everyday identity, kept simple</h2>
              <p style={{ color: 'var(--color-text-muted)' }}>
                Check a status on the way out of the door. Come back to a half-finished form later.
                The service fits around your day, not the other way round.
              </p>
              <div>
                <LinkButton
                  href="/messages/preferences/"
                  variant="quiet"
                  iconEnd={<ArrowRight aria-hidden="true" />}
                >
                  Choose how we contact you
                </LinkButton>
              </div>
            </div>
            <Photo asset="A01" ratio="16 / 10" sizes="(min-width: 60rem) 30rem, 100vw" />
          </Grid>
        </Card>
      </div>
    </Container>
  );
}
