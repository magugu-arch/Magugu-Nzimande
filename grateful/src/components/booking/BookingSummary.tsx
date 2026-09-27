import { formatDuration, formatLongDate, formatPriceState, formatRand } from '../../../shared/format';
import type { Service } from '../../../shared/types';
import { Picture } from '../ui/Picture';

/**
 * The running summary: the chosen service with its image, then date and time
 * once picked. Sits beside the steps on desktop and above them on mobile, so
 * the client always knows what they are booking and what it costs.
 */
export function BookingSummary({ service, date, time, compact = false }: { service: Service | null; date: string | null; time: string | null; compact?: boolean }) {
  if (!service) {
    return <p className="font-sans text-sm opacity-60">Choose a service to begin.</p>;
  }
  const rows: [string, string][] = [
    ['Duration', formatDuration(service.durationMinutes)],
    ['Date', date ? formatLongDate(date) : '—'],
    ['Time', time ? `${time} SAST` : '—'],
    ['Investment', formatPriceState(service.priceCents)],
  ];
  if (service.depositCents && service.priceCents && service.depositCents < service.priceCents) rows.push(['Deposit option', formatRand(service.depositCents)]);

  return (
    <div className={compact ? 'flex gap-4' : ''}>
      <Picture image={service.image} alt="" sizes={compact ? '80px' : '(min-width: 1024px) 28vw, 100vw'} className={compact ? 'h-24 w-20 shrink-0' : 'aspect-[4/3]'} />
      <div className={compact ? 'min-w-0 flex-1' : 'mt-6'}>
        <p className="ui-label opacity-50">Your booking</p>
        <p className={`mt-2 font-serif leading-tight ${compact ? 'text-xl' : 'text-3xl'}`}>{service.name}</p>
        {!compact && (
          <dl className="mt-6 border-t border-line">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 border-b border-line py-3 font-sans text-sm">
                <dt className="opacity-60">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {compact && (
          <p className="mt-1 font-sans text-sm opacity-70">
            {date ? formatLongDate(date) : formatDuration(service.durationMinutes)}
            {time ? ` · ${time}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
