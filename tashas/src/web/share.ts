/**
 * Download HTML, native share and WhatsApp (brief §9).
 *
 * The page rebuilds a clean standalone document from its own immutable parts
 * (styles, embedded images, app code), so the saved file is the app itself
 * and opens offline. Inside the Claude artifact viewer the save goes through
 * the viewer's downloads capability; elsewhere through a normal download.
 * WhatsApp shares a link only when the app has a stable public HTTPS address;
 * a local file path or a sandbox frame URL is never sent.
 */

import { isArtifactViewer, sys } from './app.ts';

export const FILENAME = 'tashas-app.html';

export function standaloneHtml(): string {
  const part = (id: string) => document.getElementById(id)?.outerHTML ?? '';
  const title = document.querySelector('title')?.textContent ?? 'Tashas App Prototype';
  return [
    '<!doctype html>',
    '<html lang="en"><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    `<title>${title}</title>`,
    part('tashas-meta'),
    part('tashas-css'),
    '</head><body>',
    '<div id="app"></div>',
    part('tashas-images'),
    part('tashas-app'),
    '</body></html>',
  ].join('\n');
}

type Downloads = { save: (r: { filename: string; data: string | Blob }) => Promise<{ status: string }> };

async function viewerDownloads(): Promise<Downloads | null> {
  if (!isArtifactViewer()) return null;
  try {
    const claude = (window as unknown as { claude: { use: (n: string) => Promise<unknown> } }).claude;
    return (await claude.use('downloads')) as Downloads | null;
  } catch {
    return null;
  }
}

export type SaveOutcome = { ok: true; message: string } | { ok: false; message: string };

/** Offers a generated file: through the viewer if present, else a plain download. */
export async function saveFile(filename: string, data: string, mime: string): Promise<SaveOutcome> {
  const downloads = await viewerDownloads();
  if (downloads) {
    try {
      await downloads.save({ filename, data });
      return { ok: true, message: `Saved ${filename}` };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'declined') return { ok: false, message: 'Download cancelled.' };
      if (code === 'rejected_extension') return { ok: false, message: 'This viewer cannot save that file type.' };
      return { ok: false, message: 'Downloads are not available in this view.' };
    }
  }
  if (isArtifactViewer()) return { ok: false, message: 'Downloads are not available in this view.' };
  try {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { ok: true, message: `Downloading ${filename}` };
  } catch {
    return { ok: false, message: 'This browser blocked the download.' };
  }
}

export function downloadApp(): Promise<SaveOutcome> {
  return saveFile(FILENAME, standaloneHtml(), 'text/html;charset=utf-8');
}

/** Native share with feature detection; files only where the platform supports them. */
export async function shareApp(): Promise<SaveOutcome> {
  const url = publicUrl();
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share !== 'function') {
    return { ok: false, message: 'This browser has no share sheet. Use Download HTML and send the file.' };
  }
  try {
    const file = new File([standaloneHtml()], FILENAME, { type: 'text/html' });
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: 'Tashas app prototype' });
      return { ok: true, message: 'Shared' };
    }
    if (url) {
      await nav.share({ title: 'Tashas app prototype', url });
      return { ok: true, message: 'Shared' };
    }
    return { ok: false, message: 'This device cannot share files. Use Download HTML instead.' };
  } catch (err) {
    if ((err as Error).name === 'AbortError') return { ok: false, message: 'Share cancelled.' };
    return { ok: false, message: 'Sharing is not available here. Use Download HTML instead.' };
  }
}

/**
 * The address other people can open: the configured production URL, or this
 * page when it is served over HTTPS as a top-level page. Never a file:// path
 * and never the artifact's sandbox frame.
 */
export function publicUrl(): string | null {
  const configured = sys.db.get('settings', 'global')?.publicAppUrl;
  if (configured && /^https:\/\//.test(configured)) return configured;
  try {
    if (location.protocol === 'https:' && window.top === window.self && !isArtifactViewer()) {
      return location.href.split('#')[0]!;
    }
  } catch {
    /* cross-origin frame */
  }
  return null;
}

export function whatsappHref(url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`Tashas app prototype: ${url}`)}`;
}

/** Google Calendar template link: a plain HTTPS link that works everywhere. */
export function googleCalendarHref(input: { title: string; startsAt: number; minutes: number; details: string; location: string }): string {
  const fmt = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${fmt(input.startsAt)}/${fmt(input.startsAt + input.minutes * 60_000)}`,
    details: input.details,
    location: input.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function icsFile(input: { uid: string; title: string; startsAt: number; minutes: number; details: string; location: string }): string {
  const fmt = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tashas//Prototype//EN',
    'BEGIN:VEVENT',
    `UID:${input.uid}@tashas-prototype`,
    `DTSTAMP:${fmt(Date.now())}`,
    `DTSTART:${fmt(input.startsAt)}`,
    `DTEND:${fmt(input.startsAt + input.minutes * 60_000)}`,
    `SUMMARY:${esc(input.title)}`,
    `DESCRIPTION:${esc(input.details)}`,
    `LOCATION:${esc(input.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function mapsHref(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
