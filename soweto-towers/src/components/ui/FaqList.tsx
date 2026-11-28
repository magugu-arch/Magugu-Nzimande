import { ChevronDown } from './icons';
import styles from './FaqList.module.css';

/** Native disclosure: keyboard, screen readers and find-in-page all work without JavaScript. */
export function FaqList({ items, name = 'faq' }: { items: { q: string; a: string }[]; name?: string }) {
  return (
    <div className={styles.list}>
      {items.map((f) => (
        <details key={f.q} className={styles.item} name={name}>
          <summary className={styles.q}>
            <span>{f.q}</span>
            <ChevronDown className={styles.chev} />
          </summary>
          <div className={styles.a}>
            <p>{f.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
