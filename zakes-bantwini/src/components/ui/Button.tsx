import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import styles from './ui.module.css';

type Variant = 'primary' | 'outline' | 'accent' | 'text';

function classes(variant: Variant, small?: boolean, extra?: string) {
  return [styles.btn, styles[variant], small ? styles.small : '', extra].filter(Boolean).join(' ');
}

/** Button styling for a plain <a> — downloads and route handlers, which must not go through client navigation. */
export const buttonClass = classes;

export function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 22 10" aria-hidden="true">
      <path d="M0 5h20M16 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

type LinkProps = Omit<ComponentProps<typeof Link>, 'className'> & {
  variant?: Variant;
  small?: boolean;
  arrow?: boolean;
  className?: string;
  children: ReactNode;
  cursor?: 'Watch' | 'Listen' | 'Open' | 'Book';
};

export function ButtonLink({ variant = 'primary', small, arrow, className, children, cursor, ...rest }: LinkProps) {
  return (
    <Link {...rest} className={classes(variant, small, className)} data-cursor={cursor}>
      {children}
      {arrow && <Arrow />}
    </Link>
  );
}

type ButtonProps = ComponentProps<'button'> & { variant?: Variant; small?: boolean; arrow?: boolean };

export function Button({ variant = 'primary', small, arrow, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button {...rest} type={type} className={classes(variant, small, className)}>
      {children}
      {arrow && <Arrow />}
    </button>
  );
}
