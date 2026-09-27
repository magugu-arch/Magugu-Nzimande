import { ArrowUpRight, LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

type Variant = 'primary' | 'secondary' | 'ghost';
type Tone = 'dark' | 'light';

/**
 * Buttons are square-cornered and quiet: a filled bar for the one action that
 * matters on a screen, an outline for the alternative, a text link otherwise.
 * `tone` is the surface the button sits on.
 */
function classes(variant: Variant, tone: Tone, extra = '') {
  const base =
    'group inline-flex min-h-11 items-center whitespace-nowrap justify-center gap-3 px-6 ui-label transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-40';
  const byVariant: Record<Variant, Record<Tone, string>> = {
    primary: {
      dark: 'bg-white text-black hover:bg-white/85',
      light: 'bg-black text-white hover:bg-black/80',
    },
    secondary: {
      dark: 'border border-white/40 text-white hover:border-white hover:bg-white hover:text-black',
      light: 'border border-black/40 text-black hover:border-black hover:bg-black hover:text-white',
    },
    ghost: {
      dark: 'px-0 text-white underline-offset-8 hover:underline',
      light: 'px-0 text-black underline-offset-8 hover:underline',
    },
  };
  return `${base} ${byVariant[variant][tone]} ${extra}`;
}

type Common = { variant?: Variant; tone?: Tone; arrow?: boolean; children: ReactNode; className?: string };

export function ButtonLink({ variant = 'primary', tone = 'dark', arrow = false, children, className, ...rest }: Common & LinkProps) {
  return (
    <Link className={classes(variant, tone, className)} {...rest}>
      {children}
      {arrow && <ArrowUpRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
    </Link>
  );
}

export function Button({
  variant = 'primary',
  tone = 'dark',
  arrow = false,
  loading = false,
  children,
  className,
  disabled,
  ...rest
}: Common & { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={classes(variant, tone, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
      {children}
      {arrow && !loading && <ArrowUpRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
    </button>
  );
}
