import Link from 'next/link';
import type { Route } from 'next';
import { breadcrumbs, graph } from '@/lib/jsonld';
import { JsonLd } from './JsonLd';
import styles from './Breadcrumbs.module.css';

export type Crumb = { name: string; path: string };

/** Visible trail plus BreadcrumbList structured data. "Home" is added automatically. */
export function Breadcrumbs({ items, tone = 'ink' }: { items: Crumb[]; tone?: 'ink' | 'paper' }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className={`${styles.crumbs} ${tone === 'paper' ? styles.paper : ''}`}>
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          {items.map((c, i) => (
            <li key={c.path}>{i === items.length - 1 ? <span aria-current="page">{c.name}</span> : <Link href={c.path as Route}>{c.name}</Link>}</li>
          ))}
        </ol>
      </nav>
      <JsonLd data={graph(breadcrumbs(items))} />
    </>
  );
}
