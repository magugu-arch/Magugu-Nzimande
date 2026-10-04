import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  capabilityForPath,
  CAPABILITY_LABELS,
  decide,
  type Capability,
  type Decision,
  type Subject,
} from '@/core/permissions/policy';
import type { SharingScope } from '@/core/domain/models';
import { useGuardianProfile } from '@/data/hooks';
import { Header, SkeletonCard, StateView, colors } from '@/design';
import { recordAudit } from '@/state/governance';
import { useSession } from '@/state/session';

/**
 * The bridge between the central policy (core/permissions/policy.ts) and
 * the UI. Screens never compare role strings; they ask `useDecision()`.
 */

/** The current person as the policy sees them, or null while still loading. */
export function useSubject(): Subject | null {
  const user = useSession((s) => s.user);
  const role = useSession((s) => s.role);
  const guardian = useGuardianProfile(role === 'parent');
  if (!user || !role) return null;
  if (role !== 'parent') return { role, lifecycle: user.lifecycle };
  if (guardian.status === 'loading') return null;
  const consents: SharingScope[] = guardian.data?.linkedStudents[0]?.sharing ?? [];
  return { role, lifecycle: user.lifecycle, consents };
}

export function useDecision(capability: Capability): Decision | null {
  const subject = useSubject();
  return subject ? decide(subject, capability) : null;
}

export function useCan(capability: Capability): boolean {
  return useDecision(capability)?.allowed ?? false;
}

const SCOPE_LABELS: Record<SharingScope, string> = {
  'key-dates': 'key dates',
  fees: 'fee information',
  results: 'results',
  residence: 'residence details',
  'wellbeing-alerts': 'wellbeing alerts',
};

/** The permission-denied / unavailable state, worded for the reason. */
export function AccessDenied({ decision, capability }: { decision: Exclude<Decision, { allowed: true }>; capability: Capability }) {
  const router = useRouter();
  const label = CAPABILITY_LABELS[capability];
  if (decision.reason === 'pending-approval') {
    return (
      <StateView
        kind="unavailable"
        title={`${label} is coming`}
        body="The architecture is ready, but this switches on only once NMU approves it and connects the infrastructure behind it."
        actionLabel="Back to Home"
        onAction={() => router.replace('/home')}
      />
    );
  }
  if (decision.reason === 'consent') {
    const what = decision.scope ? SCOPE_LABELS[decision.scope] : 'this';
    return (
      <StateView
        kind="denied"
        title={`Not shared with you`}
        body={`Your student hasn't shared ${what} with you. Only they can change that, from Privacy in their own NMU ONE.`}
        actionLabel="See what is shared"
        onAction={() => router.replace('/guardian')}
      />
    );
  }
  return (
    <StateView
      kind="denied"
      body={`${label} isn't part of NMU ONE for your role.`}
      actionLabel="Back to Home"
      onAction={() => router.replace('/home')}
    />
  );
}

/**
 * Wraps every screen in the signed-in stack (see app/(app)/_layout.tsx) and
 * enforces the route's capability before the screen renders — sensitive
 * routes require authentication *and* a role check (brief §30).
 */
export function RouteGuard({ routeName, children }: { routeName: string; children: ReactNode }) {
  const capability = capabilityForPath(`/${routeName}`);
  const subject = useSubject();
  const userId = useSession((s) => s.user?.id);
  const decision = capability && subject ? decide(subject, capability) : null;
  const denied = decision && !decision.allowed ? decision : null;

  useEffect(() => {
    if (denied && capability && userId) {
      recordAudit('access.denied', userId, `${capability} (${denied.reason}) at /${routeName}`);
    }
  }, [denied, capability, userId, routeName]);

  if (!capability) return <>{children}</>;
  if (!subject) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header />
        <View style={{ padding: 20 }}>
          <SkeletonCard />
        </View>
      </View>
    );
  }
  if (denied) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }} testID="access-denied">
        <Header title={CAPABILITY_LABELS[capability]} />
        <AccessDenied decision={denied} capability={capability} />
      </View>
    );
  }
  return <>{children}</>;
}
