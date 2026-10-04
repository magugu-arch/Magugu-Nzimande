import type { SafetyContact } from '@/core/domain/models';

/**
 * South Africa's public national emergency numbers, bundled with the app so
 * they show and dial with no network at all (brief §13 "fallback behaviour
 * when network access fails"). Re-verify before every release (RUNBOOK).
 */
export const NATIONAL_EMERGENCY: SafetyContact[] = [
  {
    id: 'saps',
    name: 'SAPS emergency',
    description: 'Police emergency line.',
    phone: '10111',
    availability: '24 hours',
    scope: 'national',
    verified: true,
  },
  {
    id: 'mobile-112',
    name: 'Emergency from a mobile',
    description: 'Works from any mobile phone, even without airtime.',
    phone: '112',
    availability: '24 hours',
    scope: 'national',
    verified: true,
  },
  {
    id: 'ambulance',
    name: 'Ambulance and fire',
    description: 'National ambulance and fire emergency line.',
    phone: '10177',
    availability: '24 hours',
    scope: 'national',
    verified: true,
  },
];
