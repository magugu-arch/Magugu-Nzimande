/**
 * Image derivatives are embedded in the page as data URIs (the build reads the
 * 28 originals, derives web-sized WebP files and inlines them), so the single
 * HTML file works offline. Originals stay untouched in assets/originals.
 */

import { assetById } from '../content/assets.ts';

export interface EmbeddedImage {
  src: string;
  w: number;
  h: number;
}

let table: Record<string, EmbeddedImage> | null = null;

function load(): Record<string, EmbeddedImage> {
  if (table) return table;
  try {
    const el = document.getElementById('tashas-images');
    table = el?.textContent ? (JSON.parse(el.textContent) as Record<string, EmbeddedImage>) : {};
  } catch {
    table = {};
  }
  return table;
}

export function image(id: string): { src: string; alt: string; w: number; h: number } {
  const asset = assetById(id);
  const embedded = load()[id];
  return {
    src: embedded?.src ?? '',
    alt: asset.altText,
    w: embedded?.w ?? asset.width,
    h: embedded?.h ?? asset.height,
  };
}
