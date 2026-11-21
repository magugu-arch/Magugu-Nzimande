import { resolveText, type ContentItem, type Locale } from '@scarlets/domain';
import { categoryLabels, kindLabels } from '@/lib/format';
import { Chip, DemoTag, Media } from './ui';

/**
 * How a supporter would see the item in one language, resolved the way the
 * app resolves it: Welsh where it exists, English with a visible fallback
 * label where it does not.
 */
export function ContentPreview({ item, locale }: { item: ContentItem; locale: Locale }) {
  const title = resolveText(item.title, locale);
  const summary = resolveText(item.summary, locale);
  const body = item.body.map((paragraph) => resolveText(paragraph, locale));
  const fallbacks = [title, summary, ...body].filter((part) => part.fallback).length;
  const name = locale === 'cy' ? 'Cymraeg' : 'English';

  return (
    <article className="preview" aria-label={`Preview in ${locale === 'cy' ? 'Welsh' : 'English'}`}>
      <div className="preview__bar">
        <p className="eyebrow">Preview · {name}</p>
        <div className="row">
          {locale === 'cy' && fallbacks > 0 ? (
            <Chip tone="warn">English fallback shown</Chip>
          ) : null}
          <DemoTag />
        </div>
      </div>
      <Media id={item.mediaId} size="wide" />
      <div className="preview__body">
        <p className="eyebrow">
          {categoryLabels[item.category]} · {kindLabels[item.kind]}
        </p>
        <div>
          <p className="preview__title" lang={title.locale}>
            {title.value}
          </p>
          {title.fallback ? <p className="fallback">No Welsh title: English shown</p> : null}
        </div>
        <div>
          <p className="preview__summary" lang={summary.locale}>
            {summary.value}
          </p>
          {summary.fallback ? <p className="fallback">No Welsh summary: English shown</p> : null}
        </div>
        {body.length > 0 ? (
          <div className="preview__copy">
            {body.map((paragraph, index) => (
              <p key={index} lang={paragraph.locale}>
                {paragraph.value}
              </p>
            ))}
            {body.some((paragraph) => paragraph.fallback) ? (
              <p className="fallback">No Welsh body: English shown</p>
            ) : null}
          </div>
        ) : null}
        {item.link ? (
          <p className="meta">
            Links out to: {resolveText(item.link.label, locale).value} ({item.link.url})
          </p>
        ) : null}
        <p className="preview__credit">{item.credit}</p>
      </div>
    </article>
  );
}
