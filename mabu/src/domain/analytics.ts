/**
 * Typed analytics — brief §27 and §47.
 *
 * Privacy-conscious by construction: properties are a closed set of
 * primitives, and there is no field for a name, email or phone. The guest id
 * is an opaque internal id.
 *
 * Tracking can never break a transaction (§48): `track` swallows every error,
 * synchronous or not, and returns nothing a caller could await on.
 */
export type MabuEvent =
  | 'home_viewed'
  | 'menu_viewed'
  | 'menu_item_viewed'
  | 'wine_item_viewed'
  | 'booking_started'
  | 'availability_checked'
  | 'booking_slot_selected'
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_rescheduled'
  | 'booking_cancelled'
  | 'reservation_created'
  | 'reservation_failed'
  | 'reservation_cancelled'
  | 'waitlist_joined'
  | 'waitlist_matched'
  | 'visit_completed'
  | 'event_viewed'
  | 'event_booking_started'
  | 'event_booking_completed'
  | 'voucher_viewed'
  | 'voucher_purchase_started'
  | 'voucher_purchase_completed'
  | 'favourite_added'
  | 'directions_opened'
  | 'call_started'
  | 'email_started'
  | 'reorder_started'
  | 'order_created'
  | 'reward_account_created'
  | 'reward_points_earned'
  | 'reward_viewed'
  | 'reward_redeemed'
  | 'reward_expiry_viewed'
  | 'notification_permission_requested'
  | 'notification_sent'
  | 'notification_opened'
  | 'notification_failed'
  | 'notification_preferences_updated';

export type AnalyticsProps = Record<string, string | number | boolean | undefined>;

export interface AnalyticsSink {
  send(event: MabuEvent, props: AnalyticsProps, at: string): void | Promise<void>;
}

export class Analytics {
  readonly log: { event: MabuEvent; props: AnalyticsProps; at: string }[] = [];
  private sinks: AnalyticsSink[] = [];

  addSink(sink: AnalyticsSink): void {
    this.sinks.push(sink);
  }

  track(event: MabuEvent, props: AnalyticsProps = {}): void {
    const at = new Date().toISOString();
    this.log.push({ event, props, at });
    if (this.log.length > 500) this.log.shift();
    for (const sink of this.sinks) {
      try {
        const result = sink.send(event, props, at);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(() => undefined);
        }
      } catch {
        // Deliberately silent: analytics is never allowed to fail a guest action.
      }
    }
  }
}
