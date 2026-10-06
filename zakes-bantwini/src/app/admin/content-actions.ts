'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { COLLECTION_SCHEMA, keyOf, mergeList } from '@/content/overlay';
import { seed } from '@/content/seed';
import { requireAdmin, type AdminSession } from '@/lib/auth/admin';
import { AssetError, uploadPublicAsset } from '@/lib/cms/assets';
import { formErrors, formValues, fromFormValues, slugify } from '@/lib/cms/forms';
import { CONTENT_COLLECTIONS, contentEntryId, SINGLETON, type ContentCollection } from '@/lib/cms/types';
import { newId } from '@/lib/security/crypto';
import { getStorage } from '@/lib/storage';
import { getStore } from '@/lib/store';
import type { AdminState } from './actions';

const LISTS = ['albums', 'videos', 'stories', 'pillars'] as const;
type ListCollection = (typeof LISTS)[number];
const isList = (c: ContentCollection): c is ListCollection => (LISTS as readonly string[]).includes(c);
/** Collections management can add to and hide from. Pillars are the five fixed ones. */
const OPEN_ENDED: readonly ContentCollection[] = ['albums', 'videos', 'stories'];

async function editor(): Promise<AdminSession | null> {
  const admin = await requireAdmin();
  return admin.role === 'viewer' ? null : admin;
}

async function audit(a: AdminSession, action: string, detail: Record<string, unknown>) {
  await getStore().insert('audit_log', { id: newId(), bookingId: null, actor: a.name, action, detail, createdAt: new Date().toISOString() });
}

/** Content shows on most public pages (home, lists, detail, sitemap), so refresh them all. */
function republish() {
  revalidatePath('/', 'layout');
}

async function mergedList(collection: ListCollection) {
  const entries = await getStore().list('content_entries', { where: { collection } });
  return mergeList(collection, seed[collection], entries);
}

export async function saveContentAction(collection: ContentCollection, slug: string | null, _prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await editor();
  if (!admin) return { ok: false, message: 'Your role is read-only.' };
  if (!CONTENT_COLLECTIONS.includes(collection)) return { ok: false, message: 'Unknown content type.' };
  const values = formValues(form);
  const store = getStore();

  let key: string;
  if (!isList(collection)) {
    key = SINGLETON;
  } else if (slug === null) {
    if (!OPEN_ENDED.includes(collection)) return { ok: false, message: 'New entries cannot be added here.' };
    const raw = String(values.slug ?? '').trim() || String(values.title ?? '');
    key = slugify(raw);
    if (!key) return { ok: false, message: 'Check the highlighted fields.', fields: { title: 'Give it a title' } };
    if ((await mergedList(collection)).some((m) => keyOf(collection, m.item) === key)) {
      return { ok: false, message: 'Check the highlighted fields.', fields: { slug: `“${key}” is already in use. Choose another web address.` } };
    }
  } else {
    key = slug;
    if (!(await mergedList(collection)).some((m) => keyOf(collection, m.item) === key)) return { ok: false, message: 'That entry no longer exists.' };
  }

  const images = await store.list('public_assets', { where: { kind: 'image' } });
  const parsed = COLLECTION_SCHEMA[collection].safeParse(fromFormValues(collection, values, { slug: key, images }));
  if (!parsed.success) return { ok: false, message: 'Check the highlighted fields.', fields: formErrors(parsed.error) };

  if (collection === 'settings') {
    // Featured lists are typed by hand: every slug must exist.
    const data = parsed.data as (typeof seed)['settings'];
    const fields: Record<string, string> = {};
    for (const [field, list, items] of [
      ['featuredAlbums', 'albums', data.featured.albums],
      ['featuredVideos', 'videos', data.featured.videos],
      ['featuredStories', 'stories', data.featured.stories],
    ] as const) {
      const known = new Set((await mergedList(list)).map((m) => keyOf(list, m.item)));
      const unknown = items.filter((s) => !known.has(s));
      if (unknown.length) fields[field] = `Not found: ${unknown.join(', ')}`;
    }
    if (Object.keys(fields).length) return { ok: false, message: 'Check the highlighted fields.', fields };
  }

  const id = contentEntryId(collection, key);
  const existing = await store.get('content_entries', id);
  const now = new Date().toISOString();
  await store.upsert('content_entries', {
    id,
    collection,
    slug: key,
    data: parsed.data,
    archived: existing?.archived ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    updatedBy: admin.name,
  });
  const approval = (parsed.data as { approval?: string; streamingApproval?: string }).approval ?? (parsed.data as { streamingApproval?: string }).streamingApproval;
  await audit(admin, existing ? 'content_updated' : 'content_created', { collection, slug: key, approval });
  republish();
  revalidatePath('/admin/content', 'layout');
  if (slug === null && isList(collection)) redirect(`/admin/content/${collection}/${key}?created=1`);
  return { ok: true, message: approval === 'approved' ? 'Saved. Approved content is live on the site.' : 'Saved. It shows on the site with a pending marker until approved (hidden in launch mode).' };
}

/** Hide or restore an entry without losing it. Seed entries get a stored copy to carry the flag. */
export async function setArchivedAction(collection: ContentCollection, slug: string, archived: boolean): Promise<void> {
  const admin = await editor();
  if (!admin || !OPEN_ENDED.includes(collection) || !isList(collection)) return;
  const store = getStore();
  const merged = (await mergedList(collection)).find((m) => keyOf(collection, m.item) === slug);
  if (!merged) return;
  const id = contentEntryId(collection, slug);
  const existing = await store.get('content_entries', id);
  const now = new Date().toISOString();
  if (existing) await store.update('content_entries', id, { archived, updatedAt: now, updatedBy: admin.name });
  else await store.insert('content_entries', { id, collection, slug, data: merged.item, archived, createdAt: now, updatedAt: now, updatedBy: admin.name });
  await audit(admin, archived ? 'content_hidden' : 'content_restored', { collection, slug });
  republish();
  revalidatePath('/admin/content', 'layout');
}

/** Drop the stored version: a seed entry goes back to its original, a new entry is deleted. */
export async function revertContentAction(collection: ContentCollection, slug: string): Promise<void> {
  const admin = await editor();
  if (!admin || !CONTENT_COLLECTIONS.includes(collection)) return;
  const removed = await getStore().remove('content_entries', contentEntryId(collection, slug));
  if (removed) {
    await audit(admin, 'content_reverted', { collection, slug });
    republish();
  }
  revalidatePath('/admin/content', 'layout');
  const inSeed = !isList(collection) || seed[collection].some((i) => keyOf(collection, i) === slug);
  redirect(inSeed ? `/admin/content/${collection}/${slug}?reverted=${Date.now()}` : '/admin/content');
}

// ── Asset library ──

export async function uploadAssetAction(_prev: AdminState, form: FormData): Promise<AdminState> {
  const admin = await editor();
  if (!admin) return { ok: false, message: 'Your role is read-only.' };
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Choose a file to upload.' };
  try {
    const asset = await uploadPublicAsset({ name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) }, String(form.get('label') ?? ''), admin.name);
    await audit(admin, 'asset_uploaded', { id: asset.id, filename: asset.filename, kind: asset.kind });
    revalidatePath('/admin/content/assets');
    return { ok: true, message: `Uploaded ${asset.filename}.` };
  } catch (error) {
    if (error instanceof AssetError) return { ok: false, message: error.message };
    console.error('[admin] asset upload failed', error);
    return { ok: false, message: 'The upload failed. Nothing was saved.' };
  }
}

/** Assets still referenced by content cannot be deleted — the page would point at nothing. */
export async function deleteAssetAction(id: string): Promise<AdminState> {
  const admin = await editor();
  if (!admin) return { ok: false, message: 'Your role is read-only.' };
  const store = getStore();
  const asset = await store.get('public_assets', id);
  if (!asset) return { ok: false, message: 'Already deleted.' };
  const needle = `/assets/${id}/`;
  const users = (await store.list('content_entries')).filter((e) => JSON.stringify(e.data).includes(needle));
  if (users.length) return { ok: false, message: `Still used by ${users.map((u) => `${u.collection}/${u.slug}`).join(', ')}. Remove it there first.` };
  await store.remove('public_assets', id);
  await getStorage()
    .delete(asset.storageKey)
    .catch((e) => console.error('[admin] could not delete stored file', asset.storageKey, e));
  await audit(admin, 'asset_deleted', { id, filename: asset.filename });
  revalidatePath('/admin/content/assets');
  return { ok: true, message: `Deleted ${asset.filename}.` };
}
