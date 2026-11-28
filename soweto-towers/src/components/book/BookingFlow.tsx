'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Photo } from '@/components/ui/Photo';
import { ArrowLeft, ArrowRight, Check, Minus, Plus, Shield, Utensils } from '@/components/ui/icons';
import { addons, getPackage, medicalExclusions, packages, type ActivityId, type PackageId } from '@/content/catalog';
import { quote as priceQuote, safetyErrors, unitsNeeded, type LiveActivity } from '@/lib/booking/engine';
import { useHydrated } from '@/lib/client-values';
import { rand } from '@/lib/format';
import { formatDayLong } from '@/lib/time';
import { StepWhen } from './StepWhen';
import { Summary } from './Summary';
import { STEPS, bookedIds, cartFor, initialDraft, syncParticipants, type Draft, type StepIndex } from './types';
import styles from './book.module.css';

const STORAGE = 'st-booking-draft-v1';

type VoucherState = { status: 'idle' | 'checking' | 'valid' | 'invalid'; message?: string; balance?: number; label?: string };

/** The saved draft for this tab, adjusted by ?activity=, ?package= and ?voucher= from a link. */
function restoreDraft(params: URLSearchParams, bookable: LiveActivity[]): Draft {
  let d = initialDraft();
  try {
    const saved = sessionStorage.getItem(STORAGE);
    if (saved) d = { ...d, ...(JSON.parse(saved) as Partial<Draft>) };
  } catch {
    /* storage unavailable */
  }
  const a = params.get('activity') as ActivityId | null;
  const p = params.get('package') as PackageId | null;
  const v = params.get('voucher');
  if (p && getPackage(p)) d = { ...initialDraft('bungee-jump', p), contact: d.contact, consents: d.consents };
  else if (a && bookable.some((x) => x.id === a) && a !== d.activityId)
    d = { ...initialDraft(a, a === 'bungee-jump' ? 'jump-film' : null), contact: d.contact, consents: d.consents };
  if (v) d = { ...d, voucherCode: v.toUpperCase() };
  if (!bookable.some((x) => x.id === d.activityId)) d = initialDraft(bookable[0]?.id ?? 'bungee-jump');
  return { ...d, participants: syncParticipants(d.participants, d.qty) };
}

async function lookupVoucher(code: string): Promise<VoucherState> {
  try {
    const r = await fetch(`/api/vouchers?code=${encodeURIComponent(code)}`);
    const d = await r.json();
    return d.valid
      ? { status: 'valid', balance: d.balance, label: d.label, message: `${d.label}: ${rand(d.balance)} to use, valid until ${d.expiresAt}.` }
      : { status: 'invalid', message: d.reason };
  } catch {
    return { status: 'invalid', message: 'Couldn’t check the code. Try again.' };
  }
}

export function BookingFlow({ catalog }: { catalog: LiveActivity[] }) {
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const bookable = useMemo(() => catalog.filter((a) => !a.disabled && a.booking.mode !== 'enquiry'), [catalog]);

  const [draft, setDraft] = useState<Draft>(() => initialDraft());
  const [step, setStep] = useState<StepIndex>(0);
  const [direction, setDirection] = useState(1);
  const [restored, setRestored] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [voucher, setVoucher] = useState<VoucherState>({ status: 'idle' });
  const [sheetOpen, setSheetOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const payForm = useRef<HTMLFormElement>(null);
  const [payfast, setPayfast] = useState<{ action: string; fields: Record<string, string> } | null>(null);

  // Once hydrated, restore a draft (same tab) and apply ?activity= / ?package= / ?voucher=
  // from links. Done during render, once, so the first visible frame is already right.
  const hydrated = useHydrated();
  if (hydrated && !restored) {
    const d = restoreDraft(params, bookable);
    setRestored(true);
    setDraft(d);
    if (d.voucherCode) setVoucher({ status: 'checking' });
  }

  useEffect(() => {
    if (!restored) return;
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(STORAGE, JSON.stringify({ ...draft, consents: { ...draft.consents, terms: false } }));
      } catch {
        /* ignore */
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [draft, restored]);

  useEffect(() => {
    if (restored) headingRef.current?.focus({ preventScroll: false });
  }, [step, restored]);

  useEffect(() => {
    if (payfast) payForm.current?.submit();
  }, [payfast]);

  const activity = bookable.find((a) => a.id === draft.activityId) ?? bookable[0]!;
  const items = cartFor(draft, catalog);
  const q = priceQuote(items, draft.activityId === 'bungee-jump' ? draft.packageId : null, catalog);
  const booked = bookedIds(draft)
    .map((id) => catalog.find((a) => a.id === id))
    .filter((a): a is LiveActivity => !!a);
  const needsWeight = booked.some((a) => a.rules.minWeightKg || a.rules.maxWeightKg);
  const safety = safetyErrors(booked, {
    participants: draft.participants.map((p) => ({ name: p.name, weightKg: p.weightKg === '' ? null : Number(p.weightKg), minor: p.minor })),
    allTwelvePlus: draft.allTwelvePlus,
    medicalOk: draft.medicalOk,
    guardianName: draft.guardianName,
  });
  const needsScad = draft.activityId === 'bungee-jump' && draft.packageId === 'full-tower';
  const session = activity.booking.mode === 'session' ? activity.booking : null;

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setQty = (qty: number) => {
    const min = session ? session.minGroup : 1;
    const max = session ? session.maxGroup : 30;
    const v = Math.max(min, Math.min(max, qty));
    setDraft((d) => ({
      ...d,
      qty: v,
      video: Math.min(d.video, v),
      photos: Math.min(d.photos, v),
      participants: syncParticipants(d.participants, v),
      time: null,
      scadTime: null,
      lunch: { ...d.lunch, partySize: Math.max(d.lunch.partySize, v) },
    }));
  };

  const contactOk =
    draft.contact.name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contact.email.trim()) &&
    /^\+?[\d\s()-]{9,20}$/.test(draft.contact.phone.trim());

  const stepErrors: Record<StepIndex, string[]> = {
    0: q.errors.filter((e) => !/minutes|time/i.test(e)),
    1: session && (draft.qty < session.minGroup || draft.qty > session.maxGroup) ? [`Sessions take ${session.minGroup}–${session.maxGroup} players.`] : [],
    2: [
      !draft.date ? 'Choose a date.' : '',
      !draft.time ? 'Choose a time.' : '',
      needsScad && !draft.scadTime ? 'Choose a time for the SCAD freefall.' : '',
    ].filter(Boolean),
    3: safety,
    4: [
      !contactOk ? 'Add your name, a valid email and a mobile number.' : '',
      voucher.status === 'invalid' && draft.voucherCode ? 'Remove or fix the voucher code.' : '',
    ].filter(Boolean),
    5: [!draft.consents.terms ? 'Please accept the terms and indemnity.' : ''].filter(Boolean),
  };

  const go = (to: StepIndex) => {
    setDirection(to > step ? 1 : -1);
    setShowErrors(false);
    setServerErrors([]);
    setSheetOpen(false);
    setStep(to);
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  const next = () => {
    if (stepErrors[step].length) {
      setShowErrors(true);
      return;
    }
    if (step < 5) go((step + 1) as StepIndex);
    else submit();
  };

  async function checkVoucher(code: string) {
    if (!code.trim()) return setVoucher({ status: 'idle' });
    setVoucher({ status: 'checking' });
    setVoucher(await lookupVoucher(code));
  }

  // A code that arrived with the link (?voucher=) is checked straight after the draft is restored.
  useEffect(() => {
    if (!restored || !draft.voucherCode) return;
    let alive = true;
    lookupVoucher(draft.voucherCode).then((v) => {
      if (alive) setVoucher(v);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the draft is first restored
  }, [restored]);

  async function submit() {
    setSubmitting(true);
    setServerErrors([]);
    try {
      const body = {
        date: draft.date,
        packageId: draft.activityId === 'bungee-jump' ? draft.packageId : null,
        items,
        participants: draft.participants.map((p) => ({ name: p.name.trim(), weightKg: p.weightKg === '' ? null : Number(p.weightKg), minor: p.minor })),
        safety: { allTwelvePlus: draft.allTwelvePlus, medicalOk: draft.medicalOk, guardianName: draft.guardianName },
        contact: { name: draft.contact.name.trim(), email: draft.contact.email.trim(), phone: draft.contact.phone.trim() },
        consents: draft.consents,
        voucherCode: voucher.status === 'valid' ? draft.voucherCode : '',
        lunch: draft.lunch.enabled ? { time: draft.lunch.time, partySize: draft.lunch.partySize } : null,
      };
      const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.ok) {
        setServerErrors(data.errors ?? ['Something went wrong. Please try again.']);
        if ((data.errors ?? []).some((e: string) => /time|filled|available/i.test(e))) set({ time: null, scadTime: null });
        return;
      }
      try {
        sessionStorage.removeItem(STORAGE);
      } catch {
        /* ignore */
      }
      const v = data.value as {
        id: string;
        payment: null | { kind: 'redirect'; url: string } | { kind: 'form'; action: string; fields: Record<string, string> };
        ticketUrl: string | null;
      };
      if (v.ticketUrl) window.location.assign(v.ticketUrl);
      else if (v.payment?.kind === 'redirect') window.location.assign(v.payment.url);
      else if (v.payment?.kind === 'form') setPayfast({ action: v.payment.action, fields: v.payment.fields });
    } catch {
      setServerErrors(['We couldn’t reach the booking system. Check your connection and try again.']);
    } finally {
      setSubmitting(false);
    }
  }

  const errorsNow = showErrors ? stepErrors[step] : [];
  const voucherForSummary = voucher.status === 'valid' && voucher.balance ? { balance: voucher.balance, label: voucher.label ?? '' } : null;
  const due = Math.max(0, q.total - (voucherForSummary ? Math.min(voucherForSummary.balance, q.total) : 0));
  const spring = reduce ? { duration: 0.15 } : { type: 'spring' as const, bounce: 0, duration: 0.45 };

  if (!restored) return <div className={styles.loading} aria-busy="true" />;

  return (
    <div className={styles.flow}>
      {/* Scrolls sideways on narrow phones, so it takes focus: keyboard users can scroll it too. */}
      <ol className={styles.progress} aria-label="Booking steps" tabIndex={0}>
        {STEPS.map((label, i) => (
          <li key={label} className={`${i === step ? styles.current : ''} ${i < step ? styles.done : ''}`} aria-current={i === step ? 'step' : undefined}>
            <button type="button" disabled={i >= step} onClick={() => go(i as StepIndex)}>
              <span className={styles.stepDot}>{i < step ? <Check width={14} height={14} /> : i + 1}</span>
              <span className={styles.stepLabel}>{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className={styles.layout}>
        <div className={styles.main}>
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.section
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: reduce ? 0 : direction * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduce ? 0 : direction * -28 }}
              transition={spring}
              className={styles.panel}
              aria-labelledby="step-title"
            >
              <p className="eyebrow">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 id="step-title" ref={headingRef} tabIndex={-1} className={`h2 ${styles.stepTitle}`}>
                {['Pick your adventure', 'Who’s jumping?', 'When are you coming?', 'Safety first', 'Your details', 'Check and pay'][step]}
              </h2>

              {step === 0 && (
                <div className={styles.stack}>
                  <div className={styles.choices} role="radiogroup" aria-label="Adventure">
                    {bookable.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={draft.activityId === a.id}
                        className={`${styles.choice} ${draft.activityId === a.id ? styles.choiceOn : ''}`}
                        onClick={() =>
                          setDraft((d) => ({
                            ...initialDraft(a.id, a.id === 'bungee-jump' ? 'jump-film' : null),
                            contact: d.contact,
                            consents: d.consents,
                            voucherCode: d.voucherCode,
                            participants: syncParticipants([], a.id === 'paintball' ? 2 : 1),
                          }))
                        }
                      >
                        <span className={styles.choiceImg}>
                          <Photo slug={a.cardImage ?? a.image} sizes="120px" />
                        </span>
                        <span className={styles.choiceText}>
                          <span className={styles.choiceName}>{a.name}</span>
                          <span className={styles.choiceShort}>{a.short}</span>
                        </span>
                        <span className={`price ${styles.choicePrice}`}>
                          {rand(a.price)}
                          {a.booking.mode === 'session' ? <small> each</small> : null}
                        </span>
                      </button>
                    ))}
                  </div>

                  {draft.activityId === 'bungee-jump' && (
                    <fieldset className={styles.fieldset}>
                      <legend className="h4">Make it count</legend>
                      <div className={styles.packages}>
                        {[...packages].map((p) => (
                          <label key={p.id} className={`${styles.pkg} ${draft.packageId === p.id ? styles.pkgOn : ''}`}>
                            <input type="radio" name="package" checked={draft.packageId === p.id} onChange={() => set({ packageId: p.id, scadTime: null })} />
                            <span className={styles.pkgName}>
                              {p.name}
                              {p.recommended && <span className="badge badge--crimson">Recommended</span>}
                            </span>
                            <span className="price">{rand(p.price)}</span>
                            <span className={styles.pkgBlurb}>
                              {p.blurb}
                              {p.saving ? ` Save ${rand(p.saving)}.` : ''}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className={styles.stack}>
                  <div className={styles.qtyRow}>
                    <div>
                      <p className="h4">{session ? 'Players' : 'People'}</p>
                      <p className="muted small">
                        {session
                          ? `${session.minGroup}–${session.maxGroup} per session. Bigger group? Book another session.`
                          : activity.group
                            ? `${activity.group.min} or more pay ${rand(activity.group.price)} each.`
                            : 'Up to 30 per booking.'}
                      </p>
                    </div>
                    <div className={styles.stepper}>
                      <button type="button" onClick={() => setQty(draft.qty - 1)} aria-label="One fewer" disabled={draft.qty <= (session?.minGroup ?? 1)}>
                        <Minus />
                      </button>
                      <output className="num" aria-live="polite">
                        {draft.qty}
                      </output>
                      <button type="button" onClick={() => setQty(draft.qty + 1)} aria-label="One more" disabled={draft.qty >= (session?.maxGroup ?? 30)}>
                        <Plus />
                      </button>
                    </div>
                  </div>
                  {activity.group && draft.qty === activity.group.min - 1 && (
                    <p className={styles.nudge} role="status">
                      Add one more and all {activity.group.min} pay {rand(activity.group.price)} each: the whole group saves{' '}
                      {rand((activity.price - activity.group.price) * activity.group.min)}.
                    </p>
                  )}
                  {activity.group && draft.qty >= activity.group.min && (
                    <p className={styles.good} role="status">
                      <Check width={18} height={18} /> Group rate applied: {rand(activity.group.price)} each.
                    </p>
                  )}

                  {(activity.addons.length > 0 || draft.packageId === 'the-jump') && (
                    <fieldset className={styles.fieldset}>
                      <legend className="h4">Keep the moment</legend>
                      {!activity.videoIncluded &&
                        activity.addons.includes('video') &&
                        !(draft.activityId === 'bungee-jump' && draft.packageId && draft.packageId !== 'the-jump') && (
                          <AddonRow
                            label={`${addons.video.name} · ${rand(addons.video.price)} each`}
                            blurb={draft.packageId === 'the-jump' ? 'Switch to Jump + Film to get it for R40 less.' : addons.video.blurb}
                            value={draft.video}
                            max={draft.qty}
                            onChange={(v) => set({ video: v })}
                          />
                        )}
                      {activity.addons.includes('photos') && (
                        <AddonRow
                          label={`${addons.photos.name} · ${rand(addons.photos.price)} each`}
                          blurb={addons.photos.blurb}
                          value={draft.photos}
                          max={draft.qty}
                          onChange={(v) => set({ photos: v })}
                        />
                      )}
                      {(activity.videoIncluded || (draft.packageId && draft.packageId !== 'the-jump')) && (
                        <p className={styles.good}>
                          <Check width={18} height={18} /> Full video included{draft.packageId === 'full-tower' ? ' for the bungee and the SCAD' : ''}.
                        </p>
                      )}
                      <p className="muted small">Every bungee and SCAD jumper also gets a free 10-second Scream Clip on WhatsApp.</p>
                    </fieldset>
                  )}
                </div>
              )}

              {step === 2 && (
                <StepWhen
                  activityId={draft.activityId}
                  date={draft.date}
                  time={draft.time}
                  scadTime={draft.scadTime}
                  needsScad={needsScad}
                  qtyUnits={{
                    main: unitsNeeded(activity, draft.qty),
                    scad: unitsNeeded(
                      catalog.find((a) => a.id === 'scad-freefall')!,
                      draft.qty,
                    ),
                  }}
                  onDate={(d) => set({ date: d })}
                  onTime={(t) => set({ time: t })}
                  onScadTime={(t) => set({ scadTime: t })}
                />
              )}

              {step === 3 && (
                <div className={styles.stack}>
                  <p className="lede">We check these now so nobody is turned away at the top. The crew checks weight again on the bridge.</p>
                  <div className={styles.people}>
                    {draft.participants.map((p, i) => (
                      <fieldset key={i} className={styles.person}>
                        <legend className="h4">Person {i + 1}</legend>
                        <label className="field">
                          <span className="field-label">First name</span>
                          <input
                            className="input"
                            value={p.name}
                            autoComplete={i === 0 ? 'given-name' : 'off'}
                            onChange={(e) => set({ participants: draft.participants.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })}
                          />
                        </label>
                        {needsWeight && (
                          <label className="field">
                            <span className="field-label">Weight (kg)</span>
                            <input
                              className="input num"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={p.weightKg}
                              onChange={(e) =>
                                set({
                                  participants: draft.participants.map((x, k) =>
                                    k === i ? { ...x, weightKg: e.target.value.replace(/[^\d]/g, '').slice(0, 3) } : x,
                                  ),
                                })
                              }
                            />
                          </label>
                        )}
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={p.minor}
                            onChange={(e) => set({ participants: draft.participants.map((x, k) => (k === i ? { ...x, minor: e.target.checked } : x)) })}
                          />
                          <span>Under 18</span>
                        </label>
                      </fieldset>
                    ))}
                  </div>
                  {booked.map((a) =>
                    a.rules.minWeightKg ? (
                      <p key={a.id} className="muted small">
                        {a.name}: {a.rules.minWeightKg}–{a.rules.maxWeightKg} kg.
                      </p>
                    ) : null,
                  )}
                  {draft.participants.some((p) => p.minor) && (
                    <label className="field">
                      <span className="field-label">Parent or guardian’s full name (consenting for under-18s)</span>
                      <input className="input" value={draft.guardianName} onChange={(e) => set({ guardianName: e.target.value })} autoComplete="name" />
                      <span className="field-hint">They sign the consent form at the gate too.</span>
                    </label>
                  )}
                  {booked.some((a) => a.rules.minAge) && (
                    <label className="check">
                      <input type="checkbox" checked={draft.allTwelvePlus} onChange={(e) => set({ allTwelvePlus: e.target.checked })} />
                      <span>Everyone in this booking is 12 or older.</span>
                    </label>
                  )}
                  {booked.some((a) => a.rules.medicalExclusions) && (
                    <div className={styles.medical}>
                      <p className="h4">
                        <Shield width={20} height={20} /> Medical check
                      </p>
                      <ul>
                        {medicalExclusions.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                      <label className="check">
                        <input type="checkbox" checked={draft.medicalOk} onChange={(e) => set({ medicalOk: e.target.checked })} />
                        <span>Nobody taking part has any of these conditions.</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className={styles.stack}>
                  <div className={styles.grid2}>
                    <label className="field">
                      <span className="field-label">Full name</span>
                      <input
                        className="input"
                        autoComplete="name"
                        value={draft.contact.name}
                        onChange={(e) => set({ contact: { ...draft.contact, name: e.target.value } })}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Mobile (WhatsApp)</span>
                      <input
                        className="input"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="082 123 4567"
                        value={draft.contact.phone}
                        onChange={(e) => set({ contact: { ...draft.contact, phone: e.target.value } })}
                      />
                    </label>
                    <label className={`field ${styles.span2}`}>
                      <span className="field-label">Email</span>
                      <input
                        className="input"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        value={draft.contact.email}
                        onChange={(e) => set({ contact: { ...draft.contact, email: e.target.value } })}
                      />
                      <span className="field-hint">Your ticket and receipt go here.</span>
                    </label>
                  </div>

                  <fieldset className={styles.fieldset}>
                    <legend className="h4">Stay in the loop</legend>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draft.consents.whatsapp}
                        onChange={(e) => set({ consents: { ...draft.consents, whatsapp: e.target.checked } })}
                      />
                      <span>Send my ticket, weather updates and my Scream Clip on WhatsApp.</span>
                    </label>
                    <label className="check">
                      <input type="checkbox" checked={draft.consents.clip} onChange={(e) => set({ consents: { ...draft.consents, clip: e.target.checked } })} />
                      <span>Soweto Towers may repost our jump clips (Scream of the Week). Optional.</span>
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draft.consents.marketing}
                        onChange={(e) => set({ consents: { ...draft.consents, marketing: e.target.checked } })}
                      />
                      <span>Tell me about new dates and offers. Optional; opt out any time.</span>
                    </label>
                  </fieldset>

                  <fieldset className={styles.fieldset}>
                    <legend className="h4">Gift voucher</legend>
                    <div className={styles.voucherRow}>
                      <input
                        className="input"
                        placeholder="GIFT-XXXX-XXXX"
                        value={draft.voucherCode}
                        autoCapitalize="characters"
                        onChange={(e) => {
                          set({ voucherCode: e.target.value.toUpperCase() });
                          setVoucher({ status: 'idle' });
                        }}
                        aria-describedby="voucher-msg"
                      />
                      <button
                        type="button"
                        className="btn btn--dark"
                        onClick={() => checkVoucher(draft.voucherCode)}
                        disabled={!draft.voucherCode || voucher.status === 'checking'}
                      >
                        {voucher.status === 'checking' ? 'Checking…' : 'Apply'}
                      </button>
                    </div>
                    {voucher.message && (
                      <p id="voucher-msg" className={voucher.status === 'valid' ? styles.good : 'field-error'} role="status">
                        {voucher.message}
                      </p>
                    )}
                  </fieldset>

                  <fieldset className={styles.fieldset}>
                    <legend className="h4">
                      <Utensils width={20} height={20} /> Jump & Lunch
                    </legend>
                    <label className="check">
                      <input type="checkbox" checked={draft.lunch.enabled} onChange={(e) => set({ lunch: { ...draft.lunch, enabled: e.target.checked } })} />
                      <span>Ask Chaf-Pozi, the restaurant on site, to hold a table for us after our slot. Pay for food on the day.</span>
                    </label>
                    {draft.lunch.enabled && (
                      <div className={styles.grid2}>
                        <label className="field">
                          <span className="field-label">Table time</span>
                          <select className="input" value={draft.lunch.time} onChange={(e) => set({ lunch: { ...draft.lunch, time: e.target.value } })}>
                            {['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'].map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span className="field-label">Table for</span>
                          <input
                            className="input num"
                            inputMode="numeric"
                            value={draft.lunch.partySize}
                            onChange={(e) =>
                              set({ lunch: { ...draft.lunch, partySize: Math.max(1, Math.min(30, Number(e.target.value.replace(/\D/g, '')) || 1)) } })
                            }
                          />
                        </label>
                      </div>
                    )}
                  </fieldset>
                </div>
              )}

              {step === 5 && (
                <div className={styles.stack}>
                  <div className={`card ${styles.review}`}>
                    <dl>
                      <div>
                        <dt>When</dt>
                        <dd>
                          {draft.date ? formatDayLong(draft.date) : ''} · {draft.time}
                          {draft.scadTime ? ` (SCAD ${draft.scadTime})` : ''}
                        </dd>
                      </div>
                      <div>
                        <dt>Who</dt>
                        <dd>{draft.participants.map((p) => p.name || 'Guest').join(', ')}</dd>
                      </div>
                      <div>
                        <dt>Contact</dt>
                        <dd>
                          {draft.contact.name} · {draft.contact.phone} · {draft.contact.email}
                        </dd>
                      </div>
                      {draft.lunch.enabled && (
                        <div>
                          <dt>Lunch</dt>
                          <dd>
                            Table for {draft.lunch.partySize} at {draft.lunch.time} (request)
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                  <div className={`${styles.compactSummary}`}>
                    <Summary draft={draft} quote={q} voucher={voucherForSummary} compact />
                  </div>
                  <label className="check">
                    <input type="checkbox" checked={draft.consents.terms} onChange={(e) => set({ consents: { ...draft.consents, terms: e.target.checked } })} />
                    <span>
                      I accept the{' '}
                      <Link href="/legal/terms" target="_blank">
                        terms
                      </Link>{' '}
                      and the{' '}
                      <Link href="/legal/indemnity" target="_blank">
                        indemnity
                      </Link>{' '}
                      for everyone in this booking.
                      {due > 0 ? ' Unpaid bookings release their slot after 15 minutes.' : ''}
                    </span>
                  </label>
                  <p className="muted small">
                    <Shield width={16} height={16} style={{ display: 'inline', verticalAlign: '-3px' }} />{' '}
                    {due > 0
                      ? 'Secure payment by card, instant EFT or phone wallet on the payment page.'
                      : 'Your gift voucher covers everything, so there’s nothing to pay.'}{' '}
                    Your ticket comes by email
                    {draft.consents.whatsapp ? ' and WhatsApp' : ''}.
                  </p>
                </div>
              )}

              {(errorsNow.length > 0 || serverErrors.length > 0) && (
                <div className={styles.errors} role="alert">
                  {[...errorsNow, ...serverErrors].map((e) => (
                    <p key={e}>{e}</p>
                  ))}
                </div>
              )}

              <div className={styles.nav}>
                {step > 0 ? (
                  <button type="button" className="btn btn--light" onClick={() => go((step - 1) as StepIndex)}>
                    <ArrowLeft width={18} height={18} /> Back
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" className={`btn btn--primary btn--lg ${styles.navNext}`} onClick={next} disabled={submitting}>
                  {step === 5 ? (submitting ? 'Securing your slot…' : due === 0 ? 'Confirm booking' : `Pay ${rand(due)}`) : 'Continue'}
                  {step < 5 && <ArrowRight width={18} height={18} />}
                </button>
              </div>
            </motion.section>
          </AnimatePresence>
        </div>

        <aside className={styles.side} aria-label="Booking summary">
          <div className={`card ${styles.sideCard}`}>
            <Summary draft={draft} quote={q} voucher={voucherForSummary} />
          </div>
          <p className={styles.reassure}>
            <Check width={16} height={16} /> Weather stops jumps? Move your slot for free.
          </p>
        </aside>
      </div>

      {/* Phones: live total within thumb reach; tap to see the breakdown. */}
      <div className={`glass-light ${styles.mobileBar}`}>
        <button type="button" className={styles.mobileTotal} onClick={() => setSheetOpen((o) => !o)} aria-expanded={sheetOpen}>
          <span className="tiny muted">Total</span>
          <span className="price num">{rand(due)}</span>
        </button>
        <button type="button" className="btn btn--primary" onClick={next} disabled={submitting}>
          {step === 5 ? (due === 0 ? 'Confirm' : `Pay ${rand(due)}`) : 'Continue'}
        </button>
      </div>
      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            className={styles.sheet}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 500) setSheetOpen(false);
            }}
          >
            <span className={styles.grabber} aria-hidden />
            <Summary draft={draft} quote={q} voucher={voucherForSummary} />
          </motion.div>
        )}
      </AnimatePresence>

      {payfast && (
        <form ref={payForm} method="post" action={payfast.action} className="visually-hidden" aria-hidden>
          {Object.entries(payfast.fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <button type="submit">Continue to PayFast</button>
        </form>
      )}
    </div>
  );
}

function AddonRow({ label, blurb, value, max, onChange }: { label: string; blurb: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className={styles.addon}>
      <div>
        <p className={styles.addonLabel}>{label}</p>
        <p className="muted small">{blurb}</p>
      </div>
      <div className={styles.stepper}>
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} aria-label={`Fewer: ${label}`}>
          <Minus />
        </button>
        <output className="num">{value}</output>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More: ${label}`}>
          <Plus />
        </button>
      </div>
    </div>
  );
}
