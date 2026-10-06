import 'server-only';
import { newId } from '@/lib/security/crypto';
import { getStorage, sniffMatches } from '@/lib/storage';
import { getStore } from '@/lib/store';
import type { PublicAsset, PublicAssetKind } from './types';

/** What management may publish, by declared type — and the bytes must agree (sniffMatches). */
export const PUBLIC_ASSET_TYPES: Record<string, { kind: PublicAssetKind; ext: string; maxBytes: number }> = {
  'image/jpeg': { kind: 'image', ext: 'jpg', maxBytes: 8 * 1024 * 1024 },
  'image/png': { kind: 'image', ext: 'png', maxBytes: 8 * 1024 * 1024 },
  'image/webp': { kind: 'image', ext: 'webp', maxBytes: 8 * 1024 * 1024 },
  // Previews and short cuts: the upload goes through a server action (12 MB body).
  'audio/mpeg': { kind: 'audio', ext: 'mp3', maxBytes: 11 * 1024 * 1024 },
  'audio/mp4': { kind: 'audio', ext: 'm4a', maxBytes: 11 * 1024 * 1024 },
  'application/pdf': { kind: 'document', ext: 'pdf', maxBytes: 10 * 1024 * 1024 },
  'text/vtt': { kind: 'captions', ext: 'vtt', maxBytes: 1024 * 1024 },
};

/** Browsers report .m4a and .vtt inconsistently; fall back to the extension. */
const BY_EXTENSION: Record<string, string> = { m4a: 'audio/mp4', vtt: 'text/vtt', mp3: 'audio/mpeg', jpeg: 'image/jpeg' };

export class AssetError extends Error {}

export function assetPath(asset: Pick<PublicAsset, 'id' | 'filename'>): string {
  return `/assets/${asset.id}/${asset.filename}`;
}

function safeFilename(name: string, ext: string): string {
  const base = name
    .replace(/\.[^.]*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'file'}.${ext}`;
}

/** Pixel size from the file header — enough for PNG, JPEG and WebP without an image library. */
export function imageSize(bytes: Buffer, contentType: string): { width: number; height: number } | null {
  if (contentType === 'image/png' && bytes.length >= 24) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (contentType === 'image/webp' && bytes.length >= 30) {
    const chunk = bytes.subarray(12, 16).toString('latin1');
    if (chunk === 'VP8X') return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (chunk === 'VP8L') {
      const b = bytes.readUInt32LE(21);
      return { width: 1 + (b & 0x3fff), height: 1 + ((b >> 14) & 0x3fff) };
    }
    if (chunk === 'VP8 ') return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    return null;
  }
  if (contentType === 'image/jpeg') {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1]!;
      // SOF0–SOF15 carry the frame size, except DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
      }
      i += 2 + bytes.readUInt16BE(i + 2);
    }
  }
  return null;
}

export async function uploadPublicAsset(file: { name: string; type: string; bytes: Buffer }, label: string, uploadedBy: string): Promise<PublicAsset> {
  const declared = file.type && file.type !== 'application/octet-stream' ? file.type : '';
  const type = PUBLIC_ASSET_TYPES[declared] ? declared : (BY_EXTENSION[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? declared);
  const spec = PUBLIC_ASSET_TYPES[type];
  if (!spec) throw new AssetError('Upload a JPG, PNG or WebP image, an MP3 or M4A audio file, a PDF, or a WebVTT caption file.');
  if (file.bytes.length === 0) throw new AssetError('The file is empty.');
  if (file.bytes.length > spec.maxBytes) throw new AssetError(`That file is over ${Math.round(spec.maxBytes / 1024 / 1024)} MB.`);
  if (!sniffMatches(type, file.bytes.subarray(0, 16))) throw new AssetError('The file does not look like the type it claims to be.');

  let size: { width: number; height: number } | null = null;
  if (spec.kind === 'image') {
    size = imageSize(file.bytes, type);
    if (!size || size.width < 1 || size.height < 1) throw new AssetError('The image dimensions could not be read. Re-export it as JPG or PNG.');
  }

  const id = newId();
  const filename = safeFilename(file.name, spec.ext);
  const storageKey = `site/${id}.${spec.ext}`;
  await getStorage().put(storageKey, file.bytes, type);
  return getStore().insert('public_assets', {
    id,
    kind: spec.kind,
    filename,
    contentType: type,
    size: file.bytes.length,
    storageKey,
    width: size?.width ?? null,
    height: size?.height ?? null,
    label: label.trim().slice(0, 200) || filename,
    uploadedBy,
    createdAt: new Date().toISOString(),
  });
}

/** The asset an /assets/… path points at, if it is one of ours. */
export async function assetForPath(src: string): Promise<PublicAsset | null> {
  const m = /^\/assets\/([a-z0-9-]+)\//.exec(src);
  return m ? getStore().get('public_assets', m[1]!) : null;
}
