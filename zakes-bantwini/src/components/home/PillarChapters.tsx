'use client';

import Link from 'next/link';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './PillarChapters.module.css';

export type PillarView = {
  key: string;
  number: string;
  title: string;
  kicker: string;
  summary: string;
  image: ReactNode;
  flag?: ReactNode;
};

/**
 * The five pillars as interactive chapters: an accessible tab set (arrow
 * keys, Home/End) where each tab swaps the image and summary. On narrow
 * screens every chapter is shown in sequence instead.
 */
export function PillarChapters({ pillars }: { pillars: PillarView[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = pillars.length - 1;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i === last ? 0 : i + 1) : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className={styles.root}>
      <div className={styles.tablist} role="tablist" aria-label="The five pillars" aria-orientation="vertical">
        {pillars.map((p, i) => (
          <button
            key={p.key}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${id}-tab-${p.key}`}
            aria-selected={active === i}
            aria-controls={`${id}-panel-${p.key}`}
            tabIndex={active === i ? 0 : -1}
            className={styles.tab}
            onClick={() => setActive(i)}
            onMouseEnter={() => setActive(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className={styles.num}>{p.number}</span>
            <span className={styles.title}>{p.title}</span>
            <span className={styles.kicker}>{p.kicker}</span>
          </button>
        ))}
      </div>

      <div className={styles.panels}>
        {pillars.map((p, i) => (
          <div
            key={p.key}
            role="tabpanel"
            id={`${id}-panel-${p.key}`}
            aria-labelledby={`${id}-tab-${p.key}`}
            className={styles.panel}
            data-active={active === i}
            hidden={false}
          >
            <div className={styles.media}>{p.image}</div>
            <div className={styles.copy}>
              <p className={styles.mobileTitle} aria-hidden="true">
                <span className={styles.num}>{p.number}</span> {p.title}
              </p>
              <p className={styles.summary}>{p.summary}</p>
              <div className={styles.actions}>
                <Link href={`/architect#${p.key}`} className={styles.more}>
                  Read the chapter <span aria-hidden="true">→</span>
                  <span className="visually-hidden">: {p.title}</span>
                </Link>
                {p.flag}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
