import { Suspense } from 'react';
import { removeHoursOverrideAction } from '@/app/admin/actions';
import { PlainActionButton } from '@/components/admin/forms';
import { CapacityForm, HoursOverrideForm, PricesForm, type PriceRow } from '@/components/admin/SettingsForms';
import styles from '@/components/admin/admin.module.css';
import { activities } from '@/content/catalog';
import { requireStaff } from '@/lib/auth/session';
import { getSetting } from '@/lib/data/settings';
import { formatDayLong, ymdInSast } from '@/lib/time';

export const metadata = { title: 'Settings' };

async function SettingsContent() {
  await requireStaff('admin');
  const [cfg, prices, hours] = await Promise.all([getSetting('capacity'), getSetting('price_overrides'), getSetting('hours_overrides')]);
  const today = ymdInSast(new Date());
  const rows: PriceRow[] = activities.map((a) => {
    const o = prices[a.id] ?? {};
    return {
      id: a.id,
      name: a.name,
      basePrice: a.price,
      price: o.price ?? a.price,
      group: a.group ? { min: a.group.min, base: a.group.price, price: o.groupPrice ?? a.group.price } : null,
      disabled: !!o.disabled,
    };
  });
  const upcoming = hours.filter((h) => h.date >= today);
  return (
    <>
      <section className={styles.panel} aria-labelledby="prices-title">
        <h2 id="prices-title" className={styles.panelTitle}>
          Prices and switches
        </h2>
        <PricesForm rows={rows} />
      </section>

      <div className={styles.grid2}>
        <section className={styles.panel} aria-labelledby="hours-title">
          <h2 id="hours-title" className={styles.panelTitle}>
            Closures and special hours
          </h2>
          <p className={`${styles.small} ${styles.muted}`}>
            Normal hours: Thursday from 12:00, Friday to Sunday from 10:00, always till sunset. Add a date to close it or to open at a different time.
          </p>
          {upcoming.length > 0 ? (
            <ul className={styles.rows} role="list">
              {upcoming.map((h) => (
                <li key={h.date} className={`${styles.row} ${styles.rowSplit}`}>
                  <span>
                    <span className={styles.rowTitle}>{formatDayLong(h.date)}</span>
                    <span className={styles.rowMeta}>
                      {h.closed ? 'Closed' : `Opens ${h.opensAt}`}
                      {h.note ? ` · ${h.note}` : ''}
                    </span>
                  </span>
                  <PlainActionButton action={removeHoursOverrideAction} fields={{ date: h.date }} className={styles.linkBtn}>
                    Remove
                  </PlainActionButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>No closures or special hours coming up.</p>
          )}
          <HoursOverrideForm min={today} />
        </section>

        <section className={styles.panel} aria-labelledby="cap-title">
          <h2 id="cap-title" className={styles.panelTitle}>
            Timed slots and capacity
          </h2>
          <CapacityForm cfg={cfg} />
        </section>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow">Settings</p>
          <h1 className={styles.pageTitle}>Prices, hours and slots</h1>
          <p className={styles.pageSub}>Changes apply to the website and booking flow straight away. Every change is logged.</p>
        </div>
      </header>
      <Suspense fallback={<div className={styles.skeleton} />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}
