'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './button.module.css';
import { cx } from './cx';
import { AppLink, type LinkProps } from './link';

export type ButtonVariant =
  'primary' | 'secondary' | 'quiet' | 'inverse' | 'inverseOutline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonLook {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
}

function lookClass({ variant = 'primary', size = 'md', fullWidth }: ButtonLook, extra?: string) {
  return cx(
    styles.button,
    styles[variant],
    size !== 'md' && styles[size],
    fullWidth && styles.full,
    extra,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonLook {
  /** Shows a spinner, announces "busy" and blocks repeat presses. */
  loading?: boolean;
}

export function Button({
  variant,
  size,
  fullWidth,
  iconStart,
  iconEnd,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={lookClass({ variant, size, fullWidth }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : iconStart}
      <span>{children}</span>
      {iconEnd}
    </button>
  );
}

export interface LinkButtonProps extends LinkProps, ButtonLook {}

/** A link that looks like a button. Use for navigation; use `Button` for actions. */
export function LinkButton({
  variant,
  size,
  fullWidth,
  iconStart,
  iconEnd,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <AppLink className={lookClass({ variant, size, fullWidth }, className)} {...rest}>
      {iconStart}
      <span>{children}</span>
      {iconEnd}
    </AppLink>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
}

export function IconButton({
  label,
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button type={type} className={cx(styles.iconButton, className)} aria-label={label} {...rest}>
      {children}
    </button>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <span className={styles.spinner} aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
