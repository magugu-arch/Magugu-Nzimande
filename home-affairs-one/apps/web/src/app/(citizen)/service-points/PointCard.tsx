import type { ServicePoint } from '@hao/api-contracts';
import { AppLink, Card, Tag, stretchedLinkClass } from '@hao/design-system';
import { Clock3 } from 'lucide-react';
import styles from './service-points.module.css';
import { ACCESS_LABEL, AvailabilityTag, KIND_LABEL, hoursLines, pointHref } from './words';

/** One sample service point as a card. The whole card links to the point's page. */
export function PointCard({
  point,
  number,
  headingLevel = 3,
}: {
  point: ServicePoint;
  /** The pin number, when the card sits beside the schematic map. */
  number?: number;
  headingLevel?: 3 | 4;
}) {
  const Heading = `h${headingLevel}` as 'h3' | 'h4';
  return (
    <Card as="article" interactive className={styles.pointCard}>
      <Heading className={styles.pointName}>
        <AppLink href={pointHref(point.id)} className={stretchedLinkClass}>
          {number ? <span className="visually-hidden">Pin {number}: </span> : null}
          {point.name}
        </AppLink>
      </Heading>
      <div className={styles.pointTags}>
        <Tag tone="brand">{KIND_LABEL[point.kind]}</Tag>
        <AvailabilityTag availability={point.availability} />
      </div>
      <p className={styles.pointPlace}>
        {point.area}, {point.region}
      </p>
      <p className={styles.pointNote}>{point.availabilityNote}</p>
      <p className={styles.pointHours}>
        <Clock3 aria-hidden="true" />
        <span>
          <span className="visually-hidden">Hours (sample): </span>
          {hoursLines(point).join('; ')}
        </span>
      </p>
      {point.accessibility.length > 0 ? (
        <ul className={styles.features} aria-label="Accessibility features">
          {point.accessibility.map((feature) => (
            <li key={feature}>
              <Tag tone="teal">{ACCESS_LABEL[feature]}</Tag>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.pointNote}>No accessibility features are listed for this point.</p>
      )}
    </Card>
  );
}
