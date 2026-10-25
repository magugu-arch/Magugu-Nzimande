/**
 * The 28 supplied images, typed from the manifest the brief names as the
 * source of truth (assets/Tashas_28_Image_Asset_Metadata.json). Roles are the
 * only thing added here; everything else is read straight from the manifest.
 */

import manifest from '../../assets/Tashas_28_Image_Asset_Metadata.json' with { type: 'json' };
import type { BrandImageAsset } from '../domain/types.ts';

const ROLE: Record<string, BrandImageAsset['role']> = {
  'TASHAS-01': 'food',
  'TASHAS-02': 'food',
  'TASHAS-03': 'food',
  'TASHAS-04': 'interior',
  'TASHAS-05': 'campaign',
  'TASHAS-06': 'interior',
  'TASHAS-07': 'food',
  'TASHAS-08': 'food',
  'TASHAS-09': 'food',
  'TASHAS-10': 'food',
  'TASHAS-11': 'food',
  'TASHAS-12': 'food',
  'TASHAS-13': 'coffee',
  'TASHAS-14': 'people',
  'TASHAS-15': 'interior',
  'TASHAS-16': 'people',
  'TASHAS-17': 'food',
  'TASHAS-18': 'coffee',
  'TASHAS-19': 'interior',
  'TASHAS-20': 'people',
  'TASHAS-21': 'coffee',
  'TASHAS-22': 'campaign',
  'TASHAS-23': 'interior',
  'TASHAS-24': 'coffee',
  'TASHAS-25': 'people',
  'TASHAS-26': 'interior',
  'TASHAS-27': 'ingredients',
  'TASHAS-28': 'campaign',
};

export const MANIFEST_NOTE: string = manifest.metadata_note;

export const brandAssets: BrandImageAsset[] = manifest.assets.map((a) => ({
  id: a.asset_id,
  originalFilename: a.filename,
  title: a.title,
  altText: a.alt_text,
  width: a.width_px,
  height: a.height_px,
  fileSizeBytes: a.file_size_bytes,
  sha256: a.sha256,
  role: ROLE[a.asset_id] ?? 'campaign',
  recommendedUse: a.recommended_use,
  exif: a.exif as Record<string, string>,
}));

export function assetById(id: string): BrandImageAsset {
  const asset = brandAssets.find((a) => a.id === id);
  if (!asset) throw new Error(`Unknown brand asset ${id}`);
  return asset;
}
