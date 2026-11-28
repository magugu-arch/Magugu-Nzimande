import Link from 'next/link';
import type { Route } from 'next';
import { packages } from '@/content/catalog';
import { ArrowUpRight, Check } from '@/components/ui/icons';
import { rand } from '@/lib/format';
import styles from './PackageCards.module.css';

/** The three bundles. Jump + Film is the recommended default, as the relaunch plan sets out. */
export function PackageCards() {
  return (
    <div className={`grid grid--3 ${styles.grid}`}>
      {packages.map((p, i) => (
        <Link
          key={p.id}
          href={`/book?package=${p.id}` as Route}
          className={`card ${p.recommended ? 'card--dark' : ''} reveal ${styles.card}`}
          style={{ ['--delay' as string]: `${i * 80}ms` }}
        >
          <ArrowUpRight className="card-arrow" />
          <h3 className="h3">{p.name}</h3>
          <p className={`price ${styles.price}`}>{rand(p.price)}</p>
          <p className={styles.flag}>{p.recommended ? `Recommended · save ${rand(p.saving)}` : p.saving ? `Save ${rand(p.saving)}` : 'Per person'}</p>
          <ul role="list" className={styles.list}>
            {p.includes.map((inc) => (
              <li key={inc}>
                <Check width={18} height={18} /> {inc}
              </li>
            ))}
          </ul>
          <span className={`card-foot ${styles.cta}`}>Book {p.name}</span>
        </Link>
      ))}
    </div>
  );
}
