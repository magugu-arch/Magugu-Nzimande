import type {
  DeliveryCreateRequest,
  DeliveryJob,
  DeliveryProvider,
  DeliveryQuote,
  DeliveryQuoteRequest,
  DeliveryStatus,
} from '@/types/delivery';

/**
 * The only provider that ships (brief §5, §12).
 *
 * It exists so the courier leg is exercised end to end — in tests, in the
 * browser audits and in a demo build — without a contract, a key or a network
 * call. It is not a stand-in that will "become" a real provider: an authorised
 * integration is a sibling file implementing the same interface, and this one
 * stays exactly as it is for tests.
 *
 * Two rules it follows deliberately, because a mock that is kinder than the
 * world hides the defects it was built to catch:
 *
 *   - It refuses a dropoff it cannot locate. An address with no coordinates is
 *     not serviceable, rather than quietly serviceable. The app has been bitten
 *     by exactly this once already, when a missing coordinate defaulted to the
 *     Johannesburg CBD and the radius rule started measuring from a constant.
 *   - It reports `trackingAvailable: false`. No real courier network grants a
 *     live position without authorisation, so the default has to be the
 *     unauthorised one or the tracking map would only ever be developed against
 *     the permissive case.
 */

/** How long a quote stands. Short, because a courier quote is perishable. */
const QUOTE_TTL_MINUTES = 5;

/** The courier leg, in order. `getStatus` walks it against the wall clock. */
const PROGRESSION: { status: DeliveryStatus; afterMinutes: number }[] = [
  { status: 'CONFIRMED', afterMinutes: 0 },
  { status: 'COURIER_ASSIGNED', afterMinutes: 2 },
  { status: 'PICKED_UP', afterMinutes: 6 },
  { status: 'ON_THE_WAY', afterMinutes: 8 },
  { status: 'DELIVERED', afterMinutes: 24 },
];

interface MockJob {
  job: DeliveryJob;
  createdAt: number;
  cancelled: boolean;
  /** The courier gave up. See `seedFailedDeliveryJob`. */
  failed: boolean;
  /** The provider is authorised to report a position. See `seedTrackedDeliveryJob`. */
  tracked?: boolean;
  /**
   * What the customer told the driver, as this provider was given it.
   *
   * A real network puts this in front of the courier; a mock has no courier to
   * put it in front of. Kept anyway, and readable through `mockDropoffBriefing`,
   * because the thing worth proving is that the provider was *told* — and for
   * most of this app's life it was not. Storing it is the only way a test can
   * tell "the customer left no note" from "the note was dropped on the way".
   */
  dropoffInstructions?: string;
}

/** Keyed by job id, and by idempotency key so a retry returns the same job. */
const jobs = new Map<string, MockJob>();
const byIdempotencyKey = new Map<string, string>();

let sequence = 0;

/** Drop everything. Tests only — a shared ledger across cases is a shared bug. */
export function resetMockDeliveryJobs(): void {
  jobs.clear();
  byIdempotencyKey.clear();
  sequence = 0;
}

/**
 * What this provider was told about reaching the door, for the job named.
 *
 * Mock-only, and the only reason it exists is that "nothing arrived" and
 * "nothing was sent" look identical from outside a courier network. Undefined
 * means the request carried no instructions.
 */
export function mockDropoffBriefing(externalJobId: string): string | undefined {
  return jobs.get(externalJobId)?.dropoffInstructions;
}

/**
 * A courier leg the network called off, with its own reason.
 *
 * `CANCELLED` is a member of `DeliveryStatus` and `PROGRESSION` walks straight
 * past it, so — like `FAILED` before it — the mock had never once produced one.
 * It is a different event from a customer cancelling their order: the food was
 * made, the job was accepted, and the network handed it back. `attachDelivery`
 * is explicit that this must not cancel the customer's order, and until now
 * nothing had ever put that rule to the test.
 */
export function seedCancelledDeliveryJob(externalJobId: string, createdAt: number): DeliveryJob {
  const job: DeliveryJob = {
    externalJobId,
    provider: 'mock',
    status: 'CANCELLED',
    trackingAvailable: false,
    reason: 'No driver was available in the area, so the trip was handed back to the store.',
    updatedAt: new Date(createdAt).toISOString(),
  };

  jobs.set(externalJobId, { job, createdAt, cancelled: true, failed: false });
  return { ...job };
}

/**
 * A courier network authorised to report a position that has not reported one.
 *
 * The ordinary first minute of any tracked delivery: the grant is in place, the
 * driver is assigned, and no fix has come in yet. `seedTrackedDeliveryJob`
 * always arrives with a position, so `trackingAvailable: true` and
 * `courierPosition: undefined` — a pair the type has always allowed — had never
 * been rendered together.
 */
export function seedAwaitingPositionJob(externalJobId: string, createdAt: number): DeliveryJob {
  const job: DeliveryJob = {
    externalJobId,
    provider: 'mock',
    status: 'COURIER_ASSIGNED',
    etaMinutes: 21,
    courierName: 'Naledi',
    trackingAvailable: true,
    updatedAt: new Date(createdAt).toISOString(),
  };

  jobs.set(externalJobId, { job, createdAt, cancelled: false, failed: false, tracked: true });
  return { ...job };
}

/**
 * A courier leg that ended without the food changing hands.
 *
 * `FAILED` is a member of `DeliveryStatus` — nobody home, the gate locked, an
 * address that turned out not to exist — and `PROGRESSION` walks straight from
 * `ON_THE_WAY` to `DELIVERED`, so the mock had never once produced it. A mock
 * kinder than the world hides the defects it was built to catch, and this one
 * hid two: `deliveryStatusToOrderStatus` maps `FAILED` to `'ready'`, and
 * `CourierTracking` counts only `DELIVERED` and `CANCELLED` as settled.
 *
 * Mock-only, like `resetMockDeliveryJobs`. A real provider reports its own
 * failures; this is how the seeded order gets one to report.
 */
export function seedFailedDeliveryJob(externalJobId: string, createdAt: number): DeliveryJob {
  const job: DeliveryJob = {
    externalJobId,
    provider: 'mock',
    status: 'FAILED',
    trackingAvailable: false,
    /**
     * Why it ended, which no job had ever carried.
     *
     * `reason` is on `DeliveryJob` and only `quote` ever filled it in — for a
     * dropoff it could not route. A job that *ended* had no way to say why, so
     * the tracking card could only give the customer the generic sentence and
     * the one fact they actually want was on the type, unused.
     */
    reason: 'Nobody answered at the gate, and the driver could not leave it unattended.',
    updatedAt: new Date(createdAt).toISOString(),
  };

  jobs.set(externalJobId, { job, createdAt, cancelled: false, failed: true });
  return { ...job };
}

/**
 * A courier network that is authorised to say where its driver is.
 *
 * `trackingAvailable` is `false` on every job the mock creates, deliberately —
 * no real network grants a live position without authorisation, and developing
 * only against the permissive case is how a screen ends up assuming one. The
 * cost was that the authorised branch never ran either: `CourierTracking` draws
 * a slot for the map and prints when the position was last reported, and that
 * slot had never been rendered.
 *
 * Still no map. Drawing a fake one would be worse than none — §12 puts mapping
 * behind its own contract and credentials. What this exercises is the surface
 * that receives one, and the sentence beside it.
 */
export function seedTrackedDeliveryJob(
  externalJobId: string,
  createdAt: number,
  position: { latitude: number; longitude: number },
): DeliveryJob {
  const job: DeliveryJob = {
    externalJobId,
    provider: 'mock',
    status: 'ON_THE_WAY',
    etaMinutes: 9,
    courierName: 'Sipho',
    trackingAvailable: true,
    courierPosition: { ...position, reportedAt: new Date(createdAt).toISOString() },
    updatedAt: new Date(createdAt).toISOString(),
  };

  jobs.set(externalJobId, { job, createdAt, cancelled: false, failed: false, tracked: true });
  return { ...job };
}

function statusAt(createdAt: number, now: number): DeliveryStatus {
  const elapsed = (now - createdAt) / 60_000;
  let reached: DeliveryStatus = 'CONFIRMED';
  for (const step of PROGRESSION) {
    if (elapsed >= step.afterMinutes) reached = step.status;
  }
  return reached;
}

function minutesRemaining(createdAt: number, now: number): number {
  const total = PROGRESSION[PROGRESSION.length - 1]!.afterMinutes;
  return Math.max(0, Math.round(total - (now - createdAt) / 60_000));
}

/**
 * Who is carrying it, if anybody is — and in one place, because it was in two.
 *
 * A name only once somebody is actually assigned. Before that there is no
 * driver, and inventing one puts a stranger's name on a customer's screen.
 *
 * `getStatus` had this rule and `create` did not, which looked harmless
 * because a freshly created job is normally `CONFIRMED` and nobody is on it
 * yet. It is not harmless here: `create` anchors the leg to `readyAt` rather
 * than to the moment it was asked, deliberately — a client-side mock can only
 * create a job when somebody reads — so it can and does return a job that is
 * already `ON_THE_WAY`. It returned that job with no courier on it.
 *
 * What a customer saw, on the screen a hungry person actually watches: "Out
 * for delivery · Your driver has collected the order and is on the way", and
 * no driver anywhere on the card, because the card will not name somebody it
 * has not been told about. Then a second later the next fetch called
 * `getStatus`, the same job answered with a name, and a driver blinked into
 * existence. One rule, two implementations, and only one of them had it.
 */
function courierFor(status: DeliveryStatus): { courierName?: string } {
  return status === 'COURIER_ASSIGNED' || status === 'PICKED_UP' || status === 'ON_THE_WAY'
    ? { courierName: 'Sipho' }
    : {};
}

export const mockDeliveryProvider: DeliveryProvider = {
  name: 'mock',

  quote(input: DeliveryQuoteRequest): Promise<DeliveryQuote> {
    const locatable = input.dropoffLatitude !== undefined && input.dropoffLongitude !== undefined;

    return Promise.resolve(
      locatable
        ? {
            // A flat quote, and flagged as such: what a courier network charges
            // is theirs to say, and inventing a distance-based tariff here
            // would put a number in front of somebody that nobody has agreed.
            feeRand: 32,
            etaMinutes: PROGRESSION[PROGRESSION.length - 1]!.afterMinutes,
            serviceable: true,
            expiresAt: new Date(Date.now() + QUOTE_TTL_MINUTES * 60_000).toISOString(),
          }
        : {
            feeRand: 0,
            etaMinutes: 0,
            serviceable: false,
            reason: 'The dropoff address has no coordinates, so it cannot be routed.',
            expiresAt: new Date(Date.now() + QUOTE_TTL_MINUTES * 60_000).toISOString(),
          },
    );
  },

  create(input: DeliveryCreateRequest): Promise<DeliveryJob> {
    // The retry rule, and the reason `idempotencyKey` is on the request at all:
    // one order must never become two courier jobs.
    const existingId = byIdempotencyKey.get(input.idempotencyKey);
    const existing = existingId ? jobs.get(existingId) : undefined;
    if (existing) return Promise.resolve({ ...existing.job });

    sequence += 1;
    const externalJobId = `mock-job-${sequence}`;
    // Anchored to when the food was ready, not to when the job was asked for.
    // Those are the same instant against a real backend and are not here,
    // because a client-side mock can only create a job when somebody reads.
    const requestedAt = Date.now();
    const readyAt = input.readyAt ? new Date(input.readyAt).getTime() : requestedAt;
    const now = Number.isFinite(readyAt) ? Math.min(readyAt, requestedAt) : requestedAt;
    const status = statusAt(now, requestedAt);
    const job: DeliveryJob = {
      externalJobId,
      provider: 'mock',
      status,
      etaMinutes: minutesRemaining(now, requestedAt),
      // Named here too, not only in `getStatus`: anchoring to `readyAt` means
      // a job can be born already on the road.
      ...courierFor(status),
      // Unauthorised by default — see the note at the top of this file.
      trackingAvailable: false,
      updatedAt: new Date(requestedAt).toISOString(),
    };

    jobs.set(externalJobId, {
      job,
      createdAt: now,
      cancelled: false,
      failed: false,
      ...(input.dropoffInstructions ? { dropoffInstructions: input.dropoffInstructions } : {}),
    });
    byIdempotencyKey.set(input.idempotencyKey, externalJobId);
    return Promise.resolve({ ...job });
  },

  getStatus(externalJobId: string): Promise<DeliveryJob> {
    const record = jobs.get(externalJobId);
    if (!record) return Promise.reject(new Error(`No such delivery job: ${externalJobId}`));

    const now = Date.now();
    // A failed leg is terminal: the courier is not going to try again on a
    // timer, so the wall clock must not walk it on to DELIVERED.
    // A tracked job is a seeded fixture rather than a leg on a timer, so the
    // wall clock must not walk it past where it was put.
    const status = record.tracked
      ? record.job.status
      : record.failed
        ? 'FAILED'
        : record.cancelled
          ? 'CANCELLED'
          : statusAt(record.createdAt, now);
    const updated: DeliveryJob = {
      ...record.job,
      status,
      ...(status === 'DELIVERED' || status === 'CANCELLED' || status === 'FAILED'
        ? {}
        : { etaMinutes: minutesRemaining(record.createdAt, now) }),
      ...courierFor(status),
      updatedAt: new Date(now).toISOString(),
    };

    record.job = updated;
    return Promise.resolve({ ...updated });
  },

  cancel(externalJobId: string): Promise<void> {
    const record = jobs.get(externalJobId);
    if (!record) return Promise.reject(new Error(`No such delivery job: ${externalJobId}`));
    record.cancelled = true;
    return Promise.resolve();
  },
};
