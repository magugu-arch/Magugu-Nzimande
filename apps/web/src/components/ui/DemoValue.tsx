import { DEMO_DATA } from '@bbq/seed';

/**
 * Marks a number on screen as unapproved demo data.
 *
 * CLAUDE.md section 8 requires every unconfirmed commercial value to be visibly
 * flagged in the interface. When the approved figures land, DEMO_DATA goes
 * false and every one of these disappears without a component being touched.
 */
export function DemoFlag({ label = 'Demo' }: { label?: string }) {
  if (!DEMO_DATA) return null;
  return (
    <span
      className="ml-2 inline-flex shrink-0 items-center rounded-full border border-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-gold"
      title="Sample value pending approved business data"
    >
      {label}
    </span>
  );
}

/** The standing notice that the whole build runs on sample commercial values. */
export function DemoNotice({ className }: { className?: string }) {
  if (!DEMO_DATA) return null;
  return (
    <p className={['text-xs leading-relaxed text-muted', className ?? ''].join(' ')}>
      Prices, fees, trading hours, points rules and allergen declarations shown here are
      sample values for review. They are not approved bb.q Chicken South Africa figures.
    </p>
  );
}
