import { AlertTriangle, Check, Clock, LoaderCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BookingStatus, PaymentStatus } from '../../../shared/types';

/**
 * Small building blocks for the studio dashboard. Black and white only, as
 * the CI requires, so state is carried by shape, icon and words — never by
 * colour alone.
 */

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="border border-line">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <h2 className="font-serif text-2xl">{title}</h2>
        {action}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

const BOOKING_LABEL: Record<BookingStatus, string> = {
  confirmed: 'Confirmed',
  pending_payment: 'Awaiting payment',
  needs_attention: 'Needs attention',
  cancelled: 'Cancelled',
  expired: 'Lapsed',
};

export function BookingChip({ status }: { status: BookingStatus }) {
  const style =
    status === 'confirmed'
      ? 'bg-white text-black border-white'
      : status === 'needs_attention'
        ? 'bg-white text-black border-white font-semibold'
        : status === 'pending_payment'
          ? 'border-white/60 border-dashed'
          : 'border-white/25 opacity-60 line-through';
  const Icon = status === 'confirmed' ? Check : status === 'needs_attention' ? AlertTriangle : status === 'pending_payment' ? Clock : X;
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-sans text-xs whitespace-nowrap ${style}`}>
      <Icon aria-hidden className="size-3" />
      {BOOKING_LABEL[status]}
    </span>
  );
}

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  not_required: 'No payment',
  pending: 'Unpaid',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
  cancelled: 'Payment cancelled',
};

export function PaymentChip({ status }: { status: PaymentStatus }) {
  return <span className="font-sans text-xs whitespace-nowrap opacity-70">{PAYMENT_LABEL[status]}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="bg-black px-4 py-4">
      <p className="ui-label opacity-60">{label}</p>
      <p className="mt-2 font-serif text-4xl tabular-nums">{value}</p>
      {hint && <p className="mt-1 font-sans text-xs opacity-60">{hint}</p>}
    </div>
  );
}

export function SmallButton({
  children,
  onClick,
  variant = 'outline',
  busy = false,
  disabled,
  type = 'button',
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'outline' | 'solid' | 'text';
  busy?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  label?: string;
}) {
  const cls =
    variant === 'solid'
      ? 'bg-white text-black hover:bg-white/85'
      : variant === 'outline'
        ? 'border border-white/40 hover:border-white hover:bg-white hover:text-black'
        : 'underline-offset-4 hover:underline';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={label}
      className={`inline-flex min-h-11 items-center justify-center gap-2 px-3 font-sans text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${cls}`}
    >
      {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Notice({ kind, children }: { kind: 'error' | 'ok'; children: ReactNode }) {
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 border px-3 py-2 font-sans text-sm ${kind === 'error' ? 'border-white' : 'border-white/30'}`}>
      {kind === 'error' ? <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" /> : <Check aria-hidden className="mt-0.5 size-4 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

export const inputCls =
  'min-h-11 w-full border border-white/30 bg-black px-3 font-sans text-base text-white outline-none focus:border-white [color-scheme:dark] placeholder:opacity-40';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-6 font-sans text-sm opacity-70">
      <LoaderCircle aria-hidden className="size-4 animate-spin" /> {label}
    </p>
  );
}
