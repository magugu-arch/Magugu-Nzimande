import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import styles from './surfaces.module.css';

export type Tone = 'neutral' | 'info' | 'attention' | 'success' | 'danger';

/* Card ------------------------------------------------------------- */

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  tone?: 'default' | 'sunken' | 'brand' | 'attention' | 'info' | 'success';
  /** `flush` removes padding (for cards that start with a photo); `compact` tightens it. */
  padding?: 'default' | 'compact' | 'flush';
  /** Adds a hover / focus lift. Pair with a link using `stretchedLinkClass`. */
  interactive?: boolean;
}

export function Card({
  as: Element = 'div',
  tone = 'default',
  padding = 'default',
  interactive = false,
  className,
  ...rest
}: CardProps) {
  return (
    <Element
      className={cx(
        styles.card,
        tone !== 'default' && styles[tone],
        padding !== 'default' && styles[padding],
        interactive && styles.interactive,
        tone === 'brand' && 'on-dark',
        className,
      )}
      {...rest}
    />
  );
}

/** Class for the main link inside an interactive card: makes the whole card the target. */
export const stretchedLinkClass = styles.stretched ?? '';

/* Tag -------------------------------------------------------------- */

const TAG_CLASS: Record<Tone | 'brand' | 'teal', string | undefined> = {
  neutral: styles.tagNeutral,
  info: styles.tagInfo,
  attention: styles.tagAttention,
  success: styles.tagSuccess,
  danger: styles.tagDanger,
  brand: styles.tagBrand,
  teal: styles.tagTeal,
};

export function Tag({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: Tone | 'brand' | 'teal';
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx(styles.tag, TAG_CLASS[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/* Notice ----------------------------------------------------------- */

const NOTICE_CLASS: Record<Tone, string | undefined> = {
  neutral: styles.noticeNeutral,
  info: styles.noticeInfo,
  attention: styles.noticeAttention,
  success: styles.noticeSuccess,
  danger: styles.noticeDanger,
};

const NOTICE_ICON: Record<Tone, ReactNode> = {
  neutral: <Info aria-hidden="true" />,
  info: <Info aria-hidden="true" />,
  attention: <TriangleAlert aria-hidden="true" />,
  success: <CircleCheck aria-hidden="true" />,
  danger: <CircleAlert aria-hidden="true" />,
};

export interface NoticeProps {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  /** Set `alert` only for errors that appear in response to an action. */
  role?: 'status' | 'alert' | 'note';
  icon?: ReactNode;
  className?: string;
}

export function Notice({
  tone = 'info',
  title,
  children,
  role = 'note',
  icon,
  className,
}: NoticeProps) {
  return (
    <div className={cx(styles.notice, NOTICE_CLASS[tone], className)} role={role}>
      {icon ?? NOTICE_ICON[tone]}
      <div className={styles.noticeBody}>
        {title ? <p className={styles.noticeTitle}>{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

/* Avatar ----------------------------------------------------------- */

/** Initials only. The prototype never shows a photograph as "this person". */
export function Avatar({
  initials,
  size = 'md',
  tone = 'navy',
  label,
}: {
  initials: string;
  size?: 'md' | 'lg';
  tone?: 'navy' | 'gold';
  label?: string;
}) {
  return (
    <span
      className={cx(
        styles.avatar,
        size === 'lg' && styles.avatarLg,
        tone === 'gold' && styles.avatarGold,
      )}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {initials}
    </span>
  );
}

/* Description list -------------------------------------------------- */

export function DescriptionList({
  items,
  className,
}: {
  items: Array<{ term: ReactNode; description: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cx(styles.dl, className)}>
      {items.map((item, index) => (
        <div className={styles.dlRow} key={index}>
          <dt>{item.term}</dt>
          <dd>{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}

/* Disclosure -------------------------------------------------------- */

export function Disclosure({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <details className={styles.disclosure}>
      <summary>{summary}</summary>
      <div className={styles.disclosureBody}>{children}</div>
    </details>
  );
}

export function Divider() {
  return <hr className={styles.divider} />;
}
