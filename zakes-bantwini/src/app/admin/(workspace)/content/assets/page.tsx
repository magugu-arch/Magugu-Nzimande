import Link from 'next/link';
import { deleteAssetAction, uploadAssetAction } from '@/app/admin/content-actions';
import { ActionForm } from '@/components/admin/AdminForms';
import { TextField } from '@/components/forms/fields';
import { requireAdmin } from '@/lib/auth/admin';
import { assetPath, PUBLIC_ASSET_TYPES } from '@/lib/cms/assets';
import { formatMoment } from '@/lib/booking/dates';
import { getStore } from '@/lib/store';
import styles from '../../../admin.module.css';

const KIND_LABEL = { image: 'Image', audio: 'Audio', document: 'PDF', captions: 'Captions' } as const;

/**
 * Public files for the site: approved cover art, audio previews, caption
 * tracks and the technical rider. Each gets a permanent link editors pick
 * from (artwork, rider) or paste (track audio, captions).
 */
export default async function AssetsPage() {
  const admin = await requireAdmin();
  const assets = await getStore().list('public_assets', { orderBy: { field: 'createdAt', dir: 'desc' } });
  const accept = [...Object.keys(PUBLIC_ASSET_TYPES), '.m4a', '.vtt'].join(',');

  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow eyebrow-accent">
            <Link href="/admin/content">Content</Link> / Assets
          </p>
          <h1>Asset library</h1>
        </div>
      </header>
      <p className={styles.small}>
        Only upload material management has approved for public use. Files are public once linked from a page. Booking documents (briefs, agreements) are
        private and live on each booking instead.
      </p>

      {admin.role !== 'viewer' && (
        <section className={styles.panel} aria-labelledby="upload-title">
          <h2 id="upload-title">Upload</h2>
          <ActionForm action={uploadAssetAction} submit="Upload" resetOnSuccess>
            <div className="field" style={{ flex: '2 1 260px' }}>
              <label htmlFor="asset-file" className={styles.small}>
                File: JPG, PNG or WebP up to 8 MB · MP3 or M4A up to 11 MB · PDF up to 10 MB · WebVTT captions
              </label>
              <input id="asset-file" name="file" type="file" required accept={accept} />
            </div>
            <TextField name="label" label="What is it?" placeholder="e.g. Release I cover, final" optional />
          </ActionForm>
        </section>
      )}

      <section className={`${styles.panel} ${styles.tableWrap}`} aria-labelledby="assets-title">
        <h2 id="assets-title">Files ({assets.length})</h2>
        {assets.length === 0 ? (
          <p className={styles.small}>Nothing uploaded yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Preview</th>
                <th>File</th>
                <th>Link</th>
                <th>Uploaded</th>
                {admin.role !== 'viewer' && <th>
                  <span className="visually-hidden">Actions</span>
                </th>}
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const href = assetPath(a);
                return (
                  <tr key={a.id}>
                    <td>
                      {a.kind === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
                        <img src={href} alt="" className={styles.assetPreview} width={72} height={72} loading="lazy" />
                      ) : a.kind === 'audio' ? (
                        <audio src={href} controls preload="none" style={{ width: 200 }} aria-label={`Play ${a.label}`} />
                      ) : (
                        <span className={styles.origin}>{KIND_LABEL[a.kind]}</span>
                      )}
                    </td>
                    <td>
                      <strong>{a.label}</strong>
                      <div className={styles.small}>
                        {a.filename} · {(a.size / 1024 / 1024).toFixed(2)} MB{a.width ? ` · ${a.width}×${a.height}` : ''}
                      </div>
                    </td>
                    <td>
                      <code className={styles.code}>{href}</code>
                    </td>
                    <td className={styles.small}>
                      {a.uploadedBy}
                      <br />
                      {formatMoment(a.createdAt)}
                    </td>
                    {admin.role !== 'viewer' && (
                      <td>
                        <ActionForm action={deleteAssetAction.bind(null, a.id)} submit="Delete" variant="outline" />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
