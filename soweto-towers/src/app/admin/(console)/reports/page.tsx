import { Suspense } from 'react';
import styles from '@/components/admin/admin.module.css';
import { requireStaff } from '@/lib/auth/session';
import { packageMix, revenueByKind, sourceBreakdown } from '@/lib/data/admin';
import { participantsReport } from '@/lib/data/bookings';
import { rand } from '@/lib/format';
import { ymdInSast } from '@/lib/time';

export const metadata = { title: 'Reports' };

const monthLabel = new Intl.DateTimeFormat('en-ZA', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const label = (key: string) => monthLabel.format(new Date(`${key}-15T12:00:00Z`));

const kindLabel: Record<string, string> = {
  adventure: 'Adventures booked online',
  voucher: 'Gift vouchers sold',
  event: 'Event tickets',
};

/** The last `n` calendar months up to and including `thisMonth` ('YYYY-MM'). */
function lastMonths(thisMonth: string, n: number): string[] {
  const [y, m] = thisMonth.split('-').map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

async function ReportsContent() {
  await requireStaff();
  const thisMonth = ymdInSast(new Date()).slice(0, 7);
  const [participants, sources, mix, revenue] = await Promise.all([participantsReport(6), sourceBreakdown(), packageMix(), revenueByKind()]);

  const byMonth = new Map(participants.map((p) => [p.month, p]));
  const keys = [...new Set([...lastMonths(thisMonth, 6), ...participants.map((p) => p.month)])].sort();
  const months = keys.map((k) => byMonth.get(k) ?? { month: k, online: 0, gate: 0, total: 0 });
  const max = Math.max(1, ...months.map((m) => m.total));
  const now = byMonth.get(thisMonth) ?? { online: 0, gate: 0, total: 0 };

  const onlineRevenue = revenue.online.reduce((n, r) => n + r.revenue, 0);
  const mixBookings = mix.reduce((n, r) => n + r.bookings, 0);

  return (
    <>
      <section className={styles.tiles} aria-label="At a glance">
        <div className={`${styles.tile} ${styles.tileDark}`}>
          <span className={styles.tileValue}>{now.total}</span>
          <span className={styles.tileLabel}>Adventure participants this month</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileValue}>{pct(now.online, now.total)}</span>
          <span className={styles.tileLabel}>Of them booked online</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileValue}>{rand(onlineRevenue)}</span>
          <span className={styles.tileLabel}>Paid online, all time</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileValue}>{rand(revenue.gate.revenue)}</span>
          <span className={styles.tileLabel}>Gate sales logged, all time</span>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="ppl-title">
        <div className={styles.panelHead}>
          <h2 id="ppl-title" className={styles.panelTitle}>
            Participants per month
          </h2>
          <div className={styles.legend} aria-hidden="true">
            <span>
              <i className={`${styles.swatch} ${styles.barOnline}`} /> Online
            </span>
            <span>
              <i className={`${styles.swatch} ${styles.barGate}`} /> At the gate
            </span>
          </div>
        </div>
        <div className={styles.bars} aria-hidden="true">
          {months.map((m) => (
            <div key={m.month} className={styles.barRow}>
              <span className={m.month > thisMonth ? styles.muted : undefined}>{label(m.month)}</span>
              <span className={styles.barTrack} title={`${m.online} online, ${m.gate} at the gate`}>
                {m.online > 0 && <span className={styles.barOnline} style={{ width: `${(m.online / max) * 100}%` }} />}
                {m.gate > 0 && <span className={styles.barGate} style={{ width: `${(m.gate / max) * 100}%` }} />}
              </span>
              <span className={styles.barValue}>{m.total}</span>
            </div>
          ))}
        </div>
        <table className="visually-hidden">
          <caption>Adventure participants per month</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Online</th>
              <th scope="col">At the gate</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <th scope="row">{label(m.month)}</th>
                <td>{m.online}</td>
                <td>{m.gate}</td>
                <td>{m.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={`${styles.small} ${styles.muted}`}>
          Online counts people on paid bookings by visit date, so later months show what is already booked. Gate figures come from the walk-in log on Today.
        </p>
      </section>

      <div className={styles.grid2}>
        <section className={styles.panel} aria-labelledby="src-title">
          <h2 id="src-title" className={styles.panelTitle}>
            Where bookings come from
          </h2>
          {sources.length === 0 ? (
            <p className={styles.empty}>No paid bookings yet.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Source</th>
                    <th scope="col">Partner code</th>
                    <th scope="col" className={styles.num}>
                      Bookings
                    </th>
                    <th scope="col" className={styles.num}>
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((r) => (
                    <tr key={`${r.source ?? ''}|${r.partner ?? ''}`}>
                      <td>{r.source ?? <span className={styles.muted}>Direct or untagged</span>}</td>
                      <td className={r.partner ? styles.mono : styles.muted}>{r.partner ?? '—'}</td>
                      <td className={styles.num}>{r.bookings}</td>
                      <td className={styles.num}>{rand(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={`${styles.small} ${styles.muted}`}>
            Tag links with ?src= (for example ?src=instagram) and give partners a ?ref= code. The site remembers it for 30 days.
          </p>
        </section>

        <section className={styles.panel} aria-labelledby="mix-title">
          <h2 id="mix-title" className={styles.panelTitle}>
            Packages and single adventures
          </h2>
          {mix.length === 0 ? (
            <p className={styles.empty}>No paid adventure bookings yet.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Booked as</th>
                    <th scope="col" className={styles.num}>
                      Bookings
                    </th>
                    <th scope="col" className={styles.num}>
                      Share
                    </th>
                    <th scope="col" className={styles.num}>
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mix.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className={styles.num}>{r.bookings}</td>
                      <td className={styles.num}>{pct(r.bookings, mixBookings)}</td>
                      <td className={styles.num}>{rand(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="rev-title">
        <h2 id="rev-title" className={styles.panelTitle}>
          Revenue by channel, all time
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Channel</th>
                <th scope="col" className={styles.num}>
                  Count
                </th>
                <th scope="col" className={styles.num}>
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody>
              {revenue.online.map((r) => (
                <tr key={r.kind}>
                  <td>{kindLabel[r.kind] ?? r.kind}</td>
                  <td className={styles.num}>
                    {r.bookings} {r.bookings === 1 ? 'booking' : 'bookings'}
                  </td>
                  <td className={styles.num}>{rand(r.revenue)}</td>
                </tr>
              ))}
              <tr>
                <td>Gate sales (walk-ins)</td>
                <td className={styles.num}>
                  {revenue.gate.qty} {revenue.gate.qty === 1 ? 'person' : 'people'}
                </td>
                <td className={styles.num}>{rand(revenue.gate.revenue)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td />
                <td className={styles.num}>
                  <strong>{rand(onlineRevenue + revenue.gate.revenue)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={`${styles.small} ${styles.muted}`}>
          Adventures paid with a gift voucher count once, when the voucher was sold. Refunds and cancellations are left out.
        </p>
      </section>
    </>
  );
}

export default function ReportsPage() {
  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow">Reports</p>
          <h1 className={styles.pageTitle}>How the towers are doing</h1>
          <p className={styles.pageSub}>Real numbers from paid bookings and the walk-in log. Nothing here is estimated.</p>
        </div>
      </header>
      <Suspense fallback={<div className={styles.skeleton} />}>
        <ReportsContent />
      </Suspense>
    </>
  );
}
