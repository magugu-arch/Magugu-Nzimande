import type { Route } from 'next';
import Link from 'next/link';
import type { ComponentPropsWithoutRef } from 'react';

type Variant = 'red' | 'black' | 'ghost' | 'ghost-dark';
type Size = 'md' | 'sm';

const VARIANTS: Record<Variant, string> = {
  red: 'bg-red text-white hover:bg-red-deep',
  black: 'bg-black text-white hover:bg-black-80',
  ghost: 'border-[1.5px] border-line-strong bg-white hover:border-black hover:bg-paper',
  'ghost-dark': 'border-[1.5px] border-white/30 text-white hover:border-white hover:bg-white/10',
};

const SIZES: Record<Size, string> = {
  md: 'h-12 px-6 text-sm',
  sm: 'h-9.5 px-4 text-[13px]',
};

function classesFor(variant: Variant, size: Size, block: boolean, extra?: string) {
  return [
    'inline-flex items-center justify-center gap-2 rounded-full font-bold tracking-[0.01em]',
    'transition-[background-color,border-color,transform] duration-150 active:translate-y-px',
    'disabled:pointer-events-none disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    block ? 'w-full' : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function Button({
  variant = 'red',
  size = 'md',
  block = false,
  className,
  ...props
}: ComponentPropsWithoutRef<'button'> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}) {
  return <button className={classesFor(variant, size, block, className)} {...props} />;
}

/**
 * Generic over the route so that a built path such as `/menu/${slug}` infers
 * the same way it does on a plain Link. Typed routes then catch a link to a
 * page that does not exist, at build time.
 */
export function ButtonLink<T extends string>({
  variant = 'red',
  size = 'md',
  block = false,
  className,
  href,
  ...props
}: Omit<ComponentPropsWithoutRef<'a'>, 'href'> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  href: Route<T>;
}) {
  return <Link href={href} className={classesFor(variant, size, block, className)} {...props} />;
}
