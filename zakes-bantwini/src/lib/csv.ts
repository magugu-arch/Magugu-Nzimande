/**
 * CSV for spreadsheets. Every cell is quoted, and a cell that a spreadsheet
 * would run as a formula (=, +, -, @, tab, CR at the start) is prefixed with
 * an apostrophe — submitted form text must never execute on management's
 * computer (CSV/formula injection).
 */
type Cell = string | number | boolean | null | undefined;

export function csvCell(value: Cell): string {
  let s = value === null || value === undefined ? '' : typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  // BOM so Excel reads UTF-8 (names with diacritics) correctly; CRLF per RFC 4180.
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
