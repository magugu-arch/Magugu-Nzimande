import type { Metadata } from 'next';
import Link from 'next/link';
import {
  contentCategory,
  contentStatus,
  translationStatus,
  type ContentStatus,
} from '@scarlets/domain';
import {
  Card,
  Chip,
  DemoTag,
  Denied,
  Empty,
  Media,
  PageHeader,
  TableWrap,
  type Tone,
} from '@/components/ui';
import {
  categoryLabels,
  contentStatusLabels,
  formatDateTime,
  kindLabels,
  plural,
  translationLabels,
} from '@/lib/format';
import { getStore } from '@/lib/instance';
import { mayAct } from '@/lib/rbac';
import { requireActor } from '@/lib/session';

export const metadata: Metadata = { title: 'Content' };

const statusTone: Record<ContentStatus, Tone> = {
  draft: 'neutral',
  scheduled: 'warn',
  published: 'good',
  archived: 'neutral',
};
const statusOrder: Record<ContentStatus, number> = {
  draft: 0,
  scheduled: 1,
  published: 2,
  archived: 3,
};

const pick = <T extends string>(value: string | undefined, options: readonly T[]): T | undefined =>
  options.find((option) => option === value);

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; welsh?: string; q?: string }>;
}) {
  const actor = await requireActor();
  if (!mayAct(actor.role, 'content.read')) {
    return <Denied actor={actor} permission="content.read" section="Content" />;
  }
  const params = await searchParams;
  const status = pick(params.status, contentStatus.options);
  const category = pick(params.category, contentCategory.options);
  const welsh = pick(params.welsh, translationStatus.options);
  const q = (params.q ?? '').trim().toLowerCase();

  const all = getStore().listContent();
  const rows = all
    .filter((record) => !status || record.item.status === status)
    .filter((record) => !category || record.item.category === category)
    .filter((record) => !welsh || record.item.translation === welsh)
    .filter(
      (record) =>
        !q ||
        [record.item.title.en, record.item.title.cy ?? '', record.item.summary.en]
          .join(' ')
          .toLowerCase()
          .includes(q),
    )
    .sort(
      (a, b) =>
        statusOrder[a.item.status] - statusOrder[b.item.status] ||
        Number(b.review !== null) - Number(a.review !== null) ||
        Number(b.item.pinned) - Number(a.item.pinned) ||
        b.item.publishAt.localeCompare(a.item.publishAt),
    );
  const canWrite = mayAct(actor.role, 'content.write');
  const canPublish = mayAct(actor.role, 'content.publish');

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Content"
        title="Stories, reports and media links"
        actions={
          canWrite ? (
            <Link className="btn btn--primary" href="/content/new">
              New draft
            </Link>
          ) : null
        }
      >
        Every item has an English and a Welsh slot.{' '}
        {canPublish
          ? 'You can publish, schedule, pin and archive. Publishing is done from the item, beside its preview.'
          : canWrite
            ? 'You can write and edit drafts and send them for approval. A club admin publishes.'
            : 'You can read content. You cannot change it.'}
      </PageHeader>

      <Card title="Filter" id="filter">
        <form method="get" className="filters">
          <div className="field">
            <label htmlFor="f-status">Status</label>
            <select id="f-status" name="status" defaultValue={status ?? ''}>
              <option value="">Any status</option>
              {contentStatus.options.map((option) => (
                <option key={option} value={option}>
                  {contentStatusLabels[option]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-category">Category</label>
            <select id="f-category" name="category" defaultValue={category ?? ''}>
              <option value="">Any category</option>
              {contentCategory.options.map((option) => (
                <option key={option} value={option}>
                  {categoryLabels[option]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-welsh">Welsh</label>
            <select id="f-welsh" name="welsh" defaultValue={welsh ?? ''}>
              <option value="">Any Welsh status</option>
              {translationStatus.options.map((option) => (
                <option key={option} value={option}>
                  {translationLabels[option]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-q">Title contains</label>
            <input id="f-q" type="search" name="q" defaultValue={params.q ?? ''} />
          </div>
          <div className="row">
            <button type="submit" className="btn btn--secondary">
              Apply
            </button>
            <Link className="btn btn--quiet" href="/content">
              Clear
            </Link>
          </div>
        </form>
      </Card>

      <Card
        title={`${plural(rows.length, 'item')}${rows.length === all.length ? '' : ` of ${all.length}`}`}
        id="items"
        aside={<DemoTag />}
      >
        {rows.length === 0 ? (
          <Empty>No content matches these filters.</Empty>
        ) : (
          <TableWrap label="Content items">
            <table>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">Welsh</th>
                  <th scope="col">Publish time</th>
                  <th scope="col">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item, review }) => (
                  <tr key={item.id}>
                    <th scope="row">
                      <div className="cell-title">
                        <Media id={item.mediaId} size="thumb" decorative />
                        <div>
                          <Link href={`/content/${item.id}`}>{item.title.en}</Link>
                          <span className="cell-sub" lang={item.title.cy ? 'cy' : undefined}>
                            {item.title.cy ?? 'No Welsh title'}
                          </span>
                        </div>
                      </div>
                    </th>
                    <td>
                      {categoryLabels[item.category]}
                      <span className="cell-sub">{kindLabels[item.kind]}</span>
                    </td>
                    <td>
                      <div className="row">
                        <Chip tone={statusTone[item.status]}>
                          {contentStatusLabels[item.status]}
                        </Chip>
                        {item.pinned ? <Chip>Pinned</Chip> : null}
                        {review ? <Chip tone="warn">Approval requested</Chip> : null}
                      </div>
                    </td>
                    <td>
                      <Chip tone={item.translation === 'approved' ? 'good' : 'warn'}>
                        {translationLabels[item.translation]}
                      </Chip>
                    </td>
                    <td>
                      {item.status === 'draft' ? (
                        <span className="meta">Not set</span>
                      ) : (
                        formatDateTime(item.publishAt)
                      )}
                    </td>
                    <td className="actions">
                      <Link
                        className="btn btn--secondary"
                        href={`/content/${item.id}`}
                        aria-label={`Open ${item.title.en}`}
                      >
                        Open
                      </Link>
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
