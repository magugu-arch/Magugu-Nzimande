import { z } from 'zod';
import { isoDateTime, provenanceSchema } from './provenance';

/**
 * Versions of the documents a supporter accepts before submitting a Fan
 * Moment. DRAFT until the club's legal team approves the wording; bump the
 * version whenever the text changes so earlier consents are re-requested.
 */
export const FAN_TERMS_VERSION = '2026-11-draft-1';
export const COMMUNITY_RULES_VERSION = '2026-11-draft-1';

export const FAN_MEDIA_RULES = {
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/webp'],
    maxBytes: 10 * 1024 * 1024,
  },
  video: {
    mimeTypes: ['video/mp4', 'video/quicktime'],
    maxBytes: 50 * 1024 * 1024,
    maxDurationSeconds: 30,
  },
} as const;

export const CAPTION_MAX = 280;

export interface FanMediaCandidate {
  mimeType: string;
  bytes: number;
  durationSeconds?: number | null;
}

export type MediaIssue = 'unsupported_type' | 'too_large' | 'too_long' | 'empty';

/** Client-side pre-check. The server repeats it and scans the file. */
export function validateFanMedia(m: FanMediaCandidate): MediaIssue[] {
  const issues: MediaIssue[] = [];
  if (m.bytes <= 0) issues.push('empty');
  const image = (FAN_MEDIA_RULES.image.mimeTypes as readonly string[]).includes(m.mimeType);
  const video = (FAN_MEDIA_RULES.video.mimeTypes as readonly string[]).includes(m.mimeType);
  if (!image && !video) return [...issues, 'unsupported_type'];
  const max = image ? FAN_MEDIA_RULES.image.maxBytes : FAN_MEDIA_RULES.video.maxBytes;
  if (m.bytes > max) issues.push('too_large');
  if (video && (m.durationSeconds ?? 0) > FAN_MEDIA_RULES.video.maxDurationSeconds) {
    issues.push('too_long');
  }
  return issues;
}

export const MEDIA_ISSUE_COPY: Record<MediaIssue, string> = {
  unsupported_type: 'Use a photo (JPEG, PNG, HEIC, WebP) or a video (MP4, MOV).',
  too_large: 'Photos can be up to 10 MB and videos up to 50 MB.',
  too_long: 'Videos can be up to 30 seconds long.',
  empty: 'That file looks empty. Try another one.',
};

export const fanConsentSchema = z.object({
  termsVersion: z.literal(FAN_TERMS_VERSION),
  communityRulesVersion: z.literal(COMMUNITY_RULES_VERSION),
  /** I own this content or have permission from everyone in it. */
  rightsConfirmed: z.literal(true),
  /** Show my display name with the post if approved. */
  showDisplayName: z.boolean(),
  acceptedAt: isoDateTime,
});
export type FanConsent = z.infer<typeof fanConsentSchema>;

export const fanPostDraftSchema = z
  .object({
    caption: z.string().trim().max(CAPTION_MAX),
    media: z.object({
      mimeType: z.string(),
      bytes: z.number().int().positive(),
      durationSeconds: z.number().nullable(),
      width: z.number().int().positive().nullable(),
      height: z.number().int().positive().nullable(),
    }),
    /** Safeguarding: does the photo or video show anyone under 18? */
    showsMinors: z.boolean(),
    /** Required when showsMinors is true. */
    guardianConsentConfirmed: z.boolean(),
    consent: fanConsentSchema,
  })
  .refine((d) => !d.showsMinors || d.guardianConsentConfirmed, {
    message: 'A parent or guardian must agree before a moment showing a child is shared.',
    path: ['guardianConsentConfirmed'],
  })
  .refine((d) => validateFanMedia(d.media).length === 0, {
    message: 'The media does not meet the upload rules.',
    path: ['media'],
  });
export type FanPostDraft = z.infer<typeof fanPostDraftSchema>;

export const FAN_POST_STATUSES = [
  'pending_review',
  'approved',
  'rejected',
  'hidden',
  'escalated',
  'removed_by_user',
] as const;
export type FanPostStatus = (typeof FAN_POST_STATUSES)[number];

export const MODERATION_ACTIONS = ['approve', 'reject', 'hide', 'escalate', 'restore'] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

const TRANSITIONS: Record<FanPostStatus, Partial<Record<ModerationAction, FanPostStatus>>> = {
  pending_review: { approve: 'approved', reject: 'rejected', escalate: 'escalated' },
  escalated: { approve: 'approved', reject: 'rejected', hide: 'hidden' },
  approved: { hide: 'hidden', escalate: 'escalated' },
  hidden: { restore: 'approved', reject: 'rejected', escalate: 'escalated' },
  rejected: {},
  removed_by_user: {},
};

/** The status a moderation action leads to, or null if it is not allowed. */
export function nextModerationStatus(
  current: FanPostStatus,
  action: ModerationAction,
): FanPostStatus | null {
  return TRANSITIONS[current][action] ?? null;
}

/**
 * Supporters can remove their own moment at any time, except while it is
 * escalated for a safeguarding or legal review, when it is held.
 */
export function ownerCanDelete(status: FanPostStatus): boolean {
  return status !== 'escalated' && status !== 'removed_by_user';
}

/** A moment is public only once approved. Posts showing minors start escalated. */
export function initialStatusFor(draft: Pick<FanPostDraft, 'showsMinors'>): FanPostStatus {
  return draft.showsMinors ? 'escalated' : 'pending_review';
}

export const FAN_REPORT_REASONS = [
  'spam',
  'harassment',
  'hate',
  'sexual_content',
  'violence',
  'privacy',
  'child_safety',
  'copyright',
  'other',
] as const;
export type FanReportReason = (typeof FAN_REPORT_REASONS)[number];

export const FAN_REPORT_REASON_COPY: Record<FanReportReason, string> = {
  spam: 'Spam or advertising',
  harassment: 'Bullying or harassment',
  hate: 'Hate or discrimination',
  sexual_content: 'Sexual content',
  violence: 'Violence or threats',
  privacy: 'Shares private information',
  child_safety: 'A child may be at risk',
  copyright: "Someone else's content",
  other: 'Something else',
};

export const fanReportSchema = z.object({
  postId: z.string().min(1),
  reason: z.enum(FAN_REPORT_REASONS),
  details: z.string().trim().max(500).nullable(),
});
export type FanReport = z.infer<typeof fanReportSchema>;

export const fanPostSchema = z.object({
  id: z.string().min(1),
  authorId: z.string().min(1),
  /** Shown only when the author chose to show it. */
  authorDisplayName: z.string().nullable(),
  caption: z.string(),
  mediaKind: z.enum(['image', 'video']),
  /** Signed, short-lived URL or a bundled demo image key. */
  mediaRef: z.string().min(1),
  status: z.enum(FAN_POST_STATUSES),
  statusReason: z.string().nullable(),
  createdAt: isoDateTime,
  provenance: provenanceSchema,
});
export type FanPost = z.infer<typeof fanPostSchema>;
