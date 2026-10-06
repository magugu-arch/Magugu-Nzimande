/**
 * Stored content. Each row overrides (or adds to) one seed entry: the seed in
 * src/content/seed is the designed starting point, and whatever management
 * saves in the admin replaces it entry by entry. Reverting an entry deletes
 * its row, which brings the seed version back.
 */
export const CONTENT_COLLECTIONS = ['albums', 'videos', 'stories', 'pillars', 'pressKit', 'settings'] as const;
export type ContentCollection = (typeof CONTENT_COLLECTIONS)[number];

/** Singletons are stored under this slug. */
export const SINGLETON = 'default';

export type ContentEntry = {
  /** `${collection}:${slug}` — one row per entry. */
  id: string;
  collection: ContentCollection;
  slug: string;
  /** The whole entry, validated against its schema on save and again on read. */
  data: unknown;
  /** Hidden from the site without losing the work (seed entries can be hidden too). */
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export const contentEntryId = (collection: ContentCollection, slug: string) => `${collection}:${slug}`;

/**
 * Files management uploads for public use — cover art, audio previews,
 * caption tracks, the technical rider. Served by /assets/[id]/[name].
 * (Booking documents are separate and private.)
 */
export const PUBLIC_ASSET_KINDS = ['image', 'audio', 'document', 'captions'] as const;
export type PublicAssetKind = (typeof PUBLIC_ASSET_KINDS)[number];

export type PublicAsset = {
  id: string;
  kind: PublicAssetKind;
  filename: string;
  contentType: string;
  size: number;
  storageKey: string;
  /** Images only. */
  width: number | null;
  height: number | null;
  /** What it is, for the library and as default alt text. */
  label: string;
  uploadedBy: string;
  createdAt: string;
};
