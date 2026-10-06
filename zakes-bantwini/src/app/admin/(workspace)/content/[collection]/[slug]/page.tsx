import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revertContentAction, saveContentAction, setArchivedAction } from '@/app/admin/content-actions';
import { ContentEditor } from '@/components/admin/ContentEditor';
import { FormAlert } from '@/components/forms/fields';
import { Button, ButtonLink } from '@/components/ui/Button';
import { keyOf, type Merged } from '@/content/overlay';
import { requireAdmin } from '@/lib/auth/admin';
import { adminContent, COLLECTION_LABEL, editorOptions } from '@/lib/cms/admin';
import { toFormValues, type FormValues } from '@/lib/cms/forms';
import { CONTENT_COLLECTIONS, SINGLETON, type ContentCollection } from '@/lib/cms/types';
import { formatMoment } from '@/lib/booking/dates';
import { getStore } from '@/lib/store';
import styles from '../../../../admin.module.css';

const NEW_DEFAULTS: Partial<Record<ContentCollection, FormValues>> = {
  albums: { kind: 'album', mood: 'IMG_6848', approval: 'pending' },
  videos: { kind: 'official', poster: 'IMG_6857', sourceType: 'none', approval: 'pending' },
  stories: { category: 'music', hero: 'IMG_6868', approval: 'pending' },
};

export default async function EditContentPage(props: PageProps<'/admin/content/[collection]/[slug]'>) {
  const admin = await requireAdmin();
  const { collection: raw, slug } = await props.params;
  const search = await props.searchParams;
  if (!(CONTENT_COLLECTIONS as readonly string[]).includes(raw)) notFound();
  const collection = raw as ContentCollection;
  const isSingleton = collection === 'pressKit' || collection === 'settings';
  if (isSingleton && slug !== SINGLETON) notFound();
  const isNew = slug === 'new';
  if (isNew && !NEW_DEFAULTS[collection]) notFound();

  const [content, assets] = await Promise.all([adminContent(), getStore().list('public_assets', { orderBy: { field: 'createdAt', dir: 'desc' } })]);
  let merged: Merged<unknown> | undefined;
  if (collection === 'pressKit' || collection === 'settings') merged = content[collection];
  else if (!isNew) merged = (content[collection] as Merged<{ slug?: string; key?: string }>[]).find((m) => keyOf(collection, m.item) === slug);
  if (!isNew && !merged) notFound();

  const label = COLLECTION_LABEL[collection];
  const title = isNew ? `New ${label.one.toLowerCase()}` : isSingleton ? label.one : ((merged!.item as { title: string }).title ?? slug);
  const defaults = isNew ? NEW_DEFAULTS[collection]! : toFormValues(collection, merged!.item);
  const canEdit = admin.role !== 'viewer';
  const canArchive = canEdit && !isNew && (collection === 'albums' || collection === 'videos' || collection === 'stories');

  return (
    <>
      <header className={styles.pageHead}>
        <div>
          <p className="eyebrow eyebrow-accent">
            <Link href="/admin/content">Content</Link> / {label.many}
          </p>
          <h1>{title}</h1>
          {merged && (
            <p className={styles.small}>
              {merged.origin === 'seed' ? 'Original seed content, not yet edited.' : `${merged.origin === 'new' ? 'Added' : 'Edited'} by ${merged.updatedBy} · ${formatMoment(merged.updatedAt!)}`}
              {merged.archived && ' · Hidden from the site'}
            </p>
          )}
        </div>
        {!isNew && (
          <div className={styles.toolbar}>
            <ButtonLink href={label.publicPath(slug)} variant="outline" small target="_blank">
              View on site ↗
            </ButtonLink>
            {canArchive && (
              <form action={setArchivedAction.bind(null, collection, slug, !merged!.archived)}>
                <Button type="submit" variant="outline" small>
                  {merged!.archived ? 'Show on site again' : 'Hide from site'}
                </Button>
              </form>
            )}
          </div>
        )}
      </header>

      {search.created && <FormAlert tone="success">Created. It is saved and visible to management; set Approval to Approved when it is signed off.</FormAlert>}
      {search.reverted && <FormAlert tone="success">Reverted to the original.</FormAlert>}

      <ContentEditor
        // Remount (fresh defaults) only after a revert; a normal save keeps the form and its message.
        key={`v-${String(search.reverted ?? '')}`}
        collection={collection}
        isNew={isNew}
        defaults={defaults}
        options={editorOptions(content, assets)}
        action={saveContentAction.bind(null, collection, isNew ? null : isSingleton ? SINGLETON : slug)}
        readOnly={!canEdit}
      />

      {canEdit && merged && merged.origin !== 'seed' && (
        <section className={styles.panel} aria-labelledby="revert-title">
          <details>
            <summary>
              <h2 id="revert-title" style={{ display: 'inline' }}>
                {merged.origin === 'new' ? 'Delete this entry' : 'Revert to the original'}
              </h2>
            </summary>
            <p className={styles.small} style={{ margin: '12px 0' }}>
              {merged.origin === 'new'
                ? 'Deletes this entry for good. To take it off the site but keep it, use “Hide from site” instead.'
                : 'Discards every saved edit and restores the original seed version.'}
            </p>
            <form action={revertContentAction.bind(null, collection, isSingleton ? SINGLETON : slug)}>
              <Button type="submit" variant="outline" small>
                {merged.origin === 'new' ? 'Delete permanently' : 'Revert'}
              </Button>
            </form>
          </details>
        </section>
      )}
    </>
  );
}
