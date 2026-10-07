'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './ChapterScroller.module.css';

export type Chapter = { id: string; numeral: string; title: string; body: ReactNode; media: ReactNode };

/**
 * Chapter-based scroll storytelling (brief §10: "Handover"). A sticky frame
 * holds every chapter's image; as each chapter's text reaches the middle of
 * the screen its image fades in. On narrow screens each chapter carries its
 * own image inline instead.
 */
export function ChapterScroller({ chapters }: { chapters: Chapter[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.root} data-motion="chapters">
      <div className={styles.stage} aria-hidden="true">
        {chapters.map((c, i) => (
          <div key={c.id} className={styles.frame} data-active={i === active}>
            {c.media}
          </div>
        ))}
        <p className={styles.counter} data-chapter-counter="">
          {chapters[active]?.numeral} / {chapters[chapters.length - 1]?.numeral}
        </p>
      </div>
      <div className={styles.chapters}>
        {chapters.map((c, i) => (
          <section
            key={c.id}
            id={c.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-index={i}
            data-numeral={c.numeral}
            className={styles.chapter}
            aria-labelledby={`${c.id}-title`}
          >
            <div className={styles.inlineMedia} aria-hidden="true">
              {c.media}
            </div>
            <p className={styles.numeral}>Chapter {c.numeral}</p>
            <h2 id={`${c.id}-title`} className={styles.title}>
              {c.title}
            </h2>
            <div className={styles.body}>{c.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
