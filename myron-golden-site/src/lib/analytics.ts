/**
 * Conversion events from brief §13: CTA clicks, form starts, successful leads,
 * book outbound clicks, event registration starts and checkout completion.
 * Nothing is sent unless GA is configured *and* the visitor has opted in.
 */
export type AnalyticsEvent =
  | 'cta_click'
  | 'form_start'
  | 'lead_success'
  | 'newsletter_signup'
  | 'book_outbound_click'
  | 'program_outbound_click'
  | 'event_registration_start'
  | 'checkout_complete';

export const CONSENT_KEY = 'mg-consent-v1';
export type ConsentState = 'granted' | 'denied' | null;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __mgAnalyticsConsent?: boolean;
  }
}

export function readConsent(): ConsentState {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: Exclude<ConsentState, null>) {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Storage blocked: the choice holds for this page view only.
  }
  window.__mgAnalyticsConsent = value === 'granted';
  window.dispatchEvent(new CustomEvent('mg-consent', { detail: value }));
}

export function track(event: AnalyticsEvent, params: Record<string, string | number> = {}) {
  if (typeof window === 'undefined' || !window.__mgAnalyticsConsent || !window.gtag) return;
  window.gtag('event', event, params);
}
