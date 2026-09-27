import { formatLongDate } from '../../../shared/format';

/** Available start times for the chosen date, as a radio group. Only open slots are ever listed. */
export function TimeSlotPicker({ date, slots, selected, onSelect, loading }: { date: string; slots: string[] | null; selected: string | null; onSelect: (t: string) => void; loading: boolean }) {
  const groups = [
    { label: 'Morning', times: (slots ?? []).filter((t) => t < '12:00') },
    { label: 'Afternoon', times: (slots ?? []).filter((t) => t >= '12:00') },
  ].filter((g) => g.times.length);

  return (
    <fieldset aria-busy={loading || undefined}>
      <legend className="font-serif text-2xl">{formatLongDate(date)}</legend>
      <p className="mt-1 font-sans text-sm opacity-60">Times are in Johannesburg time (SAST).</p>

      {loading && (
        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-12" />
          ))}
        </div>
      )}

      {!loading && slots && slots.length === 0 && <p className="mt-6 font-sans text-sm opacity-70">That day has just filled up. Please choose another date.</p>}

      {!loading &&
        groups.map((g) => (
          <div key={g.label} className="mt-6">
            <p className="ui-label mb-3 opacity-50">{g.label}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {g.times.map((t) => (
                <label
                  key={t}
                  className={`flex min-h-12 cursor-pointer items-center justify-center border font-sans text-base transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-white ${
                    selected === t ? 'border-white bg-white text-black' : 'border-white/35 hover:border-white'
                  }`}
                >
                  <input type="radio" name="time" value={t} checked={selected === t} onChange={() => onSelect(t)} className="sr-only" />
                  {t}
                </label>
              ))}
            </div>
          </div>
        ))}
    </fieldset>
  );
}
