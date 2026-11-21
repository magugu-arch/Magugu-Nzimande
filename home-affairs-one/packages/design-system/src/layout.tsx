'use client';

import { ChevronLeft } from 'lucide-react';
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import styles from './layout.module.css';
import { AppLink } from './link';

type Space = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
const space = (value: Space | undefined) => (value ? `var(--space-${value})` : undefined);

interface BoxProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  gap?: Space;
}

/** Vertical rhythm: children stacked with a consistent gap. */
export function Stack({ as: Element = 'div', gap, className, style, ...rest }: BoxProps) {
  return (
    <Element
      className={cx(styles.stack, className)}
      style={{ '--gap': space(gap), ...style } as CSSProperties}
      {...rest}
    />
  );
}

/** A wrapping row: tags, button groups, metadata. */
export function Cluster({
  as: Element = 'div',
  gap,
  align,
  justify,
  className,
  style,
  ...rest
}: BoxProps & { align?: CSSProperties['alignItems']; justify?: CSSProperties['justifyContent'] }) {
  return (
    <Element
      className={cx(styles.cluster, className)}
      style={
        { '--gap': space(gap), '--align': align, '--justify': justify, ...style } as CSSProperties
      }
      {...rest}
    />
  );
}

/** Auto-fitting grid: as many columns as fit at `min` width, one column on phones. */
export function Grid({
  as: Element = 'div',
  gap,
  min = '16rem',
  className,
  style,
  ...rest
}: BoxProps & { min?: string }) {
  return (
    <Element
      className={cx(styles.grid, className)}
      style={{ '--gap': space(gap), '--min': min, ...style } as CSSProperties}
      {...rest}
    />
  );
}

export function Container({
  as: Element = 'div',
  width = 'wide',
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: ElementType; width?: 'wide' | 'narrow' }) {
  return (
    <Element
      className={cx(styles.container, width === 'narrow' && styles.narrow, className)}
      {...rest}
    />
  );
}

/** Main column plus an aside that drops below on small screens. */
export function Split({
  gap,
  aside = '22rem',
  reverse = false,
  className,
  style,
  ...rest
}: BoxProps & { aside?: string; reverse?: boolean }) {
  return (
    <div
      className={cx(styles.split, reverse && styles.splitReverse, className)}
      style={{ '--gap': space(gap), '--aside': aside, ...style } as CSSProperties}
      {...rest}
    />
  );
}

export function Eyebrow({ children, inverse = false }: { children: ReactNode; inverse?: boolean }) {
  return <p className={cx(styles.eyebrow, inverse && styles.eyebrowInverse)}>{children}</p>;
}

export function Lede({ children }: { children: ReactNode }) {
  return <p className={styles.lede}>{children}</p>;
}

export function Muted({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return <p className={cx(styles.muted, small && styles.small)}>{children}</p>;
}

export interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  lede?: ReactNode;
  /** Shows a "Back to …" link above the title. */
  back?: { href: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
}

/** The page's single h1, with an optional eyebrow, lede, back link and actions. */
export function PageHeader({ title, eyebrow, lede, back, actions, children }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      {back ? (
        <AppLink href={back.href} className={styles.back}>
          <ChevronLeft aria-hidden="true" />
          {back.label}
        </AppLink>
      ) : null}
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h1>{title}</h1>
      {lede ? <Lede>{lede}</Lede> : null}
      {children}
      {actions ? <div className={styles.pageHeaderActions}>{actions}</div> : null}
    </header>
  );
}

export interface SectionProps {
  title: ReactNode;
  intro?: ReactNode;
  /** A "See all" style link shown beside the heading. */
  action?: { href: string; label: string };
  headingLevel?: 2 | 3;
  id?: string;
  children: ReactNode;
}

export function Section({ title, intro, action, headingLevel = 2, id, children }: SectionProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section className={styles.section} aria-labelledby={id ? `${id}-heading` : undefined}>
      <div className={styles.sectionHead}>
        <Heading id={id ? `${id}-heading` : undefined}>{title}</Heading>
        {action ? <AppLink href={action.href}>{action.label}</AppLink> : null}
      </div>
      {intro ? <p className={styles.sectionIntro}>{intro}</p> : null}
      {children}
    </section>
  );
}
