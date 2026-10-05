'use client';

import { useId, useState } from 'react';
import { TableWrap } from './ui';

/**
 * Small, dependency-free charts for the console.
 *
 * Colours are validated with the dataviz palette checker (light surface,
 * #ffffff): one series uses DATA_1; ordered stages (a funnel) use the
 * one-hue ORDINAL ramp, whose lightest step still clears 2:1 on white. The
 * console is light-only (`color-scheme: light`), so there is no dark ramp.
 *
 * Every chart labels its values in text, shows the same detail on hover and
 * keyboard focus, and has a table twin — colour never carries meaning alone.
 */
export const DATA_1 = '#256abf';
export const ORDINAL = ['#86b6ef', '#3987e5', '#1c5cab', '#132e51'] as const;

export interface BarDatum {
  id: string;
  label: string;
  value: number;
  /** Text at the bar tip, e.g. "64%". */
  display: string;
  /** Extra line for the tooltip and table, e.g. "1,204 of 1,880 opened". */
  detail?: string;
  color?: string;
}

function Tooltip({ datum, id }: { datum: BarDatum; id: string }) {
  return (
    <span className="chart-tip" id={id} role="tooltip">
      <strong>{datum.display}</strong>
      <span>{datum.label}</span>
      {datum.detail ? <span>{datum.detail}</span> : null}
    </span>
  );
}

/** Horizontal bars from one baseline. `max` fixes the scale (e.g. 100 for %). */
export function BarChart({
  title,
  data,
  max,
  valueHeader,
}: {
  title: string;
  data: BarDatum[];
  max?: number;
  valueHeader: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const base = useId();
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="chart">
      <figcaption className="visually-hidden">{title}</figcaption>
      <ul className="bars" aria-label={title}>
        {data.map((d) => {
          const tipId = `${base}-${d.id}`;
          const share = Math.max(0, Math.min(1, d.value / top));
          return (
            <li
              key={d.id}
              className="bar-row"
              tabIndex={0}
              aria-describedby={active === d.id ? tipId : undefined}
              onPointerEnter={() => setActive(d.id)}
              onPointerLeave={() => setActive((a) => (a === d.id ? null : a))}
              onFocus={() => setActive(d.id)}
              onBlur={() => setActive((a) => (a === d.id ? null : a))}
              data-active={active === d.id}
            >
              <span className="bar-label">{d.label}</span>
              <span className="bar-plot">
                <span
                  className="bar"
                  style={{ width: `${share * 100}%`, background: d.color ?? DATA_1 }}
                  aria-hidden="true"
                />
                <span className="bar-value">{d.display}</span>
                {active === d.id ? <Tooltip datum={d} id={tipId} /> : null}
              </span>
            </li>
          );
        })}
      </ul>
      <details className="table-twin">
        <summary>Show as table</summary>
        <TableWrap label={title}>
          <table>
            <caption className="visually-hidden">{title}</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col" className="num">
                  {valueHeader}
                </th>
                {data.some((d) => d.detail) ? <th scope="col">Detail</th> : null}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id}>
                  <th scope="row">{d.label}</th>
                  <td className="num">{d.display}</td>
                  {data.some((x) => x.detail) ? <td>{d.detail ?? ''}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </details>
    </figure>
  );
}

/** Targeted → delivered → opened → actioned, as ordered stages. */
export function Funnel({
  title,
  stages,
}: {
  title: string;
  stages: { id: string; label: string; value: number }[];
}) {
  const first = stages[0]?.value ?? 0;
  const fmt = (n: number) =>
    Math.round(n)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (
    <BarChart
      title={title}
      valueHeader="People"
      max={first || 1}
      data={stages.map((s, i) => {
        const prev = stages[i - 1]?.value;
        return {
          id: s.id,
          label: s.label,
          value: s.value,
          display: fmt(s.value),
          detail:
            i === 0
              ? 'Estimated audience'
              : `${first ? Math.round((s.value / first) * 100) : 0}% of audience${prev ? ` · ${Math.round((s.value / prev) * 100)}% of ${stages[i - 1]!.label.toLowerCase()}` : ''}`,
          color: ORDINAL[Math.min(i, ORDINAL.length - 1)],
        };
      })}
    />
  );
}
