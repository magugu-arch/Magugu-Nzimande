import type { ContentItem } from '@scarlets/domain';
import { CONTENT_LIMITS, joinParagraphs } from '@/lib/content-rules';
import { Field } from './ui';

/** The fields an editor fills in: an English and a Welsh slot for each, and the Welsh status. */
export function ContentFields({
  item,
  canApproveWelsh,
}: {
  item?: ContentItem;
  canApproveWelsh: boolean;
}) {
  const requested = item?.translation === 'approved' ? 'approved' : 'draft';
  return (
    <>
      <div className="pair">
        <Field label="Title" lang="EN" htmlFor="titleEn">
          <input
            id="titleEn"
            name="titleEn"
            type="text"
            required
            maxLength={CONTENT_LIMITS.title}
            defaultValue={item?.title.en ?? ''}
          />
        </Field>
        <Field
          label="Title"
          lang="CY"
          htmlFor="titleCy"
          hint="Leave empty if there is no Welsh yet."
        >
          <input
            id="titleCy"
            name="titleCy"
            type="text"
            lang="cy"
            maxLength={CONTENT_LIMITS.title}
            defaultValue={item?.title.cy ?? ''}
            aria-describedby="titleCy-hint"
          />
        </Field>
      </div>
      <div className="pair">
        <Field label="Summary" lang="EN" htmlFor="summaryEn">
          <textarea
            id="summaryEn"
            name="summaryEn"
            rows={3}
            required
            maxLength={CONTENT_LIMITS.summary}
            defaultValue={item?.summary.en ?? ''}
          />
        </Field>
        <Field label="Summary" lang="CY" htmlFor="summaryCy">
          <textarea
            id="summaryCy"
            name="summaryCy"
            rows={3}
            lang="cy"
            maxLength={CONTENT_LIMITS.summary}
            defaultValue={item?.summary.cy ?? ''}
          />
        </Field>
      </div>
      <div className="pair">
        <Field
          label="Body"
          lang="EN"
          htmlFor="bodyEn"
          hint="Leave a blank line between paragraphs."
        >
          <textarea
            id="bodyEn"
            name="bodyEn"
            rows={8}
            defaultValue={item ? joinParagraphs(item.body, 'en') : ''}
            aria-describedby="bodyEn-hint"
          />
        </Field>
        <Field
          label="Body"
          lang="CY"
          htmlFor="bodyCy"
          hint="Same number of paragraphs as the English, or leave empty."
        >
          <textarea
            id="bodyCy"
            name="bodyCy"
            rows={8}
            lang="cy"
            defaultValue={item ? joinParagraphs(item.body, 'cy') : ''}
            aria-describedby="bodyCy-hint"
          />
        </Field>
      </div>
      <Field
        label="Welsh status"
        htmlFor="translation"
        hint={
          <>
            With no Welsh title the item is saved as “Welsh missing” and Welsh readers see the
            English text with a fallback label.{' '}
            {canApproveWelsh
              ? 'Mark it approved only when the club has signed the Welsh off.'
              : 'Only a club admin can mark Welsh as approved.'}
          </>
        }
      >
        <select
          id="translation"
          name="translation"
          defaultValue={requested}
          aria-describedby="translation-hint"
        >
          <option value="draft">Welsh draft: not yet signed off</option>
          <option value="approved">Welsh approved by the club</option>
        </select>
      </Field>
    </>
  );
}
