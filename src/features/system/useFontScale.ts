import { useEffect, useState } from 'react';
import { PixelRatio, Platform } from 'react-native';

/**
 * How much larger the reader has asked for text to be, as a multiplier.
 *
 * On iOS and Android this is the OS text-size setting and React Native already
 * applies it to every `Text` — `PixelRatio.getFontScale()` is only read here so
 * that components which have to *react* to it (see `Button`, which takes a
 * second line once text is enlarged) get the same number the renderer used.
 *
 * On web it is a defect being fixed rather than a number being read.
 *
 * ── What was wrong ─────────────────────────────────────────────────────────
 * React Native Web hard-codes `fontScale: 1` in `Dimensions`, and it emits
 * every `fontSize` as an absolute pixel value. Between the two, an RNW app
 * ignores the browser's own text-size setting completely: a reader who sets
 * Chrome or Safari to its largest text size gets an app that does not move.
 * That is not a testing inconvenience, it is WCAG 1.4.4 — text has to scale to
 * 200% without loss of content or function — and the web build failed it
 * outright while the native builds passed.
 *
 * It also had a second cost, which is what surfaced it. `audit:launch` carried
 * an item saying the browser sweep was "blind to" font scale and that enlarged
 * text could only be checked by hand on a device. That was true, and it meant
 * the one accessibility rule most likely to break a dense screen was the one
 * rule nothing in this repository could check.
 *
 * ── What this does ─────────────────────────────────────────────────────────
 * A browser expresses its text-size setting as the root element's computed font
 * size: 16px is the default, "Very large" is 24px, and a page is expected to
 * scale relative to it. So the scale is that size over 16, which is exactly the
 * multiplier the OS hands a native app, and `Text` applies it the same way
 * React Native does — including the per-variant caps in `fontScaleCapFor`, so
 * chrome and content behave identically on all three platforms.
 *
 * Read live rather than once: browser text size can change while a page is
 * open. `resize` fires on a zoom change, and the poll catches a settings change
 * that fires nothing at all — two seconds is far below the threshold at which
 * anybody notices, and the work is one `getComputedStyle` call.
 */
const WEB_BASE_FONT_SIZE = 16;

function readWebFontScale(): number {
  if (typeof document === 'undefined') return 1;
  try {
    const root = document.documentElement;
    const size = Number.parseFloat(window.getComputedStyle(root).fontSize);
    if (!Number.isFinite(size) || size <= 0) return 1;
    return size / WEB_BASE_FONT_SIZE;
  } catch {
    // A hostile or sandboxed document can refuse `getComputedStyle`. Reading
    // nothing is better than throwing inside a render.
    return 1;
  }
}

/** The current scale, without subscribing. For non-reactive callers and tests. */
export function currentFontScale(): number {
  return Platform.OS === 'web' ? readWebFontScale() : PixelRatio.getFontScale();
}

export function useFontScale(): number {
  const [scale, setScale] = useState(currentFontScale);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const sync = () =>
      setScale((previous) => {
        const next = readWebFontScale();
        // Compared rather than set: an unchanged value must not re-render the
        // whole tree every two seconds.
        return Math.abs(next - previous) < 0.001 ? previous : next;
      });

    window.addEventListener('resize', sync);
    const timer = setInterval(sync, 2000);
    return () => {
      window.removeEventListener('resize', sync);
      clearInterval(timer);
    };
  }, []);

  return scale;
}

/**
 * The scale one piece of text may actually use, after its role's ceiling.
 *
 * `fontScaleCapFor` returns `undefined` for content, which is React Native's
 * way of spelling "no limit"; here that has to become a number, because the
 * multiplication is being done rather than delegated.
 */
export function cappedFontScale(scale: number, cap: number | undefined): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  // Never shrinks. A browser set below 16px is a reader who has asked for
  // smaller text everywhere, and honouring that in an app whose touch targets
  // are sized in points would push labels under the 44x44 floor.
  const atLeastOne = Math.max(1, scale);
  return cap === undefined ? atLeastOne : Math.min(atLeastOne, cap);
}
