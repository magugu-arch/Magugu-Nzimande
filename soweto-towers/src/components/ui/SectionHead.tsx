import type { ReactNode } from 'react';

/** Eyebrow + title on the left, a short line set against the right edge (the deck's slide header). */
export function SectionHead({
  eyebrow,
  title,
  intro,
  as: Tag = 'h2',
  size = 'h2',
  id,
}: {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  as?: 'h1' | 'h2';
  size?: 'h1' | 'h2';
  id?: string;
}) {
  return (
    <header className="section-head reveal">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <Tag className={size} id={id}>
          {title}
        </Tag>
      </div>
      {intro ? <p>{intro}</p> : null}
    </header>
  );
}
