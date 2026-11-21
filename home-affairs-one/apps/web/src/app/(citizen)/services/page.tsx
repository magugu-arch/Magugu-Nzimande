import { Container, PageHeader, SampleNotice } from '@hao/design-system';
import type { Metadata } from 'next';
import { SAMPLE_CATALOGUE } from '@/lib/catalogue';
import { formatDate } from '@/lib/format';
import { ServiceCatalogue, type CatalogueGroup } from './ServiceCatalogue';
import { DOMAIN_ANCHOR, needsTightCrop } from './service-labels';
import styles from './services.module.css';

export const metadata: Metadata = { title: 'Services' };

/**
 * Only what a card needs is handed to the browser: titles, summaries and tags.
 * The form definitions stay behind until a person opens a service.
 */
const GROUPS: CatalogueGroup[] = SAMPLE_CATALOGUE.domains.map((domain) => ({
  anchor: DOMAIN_ANCHOR[domain.domain],
  title: domain.title,
  summary: domain.summary,
  assetId: domain.assetId,
  isSupport: domain.domain === 'SUPPORT',
  services: SAMPLE_CATALOGUE.services
    .filter((service) => service.domain === domain.domain)
    .map((service) => ({
      slug: service.slug,
      title: service.title,
      summary: service.summary,
      availability: service.availability,
      release: service.release,
      assetId: service.assetId,
      tightCrop: needsTightCrop(service.assetId),
    })),
}));

export default function ServicesPage() {
  return (
    <Container>
      <PageHeader
        eyebrow="Services"
        title="What do you need to do?"
        lede="Every service is described in plain language and grouped by what is happening in your life, from a first ID to a new baby or a journey."
      />

      <ServiceCatalogue groups={GROUPS} />

      <div className={styles.foot}>
        <SampleNotice />
        <p className={styles.version}>
          Sample content {SAMPLE_CATALOGUE.version}, effective{' '}
          {formatDate(SAMPLE_CATALOGUE.effectiveDate)}
        </p>
      </div>
    </Container>
  );
}
