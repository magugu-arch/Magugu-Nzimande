import { ArtImage } from '@/components/media/ArtImage';
import { approvedOnly, getAlbums, getPillars, getPressKit, getSettings, getStories, getVideos } from '@/content';
import { allMedia, getMediaFile } from '@/content/media';
import styles from '../../admin.module.css';

/**
 * What is live, what is pending and what is a placeholder — the same audit
 * `npm run content:audit` runs — plus the 41-image library with its brief
 * notes. Editing happens in the CMS adapter (src/content), not here.
 */
export default async function ContentPage() {
  const [albums, videos, stories, pillars, kit, settings] = await Promise.all([getAlbums(), getVideos(), getStories(), getPillars(), getPressKit(), getSettings()]);
  const rows = [
    ...albums.map((a) => ({ kind: 'Release', title: a.title, approval: a.approval })),
    ...videos.map((v) => ({ kind: 'Video', title: v.title, approval: v.approval })),
    ...stories.map((s) => ({ kind: 'Story', title: s.title, approval: s.approval })),
    ...pillars.map((p) => ({ kind: 'Pillar', title: p.title, approval: p.approval })),
    ...(kit ? [{ kind: 'Press kit', title: 'Biographies and performance info', approval: kit.approval }] : []),
    { kind: 'Settings', title: 'Streaming links', approval: settings.streamingApproval },
  ];
  const tally = rows.reduce<Record<string, number>>((t, r) => ({ ...t, [r.approval]: (t[r.approval] ?? 0) + 1 }), {});

  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow eyebrow-accent">Content & media</p>
          <h1>Approval status</h1>
        </div>
        <p className={styles.small}>
          Launch mode: {approvedOnly() ? 'on — only approved content renders' : 'off — pending and placeholder content shows with flags'} (CONTENT_PUBLISH_APPROVED_ONLY)
        </p>
      </header>

      <div className={styles.tiles}>
        {(['approved', 'pending', 'placeholder'] as const).map((a) => (
          <div key={a} className={styles.tile}>
            <span className={styles.tileValue}>{tally[a] ?? 0}</span>
            <span className={styles.tileLabel}>{a}</span>
          </div>
        ))}
      </div>

      <section className={`${styles.panel} ${styles.tableWrap}`} aria-labelledby="entries-title">
        <h2 id="entries-title">Entries</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Title</th>
              <th>Approval</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.kind}-${r.title}`}>
                <td>{r.kind}</td>
                <td>{r.title}</td>
                <td>
                  <span className={styles.badge} data-status={r.approval === 'approved' ? 'CONFIRMED' : r.approval === 'pending' ? 'ON_HOLD' : 'NEW'}>
                    {r.approval}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.panel} aria-labelledby="media-title">
        <h2 id="media-title">Image library — {allMedia().length} supplied images</h2>
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
                {f.width < 1600 && <span className={styles.small}>Master is {f.width}px wide — request the full-resolution original for full-bleed use.</span>}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
