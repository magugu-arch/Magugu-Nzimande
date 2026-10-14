import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ArrowRight, ArrowUpRight } from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ink';
export type ButtonSize = 'md' | 'lg';

/**
 * primary   gold on ink — the one main action in a view
 * secondary hairline ivory — the alternative beside it
 * ghost     text with an arrow — tertiary, inline
 * ink       ink on ivory — the primary action on light surfaces
 */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md') {
  return cn(
    'pressable group inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none',
    'disabled:pointer-events-none disabled:opacity-50',
    size === 'lg' ? 'h-13 px-7 text-[0.975rem]' : 'h-11 px-5 text-[0.9rem]',
    variant === 'primary' &&
      'bg-gold text-ink shadow-[0_1px_0_rgb(255_255_255/0.35)_inset,0_10px_30px_-12px_rgb(203_164_93/0.6)] hover:bg-gold-bright',
    variant === 'secondary' &&
      'border border-ivory/35 text-ivory hover:border-ivory/70 hover:bg-ivory/[0.06] active:bg-ivory/10',
    variant === 'ghost' && 'h-auto px-0 text-gold-bright hover:text-ivory max-md:self-start',
    variant === 'ink' && 'bg-ink text-ivory hover:bg-charcoal',
  );
}

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  /** Show a trailing arrow. External links always get the outbound arrow. */
  arrow?: boolean;
}

/** An internal navigation styled as a button. External links use OutboundLink. */
export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size = 'md',
  className,
  arrow = variant === 'ghost',
}: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(buttonClasses(variant, size), className)}>
      {children}
      {arrow ? (
        <ArrowRight
          size={18}
          className="transition-transform duration-300 ease-out group-hover:translate-x-0.5"
        />
      ) : null}
    </Link>
  );
}

export function ExternalArrow() {
  return (
    <>
      <ArrowUpRight
        size={18}
        className="transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
      <span className="sr-only"> (opens the official site in a new tab)</span>
    </>
  );
}
