'use client';

export function QuantityStepper({
  quantity,
  onChange,
  label,
  removable = true,
}: {
  quantity: number;
  onChange: (next: number) => void;
  /** Names the thing being counted, so each control reads on its own. */
  label: string;
  /** False where one is the floor, so the control stops rather than removing. */
  removable?: boolean;
}) {
  const removes = removable && quantity === 1;

  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-white p-1">
      <button
        type="button"
        onClick={() => onChange(quantity - 1)}
        disabled={!removable && quantity <= 1}
        // Below one this removes the line, so the label has to say so rather
        // than promising a decrement that empties the row instead.
        aria-label={removes ? `Remove ${label}` : `One fewer ${label}`}
        className="grid size-8 place-items-center rounded-full text-lg leading-none transition-colors hover:bg-paper disabled:opacity-30 disabled:hover:bg-transparent"
      >
        {removes ? (
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
            <path
              fill="currentColor"
              d="M6 2h4v1H6V2ZM3 4h10v1.4h-1l-.7 8.2A1.4 1.4 0 0 1 9.9 15H6.1a1.4 1.4 0 0 1-1.4-1.4L4 5.4H3V4Z"
            />
          </svg>
        ) : (
          <span aria-hidden="true">&minus;</span>
        )}
      </button>
      <span className="tabular w-6 text-center text-sm font-bold" aria-hidden="true">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        aria-label={`One more ${label}`}
        className="grid size-8 place-items-center rounded-full text-lg leading-none transition-colors hover:bg-paper"
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
