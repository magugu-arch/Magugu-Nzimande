import { mediaById, officialLinks, partnerSeed, type OfficialLinkId } from '@scarlets/adapters';
import {
  type Campaign,
  type ContentItem,
  type Partner,
  type Permission,
  type Placement,
  type Role,
  type SupporterStory,
} from '@scarlets/domain';
import {
  campaignFields,
  campaignTiming,
  findPlacementConflict,
  runningByPlacement,
  type CampaignFields,
} from './campaign-rules';
import {
  buildBody,
  contentFields,
  decideTranslation,
  joinParagraphs,
  newContentFields,
  splitParagraphs,
  toLocalized,
} from './content-rules';
import { SCORE_REFUSAL, findScoreLike, fixtureNoticeFields, scoreKeysIn } from './fixture-rules';
import {
  caseStateLabels,
  clip,
  contentStatusLabels,
  formatDate,
  formatDateTime,
  noticeKindLabels,
  placementLabelNames,
  placementNames,
  pushCategoryLabels,
  translationLabels,
} from './format';
import { decisionFields, reasonProblem, stateAfter } from './moderation-rules';
import {
  FREQUENCY_CAPS,
  checkFrequencyCap,
  notificationFields,
  recipientsFor,
  testNotificationFields,
} from './notification-rules';
import { denialMessage, isAssignableRole, isConsoleRole, mayAct, roleLabels } from './rbac';
import {
  SCHEDULER_ID,
  TEST_DEVICE,
  TEST_PROVIDER,
  seedCampaigns,
  seedCases,
  seedContent,
  seedFixtures,
  seedNotifications,
  seedStories,
  segmentSeed,
  staffSeed,
} from './seed';
import { DAY, MINUTE } from './time';
import type {
  Actor,
  AuditArea,
  AuditOutcome,
  AuditRecord,
  CampaignRecord,
  ContentRecord,
  Failure,
  FixtureRecord,
  ModerationCase,
  PushCategory,
  PushNotification,
  Result,
  Segment,
  SegmentId,
  StaffUser,
  TestDelivery,
} from './types';
import { fail, issuesToMessage } from './validation';

/** The system actor that releases scheduled work a person has already approved. */
export const SCHEDULER: Actor = { id: SCHEDULER_ID, name: 'Scheduler', role: 'service' };

const CONCEPT_CREDIT = 'Concept image. Replace pending club media approval.';

export interface StoreOptions {
  /** The clock. Injected so tests and the demo clock can both drive it. */
  now?: () => Date;
}

/** What a mutation is, for the permission check and the audit record. */
interface Spec {
  permission: Permission;
  area: AuditArea;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
}

/** What a mutation did. Returned only after the state has changed. */
interface Change<T> {
  before: string;
  after: string;
  message: string;
  data: T;
  /** Replaces the spec's id and label when the entity was created by this change. */
  entityId?: string;
  entityLabel?: string;
}

export interface AuditFilter {
  area?: AuditArea;
  outcome?: AuditOutcome;
  actorId?: string;
  q?: string;
}

export interface Counts {
  content: {
    draft: number;
    scheduled: number;
    published: number;
    archived: number;
    review: number;
  };
  fixtures: { total: number; hidden: number; notices: number };
  campaigns: { draft: number; approved: number; running: number };
  moderation: { pending: number; escalated: number };
  notifications: { scheduled: number; sent: number; tests: number };
  staff: number;
  audit: { total: number; refused: number };
}

const clone = <T>(value: T): T => structuredClone(value);

const quote = (text: string) => `“${clip(text, 60)}”`;

/** "title: “A”; Welsh: draft" for the fields that differ, as a before/after pair. */
function diff(rows: Array<[label: string, before: string, after: string]>): {
  before: string;
  after: string;
  changed: boolean;
} {
  const changed = rows.filter(([, before, after]) => before !== after);
  return {
    changed: changed.length > 0,
    before: changed.map(([label, before]) => `${label}: ${before || '(empty)'}`).join('; '),
    after: changed.map(([label, , after]) => `${label}: ${after || '(empty)'}`).join('; '),
  };
}

/**
 * The console's in-memory DEMO store.
 *
 * It is seeded from @scarlets/adapters, lives in the server process and
 * resets when that process restarts. It has no Next.js in it, so every rule
 * can be unit-tested directly.
 *
 * Two things hold for every mutation, because every mutation goes through
 * `mutate`:
 *   1. the actor's role is checked against the permission, here, on the
 *      server, whatever the screen showed;
 *   2. an audit record is appended: `applied` when state changed, `refused`
 *      when the role was not allowed. A validation failure changes nothing
 *      and writes nothing.
 */
export class AdminStore {
  private readonly clock: () => Date;
  private readonly users: StaffUser[] = clone(staffSeed);
  private readonly content: ContentRecord[] = seedContent();
  private readonly fixtures: FixtureRecord[] = seedFixtures();
  private readonly campaigns: CampaignRecord[] = seedCampaigns();
  private readonly cases: ModerationCase[] = seedCases();
  private readonly stories: SupporterStory[] = seedStories();
  private readonly pushes: PushNotification[] = seedNotifications();
  private readonly tests: TestDelivery[] = [];
  private readonly audit: AuditRecord[] = [];
  private counter = 1000;

  constructor(options: StoreOptions = {}) {
    this.clock = options.now ?? (() => new Date());
    this.write(SCHEDULER, {
      permission: null,
      area: 'system',
      action: 'store.seed',
      entityType: 'store',
      entityId: 'demo-store',
      entityLabel: 'Demo store',
      before: 'Empty',
      after: `Seeded with DEMO data: ${this.content.length} content items, ${this.fixtures.length} fixtures, ${this.campaigns.length} campaigns, ${this.cases.length} moderation cases`,
      outcome: 'applied',
    });
  }

  /* ------------------------------------------------------------ plumbing */

  now(): Date {
    return this.clock();
  }

  private nowIso(): string {
    return this.clock().toISOString();
  }

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  /** The only place an audit record is created. Records are frozen and never removed. */
  private write(
    actor: Actor,
    entry: Omit<AuditRecord, 'seq' | 'at' | 'actorId' | 'actorName' | 'actorRole'>,
  ): void {
    this.audit.push(
      Object.freeze({
        seq: this.audit.length + 1,
        at: this.nowIso(),
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        ...entry,
      }),
    );
  }

  /** Record a refusal and return it. Used when a role lacks the permission an action needs. */
  private refuse(actor: Actor, spec: Spec, message?: string): Failure {
    this.write(actor, {
      ...spec,
      before: 'No change',
      after: `Refused: ${roleLabels[actor.role]} does not hold ${spec.permission}`,
      outcome: 'refused',
    });
    return fail('forbidden', message ?? denialMessage(actor.role, spec.permission));
  }

  private mutate<T>(actor: Actor, spec: Spec, run: () => Failure | Change<T>): Result<T> {
    this.tick();
    if (!mayAct(actor.role, spec.permission)) return this.refuse(actor, spec);
    const change = run();
    if ('code' in change) return change;
    this.write(actor, {
      ...spec,
      entityId: change.entityId ?? spec.entityId,
      entityLabel: change.entityLabel ?? spec.entityLabel,
      before: change.before,
      after: change.after,
      outcome: 'applied',
    });
    return { ok: true, message: change.message, data: change.data };
  }

  /**
   * Release whatever is due. Scheduled content was approved by a person when
   * it was scheduled; the scheduler only carries out that decision, and says
   * so in the audit log.
   */
  private tick(): void {
    const now = this.clock().getTime();
    for (const record of this.content) {
      const { item } = record;
      if (item.status !== 'scheduled' || new Date(item.publishAt).getTime() > now) continue;
      item.status = 'published';
      record.updatedAt = this.nowIso();
      record.updatedBy = SCHEDULER.name;
      this.write(SCHEDULER, {
        permission: 'content.publish',
        area: 'content',
        action: 'content.release',
        entityType: 'content',
        entityId: item.id,
        entityLabel: item.title.en,
        before: `status: scheduled for ${formatDateTime(item.publishAt)}`,
        after: `status: published (approved by ${record.approval?.by ?? 'unknown'})`,
        outcome: 'applied',
      });
    }
    for (const push of this.pushes) {
      if (push.status !== 'scheduled' || new Date(push.sendAt).getTime() > now) continue;
      push.status = 'sent';
      this.write(SCHEDULER, {
        permission: 'notifications.schedule',
        area: 'notifications',
        action: 'notification.send',
        entityType: 'notification',
        entityId: push.id,
        entityLabel: push.title.en,
        before: `status: scheduled for ${formatDateTime(push.sendAt)}`,
        after: `status: sent (simulated) to ${push.recipients} recipients; scheduled by ${push.createdBy}`,
        outcome: 'applied',
      });
    }
  }

  /* ---------------------------------------------------------------- staff */

  listStaff(): StaffUser[] {
    return clone(this.users);
  }

  getStaff(id: string): StaffUser | null {
    const user = this.users.find((candidate) => candidate.id === id);
    return user ? clone(user) : null;
  }

  /**
   * Demo sign-in. Only console roles get a session: a supporter has no
   * business here and the service role is not a person.
   */
  startSession(userId: string): Result<Actor> {
    const user = this.users.find((candidate) => candidate.id === userId);
    if (!user) return fail('not_found', 'That demo account does not exist.');
    if (user.system || !isConsoleRole(user.role)) {
      return fail(
        'forbidden',
        `Refused. ${roleLabels[user.role]} accounts cannot sign in to the operations console.`,
      );
    }
    return {
      ok: true,
      message: `Signed in as ${user.name} (${roleLabels[user.role]}).`,
      data: { id: user.id, name: user.name, role: user.role },
    };
  }

  changeRole(actor: Actor, userId: string, role: string): Result<StaffUser> {
    const user = this.users.find((candidate) => candidate.id === userId);
    const spec: Spec = {
      permission: 'roles.manage',
      area: 'roles',
      action: 'role.change',
      entityType: 'staff',
      entityId: userId,
      entityLabel: user?.name ?? userId,
    };
    return this.mutate(actor, spec, () => {
      if (!user) return fail('not_found', 'That staff account does not exist.');
      if (user.system) {
        return fail('conflict', 'System accounts are not managed here. Their role cannot change.');
      }
      if (role === 'service') {
        return fail('invalid', 'Service is a system role. It cannot be given to a person.');
      }
      if (!isAssignableRole(role)) return fail('invalid', 'Choose a role from the list.');
      if (user.id === actor.id) {
        return fail('conflict', 'You cannot change your own role. Ask another club admin.');
      }
      if (user.role === role) {
        return fail('conflict', `${user.name} is already ${roleLabels[role]}.`);
      }
      const before = user.role;
      user.role = role;
      return {
        before: `role: ${roleLabels[before]}`,
        after: `role: ${roleLabels[role]}${role === 'supporter' ? ' (no console access)' : ''}`,
        message:
          role === 'supporter'
            ? `${user.name} no longer has console access.`
            : `${user.name} is now ${roleLabels[role]}.`,
        data: clone(user),
      };
    });
  }

  /**
   * There is no reward control in this console, and this is why: no human
   * role holds `rewards.adjust`, so the attempt is always refused and logged.
   * Balances belong to the rewards provider.
   */
  adjustReward(actor: Actor): Result {
    return this.mutate(
      actor,
      {
        permission: 'rewards.adjust',
        area: 'rewards',
        action: 'reward.adjust',
        entityType: 'reward_balance',
        entityId: 'demo-member',
        entityLabel: 'Demo member balance',
      },
      () =>
        fail(
          'forbidden',
          'Refused. Reward balances are changed only by the rewards provider, never in this console.',
        ),
    );
  }

  /* -------------------------------------------------------------- content */

  listContent(): ContentRecord[] {
    this.tick();
    return clone(this.content);
  }

  getContent(id: string): ContentRecord | null {
    this.tick();
    const record = this.content.find((candidate) => candidate.item.id === id);
    return record ? clone(record) : null;
  }

  private contentSpec(action: string, permission: Permission, id: string): Spec {
    const record = this.content.find((candidate) => candidate.item.id === id);
    return {
      permission,
      area: 'content',
      action,
      entityType: 'content',
      entityId: id,
      entityLabel: record?.item.title.en ?? id,
    };
  }

  private findContent(id: string): ContentRecord | Failure {
    return (
      this.content.find((candidate) => candidate.item.id === id) ??
      fail('not_found', 'That content item no longer exists.')
    );
  }

  createContent(actor: Actor, input: unknown): Result<ContentRecord> {
    const spec: Spec = {
      permission: 'content.write',
      area: 'content',
      action: 'content.create',
      entityType: 'content',
      entityId: 'new',
      entityLabel: 'New draft',
    };
    return this.mutate(actor, spec, () => {
      const parsed = newContentFields.safeParse(input);
      if (!parsed.success) return fail('invalid', issuesToMessage(parsed.error));
      const fields = parsed.data;
      if (!mediaById.has(fields.mediaId)) return fail('invalid', 'Choose an image from the list.');
      const body = buildBody(fields.bodyEn, fields.bodyCy);
      if (!body.ok) return fail('invalid', body.message);
      const translation = decideTranslation({
        titleCy: fields.titleCy,
        summaryCy: fields.summaryCy,
        requested: fields.translation,
        previous: null,
        welshChanged: true,
        canApprove: mayAct(actor.role, 'content.publish'),
      });
      if (!translation.ok) {
        return translation.reason === 'needs_approver'
          ? this.refuse(
              actor,
              { ...spec, permission: 'content.publish' },
              `Refused. ${translation.message}`,
            )
          : fail('invalid', translation.message);
      }
      const at = this.nowIso();
      const item: ContentItem = {
        id: this.nextId('cnt'),
        kind: fields.kind,
        category: fields.category,
        title: toLocalized(fields.titleEn, fields.titleCy),
        summary: toLocalized(fields.summaryEn, fields.summaryCy),
        body: body.body,
        mediaId: fields.mediaId,
        credit: CONCEPT_CREDIT,
        // A draft has no publish time yet. This is replaced when it is published or scheduled.
        publishAt: at,
        expireAt: null,
        status: 'draft',
        translation: translation.status,
        pinned: false,
        demo: true,
      };
      const record: ContentRecord = {
        item,
        updatedAt: at,
        updatedBy: actor.name,
        review: null,
        approval: null,
      };
      this.content.unshift(record);
      return {
        before: 'Did not exist',
        after: `status: draft; title: ${quote(item.title.en)}; ${translationLabels[item.translation]}`,
        message: `Draft ${quote(item.title.en)} saved. It is not visible to supporters.`,
        data: clone(record),
        entityId: item.id,
        entityLabel: item.title.en,
      };
    });
  }

  updateContent(actor: Actor, id: string, input: unknown): Result<ContentRecord> {
    const spec = this.contentSpec('content.update', 'content.write', id);
    return this.mutate(actor, spec, () => {
      const record = this.findContent(id);
      if ('code' in record) return record;
      const { item } = record;
      if (item.status === 'archived') {
        return fail('conflict', 'This item is archived. Return it to draft to edit it.');
      }
      const canPublish = mayAct(actor.role, 'content.publish');
      if (item.status !== 'draft' && !canPublish) {
        return this.refuse(
          actor,
          { ...spec, permission: 'content.publish' },
          `Refused. ${roleLabels[actor.role]}s can change drafts only, and this item is ${contentStatusLabels[item.status].toLowerCase()}. A club admin can edit it or return it to draft.`,
        );
      }
      const parsed = contentFields.safeParse(input);
      if (!parsed.success) return fail('invalid', issuesToMessage(parsed.error));
      const fields = parsed.data;

      const enUnchanged =
        splitParagraphs(fields.bodyEn).join('\n') === item.body.map((p) => p.en).join('\n');
      const cyUnchanged =
        splitParagraphs(fields.bodyCy).join('\n') ===
        splitParagraphs(joinParagraphs(item.body, 'cy')).join('\n');
      let nextBody = item.body;
      if (!enUnchanged || !cyUnchanged) {
        const body = buildBody(fields.bodyEn, fields.bodyCy);
        if (!body.ok) return fail('invalid', body.message);
        nextBody = body.body;
      }

      const welshChanged =
        fields.titleCy !== (item.title.cy ?? '') ||
        fields.summaryCy !== (item.summary.cy ?? '') ||
        !cyUnchanged;
      const translation = decideTranslation({
        titleCy: fields.titleCy,
        summaryCy: fields.summaryCy,
        requested: fields.translation,
        previous: item.translation,
        welshChanged,
        canApprove: canPublish,
      });
      if (!translation.ok) {
        return translation.reason === 'needs_approver'
          ? this.refuse(
              actor,
              { ...spec, permission: 'content.publish' },
              `Refused. ${translation.message}`,
            )
          : fail('invalid', translation.message);
      }

      const changes = diff([
        ['title', quote(item.title.en), quote(fields.titleEn)],
        [
          'Welsh title',
          item.title.cy ? quote(item.title.cy) : '',
          fields.titleCy ? quote(fields.titleCy) : '',
        ],
        ['summary', quote(item.summary.en), quote(fields.summaryEn)],
        [
          'Welsh summary',
          item.summary.cy ? quote(item.summary.cy) : '',
          fields.summaryCy ? quote(fields.summaryCy) : '',
        ],
        [
          'body',
          `${item.body.length} paragraphs`,
          enUnchanged && cyUnchanged
            ? `${item.body.length} paragraphs`
            : `${nextBody.length} paragraphs (edited)`,
        ],
        ['Welsh', translationLabels[item.translation], translationLabels[translation.status]],
      ]);
      if (!changes.changed) return fail('conflict', 'Nothing to save: no field has changed.');

      item.title = toLocalized(fields.titleEn, fields.titleCy);
      item.summary = toLocalized(fields.summaryEn, fields.summaryCy);
      item.body = nextBody;
      item.translation = translation.status;
      record.updatedAt = this.nowIso();
      record.updatedBy = actor.name;
      return {
        before: changes.before,
        after: changes.after,
        message:
          item.status === 'draft'
            ? `Draft saved. ${translationLabels[item.translation]}.`
            : `Saved. This item is ${contentStatusLabels[item.status].toLowerCase()}, so supporters see the change. ${translationLabels[item.translation]}.`,
        data: clone(record),
        entityLabel: item.title.en,
      };
    });
  }

  requestReview(actor: Actor, id: string): Result<ContentRecord> {
    return this.mutate(
      actor,
      this.contentSpec('content.request_review', 'content.write', id),
      () => {
        const record = this.findContent(id);
        if ('code' in record) return record;
        if (record.item.status !== 'draft') {
          return fail('conflict', 'Only a draft can be sent for approval.');
        }
        if (record.review) {
          return fail(
            'conflict',
            `Approval was already requested by ${record.review.requestedBy}.`,
          );
        }
        record.review = { requestedBy: actor.name, requestedAt: this.nowIso() };
        return {
          before: 'approval: not requested',
          after: `approval: requested by ${actor.name}`,
          message: 'Sent for approval. A club admin can now preview and publish it.',
          data: clone(record),
        };
      },
    );
  }

  /**
   * Publish now. Needs `content.publish` and a person: the approver confirms
   * they have looked at the preview in both languages.
   */
  publishContent(actor: Actor, id: string, input: { confirmed?: unknown }): Result<ContentRecord> {
    return this.mutate(actor, this.contentSpec('content.publish', 'content.publish', id), () => {
      const record = this.findContent(id);
      if ('code' in record) return record;
      const { item } = record;
      if (item.status === 'published') return fail('conflict', 'This item is already published.');
      if (item.status === 'archived') {
        return fail('conflict', 'This item is archived. Return it to draft first.');
      }
      if (input.confirmed !== true) {
        return fail(
          'invalid',
          'Check the preview in English and Welsh, then tick the box to confirm.',
        );
      }
      const before = `status: ${contentStatusLabels[item.status].toLowerCase()}`;
      const at = this.nowIso();
      item.status = 'published';
      item.publishAt = at;
      record.approval = { by: actor.name, at };
      record.review = null;
      record.updatedAt = at;
      record.updatedBy = actor.name;
      return {
        before,
        after: `status: published; approved by ${actor.name}; ${translationLabels[item.translation]}`,
        message:
          item.translation === 'approved'
            ? `Published ${quote(item.title.en)} in English and Welsh.`
            : `Published ${quote(item.title.en)}. ${translationLabels[item.translation]}: Welsh readers see ${item.translation === 'missing' ? 'the English text with a fallback label' : 'the unapproved Welsh draft'}.`,
        data: clone(record),
      };
    });
  }

  schedulePublish(
    actor: Actor,
    id: string,
    input: { publishAt?: unknown; confirmed?: unknown },
  ): Result<ContentRecord> {
    return this.mutate(actor, this.contentSpec('content.schedule', 'content.publish', id), () => {
      const record = this.findContent(id);
      if ('code' in record) return record;
      const { item } = record;
      if (item.status === 'published') {
        return fail(
          'conflict',
          'This item is already published. Return it to draft to reschedule it.',
        );
      }
      if (item.status === 'archived') {
        return fail('conflict', 'This item is archived. Return it to draft first.');
      }
      const when = typeof input.publishAt === 'string' ? new Date(input.publishAt).getTime() : NaN;
      if (Number.isNaN(when)) return fail('invalid', 'Choose a publish date and time.');
      const now = this.clock().getTime();
      if (when < now + MINUTE) return fail('invalid', 'Choose a publish time in the future.');
      if (when > now + 366 * DAY)
        return fail('invalid', 'Choose a publish time within the next year.');
      if (input.confirmed !== true) {
        return fail(
          'invalid',
          'Check the preview in English and Welsh, then tick the box to confirm.',
        );
      }
      const before = `status: ${contentStatusLabels[item.status].toLowerCase()}${item.status === 'scheduled' ? ` for ${formatDateTime(item.publishAt)}` : ''}`;
      const at = this.nowIso();
      item.status = 'scheduled';
      item.publishAt = new Date(when).toISOString();
      record.approval = { by: actor.name, at };
      record.review = null;
      record.updatedAt = at;
      record.updatedBy = actor.name;
      return {
        before,
        after: `status: scheduled for ${formatDateTime(item.publishAt)}; approved by ${actor.name}`,
        message: `Scheduled ${quote(item.title.en)} for ${formatDateTime(item.publishAt)}. It publishes itself then.`,
        data: clone(record),
      };
    });
  }

  returnContentToDraft(actor: Actor, id: string): Result<ContentRecord> {
    return this.mutate(actor, this.contentSpec('content.unpublish', 'content.publish', id), () => {
      const record = this.findContent(id);
      if ('code' in record) return record;
      const { item } = record;
      if (item.status === 'draft') return fail('conflict', 'This item is already a draft.');
      const before = `status: ${contentStatusLabels[item.status].toLowerCase()}${item.pinned ? '; pinned' : ''}`;
      item.status = 'draft';
      item.pinned = false;
      record.approval = null;
      record.updatedAt = this.nowIso();
      record.updatedBy = actor.name;
      return {
        before,
        after: 'status: draft; not visible to supporters',
        message: `${quote(item.title.en)} is a draft again. Supporters no longer see it.`,
        data: clone(record),
      };
    });
  }

  archiveContent(actor: Actor, id: string): Result<ContentRecord> {
    return this.mutate(actor, this.contentSpec('content.archive', 'content.publish', id), () => {
      const record = this.findContent(id);
      if ('code' in record) return record;
      const { item } = record;
      if (item.status === 'archived') return fail('conflict', 'This item is already archived.');
      const before = `status: ${contentStatusLabels[item.status].toLowerCase()}${item.pinned ? '; pinned' : ''}`;
      item.status = 'archived';
      item.pinned = false;
      record.review = null;
      record.updatedAt = this.nowIso();
      record.updatedBy = actor.name;
      return {
        before,
        after: 'status: archived; not visible to supporters',
        message: `Archived ${quote(item.title.en)}. Supporters no longer see it.`,
        data: clone(record),
      };
    });
  }

  setContentPinned(actor: Actor, id: string, pinned: boolean): Result<ContentRecord> {
    const action = pinned ? 'content.pin' : 'content.unpin';
    return this.mutate(actor, this.contentSpec(action, 'content.publish', id), () => {
      const record = this.findContent(id);
      if ('code' in record) return record;
      const { item } = record;
      if (item.status !== 'published' && item.status !== 'scheduled') {
        return fail('conflict', 'Only a published or scheduled item can be pinned.');
      }
      if (item.pinned === pinned) {
        return fail(
          'conflict',
          pinned ? 'This item is already pinned.' : 'This item is not pinned.',
        );
      }
      item.pinned = pinned;
      record.updatedAt = this.nowIso();
      record.updatedBy = actor.name;
      return {
        before: pinned ? 'not pinned' : 'pinned',
        after: pinned ? 'pinned to the top of its list' : 'not pinned',
        message: pinned
          ? `Pinned ${quote(item.title.en)} to the top of its list.`
          : `Unpinned ${quote(item.title.en)}.`,
        data: clone(record),
      };
    });
  }

  /* ------------------------------------------------------------- fixtures */

  listFixtures(): FixtureRecord[] {
    return clone(this.fixtures);
  }

  private fixtureSpec(action: string, id: string): Spec {
    const record = this.fixtures.find((candidate) => candidate.fixture.id === id);
    return {
      permission: 'fixtures.override',
      area: 'fixtures',
      action,
      entityType: 'fixture',
      entityId: id,
      entityLabel: record ? `${record.fixture.home.name} v ${record.fixture.away.name}` : id,
    };
  }

  private findFixture(id: string): FixtureRecord | Failure {
    return (
      this.fixtures.find((candidate) => candidate.fixture.id === id) ??
      fail('not_found', 'That fixture is not in the list.')
    );
  }

  setFixtureVisibility(actor: Actor, id: string, visible: boolean): Result<FixtureRecord> {
    const action = visible ? 'fixture.show' : 'fixture.hide';
    return this.mutate(actor, this.fixtureSpec(action, id), () => {
      const record = this.findFixture(id);
      if ('code' in record) return record;
      if (record.visible === visible) {
        return fail(
          'conflict',
          visible ? 'This fixture is already visible.' : 'This fixture is already hidden.',
        );
      }
      record.visible = visible;
      record.updatedAt = this.nowIso();
      record.updatedBy = actor.name;
      return {
        before: visible ? 'hidden from supporters' : 'visible to supporters',
        after: visible ? 'visible to supporters' : 'hidden from supporters',
        message: visible
          ? 'Fixture is visible to supporters again.'
          : 'Fixture hidden from supporters. The provider feed is untouched.',
        data: clone(record),
      };
    });
  }

  /**
   * An editorial notice on a fixture ("Postponed", a venue change). It never
   * carries a score: there is no field for one, a score-shaped field is
   * refused outright, and score-like text in the note is refused too.
   */
  setFixtureNotice(actor: Actor, id: string, input: unknown): Result<FixtureRecord> {
    return this.mutate(actor, this.fixtureSpec('fixture.notice', id), () => {
      const record = this.findFixture(id);
      if ('code' in record) return record;
      if (scoreKeysIn(input).length > 0) return fail('invalid', SCORE_REFUSAL);
      const parsed = fixtureNoticeFields.safeParse(input);
      if (!parsed.success) {
        const unknown = parsed.error.issues.some((issue) => issue.code === 'unrecognized_keys');
        return fail(
          'invalid',
          unknown
            ? 'A notice has a type and a note in English and Welsh, nothing else.'
            : issuesToMessage(parsed.error),
        );
      }
      const fields = parsed.data;
      const scoreLike = findScoreLike(fields.noteEn) ?? findScoreLike(fields.noteCy);
      if (scoreLike) {
        return fail(
          'invalid',
          `The note looks like it contains a score (“${scoreLike}”). ${SCORE_REFUSAL} Write dates in words, for example “12 December”.`,
        );
      }
      const before = record.notice
        ? `${noticeKindLabels[record.notice.kind]}: ${quote(record.notice.text.en)}`
        : 'no notice';
      record.notice = { kind: fields.kind, text: toLocalized(fields.noteEn, fields.noteCy) };
      record.updatedAt = this.nowIso();
      record.updatedBy = actor.name;
      return {
        before,
        after: `${noticeKindLabels[fields.kind]}: ${quote(fields.noteEn)}${fields.noteCy ? '' : ' (no Welsh: English fallback)'}`,
        message: `Notice saved: ${noticeKindLabels[fields.kind]}. Supporters see it on this fixture.`,
        data: clone(record),
      };
    });
  }

  clearFixtureNotice(actor: Actor, id: string): Result<FixtureRecord> {
    return this.mutate(actor, this.fixtureSpec('fixture.notice_clear', id), () => {
      const record = this.findFixture(id);
      if ('code' in record) return record;
      if (!record.notice) return fail('conflict', 'This fixture has no notice to remove.');
      const before = `${noticeKindLabels[record.notice.kind]}: ${quote(record.notice.text.en)}`;
      record.notice = null;
      record.updatedAt = this.nowIso();
      record.updatedBy = actor.name;
      return {
        before,
        after: 'no notice',
        message: 'Notice removed.',
        data: clone(record),
      };
    });
  }

  /* ------------------------------------------------------------ campaigns */

  /** Placeholder slots, not approved partners. The console cannot add one. */
  listPartners(): Partner[] {
    return clone(partnerSeed);
  }

  listCampaigns(): CampaignRecord[] {
    return clone(this.campaigns);
  }

  getCampaign(id: string): CampaignRecord | null {
    const record = this.campaigns.find((candidate) => candidate.campaign.id === id);
    return record ? clone(record) : null;
  }

  private approvedCampaigns(): Campaign[] {
    return this.campaigns
      .filter((record) => record.status === 'approved')
      .map((record) => record.campaign);
  }

  /** What each screen area shows right now: at most one campaign each. */
  runningCampaigns(): Record<Placement, Campaign | null> {
    return clone(runningByPlacement(this.approvedCampaigns(), this.clock()));
  }

  private campaignSpec(action: string, permission: Permission, id: string): Spec {
    const record = this.campaigns.find((candidate) => candidate.campaign.id === id);
    return {
      permission,
      area: 'campaigns',
      action,
      entityType: 'campaign',
      entityId: id,
      entityLabel: record?.campaign.title.en ?? id,
    };
  }

  private findCampaign(id: string): CampaignRecord | Failure {
    return (
      this.campaigns.find((candidate) => candidate.campaign.id === id) ??
      fail('not_found', 'That campaign no longer exists.')
    );
  }

  private campaignFrom(
    fields: CampaignFields,
    base: Pick<Campaign, 'id' | 'terms' | 'priority'>,
  ): Campaign | Failure {
    if (!partnerSeed.some((partner) => partner.id === fields.partnerId)) {
      return fail(
        'invalid',
        'Choose a partner slot from the list. New partners are not created here.',
      );
    }
    if (!mediaById.has(fields.mediaId)) return fail('invalid', 'Choose an image from the list.');
    const link = fields.cta === 'none' ? null : officialLinks[fields.cta as OfficialLinkId];
    return {
      ...base,
      partnerId: fields.partnerId,
      label: fields.label,
      placement: fields.placement,
      title: toLocalized(fields.titleEn, fields.titleCy),
      body: toLocalized(fields.bodyEn, fields.bodyCy),
      mediaId: fields.mediaId,
      startsAt: new Date(fields.startsAt).toISOString(),
      endsAt: new Date(fields.endsAt).toISOString(),
      cta: link ? { label: link.label, url: link.url } : null,
      demo: true,
    };
  }

  private conflictMessage(verb: string, candidate: Campaign, other: Campaign): string {
    return `Cannot ${verb}. ${placementNames[candidate.placement]} already has ${quote(other.title.en)} approved from ${formatDate(other.startsAt)} to ${formatDate(other.endsAt)}, and the dates overlap. Only one campaign can run in a placement at a time: change the dates or the placement, or return the other campaign to draft.`;
  }

  private describeCampaign(campaign: Campaign): string {
    return `${placementNames[campaign.placement]}; label: ${placementLabelNames[campaign.label]}; ${formatDate(campaign.startsAt)} to ${formatDate(campaign.endsAt)}`;
  }

  createCampaign(actor: Actor, input: unknown): Result<CampaignRecord> {
    const spec: Spec = {
      permission: 'campaigns.write',
      area: 'campaigns',
      action: 'campaign.create',
      entityType: 'campaign',
      entityId: 'new',
      entityLabel: 'New campaign draft',
    };
    return this.mutate(actor, spec, () => {
      const parsed = campaignFields.safeParse(input);
      if (!parsed.success) return fail('invalid', issuesToMessage(parsed.error));
      const campaign = this.campaignFrom(parsed.data, {
        id: 'new',
        // Eligibility and redemption terms come from the partner, never from here.
        terms: null,
        priority: 10,
      });
      if ('code' in campaign) return campaign;
      campaign.id = this.nextId('cmp');
      const record: CampaignRecord = {
        campaign,
        status: 'draft',
        approval: null,
        updatedAt: this.nowIso(),
        updatedBy: actor.name,
      };
      this.campaigns.unshift(record);
      return {
        before: 'Did not exist',
        after: `status: draft; ${this.describeCampaign(campaign)}`,
        message: `Campaign draft ${quote(campaign.title.en)} saved. It does not run until a club admin approves it.`,
        data: clone(record),
        entityId: campaign.id,
        entityLabel: campaign.title.en,
      };
    });
  }

  updateCampaign(actor: Actor, id: string, input: unknown): Result<CampaignRecord> {
    const spec = this.campaignSpec('campaign.update', 'campaigns.write', id);
    return this.mutate(actor, spec, () => {
      const record = this.findCampaign(id);
      if ('code' in record) return record;
      if (record.status === 'approved' && !mayAct(actor.role, 'campaigns.approve')) {
        return this.refuse(
          actor,
          { ...spec, permission: 'campaigns.approve' },
          `Refused. ${roleLabels[actor.role]}s can change campaign drafts only, and this campaign is approved. A club admin can edit it or return it to draft.`,
        );
      }
      const parsed = campaignFields.safeParse(input);
      if (!parsed.success) return fail('invalid', issuesToMessage(parsed.error));
      const next = this.campaignFrom(parsed.data, record.campaign);
      if ('code' in next) return next;
      if (record.status === 'approved') {
        const clash = findPlacementConflict(next, this.approvedCampaigns());
        if (clash) return fail('conflict', this.conflictMessage('save', next, clash));
      }
      const previous = record.campaign;
      const changes = diff([
        ['title', quote(previous.title.en), quote(next.title.en)],
        ['Welsh title', previous.title.cy ?? '', next.title.cy ?? ''],
        ['body', quote(previous.body.en), quote(next.body.en)],
        ['Welsh body', previous.body.cy ?? '', next.body.cy ?? ''],
        ['partner slot', previous.partnerId, next.partnerId],
        ['placement', placementNames[previous.placement], placementNames[next.placement]],
        ['label', placementLabelNames[previous.label], placementLabelNames[next.label]],
        ['starts', formatDateTime(previous.startsAt), formatDateTime(next.startsAt)],
        ['ends', formatDateTime(previous.endsAt), formatDateTime(next.endsAt)],
        ['image', previous.mediaId, next.mediaId],
        ['link', previous.cta?.label.en ?? 'none', next.cta?.label.en ?? 'none'],
      ]);
      if (!changes.changed) return fail('conflict', 'Nothing to save: no field has changed.');
      record.campaign = next;
      record.updatedAt = this.nowIso();
      record.updatedBy = actor.name;
      return {
        before: changes.before,
        after: changes.after,
        message:
          record.status === 'approved'
            ? 'Saved. This campaign is approved, so supporters see the change.'
            : 'Campaign draft saved.',
        data: clone(record),
        entityLabel: next.title.en,
      };
    });
  }

  /** Approval is where "one running campaign per placement" is enforced. */
  approveCampaign(actor: Actor, id: string): Result<CampaignRecord> {
    return this.mutate(
      actor,
      this.campaignSpec('campaign.approve', 'campaigns.approve', id),
      () => {
        const record = this.findCampaign(id);
        if ('code' in record) return record;
        if (record.status === 'approved')
          return fail('conflict', 'This campaign is already approved.');
        const { campaign } = record;
        if (campaignTiming(campaign, this.clock()) === 'ended') {
          return fail(
            'invalid',
            'This campaign has already ended. Change its dates before approving it.',
          );
        }
        const clash = findPlacementConflict(campaign, this.approvedCampaigns());
        if (clash) return fail('conflict', this.conflictMessage('approve', campaign, clash));
        const at = this.nowIso();
        record.status = 'approved';
        record.approval = { by: actor.name, at };
        record.updatedAt = at;
        record.updatedBy = actor.name;
        return {
          before: 'status: draft',
          after: `status: approved by ${actor.name}; ${this.describeCampaign(campaign)}`,
          message: `Approved ${quote(campaign.title.en)} for ${placementNames[campaign.placement]}, labelled “${placementLabelNames[campaign.label]}”.`,
          data: clone(record),
        };
      },
    );
  }

  returnCampaignToDraft(actor: Actor, id: string): Result<CampaignRecord> {
    return this.mutate(
      actor,
      this.campaignSpec('campaign.unapprove', 'campaigns.approve', id),
      () => {
        const record = this.findCampaign(id);
        if ('code' in record) return record;
        if (record.status === 'draft') return fail('conflict', 'This campaign is already a draft.');
        record.status = 'draft';
        record.approval = null;
        record.updatedAt = this.nowIso();
        record.updatedBy = actor.name;
        return {
          before: 'status: approved',
          after: `status: draft; ${placementNames[record.campaign.placement]} placement freed`,
          message: `${quote(record.campaign.title.en)} is a draft again and no longer runs.`,
          data: clone(record),
        };
      },
    );
  }

  /* ----------------------------------------------------------- moderation */

  listCases(): ModerationCase[] {
    return clone(this.cases);
  }

  listStories(): SupporterStory[] {
    return clone(this.stories);
  }

  /** Fan Cam photos supporters can see: approved ones, and nothing else. */
  publishedFanCam(): ModerationCase[] {
    return clone(this.cases.filter((c) => c.kind === 'fan_cam' && c.state === 'approved'));
  }

  private caseSpec(action: string, id: string): Spec {
    const found = this.cases.find((candidate) => candidate.id === id);
    let label = id;
    if (found?.kind === 'fan_cam') label = `Fan Cam photo from ${found.submitter}`;
    if (found?.kind === 'story_report') {
      const story = this.stories.find((candidate) => candidate.id === found.storyId);
      label = `Report on ${quote(story?.title.en ?? found.storyId)}`;
    }
    return {
      permission: 'moderation.review',
      area: 'moderation',
      action,
      entityType: found?.kind ?? 'moderation_case',
      entityId: id,
      entityLabel: label,
    };
  }

  decideCase(actor: Actor, id: string, input: unknown): Result<ModerationCase> {
    const requested =
      typeof input === 'object' && input !== null && 'decision' in input
        ? String(input.decision)
        : '';
    const action = ['approve', 'reject', 'escalate'].includes(requested)
      ? `moderation.${requested}`
      : 'moderation.decide';
    return this.mutate(actor, this.caseSpec(action, id), () => {
      const found = this.cases.find((candidate) => candidate.id === id);
      if (!found) return fail('not_found', 'That case is no longer in the queue.');
      if (found.state !== 'pending') {
        return fail(
          'conflict',
          `This case was already decided: ${caseStateLabels[found.state].toLowerCase()}.`,
        );
      }
      const parsed = decisionFields.safeParse(input);
      if (!parsed.success) return fail('invalid', issuesToMessage(parsed.error));
      const { decision, reason } = parsed.data;
      const problem = reasonProblem(decision, reason);
      if (problem) return fail('invalid', problem);

      const story =
        found.kind === 'story_report'
          ? this.stories.find((candidate) => candidate.id === found.storyId)
          : undefined;
      const before =
        found.kind === 'fan_cam'
          ? 'pending: not visible to supporters'
          : `report open; story ${story?.moderation === 'approved' ? 'visible' : 'held'}`;

      found.state = stateAfter(decision);
      found.decision = { by: actor.name, at: this.nowIso(), reason: reason || null };
      if (story) {
        story.moderation =
          decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'pending';
      }

      const withReason = reason ? `; reason: ${quote(reason)}` : '';
      const outcomes = {
        fan_cam: {
          approve: [
            'approved: visible to supporters',
            'Approved. The photo can now be shown to supporters.',
          ],
          reject: [
            'rejected: stays hidden',
            'Rejected. The photo stays hidden and the reason is recorded.',
          ],
          escalate: [
            'escalated to safeguarding: stays hidden',
            'Escalated to safeguarding. The photo stays hidden and has left the moderation queue.',
          ],
        },
        story_report: {
          approve: [
            'report dismissed: story visible',
            'Report dismissed. The story is visible to supporters.',
          ],
          reject: [
            'story removed',
            'Story removed. Supporters no longer see it and the reason is recorded.',
          ],
          escalate: [
            'escalated to safeguarding: story held',
            'Escalated to safeguarding. The story is hidden while it is reviewed.',
          ],
        },
      } as const;
      const [after, message] = outcomes[found.kind][decision];
      return { before, after: `${after}${withReason}`, message, data: clone(found) };
    });
  }

  /** Undo an approve or reject by putting the case back in the queue, hidden. */
  reopenCase(actor: Actor, id: string): Result<ModerationCase> {
    return this.mutate(actor, this.caseSpec('moderation.reopen', id), () => {
      const found = this.cases.find((candidate) => candidate.id === id);
      if (!found) return fail('not_found', 'That case no longer exists.');
      if (found.state === 'pending')
        return fail('conflict', 'This case is already waiting for review.');
      if (found.state === 'escalated') {
        return fail(
          'conflict',
          'Escalated cases are handled by the safeguarding lead, not in this console.',
        );
      }
      const before = caseStateLabels[found.state].toLowerCase();
      found.state = 'pending';
      found.decision = null;
      if (found.kind === 'story_report') {
        const story = this.stories.find((candidate) => candidate.id === found.storyId);
        if (story) story.moderation = 'pending';
      }
      return {
        before,
        after: 'pending review: not visible to supporters',
        message: 'Case reopened. It is hidden from supporters until it is reviewed again.',
        data: clone(found),
      };
    });
  }

  /* -------------------------------------------------------- notifications */

  listSegments(): Segment[] {
    return clone(segmentSeed);
  }

  listNotifications(): PushNotification[] {
    this.tick();
    return clone(this.pushes);
  }

  listTests(): TestDelivery[] {
    return clone(this.tests);
  }

  /** Send times that count towards a cap: scheduled and sent, not cancelled. */
  private countedTimes(segment: SegmentId, category: PushCategory): number[] {
    return this.pushes
      .filter(
        (push) =>
          push.segment === segment && push.category === category && push.status !== 'cancelled',
      )
      .map((push) => new Date(push.sendAt).getTime());
  }

  /** How many pushes of a category a segment has in the window around now. */
  capUsage(
    segment: SegmentId,
    category: PushCategory,
  ): { used: number; max: number; window: string } {
    const cap = FREQUENCY_CAPS[category];
    const now = this.clock().getTime();
    const used = this.countedTimes(segment, category).filter(
      (time) => Math.abs(time - now) < cap.windowMs,
    ).length;
    return { used, max: cap.max, window: cap.window };
  }

  scheduleNotification(actor: Actor, input: unknown): Result<PushNotification> {
    const spec: Spec = {
      permission: 'notifications.schedule',
      area: 'notifications',
      action: 'notification.schedule',
      entityType: 'notification',
      entityId: 'new',
      entityLabel: 'New push notification',
    };
    return this.mutate(actor, spec, () => {
      const parsed = notificationFields.safeParse(input);
      if (!parsed.success) return fail('invalid', issuesToMessage(parsed.error));
      const fields = parsed.data;
      const segment = segmentSeed.find((candidate) => candidate.id === fields.segment);
      if (!segment) return fail('invalid', 'Choose who receives it.');
      const when = new Date(fields.sendAt).getTime();
      const now = this.clock().getTime();
      if (when < now + MINUTE) return fail('invalid', 'Choose a send time in the future.');
      if (when > now + 90 * DAY)
        return fail('invalid', 'Choose a send time within the next 90 days.');

      const cap = FREQUENCY_CAPS[fields.category];
      const check = checkFrequencyCap(
        when,
        this.countedTimes(fields.segment, fields.category),
        cap,
      );
      if (check.breached) {
        const others = check.clashing
          .map((time) => formatDateTime(new Date(time).toISOString()))
          .join(' and ');
        return fail(
          'conflict',
          `Frequency cap reached. ${segment.label} can get at most ${cap.max} ${fields.category} pushes in any ${cap.window}, and it already has ${others}. Choose a later time, or cancel one of those.`,
        );
      }

      const recipients = recipientsFor(segment, fields.category);
      const push: PushNotification = {
        id: this.nextId('ntf'),
        title: toLocalized(fields.titleEn, fields.titleCy),
        body: toLocalized(fields.bodyEn, fields.bodyCy),
        segment: fields.segment,
        category: fields.category,
        sendAt: new Date(when).toISOString(),
        status: 'scheduled',
        recipients,
        createdBy: actor.name,
        createdAt: this.nowIso(),
        demo: true,
      };
      this.pushes.unshift(push);
      const left = segment.pushEnabled - recipients;
      return {
        before: 'Did not exist',
        after: `${pushCategoryLabels[push.category]} to ${segment.label} at ${formatDateTime(push.sendAt)}; reaches ${recipients} of ${segment.pushEnabled}`,
        message:
          push.category === 'marketing'
            ? `Scheduled for ${formatDateTime(push.sendAt)}. Marketing reaches only the ${recipients} people in ${segment.label} who gave marketing consent; the other ${left} are left out.`
            : `Scheduled for ${formatDateTime(push.sendAt)}. As a service message it reaches all ${recipients} people in ${segment.label} with push switched on.`,
        data: clone(push),
        entityId: push.id,
        entityLabel: push.title.en,
      };
    });
  }

  cancelNotification(actor: Actor, id: string): Result<PushNotification> {
    const push = this.pushes.find((candidate) => candidate.id === id);
    const spec: Spec = {
      permission: 'notifications.schedule',
      area: 'notifications',
      action: 'notification.cancel',
      entityType: 'notification',
      entityId: id,
      entityLabel: push?.title.en ?? id,
    };
    return this.mutate(actor, spec, () => {
      if (!push) return fail('not_found', 'That notification no longer exists.');
      if (push.status !== 'scheduled') {
        return fail(
          'conflict',
          push.status === 'sent'
            ? 'This notification has already been sent.'
            : 'This notification is already cancelled.',
        );
      }
      push.status = 'cancelled';
      return {
        before: `scheduled for ${formatDateTime(push.sendAt)}`,
        after: 'cancelled: will not be sent',
        message: `Cancelled ${quote(push.title.en)}. It no longer counts towards the frequency cap.`,
        data: clone(push),
      };
    });
  }

  /**
   * Send a test to the test device. It reaches no supporter and does not
   * count towards a cap. The simulated delivery is recorded so the flow can
   * be checked end to end.
   */
  sendTestNotification(
    actor: Actor,
    target: { notificationId: string } | { draft: unknown },
  ): Result<TestDelivery> {
    const existing =
      'notificationId' in target
        ? this.pushes.find((candidate) => candidate.id === target.notificationId)
        : undefined;
    const spec: Spec = {
      permission: 'notifications.schedule',
      area: 'notifications',
      action: 'notification.test',
      entityType: 'notification_test',
      entityId: 'notificationId' in target ? target.notificationId : 'draft',
      entityLabel: existing?.title.en ?? 'Unsaved notification',
    };
    return this.mutate(actor, spec, () => {
      let title: { en: string; cy?: string };
      let body: { en: string; cy?: string };
      let category: PushCategory;
      if ('notificationId' in target) {
        if (!existing) return fail('not_found', 'That notification no longer exists.');
        ({ title, body, category } = existing);
      } else {
        const parsed = testNotificationFields.safeParse(target.draft);
        if (!parsed.success) return fail('invalid', issuesToMessage(parsed.error));
        title = toLocalized(parsed.data.titleEn, parsed.data.titleCy);
        body = toLocalized(parsed.data.bodyEn, parsed.data.bodyCy);
        category = parsed.data.category;
      }
      const delivery: TestDelivery = {
        id: this.nextId('test'),
        notificationId: existing?.id ?? null,
        device: TEST_DEVICE,
        provider: TEST_PROVIDER,
        status: 'delivered_simulated',
        at: this.nowIso(),
        sentBy: actor.name,
        category,
        en: { title: title.en, body: body.en },
        cy: {
          title: title.cy ?? title.en,
          body: body.cy ?? body.en,
          fallback: !title.cy || !body.cy,
        },
      };
      this.tests.unshift(delivery);
      return {
        before: 'No test sent',
        after: `test delivered (simulated) to ${TEST_DEVICE}; ${delivery.cy.fallback ? 'Welsh fell back to English' : 'English and Welsh shown'}`,
        message: `Test delivered to ${TEST_DEVICE} (simulated). No supporter received it.${delivery.cy.fallback ? ' Welsh is incomplete, so the Welsh device view fell back to English.' : ''}`,
        data: clone(delivery),
        entityId: delivery.id,
        entityLabel: title.en,
      };
    });
  }

  /* ------------------------------------------------------- audit & counts */

  /** Newest first. Copies: nothing a caller does to the result reaches the log. */
  listAudit(filter: AuditFilter = {}): AuditRecord[] {
    this.tick();
    const q = filter.q?.trim().toLowerCase();
    return this.audit
      .filter((record) => !filter.area || record.area === filter.area)
      .filter((record) => !filter.outcome || record.outcome === filter.outcome)
      .filter((record) => !filter.actorId || record.actorId === filter.actorId)
      .filter(
        (record) =>
          !q ||
          [
            record.action,
            record.entityLabel,
            record.entityId,
            record.before,
            record.after,
            record.actorName,
          ]
            .join(' ')
            .toLowerCase()
            .includes(q),
      )
      .map((record) => ({ ...record }))
      .reverse();
  }

  /** Everyone who appears in the log, for the actor filter. */
  auditActors(): Array<{ id: string; name: string; role: Role }> {
    const seen = new Map<string, { id: string; name: string; role: Role }>();
    for (const record of this.audit) {
      seen.set(record.actorId, {
        id: record.actorId,
        name: record.actorName,
        role: record.actorRole,
      });
    }
    return [...seen.values()];
  }

  counts(): Counts {
    this.tick();
    const status = (wanted: ContentItem['status']) =>
      this.content.filter((record) => record.item.status === wanted).length;
    const now = this.clock();
    return {
      content: {
        draft: status('draft'),
        scheduled: status('scheduled'),
        published: status('published'),
        archived: status('archived'),
        review: this.content.filter((record) => record.review !== null).length,
      },
      fixtures: {
        total: this.fixtures.length,
        hidden: this.fixtures.filter((record) => !record.visible).length,
        notices: this.fixtures.filter((record) => record.notice !== null).length,
      },
      campaigns: {
        draft: this.campaigns.filter((record) => record.status === 'draft').length,
        approved: this.campaigns.filter((record) => record.status === 'approved').length,
        running: this.approvedCampaigns().filter(
          (campaign) => campaignTiming(campaign, now) === 'running',
        ).length,
      },
      moderation: {
        pending: this.cases.filter((c) => c.state === 'pending').length,
        escalated: this.cases.filter((c) => c.state === 'escalated').length,
      },
      notifications: {
        scheduled: this.pushes.filter((push) => push.status === 'scheduled').length,
        sent: this.pushes.filter((push) => push.status === 'sent').length,
        tests: this.tests.length,
      },
      staff: this.users.filter((user) => !user.system).length,
      audit: {
        total: this.audit.length,
        refused: this.audit.filter((record) => record.outcome === 'refused').length,
      },
    };
  }
}

export function createStore(options: StoreOptions = {}): AdminStore {
  return new AdminStore(options);
}

/** Which official link a campaign's call to action points at, for the edit form. */
export function ctaIdOf(campaign: Campaign): OfficialLinkId | 'none' {
  if (!campaign.cta) return 'none';
  const match = (Object.keys(officialLinks) as OfficialLinkId[]).find(
    (id) =>
      officialLinks[id].url === campaign.cta?.url &&
      officialLinks[id].label.en === campaign.cta?.label.en,
  );
  return match ?? 'none';
}
