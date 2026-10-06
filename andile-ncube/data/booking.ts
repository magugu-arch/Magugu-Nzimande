/**
 * Booking fixture: the call types and the rules that generate sample
 * availability. No real calendar is connected — the page labels every slot as
 * sample data, and a request made against it books nothing. To go live, point
 * the page's BOOKING_ENDPOINT at a scheduling backend (Cal.com, Calendly's API,
 * Microsoft Bookings or your own) that returns real free/busy and accepts the
 * same request payload.
 *
 * South Africa has no daylight saving, so SAST is a fixed UTC+2 offset.
 */

export type BookingType = {
  id: string;
  name: string;
  minutes: number;
  summary: string;
  format: string;
};

export const booking = {
  mode: "fixture" as const,
  timezone: "Africa/Johannesburg",
  tzLabel: "SAST",
  utcOffsetMinutes: 120,
  /** How far ahead people can book. */
  horizonDays: 42,
  /** Earliest bookable slot, measured from now. */
  minNoticeHours: 24,
  /** ISO weekday numbers: 1 = Monday … 7 = Sunday. */
  workingDays: [1, 2, 3, 4, 5],
  hours: { start: "09:00", end: "17:00" },
  slotStepMinutes: 30,
  /** Fixture shaping: share of slots shown as taken, and of days fully booked. */
  busyRatio: 0.38,
  fullDayRatio: 0.08,
  seed: 6889,
  /** South African public holidays inside or near the booking window. */
  closedDates: [
    { date: "2026-12-16", label: "Day of Reconciliation" },
    { date: "2026-12-25", label: "Christmas Day" },
    { date: "2026-12-26", label: "Day of Goodwill" },
    { date: "2027-01-01", label: "New Year's Day" },
  ],
  types: [
    {
      id: "partnership-call",
      name: "Partnership call",
      minutes: 30,
      summary: "An introduction: your brand, the Flagship and where a partnership could sit.",
      format: "Video call",
    },
    {
      id: "category-deep-dive",
      name: "Category deep-dive",
      minutes: 60,
      summary: "One sponsor category in detail — placement, content opportunities and inventory.",
      format: "Video call",
    },
    {
      id: "co-production",
      name: "Co-production conversation",
      minutes: 45,
      summary: "Formats, the Slate and terms for building something together.",
      format: "Video call",
    },
    {
      id: "media-request",
      name: "Media request",
      minutes: 20,
      summary: "Interviews, features and press access.",
      format: "Phone or video",
    },
  ] satisfies BookingType[],
};
