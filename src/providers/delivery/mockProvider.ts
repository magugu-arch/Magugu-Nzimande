import { businessRules } from '@/constants/config';
import type {
  DeliveryCreateRequest,
  DeliveryJob,
  DeliveryProvider,
  DeliveryQuoteRequest,
  DeliveryStatus,
} from './types';

/**
 * The only provider that exists, and it is deliberately not a real one.
 *
 * It answers the interface honestly rather than optimistically: it refuses a
 * dropoff it has no coordinate for, it expires its quotes, it never claims
 * `trackingAvailable`, and its statuses advance on a clock rather than jumping
 * to DELIVERED. That way the screens built against it meet the awkward cases
 * before a real integration does, instead of being written against a provider
 * that always says yes.
 */

const QUOTE_TTL_MINUTES = 10;

/** Jobs this process has dispatched, so `getStatus` has something to answer from. */
interface DispatchedJob {
  createdAt: number;
  etaMinutes: number;
  cancelled: boolean;
  courierName: string;
}

const jobs = new Map<string, DispatchedJob>();
/** Dispatches already made, by the key of the attempt that made them. */
const jobsByIdempotencyKey = new Map<string, string>();

let counter = 0;

/** Test seam: forget every quote and job. */
export function resetMockDeliveryProvider(): void {
  jobs.clear();
  jobsByIdempotencyKey.clear();
  counter = 0;
}

/**
 * Where a job has got to, from how long ago it was dispatched.
 *
 * Derived rather than stored so a caller cannot ask twice and get two
 * different stories, and so time passing is the only thing that moves it.
 */
export function statusFromElapsed(elapsedMinutes: number, etaMinutes: number): DeliveryStatus {
  if (elapsedMinutes >= etaMinutes) return 'DELIVERED';
  if (elapsedMinutes >= etaMinutes * 0.6) return 'ON_THE_WAY';
  if (elapsedMinutes >= etaMinutes * 0.3) return 'PICKED_UP';
  if (elapsedMinutes >= 2) return 'COURIER_ASSIGNED';
  return 'CONFIRMED';
}

function jobFor(externalJobId: string, dispatched: DispatchedJob, now: number): DeliveryJob {
  const elapsedMinutes = (now - dispatched.createdAt) / 60_000;
  const status: DeliveryStatus = dispatched.cancelled
    ? 'CANCELLED'
    : statusFromElapsed(elapsedMinutes, dispatched.etaMinutes);

  return {
    externalJobId,
    status,
    etaMinutes: Math.max(0, Math.round(dispatched.etaMinutes - elapsedMinutes)),
    courierName: dispatched.courierName,
    // A mock has no courier to follow, and saying otherwise would put a map on
    // the tracking screen with nothing to draw in it.
    trackingAvailable: false,
  };
}

export const mockDeliveryProvider: DeliveryProvider = {
  id: 'mock',

  async quote(input: DeliveryQuoteRequest) {
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MINUTES * 60_000).toISOString();

    /**
     * A dropoff nobody has located cannot be quoted.
     *
     * The app's add-address form is six text fields with no geocoder behind
     * it, so this is the ordinary case rather than the exceptional one. A real
     * provider would refuse it too; answering with a confident fee would teach
     * checkout that every address is serviceable.
     */
    if (input.dropoff.latitude === undefined || input.dropoff.longitude === undefined) {
      return {
        feeMinor: 0,
        currency: 'ZAR' as const,
        etaMinutes: 0,
        expiresAt,
        quoteId: '',
        serviceable: false,
        unserviceableReason:
          'We could not locate that address. Pick it from the map or choose collection.',
      };
    }

    counter += 1;
    return {
      feeMinor: Math.round(businessRules.deliveryFee * 100),
      currency: 'ZAR' as const,
      etaMinutes: businessRules.deliveryBufferMinutes + 20,
      expiresAt,
      quoteId: `quote-${counter}`,
      serviceable: true,
    };
  },

  async create(input: DeliveryCreateRequest) {
    const existingId = jobsByIdempotencyKey.get(input.idempotencyKey);
    const existing = existingId ? jobs.get(existingId) : undefined;
    // Same attempt, same job — two couriers for one order is the same class of
    // harm as two orders for one basket.
    if (existingId && existing) return jobFor(existingId, existing, Date.now());

    if (!input.quoteId) {
      throw new Error('That delivery quote is no longer valid. Ask for a new one.');
    }

    counter += 1;
    const externalJobId = `job-${counter}`;
    const dispatched: DispatchedJob = {
      createdAt: Date.now(),
      etaMinutes: businessRules.deliveryBufferMinutes + 20,
      cancelled: false,
      courierName: 'Unassigned',
    };

    jobs.set(externalJobId, dispatched);
    jobsByIdempotencyKey.set(input.idempotencyKey, externalJobId);

    return jobFor(externalJobId, dispatched, Date.now());
  },

  async getStatus(externalJobId: string) {
    const dispatched = jobs.get(externalJobId);
    if (!dispatched) {
      throw new Error(`No delivery job ${externalJobId}`);
    }
    return jobFor(externalJobId, dispatched, Date.now());
  },

  async cancel(externalJobId: string) {
    const dispatched = jobs.get(externalJobId);
    if (!dispatched) {
      throw new Error(`No delivery job ${externalJobId}`);
    }
    dispatched.cancelled = true;
  },
};
