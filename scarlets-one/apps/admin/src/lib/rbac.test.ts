import { describe, expect, it } from 'vitest';
import { can, permissions, roles, type Permission, type Role } from '@scarlets/domain';
import {
  consoleRoles,
  denialMessage,
  humanRolesWith,
  isConsoleRole,
  mayAct,
  permissionMatrix,
  sectionsFor,
} from './rbac';
import type { AdminStore } from './store';
import type { Actor, Result } from './types';
import { actorFor, admin, lastAudit, snapshot, testStore } from './test-helpers';

const FUTURE = '2026-12-10T12:00:00Z';

const contentFields = {
  titleEn: 'A new headline',
  titleCy: '',
  summaryEn: 'A new summary.',
  summaryCy: '',
  bodyEn: 'One paragraph.',
  bodyCy: '',
  translation: 'draft',
};

const campaignFields = {
  partnerId: 'slot-community',
  label: 'partner_feature',
  placement: 'match_centre',
  titleEn: 'A sample panel',
  titleCy: '',
  bodyEn: 'Sample body.',
  bodyCy: '',
  mediaId: 'stadium-bowl',
  startsAt: '2027-07-01T00:00:00Z',
  endsAt: '2027-08-01T00:00:00Z',
  cta: 'none',
};

const pushFields = {
  titleEn: 'Sample push',
  titleCy: '',
  bodyEn: 'Sample message.',
  bodyCy: '',
  segment: 'following_first_team',
  category: 'service',
  sendAt: FUTURE,
};

interface Mutation {
  name: string;
  permission: Permission;
  /** Runs as a club admin first, for mutations that need something to exist. */
  setup?: (store: AdminStore) => void;
  run: (store: AdminStore, actor: Actor) => Result<unknown>;
}

/** Every mutation the console offers, with the permission it must demand. */
const mutations: Mutation[] = [
  {
    name: 'create a content draft',
    permission: 'content.write',
    run: (s, a) =>
      s.createContent(a, {
        ...contentFields,
        kind: 'news',
        category: 'club',
        mediaId: 'west-wales',
      }),
  },
  {
    name: 'edit a content draft',
    permission: 'content.write',
    run: (s, a) => s.updateContent(a, 'draft-venue-guide', contentFields),
  },
  {
    name: 'request approval of a draft',
    permission: 'content.write',
    run: (s, a) => s.requestReview(a, 'draft-venue-guide'),
  },
  {
    name: 'publish content',
    permission: 'content.publish',
    run: (s, a) => s.publishContent(a, 'draft-venue-guide', { confirmed: true }),
  },
  {
    name: 'schedule content',
    permission: 'content.publish',
    run: (s, a) =>
      s.schedulePublish(a, 'draft-venue-guide', { publishAt: FUTURE, confirmed: true }),
  },
  {
    name: 'return content to draft',
    permission: 'content.publish',
    run: (s, a) => s.returnContentToDraft(a, 'story-red-wall'),
  },
  {
    name: 'archive content',
    permission: 'content.publish',
    run: (s, a) => s.archiveContent(a, 'story-red-wall'),
  },
  {
    name: 'pin content',
    permission: 'content.publish',
    run: (s, a) => s.setContentPinned(a, 'story-red-wall', true),
  },
  {
    name: 'hide a fixture',
    permission: 'fixtures.override',
    run: (s, a) => s.setFixtureVisibility(a, 'fx-example-connacht', false),
  },
  {
    name: 'set a fixture notice',
    permission: 'fixtures.override',
    run: (s, a) =>
      s.setFixtureNotice(a, 'fx-example-connacht', {
        kind: 'postponed',
        noteEn: 'Postponed. A new date will follow.',
      }),
  },
  {
    name: 'remove a fixture notice',
    permission: 'fixtures.override',
    setup: (s) => {
      s.setFixtureNotice(admin, 'fx-example-connacht', {
        kind: 'information',
        noteEn: 'Gates information to follow.',
      });
    },
    run: (s, a) => s.clearFixtureNotice(a, 'fx-example-connacht'),
  },
  {
    name: 'create a campaign draft',
    permission: 'campaigns.write',
    run: (s, a) => s.createCampaign(a, campaignFields),
  },
  {
    name: 'edit a campaign draft',
    permission: 'campaigns.write',
    run: (s, a) => s.updateCampaign(a, 'cmp-draft-match-centre', campaignFields),
  },
  {
    name: 'approve a campaign',
    permission: 'campaigns.approve',
    run: (s, a) => s.approveCampaign(a, 'cmp-draft-match-centre'),
  },
  {
    name: 'return a campaign to draft',
    permission: 'campaigns.approve',
    run: (s, a) => s.returnCampaignToDraft(a, 'cmp-shop'),
  },
  {
    name: 'decide a moderation case',
    permission: 'moderation.review',
    run: (s, a) => s.decideCase(a, 'mod-fancam-01', { decision: 'approve' }),
  },
  {
    name: 'reopen a moderation case',
    permission: 'moderation.review',
    setup: (s) => {
      s.decideCase(admin, 'mod-fancam-01', { decision: 'approve' });
    },
    run: (s, a) => s.reopenCase(a, 'mod-fancam-01'),
  },
  {
    name: 'schedule a notification',
    permission: 'notifications.schedule',
    run: (s, a) => s.scheduleNotification(a, pushFields),
  },
  {
    name: 'cancel a notification',
    permission: 'notifications.schedule',
    run: (s, a) => s.cancelNotification(a, 'ntf-seed-03'),
  },
  {
    name: 'send a test notification',
    permission: 'notifications.schedule',
    run: (s, a) => s.sendTestNotification(a, { notificationId: 'ntf-seed-03' }),
  },
  {
    name: 'change a staff role',
    permission: 'roles.manage',
    run: (s, a) => s.changeRole(a, 'u-editor-cy', 'moderator'),
  },
];

describe('who may use the console', () => {
  it('lets four staff roles in and keeps supporter and service out', () => {
    expect([...consoleRoles].sort()).toEqual([
      'club_admin',
      'editor',
      'moderator',
      'partner_admin',
    ]);
    expect(isConsoleRole('supporter')).toBe(false);
    expect(isConsoleRole('service')).toBe(false);
  });

  it('does not let the service role act, although it holds every permission', () => {
    for (const permission of permissions) {
      expect(can('service', permission)).toBe(true);
      expect(mayAct('service', permission)).toBe(false);
      expect(mayAct('supporter', permission)).toBe(false);
    }
  });

  it('gives no human role rewards.adjust', () => {
    expect(humanRolesWith('rewards.adjust')).toEqual([]);
    const row = permissionMatrix().find((entry) => entry.permission === 'rewards.adjust');
    expect(row?.byRole).toEqual({
      supporter: false,
      editor: false,
      moderator: false,
      club_admin: false,
      partner_admin: false,
      service: true,
    });
    expect(denialMessage('club_admin', 'rewards.adjust')).toContain('No human role holds it');
  });

  it('builds the matrix from the domain, one row per permission', () => {
    const matrix = permissionMatrix();
    expect(matrix.map((row) => row.permission)).toEqual([...permissions]);
    for (const row of matrix) {
      for (const role of roles) expect(row.byRole[role]).toBe(can(role, row.permission));
    }
  });
});

describe('navigation shows only what a role may open', () => {
  const ids = (role: Role) => sectionsFor(role).map((section) => section.id);

  it('editor: content and campaigns (read), nothing operational', () => {
    expect(ids('editor')).toEqual(['overview', 'content', 'campaigns']);
  });

  it('moderator: content (read) and the moderation queue', () => {
    expect(ids('moderator')).toEqual(['overview', 'content', 'moderation']);
  });

  it('partner admin: campaigns only', () => {
    expect(ids('partner_admin')).toEqual(['overview', 'campaigns']);
  });

  it('club admin: everything', () => {
    expect(ids('club_admin')).toEqual([
      'overview',
      'content',
      'fixtures',
      'campaigns',
      'moderation',
      'notifications',
      'roles',
      'audit',
    ]);
  });

  it('supporter and service: nothing at all', () => {
    expect(ids('supporter')).toEqual([]);
    expect(ids('service')).toEqual([]);
  });
});

describe('every mutation re-checks the role on the server', () => {
  for (const mutation of mutations) {
    describe(mutation.name, () => {
      for (const role of roles) {
        const allowedRole = isConsoleRole(role) && can(role, mutation.permission);

        it(`${role}: ${allowedRole ? 'allowed, and audited' : 'refused, nothing changes, and the refusal is audited'}`, () => {
          const { store } = testStore();
          mutation.setup?.(store);
          const before = snapshot(store);
          const auditBefore = store.listAudit().length;

          const result = mutation.run(store, actorFor(role));

          expect(result.ok).toBe(allowedRole);
          expect(store.listAudit()).toHaveLength(auditBefore + 1);
          const record = lastAudit(store);
          expect(record.actorRole).toBe(role);
          expect(record.permission).toBe(mutation.permission);
          if (allowedRole) {
            expect(record.outcome).toBe('applied');
            expect(snapshot(store)).not.toBe(before);
          } else {
            expect(result).toMatchObject({ ok: false, code: 'forbidden' });
            expect(record.outcome).toBe('refused');
            expect(snapshot(store)).toBe(before);
          }
        });
      }
    });
  }

  it('covers every permission the console acts on', () => {
    const covered = new Set(mutations.map((mutation) => mutation.permission));
    expect([...covered].sort()).toEqual(
      [
        'campaigns.approve',
        'campaigns.write',
        'content.publish',
        'content.write',
        'fixtures.override',
        'moderation.review',
        'notifications.schedule',
        'roles.manage',
      ].sort(),
    );
  });

  it('refuses a reward adjustment from every role, and logs the attempt', () => {
    for (const role of roles) {
      const { store } = testStore();
      const before = snapshot(store);
      const result = store.adjustReward(actorFor(role));
      expect(result).toMatchObject({ ok: false, code: 'forbidden' });
      expect(snapshot(store)).toBe(before);
      expect(lastAudit(store)).toMatchObject({
        action: 'reward.adjust',
        permission: 'rewards.adjust',
        outcome: 'refused',
        actorRole: role,
      });
    }
  });
});
