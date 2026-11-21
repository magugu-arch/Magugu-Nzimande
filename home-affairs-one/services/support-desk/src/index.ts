/**
 * Mock support desk: call-back requests, complaints and feedback.
 *
 * Stands in for a contact-centre system. The point it demonstrates is the
 * hand-off: an adviser receives only the minimum context the person agreed to
 * share — a masked application reference and a one-line summary — and never
 * the free text the person typed.
 */
import {
  DEMO,
  type CreateSupportRequestInput,
  type SupportPort,
  type SupportRequest,
} from '@hao/api-contracts';
import { createCollection, DAY, type Platform } from '@hao/local-platform';
import { GatewayError, maskReference, type MutationOptions } from '@hao/shared-types';

const MAX_DETAIL_LENGTH = 1000;
const MIN_TOPIC_LENGTH = 3;

/** The seeded call-back request for Thandi's Smart ID replacement. */
export const DEMO_SEED_SUPPORT_REQUEST_ID = 'HELP-DEMO-1001';

/**
 * Builds the context passed to an adviser. With consent and an application to
 * refer to, that is a masked reference and a fixed sentence built from it.
 * The person's own words are never copied into the summary.
 */
export function buildSharedContext(
  shareContext: boolean,
  caseId: string | null,
): SupportRequest['sharedContext'] {
  if (!shareContext || caseId === null) {
    return { consented: false, caseToken: null, summary: null };
  }
  const caseToken = maskReference(caseId);
  return {
    consented: true,
    caseToken,
    summary: `Person asked for help with application ${caseToken}.`,
  };
}

function seedRequests(platform: Platform): SupportRequest[] {
  const caseId = DEMO.cases.smartIdActionRequired;
  return [
    {
      requestId: DEMO_SEED_SUPPORT_REQUEST_ID,
      kind: 'CALLBACK',
      personToken: DEMO.persons.thandi,
      caseId,
      topic: 'Choosing where to finish my Smart ID replacement',
      detail:
        'I am not sure which service point I can use to finish my application. Please call me back.',
      preferredTime: 'Weekday mornings',
      contactChannel: 'PHONE',
      status: 'IN_PROGRESS',
      createdAt: platform.clock.iso(new Date(platform.clock.now().getTime() - DAY)),
      sharedContext: buildSharedContext(true, caseId),
    },
  ];
}

function validate(input: CreateSupportRequestInput): { topic: string; detail: string } {
  const topic = input.topic.trim();
  if (topic.length < MIN_TOPIC_LENGTH) {
    throw new GatewayError('VALIDATION', {
      safeMessage: 'Tell us in a few words what you need help with.',
    });
  }
  const detail = input.detail.trim();
  if (detail.length > MAX_DETAIL_LENGTH) {
    throw new GatewayError('VALIDATION', {
      safeMessage: `Please shorten your message to ${MAX_DETAIL_LENGTH} characters or fewer.`,
    });
  }
  return { topic, detail };
}

export function createSupportService(platform: Platform): SupportPort {
  const requests = createCollection<SupportRequest>(
    platform,
    'support.requests',
    (request) => request.requestId,
  );

  function ensureSeeded(): void {
    if (!requests.exists()) requests.replaceAll(seedRequests(platform));
  }

  function nextRequestId(): string {
    let id = platform.ids.next('HELP-DEMO');
    while (requests.get(id)) id = platform.ids.next('HELP-DEMO');
    return id;
  }

  return {
    async createRequest(input, _options: MutationOptions) {
      ensureSeeded();
      const { topic, detail } = validate(input);
      const preferredTime = input.preferredTime?.trim() ?? '';
      return requests.put({
        requestId: nextRequestId(),
        kind: input.kind,
        personToken: input.personToken,
        caseId: input.caseId,
        topic,
        detail,
        preferredTime: preferredTime.length > 0 ? preferredTime : null,
        contactChannel: input.contactChannel,
        status: 'RECEIVED',
        createdAt: platform.clock.iso(),
        sharedContext: buildSharedContext(input.shareContext, input.caseId),
      });
    },

    async listRequests(personToken) {
      ensureSeeded();
      // Stored oldest first; returned newest first.
      return requests.find((request) => request.personToken === personToken).reverse();
    },

    async listOpenRequests() {
      ensureSeeded();
      return requests.find((request) => request.status !== 'RESOLVED').reverse();
    },
  };
}
