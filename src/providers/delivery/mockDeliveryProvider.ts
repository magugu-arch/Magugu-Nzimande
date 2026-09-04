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

    jobs.set(externalJobId, { job, createdAt: now, cancelled: false });
    byIdempotencyKey.set(input.idempotencyKey, externalJobId);
    return Promise.resolve({ ...job });
  },

  getStatus(externalJobId: string): Promise<DeliveryJob> {
    const record = jobs.get(externalJobId);
    if (!record) return Promise.reject(new Error(`No such delivery job: ${externalJobId}`));

    const now = Date.now();
    const status = record.cancelled ? 'CANCELLED' : statusAt(record.createdAt, now);
    const updated: DeliveryJob = {
      ...record.job,
      status,
      ...(status === 'DELIVERED' || status === 'CANCELLED'
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
