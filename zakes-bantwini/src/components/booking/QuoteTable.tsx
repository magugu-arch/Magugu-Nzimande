import { formatDayLong } from '@/lib/booking/dates';
import { formatZar } from '@/lib/booking/quote';
import type { Quote, QuoteLineKind } from '@/lib/booking/types';
import styles from './Portal.module.css';

const KIND_LABEL: Record<QuoteLineKind, string> = {
  performance: 'Performance',
  travel: 'Travel',
  accommodation: 'Accommodation',
  production: 'Production',
  additional: 'Additional costs',
};

/** The quote, line by line, in the brief's order — every section shown, even when nil. */
export function QuoteTable({ quote }: { quote: Quote }) {
  const kinds: QuoteLineKind[] = ['performance', 'travel', 'accommodation', 'production', 'additional'];
  return (
    <table className={styles.quote}>
      <caption className="visually-hidden">Quote version {quote.version}</caption>
      <thead>
        <tr>
          <th scope="col">Item</th>
          <th scope="col" className={styles.amount}>
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        {kinds.map((kind) => {
          const lines = quote.lines.filter((l) => l.kind === kind);
          if (lines.length === 0) {
            return (
              <tr key={kind} className={styles.nil}>
                <th scope="row">
                  {KIND_LABEL[kind]}
                  <span className={styles.lineNote}>Not included</span>
                </th>
                <td className={styles.amount}>—</td>
              </tr>
            );
          }
          return lines.map((l, i) => (
            <tr key={`${kind}-${i}`}>
              <th scope="row">
                {KIND_LABEL[kind]}
                <span className={styles.lineNote}>{l.description}</span>
              </th>
              <td className={`${styles.amount} mono-num`}>{formatZar(l.amountCents)}</td>
            </tr>
          ));
        })}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Subtotal</th>
          <td className={`${styles.amount} mono-num`}>{formatZar(quote.subtotalCents)}</td>
        </tr>
        <tr>
          <th scope="row">{quote.taxApplicable ? `VAT (${quote.taxRateBps / 100}%)` : 'Tax'}</th>
          <td className={`${styles.amount} mono-num`}>{quote.taxApplicable ? formatZar(quote.taxCents) : 'Not applicable'}</td>
        </tr>
        <tr className={styles.total}>
          <th scope="row">Total</th>
          <td className={`${styles.amount} mono-num`}>{formatZar(quote.totalCents)}</td>
        </tr>
        <tr>
          <th scope="row">
            Deposit ({quote.depositPercent}%)<span className={styles.lineNote}>Due by {formatDayLong(quote.depositDueDate)}</span>
          </th>
          <td className={`${styles.amount} mono-num`}>{formatZar(quote.depositCents)}</td>
        </tr>
        <tr>
          <th scope="row">
            Balance<span className={styles.lineNote}>{quote.balanceDueDate ? `Due by ${formatDayLong(quote.balanceDueDate)}` : 'Due as agreed'}</span>
          </th>
          <td className={`${styles.amount} mono-num`}>{formatZar(quote.balanceCents)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
