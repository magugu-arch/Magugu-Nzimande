import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Chip, DemoTag, Denied, Empty, PageHeader, TableWrap } from '@/components/ui';
import { auditAreaLabels, formatDateTime, plural } from '@/lib/format';
import { getStore } from '@/lib/instance';
import { mayAct, roleLabels } from '@/lib/rbac';
import { requireActor } from '@/lib/session';
import { auditAreas, type AuditArea, type AuditOutcome } from '@/lib/types';

export const metadata: Metadata = { title: 'Audit log' };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; outcome?: string; actor?: string; q?: string }>;
}) {
  const actor = await requireActor();
  if (!mayAct(actor.role, 'audit.read')) {
    return <Denied actor={actor} permission="audit.read" section="Audit log" />;
  }
  const params = await searchParams;
  const store = getStore();
  const area = auditAreas.find((candidate) => candidate === params.area) as AuditArea | undefined;
  const outcome: AuditOutcome | undefined =
    params.outcome === 'applied' || params.outcome === 'refused' ? params.outcome : undefined;
  const actors = store.auditActors();
  const actorId = actors.find((candidate) => candidate.id === params.actor)?.id;
  const q = params.q?.trim() ?? '';

  const total = store.listAudit().length;
  const records = store.listAudit({ area, outcome, actorId, q });

  return (
    <div className="stack">
      <PageHeader eyebrow="Audit log" title="Who changed what, and when">
        Every change made in this console adds a record here, and so does every attempt the server
        refused. The log is append-only: records are never edited or removed.
      </PageHeader>

      <Card title="Filter" id="filter">
        <form method="get" className="filters">
          <div className="field">
            <label htmlFor="a-area">Area</label>
            <select id="a-area" name="area" defaultValue={area ?? ''}>
              <option value="">Every area</option>
              {auditAreas.map((option) => (
                <option key={option} value={option}>
                  {auditAreaLabels[option]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="a-outcome">Outcome</label>
            <select id="a-outcome" name="outcome" defaultValue={outcome ?? ''}>
              <option value="">Applied and refused</option>
              <option value="applied">Applied</option>
              <option value="refused">Refused</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="a-actor">Actor</label>
            <select id="a-actor" name="actor" defaultValue={actorId ?? ''}>
              <option value="">Everyone</option>
              {actors.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ({roleLabels[option.role]})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="a-q">Contains</label>
            <input id="a-q" type="search" name="q" defaultValue={q} />
          </div>
          <div className="row">
            <button type="submit" className="btn btn--secondary">
              Apply
            </button>
            <Link className="btn btn--quiet" href="/audit">
              Clear
            </Link>
          </div>
        </form>
      </Card>

      <Card
        title={`${plural(records.length, 'record')}${records.length === total ? '' : ` of ${total}`}`}
        eyebrow="Newest first"
        id="records"
        aside={<DemoTag />}
      >
        {records.length === 0 ? (
          <Empty>No record matches these filters.</Empty>
        ) : (
          <TableWrap label="Audit records">
            <table>
              <thead>
                <tr>
                  <th scope="col" className="num">
                    No.
                  </th>
                  <th scope="col">Time</th>
                  <th scope="col">Actor and role</th>
                  <th scope="col">Action</th>
                  <th scope="col">Entity</th>
                  <th scope="col">Before</th>
                  <th scope="col">After</th>
                  <th scope="col">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.seq} data-action={record.action} data-outcome={record.outcome}>
                    <td className="num">{record.seq}</td>
                    <td>{formatDateTime(record.at)}</td>
                    <th scope="row">
                      {record.actorName}
                      <span className="cell-sub">{roleLabels[record.actorRole]}</span>
                    </th>
                    <td>
                      <code>{record.action}</code>
                      <span className="cell-sub">
                        {auditAreaLabels[record.area]}
                        {record.permission ? ` · needs ${record.permission}` : ''}
                      </span>
                    </td>
                    <td>
                      {record.entityLabel}
                      <span className="cell-sub">
                        {record.entityType} · {record.entityId}
                      </span>
                    </td>
                    <td>{record.before}</td>
                    <td>{record.after}</td>
                    <td>
                      <Chip tone={record.outcome === 'applied' ? 'good' : 'strong'}>
                        {record.outcome === 'applied' ? 'Applied' : 'Refused'}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
