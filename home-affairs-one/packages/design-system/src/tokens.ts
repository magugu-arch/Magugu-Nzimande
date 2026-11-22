/**
 * Brand values from the product brief (§9), mirrored from tokens.css for docs
 * and tests. The CSS file is what the browser uses. The product arranges them
 * as a dark theme: ink page, ivory type, Warm Gold as the single accent.
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
  midnightNavy: 'Brand bands and panels; taken down to ink for the page.',
  actionBlue: 'Informational fills and markers.',
  teal: 'Secondary emphasis and informational tags.',
  successGreen: 'Completed and verified states.',
  warmGold: 'The accent: primary buttons, links, rules, the mark; attention states.',
  surface: 'Paper: the light surface the product turns to when it is printed.',
  errorRed: 'Critical error and destructive action only.',
};

/** The CSS custom property that carries each brand colour. */
export const brandColorVar: Record<keyof typeof brandColors, string> = {
  midnightNavy: '--navy-900',
  actionBlue: '--blue-600',
  teal: '--teal-600',
  successGreen: '--green-600',
  warmGold: '--gold-500',
  surface: '--paper',
  errorRed: '--red-600',
};
