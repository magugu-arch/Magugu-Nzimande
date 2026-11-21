/**
 * Mock audit trail.
 *
 * Append-only: there is no way to change or remove an event through this
 * service. Events carry opaque references only — a person token, a staff or
 * partner reference, a case reference — never a name, a contact detail or an
 * identity number. Anything that looks like personal information is refused.
 */
import { DEMO, type AuditEvent, type AuditFilter, type AuditPort } from '@hao/api-contracts';
import { createCollection, DAY, HOUR, MINUTE, type Platform } from '@hao/local-platform';
import { GatewayError } from '@hao/shared-types';

export type AuditEventInput = Omit<AuditEvent, 'auditId' | 'at'>;

const DEFAULT_LIMIT = 200;

/**
 * The prototype's own opaque tokens, e.g. `CASE-DEMO-002481` or
 * `PERSON-DEMO-7X3Q`. A case reference legitimately ends in six digits, so
 * these are set aside before the digit-run check. The tail is capped at six
 * characters: a longer number wearing a `-DEMO-` prefix is still refused.
 */
const OPAQUE_DEMO_TOKEN = /\b[A-Z][A-Z0-9]*-DEMO-[A-Z0-9]{1,6}\b/g;
/**
 * The gateway's correlation ids: `CORR-<time in base 36>-<counter>`. About one
 * in two thousand of those time stamps happens to contain six digits in a row,
 * and refusing them would silently drop genuine events. Only this exact shape
 * is excused, only in the `correlationId` field, and the time part must
 * contain a letter — so a bare number dressed up as a correlation id is still
 * refused.
 */
const GATEWAY_CORRELATION_ID = /^CORR-(?=[0-9]*[A-Z])[A-Z0-9]{6,9}-\d{1,5}$/;
const LONG_DIGIT_RUN = /\d{6,}/;

/**
 * Looks for signs of personal information in an audit event.
 *
 * Returns a short description of the first problem found, or `null` when the
 * event is safe to record. The rules are deliberately blunt:
 *   - no `@` anywhere (an email address or a handle)
 *   - no run of six or more digits anywhere (an identity, passport or phone number),
 *     other than inside one of the prototype's own opaque tokens: a
 *     `…-DEMO-…` reference, or a gateway correlation id in `correlationId`
 *   - no whitespace inside `actor.ref` or `resource.ref` — references must be
 *     opaque tokens, not names or descriptions
 */
export function findPiiRisk(event: AuditEventInput): string | null {
  const fields: [string, string][] = [
    ['actor.role', event.actor.role],
    ['actor.ref', event.actor.ref],
    ['action', event.action],
    ['resource.type', event.resource.type],
    ['resource.ref', event.resource.ref],
    ['purpose', event.purpose],
    ['outcome', event.outcome],
    ['channel', event.channel],
    ['correlationId', event.correlationId],
  ];
  for (const [name, value] of fields) {
    if (typeof value !== 'string') return `${name} must be text`;
    if (value.includes('@')) return `${name} contains an @ sign, which looks like a contact detail`;
    const excused = name === 'correlationId' && GATEWAY_CORRELATION_ID.test(value);
    if (!excused && LONG_DIGIT_RUN.test(value.replace(OPAQUE_DEMO_TOKEN, ''))) {
      return `${name} contains a long run of digits, which looks like an identity or phone number`;
    }
  }
  const references: [string, string][] = [
    ['actor.ref', event.actor.ref],
    ['resource.ref', event.resource.ref],
  ];
  for (const [name, value] of references) {
    if (/\s/.test(value)) return `${name} contains a space, so it is not an opaque reference`;
  }
  return null;
}

function seedEvents(platform: Platform): AuditEvent[] {
  const now = platform.clock.now().getTime();
  const at = (msAgo: number) => platform.clock.iso(new Date(now - msAgo));
  const P = DEMO.persons;
  // Oldest first, as they would have been appended. The times line up with the
  // seeded cases, draft, appointment and consent in the other mock services.
  const events: (AuditEventInput & { msAgo: number })[] = [
    {
      msAgo: 2 * DAY + 20 * HOUR,
      actor: { role: 'citizen', ref: P.lerato },
      action: 'APPOINTMENT_VIEWED',
      resource: { type: 'appointment', ref: DEMO.appointments.leratoMission },
      purpose: 'Viewed own appointment',
      outcome: 'SUCCESS',
      channel: 'WEB',
      correlationId: 'CORR-DEMO-0901',
    },
    {
      msAgo: 2 * DAY,
      actor: { role: 'citizen', ref: P.sipho },
      action: 'DRAFT_RESUMED',
      resource: { type: 'draft', ref: DEMO.drafts.siphoPassport },
      purpose: 'Resumed own saved application',
      outcome: 'SUCCESS',
      channel: 'WEB',
      correlationId: 'CORR-DEMO-0902',
    },
    {
      msAgo: DAY,
      actor: { role: 'system', ref: 'WORKFLOW-ADAPTER-MOCK' },
      action: 'CASE_STATUS_CHANGED',
      resource: { type: 'case', ref: DEMO.cases.passportInProduction },
      purpose: 'Workflow event recorded against the case',
      outcome: 'SUCCESS',
      channel: 'SYSTEM',
      correlationId: 'CORR-DEMO-0903',
    },
    {
      msAgo: 18 * HOUR,
      actor: { role: 'citizen', ref: P.thandi },
      action: 'CONSENT_RECORDED',
      resource: { type: 'consent', ref: DEMO.consents.thandiWhatsApp },
      purpose: 'Opted in to WhatsApp update notices',
      outcome: 'SUCCESS',
      channel: 'WEB',
      correlationId: 'CORR-DEMO-0904',
    },
    {
      msAgo: 17 * HOUR,
      actor: { role: 'staff', ref: DEMO.staff.caseOfficer },
      action: 'CASE_OPENED',
      resource: { type: 'case', ref: DEMO.cases.birthInValidation },
      purpose: 'Evidence check on an assigned case',
      outcome: 'SUCCESS',
      channel: 'STAFF_CONSOLE',
      correlationId: 'CORR-DEMO-0905',
    },
    {
      msAgo: 16 * HOUR,
      actor: { role: 'staff', ref: DEMO.staff.caseOfficer },
      action: 'QUEUE_OPENED',
      resource: { type: 'queue', ref: 'QUEUE-SPECIALIST-REVIEW' },
      purpose: 'Queue is not assigned to this role',
      outcome: 'DENIED',
      channel: 'STAFF_CONSOLE',
      correlationId: 'CORR-DEMO-0906',
    },
    {
      msAgo: 2 * HOUR,
      actor: { role: 'citizen', ref: P.thandi },
      action: 'SIGN_IN',
      resource: { type: 'session', ref: 'SESSION-DEMO-0901' },
      purpose: 'Signed in with a passkey (mock)',
      outcome: 'SUCCESS',
      channel: 'WEB',
      correlationId: 'CORR-DEMO-0907',
    },
    {
      msAgo: 2 * HOUR - 3 * MINUTE,
      actor: { role: 'citizen', ref: P.thandi },
      action: 'CASE_VIEWED',
      resource: { type: 'case', ref: DEMO.cases.smartIdActionRequired },
      purpose: 'Viewed own application',
      outcome: 'SUCCESS',
      channel: 'WEB',
      correlationId: 'CORR-DEMO-0908',
    },
  ];
  return events.map(({ msAgo, ...event }, index) => ({
    auditId: `AUD-DEMO-${1001 + index}`,
    at: at(msAgo),
    ...event,
  }));
}

export function createAuditService(platform: Platform): AuditPort {
  const events = createCollection<AuditEvent>(platform, 'audit.events', (event) => event.auditId);

  function ensureSeeded(): void {
    if (!events.exists()) events.replaceAll(seedEvents(platform));
  }

  function nextAuditId(): string {
    let id = platform.ids.next('AUD-DEMO');
    while (events.get(id)) id = platform.ids.next('AUD-DEMO');
    return id;
  }

  return {
    async record(event) {
      ensureSeeded();
      const risk = findPiiRisk(event);
      if (risk !== null) {
        // The reason names the field and the rule only — never the offending value.
        throw new GatewayError('VALIDATION', {
          safeMessage: `This activity was not logged because it may contain personal information: ${risk}.`,
        });
      }
      // Only the contract fields are stored, whatever else the caller passed in.
      return events.put({
        auditId: nextAuditId(),
        at: platform.clock.iso(),
        actor: { role: event.actor.role, ref: event.actor.ref },
        action: event.action,
        resource: { type: event.resource.type, ref: event.resource.ref },
        purpose: event.purpose,
        outcome: event.outcome,
        channel: event.channel,
        correlationId: event.correlationId,
      });
    },

    async list(filter: AuditFilter = {}) {
      ensureSeeded();
      const requested = filter.limit ?? DEFAULT_LIMIT;
      const limit = Number.isFinite(requested) ? Math.max(0, Math.floor(requested)) : DEFAULT_LIMIT;
      // Stored in the order they were appended; returned newest first.
      return events
        .all()
        .reverse()
        .filter(
          (event) =>
            (filter.resourceRef === undefined || event.resource.ref === filter.resourceRef) &&
            (filter.actorRef === undefined || event.actor.ref === filter.actorRef),
        )
        .slice(0, limit);
    },
  };
}
