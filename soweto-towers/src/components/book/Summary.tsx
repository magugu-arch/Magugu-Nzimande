'use client';

import { getPackage } from '@/content/catalog';
import type { Quote } from '@/lib/booking/engine';
import { approx, rand } from '@/lib/format';
import { formatDayShort } from '@/lib/time';
import type { Draft } from './types';
import styles from './book.module.css';

export function Summary({
  draft,
  quote,
  voucher,
  compact,
}: {
  draft: Draft;
  quote: Quote;
  voucher: { balance: number; label: string } | null;
  compact?: boolean;
}) {
  const pkg = draft.packageId ? getPackage(draft.packageId) : null;
  const voucherApplied = voucher ? Math.min(voucher.balance, quote.total) : 0;
  const due = Math.max(0, quote.total - voucherApplied);
  const fx = approx(due);
  return (
    <div className={styles.summary}>
      {!compact && (
        <>
          <p className="eyebrow">Your booking</p>
          <p className={styles.summaryTitle}>{pkg ? pkg.name : (quote.lines[0]?.label ?? 'Choose an adventure')}</p>
          <p className={styles.summaryWhen}>
            {draft.date ? formatDayShort(draft.date) : 'Date to choose'}
            {draft.time ? ` · ${draft.time}` : ''}
            {draft.scadTime ? ` · SCAD ${draft.scadTime}` : ''}
          </p>
        </>
      )}
      <ul role="list" className={styles.lines}>
        {quote.lines.map((l) => (
          <li key={l.sku}>
            <span>
              {l.label} <span className={styles.qty}>× {l.qty}</span>
              {l.groupRate && <span className={styles.tag}>Group rate</span>}
            </span>
            <span className="num">{rand(l.total)}</span>
          </li>
        ))}
        {quote.packageSaving > 0 && (
          <li className={styles.saving}>
            <span>{pkg?.name} saving</span>
            <span className="num">−{rand(quote.packageSaving)}</span>
          </li>
        )}
        {voucherApplied > 0 && (
          <li className={styles.saving}>
            <span>Gift voucher</span>
            <span className="num">−{rand(voucherApplied)}</span>
          </li>
        )}
      </ul>
      {quote.groupSaving > 0 && <p className={styles.savedNote}>Group rate saved you {rand(quote.groupSaving)}.</p>}
      <div className={styles.total}>
        <span>To pay</span>
        <span className="price num" aria-live="polite">
          {rand(due)}
        </span>
      </div>
      {due > 0 && (
        <p className={styles.fx}>
          About {fx.usd} · {fx.eur} · {fx.gbp}. Charged in rand.
        </p>
      )}
    </div>
  );
}
