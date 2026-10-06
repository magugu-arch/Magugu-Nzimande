import type { ReactNode } from 'react';
import styles from './ui.module.css';

type Props = { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode; headingLevel?: 'h2' | 'h3' };

/** A designed empty state — never a blank space where content should be. */
export function EmptyState({ eyebrow, title, children, actions, headingLevel = 'h3' }: Props) {
  const Heading = headingLevel;
  return (
    <div className={styles.empty} role="status">
      {eyebrow && <p className="eyebrow eyebrow-accent">{eyebrow}</p>}
      <Heading>{title}</Heading>
      {children && <div>{children}</div>}
      {actions && <div className={styles.emptyActions}>{actions}</div>}
    </div>
  );
}
