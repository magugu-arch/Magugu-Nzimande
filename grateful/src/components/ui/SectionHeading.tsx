import type { ReactNode } from 'react';
import { FadeIn } from './ImageReveal';

/**
 * The stacked, dash-joined heading from the editorial reference —
 * "SELECTED — / WORK" — set in Baskerville. Each line is its own element so
 * the stagger reads line by line, but screen readers hear one heading.
 */
export function SectionHeading({
  lines,
  as: Tag = 'h2',
  align = 'left',
  eyebrow,
  className = '',
  size = 'lg',
  id,
}: {
  id?: string;
  lines: ReactNode[];
  as?: 'h1' | 'h2' | 'h3';
  align?: 'left' | 'right';
  eyebrow?: string;
  className?: string;
  size?: 'md' | 'lg' | 'xl';
}) {
  const sizes = {
    md: 'text-[2.5rem] sm:text-5xl lg:text-6xl',
    lg: 'text-[3rem] sm:text-6xl lg:text-[5.5rem]',
    xl: 'text-[3.4rem] sm:text-7xl lg:text-[8.5rem]',
  };
  return (
    <div className={`${align === 'right' ? 'text-right' : ''} ${className}`}>
      {eyebrow && <p className="ui-label mb-6 opacity-60">{eyebrow}</p>}
      <Tag id={id} className={`editorial-title ${sizes[size]}`}>
        {lines.map((line, i) => (
          <FadeIn key={i} as="span" delay={i * 0.08} className="block">
            {line}
          </FadeIn>
        ))}
      </Tag>
    </div>
  );
}
