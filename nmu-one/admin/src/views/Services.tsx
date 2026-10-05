'use client';

import { ROLES } from '@core/domain/models';
import { CAPABILITY_LABELS } from '@core/permissions/policy';
import { Badge, PageHeader, TableWrap } from '@/components/ui';
import { ROLE_LABELS } from '@/lib/audience';
import { grantFor } from '@/lib/grants';
import { SERVICE_STATUS } from '@/lib/labels';
import { useConsole } from '@/lib/store';
import type { World } from '@core/domain/models';

const WORLDS: { id: World; title: string }[] = [
  { id: 'academics', title: 'Academics' },
  { id: 'campus', title: 'Campus' },
  { id: 'money', title: 'Money' },
  { id: 'community', title: 'Community' },
  { id: 'alumni', title: 'Alumni' },
];

export function Services() {
  const data = useConsole();
  const counts = {
    live: data.services.filter((s) => s.status === 'live').length,
    pilot: data.services.filter((s) => s.status === 'pilot').length,
    waiting: data.services.filter((s) => s.status === 'awaiting-integration').length,
  };
  return (
    <>
      <PageHeader
        eyebrow="Campus life"
        title="Service directory"
        description="Everything NMU ONE offers, grouped the way people think about it rather than by department. Each service has an owner, the system it connects to, and the permission that decides who sees it."
      />
      <p className="muted" style={{ marginBottom: 16 }}>
        {counts.live} live · {counts.pilot} in pilot on demo data · {counts.waiting} waiting for
        their NMU system to be connected.
      </p>
      <div className="stack">
        {WORLDS.map((w) => {
          const services = data.services.filter((s) => s.world === w.id);
          return (
            <section key={w.id} aria-labelledby={`world-${w.id}`} className="stack-sm">
              <h2 id={`world-${w.id}`}>{w.title}</h2>
              <TableWrap label={`${w.title} services`}>
                <table>
                  <caption className="visually-hidden">{w.title} services</caption>
                  <thead>
                    <tr>
                      <th scope="col">Service</th>
                      <th scope="col">Owner</th>
                      <th scope="col">Connects to</th>
                      <th scope="col">Who sees it</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="cell-title">{s.title}</div>
                          <div className="cell-sub">
                            <span className="code">{s.route}</span> ·{' '}
                            {CAPABILITY_LABELS[s.capability]}
                          </div>
                        </td>
                        <td className="small">{s.owner}</td>
                        <td className="small">{s.integration}</td>
                        <td className="small">
                          {ROLES.map((r) => ({ r, g: grantFor(r, s.capability) }))
                            .filter(({ g }) => g.short !== '—')
                            .map(({ r, g }) =>
                              g.short === 'Yes'
                                ? ROLE_LABELS[r]
                                : `${ROLE_LABELS[r]} (${g.short.toLowerCase()})`,
                            )
                            .join(', ') || 'Nobody yet'}
                        </td>
                        <td>
                          <Badge tone={SERVICE_STATUS[s.status].tone}>
                            {SERVICE_STATUS[s.status].label}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </section>
          );
        })}
      </div>
    </>
  );
}
