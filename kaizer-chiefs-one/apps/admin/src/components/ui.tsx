import type { ReactNode } from 'react';

export function PageHead({
  eyebrow,
  lead,
  accent,
  children,
}: {
  eyebrow: string;
  lead: string;
  accent?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="display">
        {lead}
        {accent ? <em>{accent}</em> : null}
      </h1>
      {children}
    </header>
  );
}

export function Notice({ notice, tone }: { notice?: string; tone?: string }) {
  if (!notice) return null;
  return (
    <div
      className={`notice ${tone === 'error' ? 'error' : ''}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {notice}
    </div>
  );
}

export function DemoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="banner">
      <span className="tag demo">Demo</span>
      <span>{children}</span>
    </div>
  );
}

export function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
