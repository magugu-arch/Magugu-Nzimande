import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  PREFS_KEY,
  applyPrefs,
  contrastRatio,
  loadPrefs,
  prefsBootScript,
  savePrefs,
} from './index';

describe('preferences', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-text-size');
    document.documentElement.removeAttribute('data-contrast');
    document.documentElement.removeAttribute('data-motion');
    document.documentElement.removeAttribute('data-saver');
  });

  it('round-trips through storage and falls back to defaults', () => {
    expect(loadPrefs(window.localStorage)).toEqual(DEFAULT_PREFS);
    savePrefs(window.localStorage, { ...DEFAULT_PREFS, textSize: 'larger', dataSaver: true });
    expect(loadPrefs(window.localStorage)).toMatchObject({ textSize: 'larger', dataSaver: true });
    window.localStorage.setItem(PREFS_KEY, 'not json');
    expect(loadPrefs(window.localStorage)).toEqual(DEFAULT_PREFS);
  });

  it('applies and removes data attributes on the root element', () => {
    const root = document.documentElement;
    applyPrefs(root, { textSize: 'large', contrast: 'more', motion: 'reduce', dataSaver: true });
    expect(root.dataset.textSize).toBe('large');
    expect(root.dataset.contrast).toBe('more');
    expect(root.dataset.motion).toBe('reduce');
    expect(root.dataset.saver).toBe('on');
    applyPrefs(root, DEFAULT_PREFS);
    expect(root.hasAttribute('data-text-size')).toBe(false);
    expect(root.hasAttribute('data-contrast')).toBe(false);
  });

  it('boot script applies stored preferences before the app loads', () => {
    savePrefs(window.localStorage, { ...DEFAULT_PREFS, textSize: 'larger', contrast: 'more' });
    // Run the inline boot script exactly as the page does.
    new Function(prefsBootScript)();
    expect(document.documentElement.dataset.textSize).toBe('larger');
    expect(document.documentElement.dataset.contrast).toBe('more');
  });
});

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });
});
