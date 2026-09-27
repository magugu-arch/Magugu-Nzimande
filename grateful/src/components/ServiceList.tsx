import { Link } from 'react-router';
import { formatDuration, formatPriceState } from '../../shared/format';
import { useServices } from '../lib/useServices';
import { ButtonLink } from './ui/Button';
import { FadeIn } from './ui/ImageReveal';

/**
 * The services as numbered editorial rows — the home page's compact index.
 * The Services page has the long-form version with imagery.
 */
export function ServiceList({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { services, error, loading } = useServices();
  const line = tone === 'dark' ? 'border-line' : 'border-ink-line';

  if (error) {
    return (
      <p role="alert" className="font-sans text-sm opacity-70">
        {error} You can still <Link className="underline" to="/contact">contact the studio</Link> to book.
      </p>
    );
  }

  return (
    <ol className={`border-t ${line}`} aria-busy={loading || undefined}>
      {loading &&
        Array.from({ length: 4 }, (_, i) => (
          <li key={i} className={`border-b ${line} py-8`}>
            <div className="skeleton h-9 w-2/3" />
            <div className="skeleton mt-4 h-4 w-1/3" />
          </li>
        ))}
      {services?.map((s, i) => (
        <FadeIn as="li" key={s.id} delay={i * 0.05} className={`border-b ${line}`}>
          <div className="editorial-grid items-baseline gap-y-4 py-8 lg:py-10">
            <span className="ui-label col-span-1 opacity-50">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="col-span-3 font-serif text-[1.6rem] leading-[1.05] break-words uppercase sm:text-4xl md:col-span-7 lg:col-span-5">{s.name}</h3>
            <p className="col-span-4 max-w-md opacity-70 md:col-span-6 md:col-start-2 lg:col-span-3 lg:col-start-auto">{s.description}</p>
            <dl className="col-span-2 font-sans text-sm md:col-span-4 md:col-start-2 lg:col-span-2 lg:col-start-auto">
              <div className="flex gap-2">
                <dt className="sr-only">Duration</dt>
                <dd>{formatDuration(s.durationMinutes)}</dd>
              </div>
              <div className="flex gap-2 opacity-70">
                <dt className="sr-only">Price</dt>
                <dd>{formatPriceState(s.priceCents)}</dd>
              </div>
            </dl>
            <div className="col-span-2 justify-self-end md:col-span-2 lg:col-span-1">
              <ButtonLink to={`/booking?service=${s.id}`} variant="ghost" tone={tone} arrow aria-label={`Book ${s.name}`}>
                Book
              </ButtonLink>
            </div>
          </div>
        </FadeIn>
      ))}
    </ol>
  );
}
