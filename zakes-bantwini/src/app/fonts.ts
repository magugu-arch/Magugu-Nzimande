import localFont from 'next/font/local';

/**
 * Archivo (SIL OFL) — a contemporary grotesk with a width axis, so the same
 * family sets expanded monumental headlines and normal-width body copy.
 */
export const grotesk = localFont({
  src: [{ path: '../fonts/archivo-latin-wdth-normal.woff2', style: 'normal', weight: '100 900' }],
  variable: '--font-grotesk',
  display: 'swap',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

/** Instrument Serif (SIL OFL) — restrained editorial serif for statements and quotes. */
export const serif = localFont({
  src: [
    { path: '../fonts/instrument-serif-latin-400-normal.woff2', style: 'normal', weight: '400' },
    { path: '../fonts/instrument-serif-latin-400-italic.woff2', style: 'italic', weight: '400' },
  ],
  variable: '--font-serif',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});
