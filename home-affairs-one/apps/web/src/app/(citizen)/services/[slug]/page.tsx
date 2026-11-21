import type { ServiceChannel, ServiceDefinition } from '@hao/api-contracts';
import {
  AppLink,
  Card,
  Cluster,
  Container,
  LinkButton,
  Notice,
  PageHeader,
  SampleNotice,
  Section,
  Split,
  Stack,
  Tag,
  UnavailableState,
} from '@hao/design-system';
import { ASSURANCE_TIER_INFO } from '@hao/shared-types';
import {
  ArrowRight,
  BookOpen,
  Building2,
  Bus,
  Globe,
  Landmark,
  LifeBuoy,
  MapPinned,
  MonitorSmartphone,
} from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Row, Rows } from '@/components/cards';
import { Photo } from '@/components/Photo';
import { findService, SAMPLE_CATALOGUE } from '@/lib/catalogue';
import { formatDate, formatSampleAmount } from '@/lib/format';
import {
  AVAILABILITY_TAG,
  CHANNEL_LABEL,
  isInPersonChannel,
  needsTightCrop,
  releaseLabel,
} from '../service-labels';
import { HandoffDialog } from './HandoffDialog';
import styles from './service.module.css';

/** Service pages are static content: one page per service in the sample catalogue. */
export function generateStaticParams() {
  return SAMPLE_CATALOGUE.services.map((service) => ({ slug: service.slug }));
}
export const dynamicParams = false;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = findService(slug);
  return { title: service ? service.title : 'Service not found' };
}

const TIMEFRAME_CAUTION = 'We only show timeframes when they come from live operational data.';

const CHANNEL_ICON: Record<ServiceChannel, ReactNode> = {
  ONLINE: <MonitorSmartphone aria-hidden="true" />,
  SERVICE_OFFICE: <Building2 aria-hidden="true" />,
  PARTNER_BANK: <Landmark aria-hidden="true" />,
  MOBILE_UNIT: <Bus aria-hidden="true" />,
  MISSION_ABROAD: <Globe aria-hidden="true" />,
};

function firstSentence(text: string): string {
  return /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
}

function servicePointsHref(service: ServiceDefinition): string {
  return service.channels.some(isInPersonChannel)
    ? `/service-points/?service=${service.code}`
    : '/service-points/';
}

/** The one thing to do next. Shown near the top on phones and in the aside on wider screens. */
function PrimaryAction({
  service,
  fullWidth,
}: {
  service: ServiceDefinition;
  fullWidth?: boolean;
}) {
  if (service.availability === 'APPLY_ONLINE') {
    return (
      <LinkButton
        href={`/apply/?service=${service.code}`}
        fullWidth={fullWidth}
        iconEnd={<ArrowRight aria-hidden="true" />}
      >
        Start application
      </LinkButton>
    );
  }
  if (service.handoff) {
    return <HandoffDialog handoff={service.handoff} fullWidth={fullWidth} />;
  }
  return (
    <LinkButton
      href={servicePointsHref(service)}
      variant="secondary"
      fullWidth={fullWidth}
      iconStart={<MapPinned aria-hidden="true" />}
    >
      Find a service point
    </LinkButton>
  );
}

function NextStep({ service }: { service: ServiceDefinition }) {
  const helpButton = (
    <LinkButton
      href="/help/"
      variant="secondary"
      fullWidth
      iconStart={<LifeBuoy aria-hidden="true" />}
    >
      Get help
    </LinkButton>
  );

  if (service.availability === 'APPLY_ONLINE') {
    return (
      <Card className={styles.next}>
        <h2>Next step</h2>
        <PrimaryAction service={service} fullWidth />
        <p>You will be asked to sign in. You can save and come back.</p>
        {service.needsServicePoint ? (
          <p>After the online part, an in-person step follows at a service point of your choice.</p>
        ) : null}
      </Card>
    );
  }

  if (service.handoff) {
    return (
      <Card className={styles.next}>
        <h2>Next step</h2>
        <h3>{service.handoff.label}</h3>
        <p>{service.handoff.description}</p>
        <PrimaryAction service={service} fullWidth />
      </Card>
    );
  }

  // Information only. When the page already explains why it is not online, that
  // panel carries the same two routes, so they are not repeated here.
  if (service.unavailable) return null;
  return (
    <Card className={styles.next}>
      <h2>Next step</h2>
      <p>
        There is nothing to apply for on this page. If you need to do something in person, find a
        service point. If you are not sure what to do, ask for help.
      </p>
      <PrimaryAction service={service} fullWidth />
      {helpButton}
    </Card>
  );
}

export default async function ServicePage({ params }: PageProps) {
  const { slug } = await params;
  const service = findService(slug);
  if (!service) notFound();

  const domain = SAMPLE_CATALOGUE.domains.find((item) => item.domain === service.domain);
  const availability = AVAILABILITY_TAG[service.availability];
  const planned = releaseLabel(service.release);
  const inPerson = service.channels.some(isInPersonChannel);
  const cautions = service.cautions.includes(TIMEFRAME_CAUTION)
    ? service.cautions
    : [...service.cautions, TIMEFRAME_CAUTION];
  const guidance = SAMPLE_CATALOGUE.guidance.filter((article) =>
    article.serviceCodes.includes(service.code),
  );
  const tightCrop = needsTightCrop(service.assetId);

  return (
    <Container>
      <PageHeader
        back={{ href: '/services/', label: 'All services' }}
        eyebrow={domain?.title ?? 'Services'}
        title={service.title}
        lede={service.summary}
      >
        <Cluster gap={2}>
          <Tag tone={availability.tone}>{availability.label}</Tag>
          {planned ? <Tag>{planned}</Tag> : null}
          <Tag>Sign-in level: {ASSURANCE_TIER_INFO[service.requiredTier].label}</Tag>
        </Cluster>
      </PageHeader>

      <Split gap={7} aside="23rem">
        <Stack gap={7}>
          {/* Phones: the aside drops below the content, so the action is offered here too. */}
          <div className={styles.topAction}>
            <PrimaryAction service={service} fullWidth />
            {service.availability === 'APPLY_ONLINE' ? (
              <p>You will be asked to sign in. You can save and come back.</p>
            ) : null}
          </div>

          <Photo
            asset={service.assetId}
            ratio={tightCrop ? '1 / 1' : '16 / 9'}
            className={tightCrop ? styles.heroTight : undefined}
            sizes="(min-width: 60rem) 44rem, 100vw"
            priority
          />

          <Section title="How it works" id="how">
            <ol className={styles.steps}>
              {service.journey.map((step, index) => (
                <li key={step.title} className={styles.step}>
                  <span className={styles.stepNumber}>
                    <span className="visually-hidden">Step </span>
                    {index + 1}
                  </span>
                  <div className={styles.stepText}>
                    <h3>{step.title}</h3>
                    <p>{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="What you will need" id="need">
            <ul className={styles.requirements}>
              {service.requirements.map((item) => (
                <li key={item.id}>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
            <SampleNotice />
          </Section>

          <Section title="Cost" id="cost">
            {service.fee.kind === 'SAMPLE' ? (
              <p>
                Sample amount {formatSampleAmount(service.fee.amountCents)} for the payment sandbox.
                Not a real fee.
              </p>
            ) : (
              <p>{service.fee.note}</p>
            )}
          </Section>

          <Section title="Where you can do this" id="where">
            <ul className={styles.channels}>
              {service.channels.map((channel) => (
                <li key={channel}>
                  {CHANNEL_ICON[channel]}
                  {CHANNEL_LABEL[channel]}
                </li>
              ))}
            </ul>
            {inPerson ? (
              <p>
                <AppLink href={`/service-points/?service=${service.code}`}>
                  Find a service point that lists this service
                </AppLink>
              </p>
            ) : null}
          </Section>

          <Section title="Good to know" id="know">
            <div className={styles.cautions}>
              {cautions.map((caution, index) => (
                <Notice key={caution} tone={index === 0 ? 'attention' : 'info'}>
                  <p>{caution}</p>
                </Notice>
              ))}
            </div>
          </Section>

          <Section
            title="Related guidance"
            id="guidance"
            action={{ href: '/help/guidance/', label: 'All guidance' }}
          >
            {guidance.length > 0 ? (
              <Rows label="Related guidance">
                {guidance.map((article) => (
                  <Row
                    key={article.id}
                    href={`/help/guidance/?id=${encodeURIComponent(article.id)}`}
                    title={article.title}
                    lead={<BookOpen />}
                    text={firstSentence(article.body[0] ?? '')}
                  />
                ))}
              </Rows>
            ) : (
              <p className={styles.muted}>
                No guidance is linked to this service yet. The guidance library covers signing in,
                statuses, messages and getting help.
              </p>
            )}
          </Section>
        </Stack>

        <aside className={styles.aside} aria-label="Next step">
          {service.unavailable ? (
            <UnavailableState
              title="Not available online yet"
              reason={service.unavailable.reason}
              whatNext={service.unavailable.whatNext}
              alternatives={service.unavailable.alternatives}
              actions={
                <>
                  <LinkButton
                    href={servicePointsHref(service)}
                    variant="secondary"
                    iconStart={<MapPinned aria-hidden="true" />}
                  >
                    Find a service point
                  </LinkButton>
                  <LinkButton
                    href="/help/"
                    variant="secondary"
                    iconStart={<LifeBuoy aria-hidden="true" />}
                  >
                    Get help
                  </LinkButton>
                </>
              }
            />
          ) : null}
          <NextStep service={service} />
        </aside>
      </Split>

      <p className={styles.version}>
        Sample content {service.contentVersion}, effective {formatDate(service.effectiveDate)}
      </p>
    </Container>
  );
}
