'use client';

import type { ServicePoint, ServicePointKind } from '@hao/api-contracts';
import {
  AppLink,
  Card,
  Cluster,
  Container,
  DescriptionList,
  EmptyState,
  LinkButton,
  Notice,
  PageHeader,
  SampleNotice,
  Section,
  Split,
  Stack,
} from '@hao/design-system';
import { Check, MapPinned } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Photo } from '@/components/Photo';
import { QueryBoundary } from '@/components/QueryBoundary';
import { findService, serviceHref } from '@/lib/catalogue';
import { formatTimeInZone } from '@/lib/format';
import { useGatewayQuery } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { SchematicMap } from '../SchematicMap';
import styles from '../service-points.module.css';
import { useNowIso } from '../use-now';
import {
  ACCESS_FEATURES,
  ACCESS_LABEL,
  AvailabilityTag,
  CAPABILITY_LABEL,
  KIND_LABEL,
  SAST,
  hoursLines,
  zoneLabel,
} from '../words';

/**
 * One illustration per kind of service point. They are generic photographs:
 * decoration only, never a picture of the place itself.
 */
const KIND_PHOTO: Record<ServicePointKind, string> = {
  SERVICE_OFFICE: 'A02',
  PARTNER_BANK: 'A41',
  MOBILE_UNIT: 'A39',
  KIOSK: 'A44',
  MISSION_ABROAD: 'A26',
};

function PointDetail({ point }: { point: ServicePoint }) {
  const { session, ready } = useSession();
  const nowIso = useNowIso();
  const isMission = point.kind === 'MISSION_ABROAD';
  const signedIn = session?.role === 'citizen';
  const notListed = ACCESS_FEATURES.filter((feature) => !point.accessibility.includes(feature));

  const facts = [
    { term: 'Area', description: point.area },
    { term: 'Region', description: point.region },
    { term: 'Country', description: point.country },
    { term: 'Address (sample)', description: point.address },
    {
      term: 'Hours (sample)',
      description: (
        <ul className={styles.plainList}>
          {hoursLines(point).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ),
    },
    { term: 'Time zone', description: zoneLabel(point.timeZone) },
    ...(isMission
      ? [
          {
            term: 'Local time there',
            description: nowIso ? formatTimeInZone(nowIso, point.timeZone) : 'Checking the time…',
          },
          {
            term: 'Time in South Africa',
            description: nowIso ? formatTimeInZone(nowIso, SAST) : 'Checking the time…',
          },
        ]
      : []),
    {
      term: 'Availability',
      description: (
        <span className={styles.availability}>
          <AvailabilityTag availability={point.availability} />
          <span>{point.availabilityNote}</span>
        </span>
      ),
    },
  ];

  return (
    <Stack gap={7}>
      <Split gap={6} aside="24rem">
        <Stack gap={4}>
          <SampleNotice>
            This is a synthetic location. The address, hours and status are placeholders, not a real
            office or a real opening promise.
          </SampleNotice>
          <DescriptionList items={facts} />
        </Stack>
        <figure className={styles.illustration}>
          <Photo
            asset={KIND_PHOTO[point.kind]}
            ratio="4 / 3"
            sizes="(min-width: 60rem) 24rem, 100vw"
            priority
            decorative
          />
          <figcaption>Illustrative image. Sample location — not a real office.</figcaption>
        </figure>
      </Split>

      <Section title="What you can do here" id="services">
        <div className={styles.columns}>
          <div className={styles.block}>
            <h3>Services (sample)</h3>
            {point.services.length > 0 ? (
              <ul className={styles.linkList}>
                {point.services.map((code) => (
                  <li key={code}>
                    <AppLink href={serviceHref(code)}>{findService(code)?.title ?? code}</AppLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>No services are listed for this point yet.</p>
            )}
          </div>
          <div className={styles.block}>
            <h3>At this kind of point you can</h3>
            <ul className={styles.checkList}>
              {point.capabilities.map((capability) => (
                <li key={capability}>
                  <Check aria-hidden="true" />
                  <span>{CAPABILITY_LABEL[capability]}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Accessibility" id="accessibility">
        {point.accessibility.length > 0 ? (
          <ul className={styles.checkList}>
            {point.accessibility.map((feature) => (
              <li key={feature}>
                <Check aria-hidden="true" />
                <span>{ACCESS_LABEL[feature]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No accessibility features are listed for this sample point.</p>
        )}
        {point.accessibility.length <= 2 && notListed.length > 0 ? (
          <Notice tone="info" title="Not listed for this point">
            <p>{notListed.map((feature) => ACCESS_LABEL[feature]).join(', ')}.</p>
            <p>
              Not listed does not always mean not available. If you need one of these, ask an
              adviser before you travel.{' '}
              <AppLink href="/help/callback/">Request a call-back</AppLink>
            </p>
          </Notice>
        ) : null}
      </Section>

      <Section title="Where it is on the map" id="position">
        <SchematicMap points={[point]} size="small" />
      </Section>

      <Card tone="sunken">
        <Stack gap={3}>
          <h2 className={styles.nextTitle}>Next steps</h2>
          <p>
            {signedIn
              ? 'Booking starts from an application, so the appointment stays linked to it.'
              : 'Booking needs a verified account, so the appointment is linked to your application.'}
          </p>
          <Cluster gap={3}>
            {ready && signedIn ? (
              <LinkButton href="/applications/">Book here for one of your applications</LinkButton>
            ) : null}
            {ready && !signedIn ? (
              <LinkButton href={`/sign-in/?next=${encodeURIComponent('/applications/')}`}>
                Sign in to book
              </LinkButton>
            ) : null}
            <LinkButton href="/help/" variant="secondary">
              Get help
            </LinkButton>
          </Cluster>
        </Stack>
      </Card>
    </Stack>
  );
}

export function PointScreen() {
  const id = useSearchParams().get('id');
  const point = useGatewayQuery(['point', id], (g) => g.appointments.getServicePoint(id ?? ''), {
    enabled: Boolean(id),
  });
  const found = point.data;
  const isMission = found?.kind === 'MISSION_ABROAD';

  return (
    <Container>
      <PageHeader
        back={
          isMission
            ? { href: '/abroad/', label: 'South Africans abroad' }
            : { href: '/service-points/', label: 'Find a service point' }
        }
        eyebrow={found ? KIND_LABEL[found.kind] : undefined}
        title={found?.name ?? 'Service point'}
      />
      {id ? (
        <QueryBoundary query={point} loadingLabel="Loading the service point">
          {(item) => <PointDetail point={item} />}
        </QueryBoundary>
      ) : (
        <EmptyState
          title="Choose a service point first"
          icon={<MapPinned />}
          actions={<LinkButton href="/service-points/">Find a service point</LinkButton>}
        >
          <p>This page shows one service point. Pick one from the finder to see its details.</p>
        </EmptyState>
      )}
    </Container>
  );
}
