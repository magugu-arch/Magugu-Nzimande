import type { Faq } from '@/content/types';
import { cn } from '@/lib/cn';
import { PlusIcon } from './icons';

/**
 * FAQs on native <details>: keyboard and screen-reader support for free, and
 * an animated height where the browser supports interpolate-size.
 */
export function Accordion({ items, tone = 'light' }: { items: Faq[]; tone?: 'light' | 'dark' }) {
  return (
    <div
      className={cn(
        'divide-y border-y',
        tone === 'light' ? 'divide-ink/10 border-ink/10' : 'divide-ivory/10 border-ivory/10',
      )}
    >
      {items.map((faq) => (
        <details key={faq.question} className="accordion group">
          <summary className="flex items-center justify-between gap-6 py-5 text-left text-[1.0625rem] font-semibold">
            {faq.question}
            <span
              className={cn(
                'accordion-icon grid size-9 shrink-0 place-items-center rounded-full ring-1',
                tone === 'light' ? 'ring-ink/15' : 'ring-ivory/20',
              )}
            >
              <PlusIcon size={18} />
            </span>
          </summary>
          <p
            className={cn(
              'max-w-2xl pb-6 leading-relaxed',
              tone === 'light' ? 'text-slate' : 'text-ivory/75',
            )}
          >
            {faq.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
