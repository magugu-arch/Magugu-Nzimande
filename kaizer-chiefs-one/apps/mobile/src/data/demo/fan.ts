import * as Crypto from 'expo-crypto';
import {
  fanPostDraftSchema,
  fanReportSchema,
  initialStatusFor,
  ok,
  ownerCanDelete,
  unavailable,
  type FanMomentsProvider,
  type FanPost,
} from '@kc-one/contracts';
import { useDemoFan } from '@/state/demoFan';
import { demoProvenance, latency } from './common';

/** Sample, already-approved moments for the feed. Captions say they are samples. */
const feed: FanPost[] = (
  [
    ['demo-fm-1', 'supporterPortrait', 'Sample moment · Scarves up'],
    ['demo-fm-2', 'stadium', 'Sample moment · Under the lights'],
    ['demo-fm-3', 'fanCam', 'Sample moment · On the big screen'],
    ['demo-fm-4', 'womensTeam', 'Sample moment · Hands in'],
  ] as const
).map(([id, mediaRef, caption]) => ({
  id,
  authorId: 'demo',
  authorDisplayName: 'Demo supporter',
  caption,
  mediaKind: 'image' as const,
  mediaRef,
  status: 'approved' as const,
  statusReason: null,
  createdAt: new Date().toISOString(),
  provenance: demoProvenance(id),
}));

/**
 * Demo Fan Moments. Submissions are validated against the same contract as
 * live ones (consent, rights, safeguarding, upload rules) and then kept on
 * this phone only. Nothing is uploaded and nobody moderates them.
 */
export const demoFan: FanMomentsProvider = {
  async listFeed() {
    return latency(ok(feed, demoProvenance()));
  },
  async listMine(userId) {
    const mine = useDemoFan
      .getState()
      .posts.filter((p) => p.authorId === userId && p.status !== 'removed_by_user');
    return latency(ok(mine, demoProvenance()));
  },
  async submit(userId, draft, localMediaUri) {
    const parsed = fanPostDraftSchema.safeParse(draft);
    if (!parsed.success)
      return unavailable('error', parsed.error.issues[0]?.message ?? 'Check the details.');
    const post: FanPost & { localUri: string } = {
      id: `demo-mine-${Crypto.randomUUID()}`,
      authorId: userId,
      authorDisplayName: draft.consent.showDisplayName ? 'You' : null,
      caption: draft.caption,
      mediaKind: draft.media.mimeType.startsWith('video/') ? 'video' : 'image',
      mediaRef: localMediaUri,
      localUri: localMediaUri,
      status: initialStatusFor(draft),
      statusReason: null,
      createdAt: new Date().toISOString(),
      provenance: demoProvenance(),
    };
    useDemoFan.getState().add(post);
    return latency(ok(post, post.provenance), 400);
  },
  async remove(userId, postId) {
    const post = useDemoFan.getState().posts.find((p) => p.id === postId);
    if (!post || post.authorId !== userId)
      return unavailable('not_eligible', 'You can only remove your own moments.');
    if (!ownerCanDelete(post.status)) {
      return unavailable(
        'not_eligible',
        'This moment is held for review and cannot be removed right now.',
      );
    }
    useDemoFan.getState().markRemoved(postId);
    return latency(ok({ removed: true as const }, demoProvenance()));
  },
  async report(_userId, report) {
    const parsed = fanReportSchema.safeParse(report);
    if (!parsed.success) return unavailable('error', 'Choose a reason for the report.');
    return latency(
      unavailable(
        'demo_restricted',
        'In the live app this report goes straight to the moderation team. In the demo, nothing was sent.',
      ),
    );
  },
};
