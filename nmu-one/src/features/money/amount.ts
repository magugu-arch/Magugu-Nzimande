/** Parses "1500", "R1,500" or "1500.50" into cents; null unless a positive amount. */
export function parseRands(input: string): number | null {
  const clean = input.replace(/[\sR,]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const cents = Math.round(Number(clean) * 100);
  return cents > 0 ? cents : null;
}
