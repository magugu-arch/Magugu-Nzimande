export * from './color';
export * from './contrast';
export * from './type';
export * from './layout';
export * from './motion';

/**
 * Provenance of every value in this package. Shown in the app's About screen
 * and the admin dashboard so nobody mistakes the proposal for approved CI.
 */
export const tokenSource = {
  status: 'proposed',
  reference: 'Kaizer Chiefs One App brief, 10 November 2026',
  note: 'Proposed digital values only. Confirm against the official club CI manual before release.',
} as const;
