'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Mark } from '@/components/brand/Logo';
import { Check, Gift, Mail, Minus, Plus, WhatsAppGlyph } from '@/components/ui/icons';
import { packages, type ActivityId, type PackageId } from '@/content/catalog';
import { rand } from '@/lib/format';
import { ymdInSast } from '@/lib/time';
import styles from './page.module.css';

type Product = { type: 'package'; id: PackageId } | { type: 'activity'; id: ActivityId } | { type: 'amount'; amount: number };

export function GiftForm({ catalog }: { catalog: { id: ActivityId; name: string; price: number }[] }) {
  const [product, setProduct] = useState<Product>({ type: 'package', id: 'jump-film' });
  const [amount, setAmount] = useState(500);
  const [qty, setQty] = useState(1);
  const [delivery, setDelivery] = useState<'whatsapp' | 'email' | 'me'>('whatsapp');
  const [recipient, setRecipient] = useState({ name: '', email: '', phone: '' });
  const [message, setMessage] = useState('');
  const [deliverOn, setDeliverOn] = useState('');
  const [purchaser, setPurchaser] = useState({ name: '', email: '', phone: '' });
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // The earliest delivery date is set straight on the input after mount: a state
  // update here would re-render the form just as React restores anything typed
  // before the page finished loading, and wipe it.
  const deliverOnRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    deliverOnRef.current?.setAttribute('min', ymdInSast(new Date()));
  }, []);
  const [payfast, setPayfast] = useState<{ action: string; fields: Record<string, string> } | null>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (payfast) form.current?.submit();
  }, [payfast]);

  const options: { key: string; product: Product; name: string; price: number; note?: string }[] = [
    ...packages.map((p) => ({
      key: p.id,
      product: { type: 'package' as const, id: p.id },
      name: p.name,
      price: p.price,
      note: p.recommended ? 'Most gifted' : undefined,
    })),
    ...catalog
      .filter((a) => a.id !== 'bungee-jump')
      .map((a) => ({ key: a.id, product: { type: 'activity' as const, id: a.id }, name: a.name, price: a.price })),
  ];
  const unit = product.type === 'amount' ? amount : (options.find((o) => o.key === (product as { id: string }).id)?.price ?? 0);
  const label = product.type === 'amount' ? `${rand(amount)} gift voucher` : (options.find((o) => o.key === (product as { id: string }).id)?.name ?? '');
  const total = unit * qty;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    try {
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: product.type === 'amount' ? { type: 'amount', amount } : product,
          quantity: qty,
          recipient,
          message,
          delivery,
          deliverOn,
          purchaser,
          consents: { terms, marketing },
        }),
      });
      const d = await res.json();
      if (!d.ok) return setErrors(d.errors ?? ['Something went wrong.']);
      if (d.value.payment?.kind === 'redirect') window.location.assign(d.value.payment.url);
      else if (d.value.payment?.kind === 'form') setPayfast(d.value.payment);
    } catch {
      setErrors(['We couldn’t reach the payment system. Check your connection.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.formMain}>
          <fieldset className={styles.block}>
            <legend className="h3">1. Choose the gift</legend>
            <div className={styles.options} role="radiogroup" aria-label="Gift">
              {options.map((o) => {
                const on = product.type !== 'amount' && (product as { id: string }).id === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`${styles.option} ${on ? styles.optionOn : ''}`}
                    onClick={() => setProduct(o.product)}
                  >
                    <span className={styles.optionName}>{o.name}</span>
                    <span className="price">{rand(o.price)}</span>
                    {o.note && <span className="badge badge--orange">{o.note}</span>}
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={product.type === 'amount'}
                className={`${styles.option} ${product.type === 'amount' ? styles.optionOn : ''}`}
                onClick={() => setProduct({ type: 'amount', amount })}
              >
                <span className={styles.optionName}>Any amount</span>
                <span className="price">R100–R10,000</span>
              </button>
            </div>
            {product.type === 'amount' && (
              <label className="field">
                <span className="field-label">Amount in rand</span>
                <input
                  className="input num"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => {
                    const v = Math.min(10000, Number(e.target.value.replace(/\D/g, '')) || 0);
                    setAmount(v);
                    setProduct({ type: 'amount', amount: v });
                  }}
                />
              </label>
            )}
            <div className={styles.qty}>
              <span className="field-label">How many vouchers?</span>
              <div className={styles.stepper}>
                <button type="button" aria-label="One fewer" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>
                  <Minus />
                </button>
                <output className="num">{qty}</output>
                <button type="button" aria-label="One more" onClick={() => setQty((q) => Math.min(10, q + 1))} disabled={qty >= 10}>
                  <Plus />
                </button>
              </div>
            </div>
          </fieldset>

          <fieldset className={styles.block}>
            <legend className="h3">2. Who’s it for?</legend>
            <label className="field">
              <span className="field-label">Their name</span>
              <input className="input" value={recipient.name} onChange={(e) => setRecipient({ ...recipient, name: e.target.value })} />
            </label>
            <div className={styles.delivery} role="radiogroup" aria-label="Delivery">
              {(
                [
                  ['whatsapp', 'WhatsApp', <WhatsAppGlyph key="w" size={18} />],
                  ['email', 'Email', <Mail key="m" width={18} height={18} />],
                  ['me', 'Send to me to print', <Gift key="g" width={18} height={18} />],
                ] as const
              ).map(([key, text, icon]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={delivery === key}
                  className={`${styles.pill} ${delivery === key ? styles.pillOn : ''}`}
                  onClick={() => setDelivery(key)}
                >
                  {icon} {text}
                </button>
              ))}
            </div>
            {delivery === 'whatsapp' && (
              <label className="field">
                <span className="field-label">Their WhatsApp number</span>
                <input
                  className="input"
                  type="tel"
                  inputMode="tel"
                  value={recipient.phone}
                  onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })}
                  placeholder="082 123 4567"
                />
              </label>
            )}
            {delivery === 'email' && (
              <label className="field">
                <span className="field-label">Their email</span>
                <input
                  className="input"
                  type="email"
                  inputMode="email"
                  value={recipient.email}
                  onChange={(e) => setRecipient({ ...recipient, email: e.target.value })}
                />
              </label>
            )}
            {delivery !== 'me' && (
              <label className="field">
                <span className="field-label">Send on (optional)</span>
                <input ref={deliverOnRef} className="input" type="date" value={deliverOn} onChange={(e) => setDeliverOn(e.target.value)} />
                <span className="field-hint">Leave empty to send as soon as you’ve paid.</span>
              </label>
            )}
            <label className="field">
              <span className="field-label">Your message (optional)</span>
              <textarea
                className="input"
                maxLength={280}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Happy birthday! Time to face the drop."
              />
              <span className="field-hint">{280 - message.length} characters left</span>
            </label>
          </fieldset>

          <fieldset className={styles.block}>
            <legend className="h3">3. Your details</legend>
            <div className={styles.grid2}>
              <label className="field">
                <span className="field-label">Your name</span>
                <input className="input" autoComplete="name" value={purchaser.name} onChange={(e) => setPurchaser({ ...purchaser, name: e.target.value })} />
              </label>
              <label className="field">
                <span className="field-label">Your mobile</span>
                <input
                  className="input"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={purchaser.phone}
                  onChange={(e) => setPurchaser({ ...purchaser, phone: e.target.value })}
                />
              </label>
              <label className={`field ${styles.span2}`}>
                <span className="field-label">Your email (for the receipt)</span>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={purchaser.email}
                  onChange={(e) => setPurchaser({ ...purchaser, email: e.target.value })}
                />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => {
                  setTerms(e.target.checked);
                  setErrors([]);
                }}
              />
              <span>
                I accept the <Link href="/legal/terms">voucher terms</Link>: valid 365 days, not exchangeable for cash.
              </span>
            </label>
            <label className="check">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              <span>Tell me about new dates and offers (optional).</span>
            </label>
          </fieldset>
        </div>

        <aside className={styles.preview} aria-label="Voucher preview">
          <div className={styles.voucher}>
            <div className={styles.voucherTop}>
              <Mark tone="paper" size={40} />
              <span className={styles.voucherBrand}>Gift a Jump</span>
            </div>
            <p className={styles.voucherFor}>{recipient.name ? `For ${recipient.name}` : 'For someone brave'}</p>
            <p className={styles.voucherLabel}>{label}</p>
            {message && <p className={styles.voucherMsg}>“{message}”</p>}
            <p className={styles.voucherCode}>GIFT-XXXX-XXXX</p>
            <p className={styles.voucherSmall}>Soweto Towers · Orlando East, Soweto · valid 12 months</p>
          </div>
          <div className={`card ${styles.totalCard}`}>
            <div className={styles.totalRow}>
              <span>
                {qty} × {label}
              </span>
              <span className="price num">{rand(total)}</span>
            </div>
            {errors.length > 0 && (
              <div className={styles.errors} role="alert">
                {errors.map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            )}
            <button className="btn btn--primary btn--lg btn--block" disabled={busy || total < 100}>
              {busy ? 'Starting payment…' : `Pay ${rand(total)}`}
            </button>
            <p className={styles.tiny}>
              <Check width={14} height={14} /> Secure payment. The voucher code is created the moment payment clears.
            </p>
          </div>
        </aside>
      </form>
      {payfast && (
        <form ref={form} method="post" action={payfast.action} className="visually-hidden" aria-hidden>
          {Object.entries(payfast.fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        </form>
      )}
    </>
  );
}
