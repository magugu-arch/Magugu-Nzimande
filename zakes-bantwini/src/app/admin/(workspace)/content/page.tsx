import Link from 'next/link';
import { ArtImage } from '@/components/media/ArtImage';
import { ButtonLink } from '@/components/ui/Button';
import { approvedOnly } from '@/content';
import { keyOf, type Merged } from '@/content/overlay';
import { allMedia, getMediaFile } from '@/content/media';
import type { Approval } from '@/content/schema';
import { requireAdmin } from '@/lib/auth/admin';
import { adminContent, COLLECTION_LABEL } from '@/lib/cms/admin';
import { formatMoment } from '@/lib/booking/dates';
import styles from '../../admin.module.css';

const BADGE: Record<Approval, string> = { approved: 'CONFIRMED', pending: 'ON_HOLD', placeholder: 'NEW' };
const ORIGIN = { seed: 'Original', edited: 'Edited', new: 'Added' } as const;

/**
 * Content management: every release, video, story and pillar, the press kit
 * and site settings — what is approved, what is pending, what is still a
 * placeholder — with an editor for each, plus the 41-image library.
 */
export default async function ContentPage() {
  const admin = await requireAdmin();
  const content = await adminContent();
  const canEdit = admin.role !== 'viewer';

  const approvals: Approval[] = [
    ...[...content.albums, ...content.videos, ...content.stories, ...content.pillars].filter((m) => !m.archived).map((m) => m.item.approval),
    content.pressKit.item.approval,
    content.settings.item.streamingApproval,
  ];
  const tally = approvals.reduce<Record<string, number>>((t, a) => ({ ...t, [a]: (t[a] ?? 0) + 1 }), {});

  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow eyebrow-accent">Content & media</p>
          <h1>Content</h1>
        </div>
        <div className={styles.toolbar}>
          <ButtonLink href="/admin/content/assets" variant="outline" small>
            Asset library
          </ButtonLink>
          <ButtonLink href="/admin/content/settings/default" variant="outline" small>
            Site settings
          </ButtonLink>
          <ButtonLink href="/admin/content/pressKit/default" variant="outline" small>
            Press kit
          </ButtonLink>
        </div>
      </header>
      <p className={styles.small}>
        Launch mode is {approvedOnly() ? 'on: only approved content renders' : 'off: pending and placeholder content shows with markers'} (CONTENT_PUBLISH_APPROVED_ONLY). Saving publishes
        immediately.
      </p>

      <div className={styles.tiles}>
        {(['approved', 'pending', 'placeholder'] as const).map((a) => (
          <div key={a} className={styles.tile}>
            <span className={styles.tileValue}>{tally[a] ?? 0}</span>
            <span className={styles.tileLabel}>{a}</span>
          </div>
        ))}
      </div>

      <Collection title="Releases" collection="albums" items={content.albums} canAdd={canEdit} />
      <Collection title="Videos" collection="videos" items={content.videos} canAdd={canEdit} />
      <Collection title="Journal" collection="stories" items={content.stories} canAdd={canEdit} />
      <Collection title="Pillars of The Architect" collection="pillars" items={content.pillars} canAdd={false} />

      <section className={`${styles.panel} ${styles.tableWrap}`} aria-labelledby="singletons-title">
        <h2 id="singletons-title">Press kit and settings</h2>
        <table className={styles.table}>
          <tbody>
            <tr>
              <td>
                <Link href="/admin/content/pressKit/default">Press kit</Link>
                <div className={styles.small}>Biographies, awards, quotes, performance formats, rider, press photos</div>
              </td>
              <td>
                <Badge approval={content.pressKit.item.approval} />
              </td>
              <td className={styles.small}>{describe(content.pressKit)}</td>
            </tr>
            <tr>
              <td>
                <Link href="/admin/content/settings/default">Site settings</Link>
                <div className={styles.small}>Streaming profiles, social links, public emails, home-page features</div>
              </td>
              <td>
                <Badge approval={content.settings.item.streamingApproval} />
              </td>
              <td className={styles.small}>{describe(content.settings)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.panel} aria-labelledby="media-title">
        <details>
          <summary>
            <h2 id="media-title" style={{ display: 'inline' }}>
              Image library: {allMedia().length} supplied photographs
            </h2>
          </summary>
          <p className={styles.small} style={{ margin: '12px 0' }}>
            Kept byte-for-byte as supplied and placed per the brief&rsquo;s matrix. Editors choose from these for mood, poster, lead and press images.
          </p>
          <ul role="list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {allMedia().map((m) => {
              const f = getMediaFile(m.id);
              return (
                <li key={m.id} style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
                  <ArtImage id={m.id} sizes="200px" ratio={{ desktop: '4/3', mobile: '4/3' }} />
                  <strong style={{ fontSize: 13 }}>
                    {String(m.index).padStart(2, '0')} · {m.title}
                  </strong>
                  <span className={styles.small}>
                    {f.file} · {f.width}×{f.height} · {m.sections.join(', ')}
                  </span>
                  {m.briefNote && <span className={styles.small} style={{ color: 'var(--champagne)' }}>Brief note: {m.briefNote}</span>}
                  {m.caution && <span className={styles.small} style={{ color: 'var(--danger)' }}>Caution: {m.caution}</span>}
                  {f.width < 1600 && <span className={styles.small}>Master is {f.width}px wide. Request the full-resolution original for full-bleed use.</span>}
                </li>
              );
            })}
          </ul>
        </details>
      </section>
    </>
  );
}

function describe(m: Pick<Merged<unknown>, 'origin' | 'updatedAt' | 'updatedBy'>): string {
  if (m.origin === 'seed' || !m.updatedAt) return 'Original (not yet edited)';
  return `${ORIGIN[m.origin]} by ${m.updatedBy} · ${formatMoment(m.updatedAt)}`;
}

function Badge({ approval }: { approval: Approval }) {
  return (
    <span className={styles.badge} data-status={BADGE[approval]}>
      {approval}
    </span>
  );
}

function Collection({
  title,
  collection,
  items,
  canAdd,
}: {
  title: string;
  collection: 'albums' | 'videos' | 'stories' | 'pillars';
  items: Merged<{ title: string; approval: Approval; slug?: string; key?: string }>[];
  canAdd: boolean;
}) {
  const id = `${collection}-title`;
  return (
    <section className={`${styles.panel} ${styles.tableWrap}`} aria-labelledby={id}>
      <div className={styles.calHead}>
        <h2 id={id}>
          {title} <span className={styles.small}>({items.filter((i) => !i.archived).length})</span>
        </h2>
        {canAdd && (
          <ButtonLink href={`/admin/content/${collection}/new`} small>
            New {COLLECTION_LABEL[collection].one.toLowerCase()}
          </ButtonLink>
        )}
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Title</th>
            <th>Approval</th>
            <th>Version</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => {
            const key = keyOf(collection, m.item);
            return (
              <tr key={key} style={m.archived ? { opacity: 0.55 } : undefined}>
                <td>
                  <Link href={`/admin/content/${collection}/${key}`}>{m.item.title}</Link>
                  {m.archived && <span className={styles.origin}> · hidden</span>}
                  <div className={styles.small}>{COLLECTION_LABEL[collection].publicPath(key)}</div>
                </td>
                <td>
                  <Badge approval={m.item.approval} />
                </td>
                <td className={styles.small}>{describe(m)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
