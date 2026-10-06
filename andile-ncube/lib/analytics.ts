/**
 * Analytics boundary. Components call `track()` and nothing else; which vendor
 * receives the events is decided here.
 *
 * Events are pushed onto `window.dataLayer`, which Google Tag Manager, Segment
 * and most tag managers read directly, and re-dispatched as an `analytics`
 * DOM event for anything else. No vendor script is loaded by this site — until
 * one is added, events go nowhere except the console in development.
 *
 * Primary funnel: VISITOR → WATCH / EXPLORE → PARTNERSHIP → ENQUIRY.
 */

export type AnalyticsEvent =
  | "hero_cta"
  | "watch_click"
  | "episode_start"
  | "episode_complete"
  | "slate_click"
  | "sponsor_category_view"
  | "partnership_start"
  | "partnership_complete"
  | "deck_download"
  | "press_download"
  | "journal_read";

const funnelStep: Partial<Record<AnalyticsEvent, string>> = {
  watch_click: "watch_explore",
  slate_click: "watch_explore",
  episode_start: "watch_explore",
  sponsor_category_view: "watch_explore",
  partnership_start: "partnership",
  deck_download: "partnership",
  partnership_complete: "enquiry",
};

type Props = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function track(event: AnalyticsEvent, props: Props = {}) {
  if (typeof window === "undefined") return;
  const detail = { event, funnel_step: funnelStep[event] ?? null, ...props };
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(detail);
  window.dispatchEvent(new CustomEvent("analytics", { detail }));
  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", detail);
  }
}
