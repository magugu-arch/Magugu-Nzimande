import { AppLink, Card, cx, stretchedLinkClass } from '@hao/design-system';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './cards.module.css';
import { Photo } from './Photo';

/* Photo card -------------------------------------------------------- */

export interface PhotoCardProps {
  asset: string;
  href: string;
  title: string;
  /** One or two sentences. */
  children?: ReactNode;
  /** Tags shown under the text. */
  meta?: ReactNode;
  /** Link text shown at the bottom, e.g. "See how it works". */
  cta?: string;
  ratio?: string;
  sizes?: string;
  headingLevel?: 2 | 3 | 4;
}

/** A photograph with a title and summary; the whole card links to `href`. */
export function PhotoCard({
  asset,
  href,
  title,
  children,
  meta,
  cta,
  ratio = '4 / 3',
  sizes = '(min-width: 60rem) 24rem, (min-width: 36rem) 50vw, 100vw',
  headingLevel = 3,
}: PhotoCardProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <Card as="article" padding="flush" interactive className={styles.photoCard}>
      {/* The title names the destination; the photo is context, so it is hidden from screen readers. */}
      <Photo asset={asset} ratio={ratio} sizes={sizes} decorative />
      <div className={styles.photoCardBody}>
        <Heading className={styles.photoCardTitle}>
          <AppLink href={href} className={stretchedLinkClass}>
            {title}
          </AppLink>
        </Heading>
        {children ? <p className={styles.photoCardText}>{children}</p> : null}
        {meta ? <div className={styles.photoCardMeta}>{meta}</div> : null}
        {cta ? (
          <span className={styles.go} aria-hidden="true">
            {cta}
            <ArrowRight />
          </span>
        ) : null}
      </div>
    </Card>
  );
}

/* Icon tile --------------------------------------------------------- */

export interface IconTileProps {
  href: string;
  icon: ReactNode;
  title: string;
  hint?: string;
  headingLevel?: 2 | 3 | 4;
}

/** A compact shortcut: icon, action label and a few words of help. */
export function IconTile({ href, icon, title, hint, headingLevel = 3 }: IconTileProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <Card padding="compact" interactive className={styles.tile}>
      <span className={styles.tileIcon} aria-hidden="true">
        {icon}
      </span>
      <Heading className={styles.tileTitle}>
        <AppLink href={href} className={stretchedLinkClass}>
          {title}
        </AppLink>
      </Heading>
      {hint ? <p className={styles.tileHint}>{hint}</p> : null}
    </Card>
  );
}

/* Rows -------------------------------------------------------------- */

/** A bordered list of linked rows. Children must be `<Row>` elements. */
export function Rows({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className={styles.rows} aria-label={label}>
      {children}
    </ul>
  );
}

export interface RowProps {
  href: string;
  title: ReactNode;
  /** Icon or avatar shown at the start. */
  lead?: ReactNode;
  /** Tags, dates and other small facts under the title. */
  meta?: ReactNode;
  /** A sentence under the meta line. */
  text?: ReactNode;
  unread?: boolean;
  headingLevel?: 3 | 4;
}

export function Row({ href, title, lead, meta, text, unread = false, headingLevel = 3 }: RowProps) {
  const Heading = `h${headingLevel}` as 'h3' | 'h4';
  return (
    <li className={cx(styles.row, unread && styles.rowUnread)}>
      {lead ? (
        <span className={styles.rowLead} aria-hidden="true">
          {lead}
        </span>
      ) : (
        <span />
      )}
      <div className={styles.rowBody}>
        <Heading className={styles.rowTitle}>
          <AppLink href={href}>
            {unread ? <span className="visually-hidden">Unread: </span> : null}
            {title}
          </AppLink>
        </Heading>
        {meta ? <div className={styles.rowMeta}>{meta}</div> : null}
        {text ? <p className={styles.rowText}>{text}</p> : null}
      </div>
      <ChevronRight className={styles.rowChevron} aria-hidden="true" />
    </li>
  );
}
