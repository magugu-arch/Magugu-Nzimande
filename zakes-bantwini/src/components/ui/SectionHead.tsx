import type { CSSProperties, ReactNode } from 'react';
import styles from './ui.module.css';

type Props = {
  index?: string;
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  id?: string;
  as?: 'h1' | 'h2';
};

/** "04 / Catalogue" — the editorial section header used across the site. */
export function SectionHead({ index, eyebrow, title, intro, id, as: Heading = 'h2' }: Props) {
  return (
    <header className={styles.head}>
      <p className={`${styles.headIndex} eyebrow`} data-reveal>
        {index && <span className={styles.num}>{index}</span>}
        <span>{eyebrow}</span>
      </p>
      <Heading id={id} className={`${styles.headTitle} display display-m`} data-reveal="mask">
        {title}
      </Heading>
      {intro && (
        <div className={`${styles.headIntro} lede`} data-reveal style={{ '--reveal-delay': 120 } as CSSProperties}>
          {intro}
        </div>
      )}
    </header>
  );
}
