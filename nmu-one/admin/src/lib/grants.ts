import { ROLES, type Role } from '@core/domain/models';
import { PENDING_APPROVAL, ROLE_GRANTS, type Capability } from '@core/permissions/policy';
import type { Tone } from '@/components/ui';

/**
 * Reads the app's own permission matrix (`src/core/permissions/policy.ts`),
 * so the console always shows exactly what NMU ONE enforces.
 */
export function grantFor(
  role: Role,
  capability: Capability,
): { text: string; short: string; tone: Tone } {
  if (PENDING_APPROVAL.has(capability))
    return { text: 'Waiting for NMU approval', short: 'Pending', tone: 'warning' };
  const g = ROLE_GRANTS[role][capability];
  if (g === undefined) return { text: 'No access', short: '—', tone: 'neutral' };
  if (g === true) return { text: 'Allowed', short: 'Yes', tone: 'success' };
  if ('consent' in g)
    return { text: `Only if the student shares “${g.consent}”`, short: 'Consent', tone: 'info' };
  return {
    text: `Only at the ${g.lifecycle} stage`,
    short: `${g.lifecycle[0]!.toUpperCase()}${g.lifecycle.slice(1)} only`,
    tone: 'info',
  };
}

export const rolesWith = (capability: Capability): Role[] =>
  ROLES.filter((r) => grantFor(r, capability).short !== '—' && !PENDING_APPROVAL.has(capability));
