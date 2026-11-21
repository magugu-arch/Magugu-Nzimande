/**
 * Brand values from the product brief (§9), mirrored from tokens.css for docs
 * and tests. The CSS file is what the browser uses.
 */
export const brandColors = {
  midnightNavy: '#102a43',
  actionBlue: '#1261a0',
  teal: '#0f766e',
  successGreen: '#1a7f5a',
  warmGold: '#d5a52a',
  surface: '#f2f6f9',
  errorRed: '#c83b3b',
} as const;

export const brandColorUse: Record<keyof typeof brandColors, string> = {
  midnightNavy: 'Navigation, headings, trust surfaces.',
  actionBlue: 'Primary buttons, links, focus states.',
  teal: 'Secondary emphasis and informational tags.',
  successGreen: 'Completed and verified states.',
  warmGold: 'Attention and waiting states.',
  surface: 'Cards and panels.',
  errorRed: 'Critical error and destructive action only.',
};

/** The CSS custom property that carries each brand colour. */
export const brandColorVar: Record<keyof typeof brandColors, string> = {
  midnightNavy: '--navy-900',
  actionBlue: '--blue-600',
  teal: '--teal-600',
  successGreen: '--green-600',
  warmGold: '--gold-500',
  surface: '--surface-sunken',
  errorRed: '--red-600',
};
