/**
 * Accessibility preferences and helpers.
 *
 * Preferences are stored on the device only and applied as data attributes on
 * <html>, where the design tokens pick them up. They add to, and never
 * override, what the operating system already asks for.
 */

export type TextSize = 'standard' | 'large' | 'larger';

export interface AccessibilityPrefs {
  textSize: TextSize;
  /** `system` follows the device; `more` forces higher contrast. */
  contrast: 'system' | 'more';
  /** `system` follows the device; `reduce` switches animation off. */
  motion: 'system' | 'reduce';
  /** Loads the smallest image sizes and never preloads. For low or costly data. */
  dataSaver: boolean;
}

export const DEFAULT_PREFS: AccessibilityPrefs = {
  textSize: 'standard',
  contrast: 'system',
  motion: 'system',
  dataSaver: false,
};

export const PREFS_KEY = 'hao.prefs.v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadPrefs(storage: StorageLike): AccessibilityPrefs {
  try {
    const raw = storage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<AccessibilityPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(storage: StorageLike, prefs: AccessibilityPrefs): void {
  try {
    storage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: the preference still applies for this page view.
  }
}

/** Applies preferences to the document root. Safe to call repeatedly. */
export function applyPrefs(root: HTMLElement, prefs: AccessibilityPrefs): void {
  const set = (name: string, value: string | null) => {
    if (value === null) root.removeAttribute(name);
    else root.setAttribute(name, value);
  };
  set('data-text-size', prefs.textSize === 'standard' ? null : prefs.textSize);
  set('data-contrast', prefs.contrast === 'more' ? 'more' : null);
  set('data-motion', prefs.motion === 'reduce' ? 'reduce' : null);
  set('data-saver', prefs.dataSaver ? 'on' : null);
}

/**
 * Inline script that applies stored preferences before first paint, so a person
 * who chose larger text never sees the page jump.
 */
export const prefsBootScript = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  PREFS_KEY,
)})||'{}'),r=document.documentElement;if(p.textSize&&p.textSize!=='standard')r.setAttribute('data-text-size',p.textSize);if(p.contrast==='more')r.setAttribute('data-contrast','more');if(p.motion==='reduce')r.setAttribute('data-motion','reduce');if(p.dataSaver)r.setAttribute('data-saver','on');}catch(e){}})();`;

/* ------------------------------------------------------------------ */
/* Live announcements                                                  */
/* ------------------------------------------------------------------ */

export const LIVE_REGION_ID = 'hao-live-region';

/**
 * Announces a short message to screen readers without moving focus. The app
 * renders one polite live region with `LIVE_REGION_ID`; if it is missing (for
 * example in a unit test) one is created.
 */
export function announce(message: string): void {
  if (typeof document === 'undefined') return;
  let region = document.getElementById(LIVE_REGION_ID);
  if (!region) {
    region = document.createElement('div');
    region.id = LIVE_REGION_ID;
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.className = 'visually-hidden';
    document.body.appendChild(region);
  }
  // Clearing first makes an identical message announce again.
  region.textContent = '';
  const target = region;
  window.setTimeout(() => {
    target.textContent = message;
  }, 50);
}

/** Moves focus to the page's main heading after a client-side navigation. */
export function focusMainHeading(root: ParentNode = document): void {
  const heading = root.querySelector<HTMLElement>('main h1');
  if (!heading) return;
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Contrast maths (used by design-token tests)                         */
/* ------------------------------------------------------------------ */

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
