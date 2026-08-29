import { formatMoney, formatMoneyCompact, type Cents } from '@bbq/types';

/**
 * The one place cents becomes text. Tabular figures so a column of prices lines
 * up, and the raw amount stays machine-readable for anything parsing the page.
 */
export function Price({
  cents,
  compact = false,
  className,
}: {
  cents: Cents;
  /** Drops a trailing ".00", for price flags and card corners. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={['tabular', className ?? ''].join(' ')} data-cents={cents}>
      {compact ? formatMoneyCompact(cents) : formatMoney(cents)}
    </span>
  );
}
