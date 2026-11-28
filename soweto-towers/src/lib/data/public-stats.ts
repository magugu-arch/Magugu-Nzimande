import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { jumpedThisMonth } from './bookings';

/** Shown only once it is worth showing; never padded. */
export const SOCIAL_PROOF_MIN = 50;

export async function monthJumpCount(): Promise<number> {
  'use cache';
  cacheTag('stats');
  cacheLife('minutes');
  return jumpedThisMonth();
}
