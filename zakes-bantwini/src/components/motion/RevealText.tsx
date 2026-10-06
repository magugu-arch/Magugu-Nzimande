import type { CSSProperties, ElementType } from 'react';

type Props = {
  /** One string per line; each slides up from behind its own mask. */
  lines: string[];
  as?: ElementType;
  className?: string;
  delay?: number;
  id?: string;
};

/** Masked line-by-line type reveal (brief §10 MOTION: hero masked type). */
export function RevealText({ lines, as: Tag = 'h2', className, delay = 0, id }: Props) {
  return (
    <Tag className={className} data-reveal="lines" style={{ '--reveal-delay': delay } as CSSProperties} id={id}>
      {lines.map((line, i) => (
        <span className="line" key={i} style={{ '--line-index': i } as CSSProperties}>
          <span>{line}</span>
        </span>
      ))}
    </Tag>
  );
}
