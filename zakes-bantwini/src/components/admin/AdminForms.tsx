'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { FormAlert, TextArea, TextField, Checkbox, fieldStyles } from '@/components/forms/fields';
import { Button } from '@/components/ui/Button';
import type { AdminState } from '@/app/admin/actions';
import { calculateQuote, DEFAULT_CANCELLATION_TERMS, DEFAULT_DEPOSIT_PERCENT, DEFAULT_TAX_RATE_BPS, formatZar, parseRandToCents } from '@/lib/booking/quote';
import { QUOTE_LINE_KINDS, type Quote, type QuoteLineKind } from '@/lib/booking/types';
import styles from '@/app/admin/admin.module.css';

type Action = (prev: AdminState, form: FormData) => Promise<AdminState>;
const initial: AdminState = { ok: false, message: null };

/** A server-action form that reports its own result inline. */
export function ActionForm({
  action,
  children,
  submit,
  variant = 'primary',
  className,
  resetOnSuccess = false,
}: {
  action: Action;
  children?: ReactNode;
  submit: string;
  variant?: 'primary' | 'outline' | 'accent';
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state.ok) form.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={form} action={formAction} className={className ?? styles.inline}>
      {children}
      <div>
        <Button type="submit" variant={variant} small disabled={pending} aria-busy={pending}>
          {pending ? 'Working…' : submit}
        </Button>
      </div>
      {state.message && (
        <div style={{ flexBasis: '100%' }}>
          <FormAlert tone={state.ok ? 'success' : 'error'}>{state.message}</FormAlert>
        </div>
      )}
    </form>
  );
}

const KIND_LABEL: Record<QuoteLineKind, string> = {
  performance: 'Performance',
  travel: 'Travel',
  accommodation: 'Accommodation',
  production: 'Production',
  additional: 'Additional',
};

type Line = { kind: QuoteLineKind; description: string; amount: string };

const rand = (cents: number) => (cents / 100).toFixed(2);

/**
 * Quote editor: line items by category, VAT, deposit, dates and terms, with
 * live totals from the same arithmetic the server stores. Saves a draft, or
 * saves and sends in one step.
 */
export function QuoteEditor({ action, draft, defaults }: { action: Action; draft: Quote | null; defaults: { depositDueDate: string; validUntil: string; balanceDueDate: string | null } }) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [lines, setLines] = useState<Line[]>(
    draft?.lines.map((l) => ({ kind: l.kind, description: l.description, amount: rand(l.amountCents) })) ?? [
      { kind: 'performance', description: 'Performance fee', amount: '' },
      { kind: 'travel', description: 'Flights and ground transport', amount: '' },
      { kind: 'accommodation', description: 'Accommodation', amount: '' },
      { kind: 'production', description: 'Production and backline', amount: '' },
    ],
  );
  const [taxApplicable, setTax] = useState(draft?.taxApplicable ?? true);
  const [taxRate, setTaxRate] = useState(String((draft?.taxRateBps ?? DEFAULT_TAX_RATE_BPS) / 100));
  const [deposit, setDeposit] = useState(String(draft?.depositPercent ?? DEFAULT_DEPOSIT_PERCENT));
  const [depositDueDate, setDepositDue] = useState(draft?.depositDueDate ?? defaults.depositDueDate);
  const [balanceDueDate, setBalanceDue] = useState(draft?.balanceDueDate ?? defaults.balanceDueDate ?? '');
  const [validUntil, setValidUntil] = useState(draft?.validUntil ?? defaults.validUntil);
  const [terms, setTerms] = useState(draft?.cancellationTerms ?? DEFAULT_CANCELLATION_TERMS);
  const [message, setMessage] = useState(draft?.clientMessage ?? '');

  const parsed = lines.map((l) => ({ kind: l.kind, description: l.description.trim(), amountCents: parseRandToCents(l.amount || '0') }));
  const valid = parsed.every((l) => l.amountCents !== null);
  const payload = {
    lines: parsed.filter((l) => (l.amountCents ?? 0) > 0 || l.kind === 'performance').map((l) => ({ ...l, amountCents: l.amountCents ?? 0 })),
    taxApplicable,
    taxRateBps: Math.round(Number(taxRate) * 100),
    depositPercent: Math.round(Number(deposit)),
    depositDueDate,
    balanceDueDate: balanceDueDate || null,
    validUntil,
    cancellationTerms: terms,
    clientMessage: message || undefined,
  };
  let totals: ReturnType<typeof calculateQuote> | null = null;
  try {
    totals = valid ? calculateQuote(payload.lines, payload) : null;
  } catch {
    totals = null;
  }

  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    // Validation is the editor's own (amounts, totals) and the server's; empty lines are allowed.
    <form action={formAction} className={styles.panel} style={{ background: 'transparent', padding: 0, border: 0 }} noValidate>
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      {lines.map((l, i) => (
        <div key={i} className={styles.quoteLine}>
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label} htmlFor={`kind-${i}`}>
              Category
            </label>
            <select id={`kind-${i}`} className={`${fieldStyles.input} ${fieldStyles.select}`} value={l.kind} onChange={(e) => update(i, { kind: e.target.value as QuoteLineKind })}>
              {QUOTE_LINE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <TextField name={`desc-${i}`} label="Description" value={l.description} onChange={(e) => update(i, { description: e.target.value })} />
          <TextField
            name={`amount-${i}`}
            label="Amount (R)"
            inputMode="decimal"
            value={l.amount}
            onChange={(e) => update(i, { amount: e.target.value })}
            error={parseRandToCents(l.amount || '0') === null ? 'Not an amount' : undefined}
          />
          <button type="button" className={styles.remove} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label={`Remove line ${i + 1}`} disabled={lines.length === 1}>
            ×
          </button>
        </div>
      ))}
      <div>
        <Button variant="outline" small onClick={() => setLines((ls) => [...ls, { kind: 'additional', description: '', amount: '' }])}>
          Add line
        </Button>
      </div>

      <div className={fieldStyles.row3}>
        <Checkbox name="taxApplicable" label="Charge VAT" checked={taxApplicable} onChange={(e) => setTax(e.target.checked)} />
        <TextField name="taxRate" label="VAT rate (%)" inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} disabled={!taxApplicable} />
        <TextField name="deposit" label="Deposit (%)" inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
      </div>
      <div className={fieldStyles.row3}>
        <TextField name="depositDueDate" label="Deposit due" type="date" value={depositDueDate} onChange={(e) => setDepositDue(e.target.value)} />
        <TextField name="balanceDueDate" label="Balance due" type="date" optional value={balanceDueDate} onChange={(e) => setBalanceDue(e.target.value)} />
        <TextField name="validUntil" label="Quote valid until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
      </div>
      <TextArea name="terms" label="Cancellation terms" rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} hint="Default wording is a template — have it approved by management’s legal adviser." />
      <TextArea name="message" label="Message to the client" optional rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />

      <div className={styles.quoteTotals} aria-live="polite">
        {totals ? (
          <>
            <span>Subtotal</span>
            <span>{formatZar(totals.subtotalCents)}</span>
            <span>VAT</span>
            <span>{formatZar(totals.taxCents)}</span>
            <span className={styles.grand}>Total</span>
            <span className={styles.grand}>{formatZar(totals.totalCents)}</span>
            <span>Deposit</span>
            <span>{formatZar(totals.depositCents)}</span>
            <span>Balance</span>
            <span>{formatZar(totals.balanceCents)}</span>
          </>
        ) : (
          <span>Fix the highlighted amounts to see totals.</span>
        )}
      </div>

      {state.message && <FormAlert tone={state.ok ? 'success' : 'error'}>{state.message}{state.fields ? ` (${Object.keys(state.fields).join(', ')})` : ''}</FormAlert>}
      <div className={styles.actions}>
        <Button type="submit" name="intent" value="draft" variant="outline" small disabled={pending || !valid}>
          Save draft
        </Button>
        <Button type="submit" name="intent" value="send" small disabled={pending || !valid}>
          {pending ? 'Working…' : 'Save and send to client'}
        </Button>
      </div>
    </form>
  );
}
