/** R1,090 — rand with a thousands separator and no decimals for whole amounts. */
export function rand(amount: number, opts: { cents?: boolean } = {}): string {
  const whole = Number.isInteger(amount) && !opts.cents;
  const n = whole ? Math.round(amount).toLocaleString('en-US') : amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `R${n}`;
}

/** Approximate foreign-currency hint for visitors. Rates are indicative, set in env. */
export function approx(amountZar: number): { usd: string; eur: string; gbp: string } {
  const r = {
    usd: Number(process.env.NEXT_PUBLIC_FX_USD ?? 0.055),
    eur: Number(process.env.NEXT_PUBLIC_FX_EUR ?? 0.05),
    gbp: Number(process.env.NEXT_PUBLIC_FX_GBP ?? 0.043),
  };
  const f = (v: number) => Math.round(v);
  return { usd: `$${f(amountZar * r.usd)}`, eur: `€${f(amountZar * r.eur)}`, gbp: `£${f(amountZar * r.gbp)}` };
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
