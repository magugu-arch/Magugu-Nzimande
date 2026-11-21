// The proposal's charts, drawn as SVG from the figures in data.mjs.
//
// They follow one set of rules: a single axis, thin marks with a rounded data
// end and a square baseline, a small gap between stacked segments, direct
// labels in ink (never in the series colour), hairline solid gridlines, and a
// legend wherever there is more than one series. The three scenario colours
// were checked for colour-blind separation on the card surface. The PDF is
// static, so every charted value is also printed in a table on the same slide.
import {
  build,
  currency,
  ownership,
  partnerCases,
  partners,
  returns,
  roleTotals,
  runningMonthly,
  seasonValue,
  threeYearCost,
  valueLines,
  yearOneCost,
} from './data.mjs';

export const money = (n) => `${currency.symbol}${Math.round(n).toLocaleString('en-GB')}`;
export const k = (n, digits = 0) => {
  const value = n / 1000;
  return `${currency.symbol}${value.toFixed(Number.isInteger(value) ? 0 : digits || 1)}k`;
};

const SERIES = { conservative: '#2A6FB5', base: '#C8102E', stretch: '#B07A1E' };
const MARK = '#3B101B';
const GAP = 3;

/** A bar with a rounded data end and a square baseline. */
function hbar(x, y, w, h, fill, round = 6) {
  const r = Math.min(round, w / 2);
  return `<path d="M${x} ${y}h${w - r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - r)}z" fill="${fill}"/>`;
}
function vbar(x, yTop, w, h, fill, round = 6) {
  const r = Math.min(round, h / 2);
  return `<path d="M${x} ${yTop + h}v${-(h - r)}a${r} ${r} 0 0 1 ${r} ${-r}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - r}z" fill="${fill}"/>`;
}

/* ------------------------------------------- partner fees against the build */

export function partnerBars() {
  const W = 1070;
  const H = 640;
  const x0 = 392;
  const x1 = W - 96;
  const max = 150_000;
  const sx = (v) => x0 + (v / max) * (x1 - x0);
  const rows = [
    {
      label: 'The build, once',
      sub: 'Full fan app, fixed price',
      parts: [{ v: build.price, fill: MARK }],
    },
    {
      label: 'Base case, a season',
      sub: `Presenting ${k(partners[0].fee)} · Passport ${k(partners[1].fee)} · Matchday ${k(partners[2].fee)}`,
      parts: [
        { v: partners[0].fee, fill: '#C8102E' },
        { v: partners[1].fee, fill: '#D6485E' },
        { v: partners[2].fee, fill: '#E38592' },
      ],
    },
    {
      label: 'All six properties, a season',
      sub: 'The full rate card',
      parts: [{ v: partnerCases.stretch, fill: '#B07A1E' }],
    },
    {
      label: 'Presenting partner, three seasons',
      sub: `A launch partnership, ${k(partners[0].fee)} a season`,
      parts: [1, 2, 3].map((season, i) => ({
        v: partners[0].fee,
        fill: ['#C8102E', '#D6485E', '#E38592'][i],
        text: `Season ${season}`,
        ink: i === 2,
      })),
    },
  ];
  const top = 70;
  const step = 132;
  const bh = 30;
  let out = '';
  for (const tick of [0, 50_000, 100_000, 150_000]) {
    out += `<line class="grid" x1="${sx(tick)}" x2="${sx(tick)}" y1="${top - 24}" y2="${H - 44}"/>`;
    out += `<text class="tick" x="${sx(tick)}" y="${H - 16}" text-anchor="middle">${tick === 0 ? '0' : k(tick)}</text>`;
  }
  rows.forEach((row, i) => {
    const y = top + i * step;
    out += `<text class="lbl" x="0" y="${y + 14}">${row.label}</text>`;
    out += `<text class="cs" x="0" y="${y + 38}">${row.sub}</text>`;
    let x = x0;
    const total = row.parts.reduce((s, p) => s + p.v, 0);
    row.parts.forEach((part, j) => {
      const last = j === row.parts.length - 1;
      const w = (part.v / max) * (x1 - x0) - (last ? 0 : GAP);
      out += last
        ? hbar(x, y, w, bh, part.fill)
        : `<rect x="${x}" y="${y}" width="${w}" height="${bh}" fill="${part.fill}"/>`;
      if (part.text && w > 86) {
        out += `<text class="in" x="${x + w / 2}" y="${y + 20.5}" text-anchor="middle"${part.ink ? ' style="fill:#3B101B"' : ''}>${part.text}</text>`;
      }
      x += w + (last ? 0 : GAP);
    });
    // a total that ends just short of the build line is labelled beyond the line
    const nearLine = total < build.price && sx(build.price) - sx(total) < 80;
    const labelX = nearLine ? sx(build.price) + 12 : sx(total) + 14;
    out += `<text class="val" x="${labelX}" y="${y + 23}">${k(total)}</text>`;
  });
  // the build as a reference line
  out += `<line x1="${sx(build.price)}" x2="${sx(build.price)}" y1="${top - 24}" y2="${H - 44}" stroke="${MARK}" stroke-width="1.5"/>`;
  out += `<text class="ref" x="${sx(build.price) + 10}" y="${top - 30}">Build ${k(build.price)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Partner fees against the build cost">${out}</svg>`;
}

/* --------------------------------------------------- a season's value */

export function waterfall() {
  const W = 856;
  const H = 606;
  const x0 = 70;
  const x1 = W - 16;
  const y0 = H - 78;
  const yTop = 30;
  const max = 200_000;
  const sy = (v) => y0 - (v / max) * (y0 - yTop);
  const cols = [
    ...valueLines.map((line) => ({ label: line.short, v: line.cases.base.value })),
    { label: 'A season', v: seasonValue.base, total: true },
  ];
  const slot = (x1 - x0) / cols.length;
  const bw = 44;
  let out = '';
  for (const tick of [0, 50_000, 100_000, 150_000, 200_000]) {
    out += `<line class="${tick === 0 ? 'axis' : 'grid'}" x1="${x0}" x2="${x1}" y1="${sy(tick)}" y2="${sy(tick)}"/>`;
    out += `<text class="tick" x="${x0 - 14}" y="${sy(tick) + 5}" text-anchor="end">${tick === 0 ? '0' : k(tick)}</text>`;
  }
  let running = 0;
  cols.forEach((col, i) => {
    const cx = x0 + slot * i + slot / 2;
    const from = col.total ? 0 : running;
    const to = col.total ? col.v : running + col.v;
    const fill = col.total ? '#B07A1E' : col.label === 'Partners' ? '#C8102E' : MARK;
    const h = sy(from) - sy(to);
    out +=
      from === 0
        ? vbar(cx - bw / 2, sy(to), bw, h, fill)
        : `<rect x="${cx - bw / 2}" y="${sy(to)}" width="${bw}" height="${h}" rx="5" fill="${fill}"/>`;
    out += `<text class="val s" x="${cx}" y="${sy(to) - 12}" text-anchor="middle">${k(col.v)}</text>`;
    if (!col.total && i < cols.length - 2) {
      out += `<line class="grid" x1="${cx + bw / 2 + 4}" x2="${cx + slot - bw / 2 - 4}" y1="${sy(to)}" y2="${sy(to)}"/>`;
    }
    const words = col.label.split(', ');
    const lines =
      words.length > 1
        ? words
        : col.label.split(' reach ').length > 1
          ? ['Paid reach', 'replaced']
          : col.label === 'Extra tickets'
            ? ['Extra', 'tickets']
            : [col.label];
    lines.forEach((text, n) => {
      out += `<text class="lbl" x="${cx}" y="${y0 + 28 + n * 20}" text-anchor="middle" style="font-size:13.5px${col.total ? ';font-weight:600' : ''}">${text}</text>`;
    });
    if (!col.total) running = to;
  });
  // what it has to repay
  const refs = [
    { v: build.price, text: `Build, ${k(build.price)}`, dy: 20 },
    { v: yearOneCost, text: `Year one: build and running, ${k(yearOneCost, 1)}`, dy: -8 },
  ];
  for (const ref of refs) {
    out += `<line x1="${x0}" x2="${x1}" y1="${sy(ref.v)}" y2="${sy(ref.v)}" stroke="${MARK}" stroke-width="1.5"/>`;
    out += `<text class="ref" x="${x0 + 10}" y="${sy(ref.v) + ref.dy}">${ref.text}</text>`;
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="How a base-case season adds up">${out}</svg>`;
}

/* ------------------------------------------- the club's position over time */

export function returnLines() {
  const W = 1150;
  const H = 520;
  const x0 = 74;
  const x1 = W - 190;
  const yTop = 22;
  const y0 = H - 56;
  const min = -200_000;
  const max = 900_000;
  const months = 36;
  const sx = (m) => x0 + (m / months) * (x1 - x0);
  const sy = (v) => y0 - ((v - min) / (max - min)) * (y0 - yTop);
  let out = '';
  for (const tick of [-200_000, 0, 200_000, 400_000, 600_000, 800_000]) {
    out += `<line class="${tick === 0 ? 'axis' : 'grid'}" x1="${x0}" x2="${x1}" y1="${sy(tick)}" y2="${sy(tick)}"/>`;
    out += `<text class="tick" x="${x0 - 14}" y="${sy(tick) + 5}" text-anchor="end">${tick === 0 ? '0' : tick < 0 ? `−${k(-tick)}` : k(tick)}</text>`;
  }
  for (let m = 0; m <= months; m += 6) {
    out += `<text class="tick" x="${sx(m)}" y="${y0 + 28}" text-anchor="middle">${m}</text>`;
  }
  for (const season of [12, 24]) {
    out += `<line class="grid" x1="${sx(season)}" x2="${sx(season)}" y1="${yTop}" y2="${y0}"/>`;
  }
  [6, 18, 30].forEach((month, i) => {
    out += `<text class="ref" x="${sx(month)}" y="${yTop + 14}" text-anchor="middle" style="fill:#6E686A">Season ${i + 1}</text>`;
  });
  out += `<text class="ref" x="${x1}" y="${y0 + 50}" text-anchor="end" style="fill:#6E686A">Months after launch</text>`;
  const order = ['conservative', 'base', 'stretch'];
  for (const key of order) {
    const r = returns[key];
    const end = -build.price + r.monthly * months;
    out += `<line x1="${sx(0)}" y1="${sy(-build.price)}" x2="${sx(months)}" y2="${sy(end)}" stroke="${SERIES[key]}" stroke-width="3" stroke-linecap="round"/>`;
  }
  for (const key of order) {
    const r = returns[key];
    const end = -build.price + r.monthly * months;
    // payback marker, with a ring in the surface colour so it stays clear of the lines
    out += `<circle cx="${sx(r.paybackMonths)}" cy="${sy(0)}" r="8" fill="${SERIES[key]}" stroke="#F8F6F2" stroke-width="3"/>`;
    out += `<circle cx="${sx(months)}" cy="${sy(end)}" r="6" fill="${SERIES[key]}" stroke="#F8F6F2" stroke-width="3"/>`;
    out += `<text class="val s" x="${sx(months) + 16}" y="${sy(end) + 1}">${k(end, 1)}</text>`;
    out += `<text class="ref" x="${sx(months) + 16}" y="${sy(end) + 21}" style="fill:#6E686A">${key}</text>`;
  }
  out += `<text class="ref" x="${sx(0) + 12}" y="${sy(-build.price) + 26}">Start: the ${k(build.price)} build</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="The club's cumulative position after launch">${out}</svg>`;
}

export function returnLegend() {
  const names = { conservative: 'Conservative', base: 'Base', stretch: 'Stretch' };
  return `<div class="legend">${['conservative', 'base', 'stretch']
    .map(
      (key) =>
        `<span style="--c:${SERIES[key]}">${names[key]}: pays back in ${returns[key].paybackMonths.toFixed(1)} months</span>`,
    )
    .join('')}</div>`;
}

/* --------------------------------------------- the build, by discipline */

export function disciplineBars() {
  const W = 610;
  const rowH = 84;
  const H = roleTotals.length * rowH;
  const x0 = 0;
  const x1 = W - 200;
  const max = 180;
  let out = '';
  roleTotals.forEach((role, i) => {
    const y = i * rowH;
    const w = (role.days / max) * (x1 - x0);
    out += `<text class="lbl" x="0" y="${y + 16}" style="font-size:14.5px">${role.name}</text>`;
    out += hbar(x0, y + 28, w, 24, MARK);
    out += `<text class="val s" x="${x0 + w + 12}" y="${y + 47}">${role.days} days · ${money(role.price)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="The build by discipline">${out}</svg>`;
}

/* ------------------------------------------------ three years of ownership */

export function ownershipBars() {
  const W = 680;
  const H = 286;
  const x0 = 140;
  const x1 = W - 130;
  const max = 160_000;
  const sx = (v) => x0 + (v / max) * (x1 - x0);
  let out = '';
  for (const tick of [0, 50_000, 100_000, 150_000]) {
    out += `<line class="grid" x1="${sx(tick)}" x2="${sx(tick)}" y1="8" y2="${H - 44}"/>`;
    out += `<text class="tick" x="${sx(tick)}" y="${H - 18}" text-anchor="middle">${tick === 0 ? '0' : k(tick)}</text>`;
  }
  ownership.forEach((year, i) => {
    const y = 22 + i * 72;
    out += `<text class="lbl" x="0" y="${y + 19}">Year ${['one', 'two', 'three'][i]}</text>`;
    let x = x0;
    if (year.build) {
      const w = (year.build / max) * (x1 - x0) - GAP;
      out += `<rect x="${x}" y="${y}" width="${w}" height="28" fill="${MARK}"/>`;
      x += w + GAP;
    }
    const w = (year.running / max) * (x1 - x0);
    out += hbar(x, y, w, 28, '#B07A1E');
    out += `<text class="val s" x="${x + w + 12}" y="${y + 21}">${money(year.build + year.running)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Cost of ownership by year">${out}</svg>`;
}

export const ownershipLegend = `<div class="legend"><span style="--c:${MARK}">The build, once</span><span style="--c:#B07A1E">Running, ${money(runningMonthly)} a month</span></div>`;

export const totals = { threeYearCost, yearOneCost };
