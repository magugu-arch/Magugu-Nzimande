import { FEATURE_COPY, FEATURES } from '@kc-one/contracts';
import { tokenSource } from '@kc-one/ui';
import { DemoBanner, PageHead } from '@/components/ui';
import { requirePermission } from '@/lib/dal';
import { readAdminConfig } from '@/lib/env';
import { dashboard } from '@/lib/store';

const MODE = {
  off: { label: 'Not connected', cls: 'tag' },
  demo: { label: 'Demo adapter', cls: 'tag warn' },
  live: { label: 'Connected', cls: 'tag ok' },
} as const;

export default async function Dashboard() {
  const actor = await requirePermission('ops.read');
  const config = readAdminConfig();
  const d = dashboard(actor);
  const stats = [
    ['Awaiting review', d.awaitingReview],
    ['Safeguarding holds', d.escalated],
    ['Open reports', d.openReports],
    ['Content drafts', d.drafts],
    ['Scheduled campaigns', d.scheduledCampaigns],
  ] as const;
  return (
    <>
      <PageHead
        eyebrow={`Operations · ${config.appEnv}`}
        lead="Every Khosi,"
        accent="looked after."
      />
      <DemoBanner>
        Everything in this console is sample data held in memory on this server. Nothing here
        reaches supporters.
      </DemoBanner>
      <section className="grid" aria-label="Today">
        {stats.map(([label, n]) => (
          <div className="card" key={label}>
            <div className="micro">{label}</div>
            <div className="stat">{n}</div>
          </div>
        ))}
      </section>
      <section className="card">
        <h2 style={{ marginBottom: 12 }}>Integration health</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col">Mode</th>
              <th scope="col">Last sync</th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => {
              const m = MODE[config.capabilities[f]];
              return (
                <tr key={f}>
                  <td>{FEATURE_COPY[f]}</td>
                  <td>
                    <span className={m.cls}>{m.label}</span>
                  </td>
                  <td className="muted">
                    {config.capabilities[f] === 'live' ? 'See sync log' : 'Never'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="micro">Design tokens: {tokenSource.note}</p>
    </>
  );
}
