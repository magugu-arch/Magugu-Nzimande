import { z } from 'zod';
import { contentCategory, type LocalizedText, type TranslationStatus } from '@scarlets/domain';
import { optionalText, requiredText } from './validation';

export const CONTENT_LIMITS = { title: 110, summary: 240, body: 12_000 } as const;

/** What an editor can change on an item: both language slots and the Welsh status. */
export const contentFields = z.object({
  titleEn: requiredText('an English title', CONTENT_LIMITS.title),
  titleCy: optionalText('the Welsh title', CONTENT_LIMITS.title),
  summaryEn: requiredText('an English summary', CONTENT_LIMITS.summary),
  summaryCy: optionalText('the Welsh summary', CONTENT_LIMITS.summary),
  bodyEn: z.string().max(CONTENT_LIMITS.body, 'The English body is too long.').default(''),
  bodyCy: z.string().max(CONTENT_LIMITS.body, 'The Welsh body is too long.').default(''),
  /** What the editor asked for. The saved status also depends on what Welsh exists. */
  translation: z.enum(['draft', 'approved'], 'Choose a Welsh status.').default('draft'),
});
export type ContentFields = z.infer<typeof contentFields>;

/** A new item starts as a draft. Video, audio and reports come from the club's own systems. */
export const newContentFields = contentFields.extend({
  kind: z.enum(['news', 'feature'], 'Choose news or feature.'),
  category: contentCategory,
  mediaId: z.string('Choose an image.').min(1, 'Choose an image.'),
});
export type NewContentFields = z.infer<typeof newContentFields>;

/** Paragraphs are separated by a blank line. */
export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** The body as textarea text for one language. Welsh only when every paragraph has it. */
export function joinParagraphs(body: readonly LocalizedText[], locale: 'en' | 'cy'): string {
  if (locale === 'en') return body.map((paragraph) => paragraph.en).join('\n\n');
  if (body.length === 0 || body.some((paragraph) => !paragraph.cy?.trim())) return '';
  return body.map((paragraph) => paragraph.cy).join('\n\n');
}

export type BodyResult = { ok: true; body: LocalizedText[] } | { ok: false; message: string };

/**
 * Welsh paragraphs are matched to English ones by position, so a Welsh body
 * is either absent (English is shown with a fallback label) or complete.
 */
export function buildBody(bodyEn: string, bodyCy: string): BodyResult {
  const en = splitParagraphs(bodyEn);
  const cy = splitParagraphs(bodyCy);
  if (cy.length > 0 && cy.length !== en.length) {
    return {
      ok: false,
      message: `The Welsh body has ${cy.length} paragraph${cy.length === 1 ? '' : 's'} and the English has ${en.length}. Match them one for one, or leave the Welsh body empty.`,
    };
  }
  return {
    ok: true,
    body: en.map((paragraph, index) => {
      const welsh = cy[index];
      return welsh ? { en: paragraph, cy: welsh } : { en: paragraph };
    }),
  };
}

export function toLocalized(en: string, cy: string): LocalizedText {
  return cy ? { en, cy } : { en };
}

export type TranslationDecision =
  | { ok: true; status: TranslationStatus }
  | { ok: false; reason: 'incomplete' | 'needs_approver'; message: string };

/**
 * The Welsh status that will be saved.
 *
 * missing   no Welsh title: Welsh readers get English with a fallback label
 * draft     Welsh exists but the club has not signed it off
 * approved  signed off. Only someone who can publish may set this, and
 *           changing the Welsh afterwards drops it back to draft.
 */
export function decideTranslation(args: {
  titleCy: string;
  summaryCy: string;
  requested: 'draft' | 'approved';
  previous: TranslationStatus | null;
  welshChanged: boolean;
  canApprove: boolean;
}): TranslationDecision {
  if (!args.titleCy) return { ok: true, status: 'missing' };
  if (args.requested === 'draft') return { ok: true, status: 'draft' };
  if (!args.summaryCy) {
    return {
      ok: false,
      reason: 'incomplete',
      message:
        'Welsh can be marked approved only when the Welsh title and the Welsh summary are both filled in.',
    };
  }
  if (args.previous === 'approved' && !args.welshChanged) return { ok: true, status: 'approved' };
  if (args.canApprove) return { ok: true, status: 'approved' };
  return {
    ok: false,
    reason: 'needs_approver',
    message: 'Only a club admin can sign Welsh off as approved. Save it as a Welsh draft instead.',
  };
}
