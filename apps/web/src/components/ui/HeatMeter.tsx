/**
 * The heat ladder, read straight off the sauce range.
 *
 * Rendered as filled segments rather than an icon, because the icon vocabulary
 * for heat is the one place a chilli reads as a warning rather than a scale —
 * and because a segment count survives a screen reader without needing a label
 * per step.
 */

const LEVELS = [1, 2, 3, 4, 5] as const;

export function HeatMeter({ heat, onDark = false }: { heat: number; onDark?: boolean }) {
  if (heat <= 0) {
    return <span className={onDark ? 'text-xs text-white/60' : 'text-xs text-muted'}>Mild</span>;
  }

  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`Heat ${heat} of 5`}>
      {LEVELS.map((level) => (
        <span
          key={level}
          aria-hidden="true"
          className={[
            'block h-1.5 w-3 rounded-full',
            level <= heat ? 'bg-red' : onDark ? 'bg-white/20' : 'bg-black-20',
          ].join(' ')}
        />
      ))}
    </span>
  );
}
