'use client';

export function PrintButton() {
  return (
    <button type="button" className="btn btn--light btn--lg" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
