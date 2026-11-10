import { can } from '@kc-one/contracts';
import { DemoBanner, first, Notice, PageHead } from '@/components/ui';
import { requirePermission } from '@/lib/dal';
import { listContent } from '@/lib/store';
import { createContentAction, setContentStatusAction } from '../../actions';

const STATUS_CLASS = {
  draft: 'tag',
  scheduled: 'tag warn',
  published: 'tag ok',
  archived: 'tag',
} as const;

export default async function Content({ searchParams }: PageProps<'/content'>) {
  const actor = await requirePermission('content.read');
  const sp = await searchParams;
  const rows = listContent(actor);
  const canWrite = can(actor.role, 'content.write');
  const canPublish = can(actor.role, 'content.publish');
  return (
    <>
      <PageHead eyebrow="CMS" lead="Home and" accent="stories." />
      <Notice notice={first(sp.notice)} tone={first(sp.tone)} />
      <DemoBanner>
        Sample editorial cards. Publishing here changes only this demo console.
      </DemoBanner>

      {canWrite ? (
        <form action={createContentAction} className="card stack" aria-label="New draft">
          <h2>New draft</h2>
          <label>
            Title
            <input name="title" required maxLength={120} />
          </label>
          <label>
            Summary
            <textarea name="summary" maxLength={280} rows={3} />
          </label>
          <label>
            Kind
            <select name="kind" defaultValue="article">
              <option value="article">Article</option>
              <option value="campaign">Campaign</option>
            </select>
          </label>
          <div className="row">
            <button className="primary" type="submit">
              Save draft
            </button>
          </div>
        </form>
      ) : null}

      <section className="card">
        <table>
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Status</th>
              <th scope="col">Updated</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.title}</strong> <span className="tag demo">Demo</span>
                  <div className="muted">{r.summary}</div>
                </td>
                <td>
                  <span className={STATUS_CLASS[r.status]}>{r.status}</span>
                  {r.publishAt ? (
                    <div className="micro">{new Date(r.publishAt).toLocaleString('en-ZA')}</div>
                  ) : null}
                </td>
                <td className="muted">{new Date(r.updatedAt).toLocaleString('en-ZA')}</td>
                <td>
                  <div className="row">
                    {canPublish && r.status !== 'published' ? (
                      <form action={setContentStatusAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="published" />
                        <button type="submit">Publish</button>
                      </form>
                    ) : null}
                    {canPublish && r.status === 'draft' ? (
                      <form action={setContentStatusAction} className="row">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="scheduled" />
                        <input
                          type="datetime-local"
                          name="publishAt"
                          aria-label={`Publish time for ${r.title} (SAST)`}
                          required
                        />
                        <button type="submit">Schedule</button>
                      </form>
                    ) : null}
                    {canWrite && r.status !== 'archived' ? (
                      <form action={setContentStatusAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="archived" />
                        <button type="submit">Archive</button>
                      </form>
                    ) : null}
                    {!canWrite ? <span className="micro">Read only</span> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
