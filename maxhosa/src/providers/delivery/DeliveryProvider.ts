import type {
  DeliveryExceptionKind,
  DeliveryMode,
  DeliveryPreference,
  DeliveryTracking,
} from '@/domain/types';

/**
 * Shipment tracking, kept apart from commerce: the platform owns the order and
 * its fulfilment; the courier (or a shipping aggregator) owns scans, the
 * estimate and — only for a contracted last-mile service — a live position.
 *
 * In production the app talks to MAXHOSA's integration service, which
 * verifies courier webhooks, de-duplicates events and normalises codes. The
 * app never calls a courier API directly or holds its credentials.
 */
export interface DeliveryProvider {
  readonly id: string;
  readonly isMock: boolean;

  getTracking(orderId: string): Promise<DeliveryTracking | null>;

  /** Pushed updates (webhook → service → app). Returns an unsubscribe. */
  subscribe(orderId: string, listener: (t: DeliveryTracking) => void): () => void;

  /**
   * Ask the courier to change where or how the parcel is left. Resolves only
   * once the provider has acknowledged it; rejects if it refuses (e.g. past
   * its cut-off). The app never says "saved" before this resolves.
   */
  requestPreference(
    orderId: string,
    preference: Omit<DeliveryPreference, 'acknowledgedAt'>,
  ): Promise<DeliveryPreference>;
}

/** Presenter controls. Exists only on the mock — production has no such door. */
export interface DemoDeliveryControls {
  advance(orderId: string): void;
  setMode(orderId: string, mode: DeliveryMode): void;
  setException(orderId: string, exception: DeliveryExceptionKind | null): void;
  setStale(orderId: string, stale: boolean): void;
  injectUnknownEvent(orderId: string): void;
  reset(orderId: string): void;
}
