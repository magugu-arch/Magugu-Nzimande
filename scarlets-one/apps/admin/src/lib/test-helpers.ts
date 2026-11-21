import type { Role } from '@scarlets/domain';
import { DEMO_START } from './seed';
import { AdminStore } from './store';
import type { Actor, AuditRecord, Result } from './types';

/** A store on a clock the test controls, starting where the demo clock starts. */
export function testStore(): { store: AdminStore; advance: (ms: number) => void; now: () => Date } {
  let current = new Date(DEMO_START).getTime();
  const now = () => new Date(current);
  return {
    store: new AdminStore({ now }),
    advance: (ms) => {
      current += ms;
    },
    now,
  };
}

export const actorFor = (role: Role): Actor => ({ id: `test-${role}`, name: `Test ${role}`, role });

export const admin = actorFor('club_admin');
export const editor = actorFor('editor');
export const moderator = actorFor('moderator');
export const partnerAdmin = actorFor('partner_admin');

/** The newest audit record. */
export function lastAudit(store: AdminStore): AuditRecord {
  const [latest] = store.listAudit();
  if (!latest) throw new Error('The audit log is empty');
  return latest;
}

/** Everything a mutation could touch, as one string. Excludes the audit log. */
export function snapshot(store: AdminStore): string {
  return JSON.stringify({
    staff: store.listStaff(),
    content: store.listContent(),
    fixtures: store.listFixtures(),
    campaigns: store.listCampaigns(),
    cases: store.listCases(),
    stories: store.listStories(),
    pushes: store.listNotifications(),
    tests: store.listTests(),
  });
}

export function expectOk<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`Expected success, got ${result.code}: ${result.message}`);
  return result.data;
}

export function expectFail<T>(result: Result<T>): { code: string; message: string } {
  if (result.ok) throw new Error(`Expected a failure, got success: ${result.message}`);
  return result;
}
