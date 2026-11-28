import Link from 'next/link';
import type { Route } from 'next';
import type { Activity } from '@/content/catalog';
import { Photo } from '@/components/ui/Photo';
import { rand } from '@/lib/format';
import styles from './AdventureCard.module.css';

/** Tall photo card: price on top, name at the bottom (the deck's "Seven ways up" cards). */
export function AdventureCard({ activity, price, sizes }: { activity: Activity; price?: number; sizes?: string }) {
  const p = price ?? activity.price;
  const label = activity.booking.mode === 'enquiry' ? 'By arrangement' : activity.booking.mode === 'session' ? `${rand(p)} each` : rand(p);
  return (
    <Link href={`/adventures/${activity.id}` as Route} className={styles.card}>
      <Photo slug={activity.cardImage ?? activity.image} sizes={sizes ?? '(min-width: 1040px) 300px, 72vw'} />
      <span className={styles.shade} aria-hidden />
      <span className={`badge ${activity.booking.mode === 'enquiry' ? '' : 'badge--crimson'} ${styles.price}`}>{label}</span>
      <span className={styles.body}>
        <span className={styles.name}>{activity.name}</span>
        <span className={styles.short}>{activity.short}</span>
      </span>
    </Link>
  );
}
