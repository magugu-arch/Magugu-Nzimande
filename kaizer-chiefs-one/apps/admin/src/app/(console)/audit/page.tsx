import { ROLE_COPY } from '@kc-one/contracts';
import { PageHead } from '@/components/ui';
import { requirePermission } from '@/lib/dal';
import { listAudit } from '@/lib/store';

export default async function Audit() {
  const actor = await requirePermission('audit.read');
  const rows = listAudit(actor);
  return (
    <>
      <PageHead eyebrow="Audit log" lead="Every decision," accent="on record." />
      <p className="muted">
        Publication, moderation, campaign scheduling and role changes. The log is append-only: in
        the database it cannot be edited or deleted, even by its owner.
      </p>
      <section className="card">
        {rows.length === 0 ? (
          <p className="muted">Nothing recorded yet in this demo session.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Action</th>
                <th scope="col">Record</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{new Date(r.at).toLocaleString('en-ZA')}</td>
                  <td>
                    {r.actor}
                    <div className="micro">{ROLE_COPY[r.role].label}</div>
                  </td>
                  <td>
                    <code>{r.action}</code>
                  </td>
                  <td className="muted">{r.entity}</td>
                  <td className="muted" style={{ maxWidth: 320, wordBreak: 'break-word' }}>
                    {r.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
