import { DEMO, PaymentRecordSchema, type SandboxOutcome } from '@hao/api-contracts';
import { createLocalPlatform } from '@hao/local-platform';
import { describe, expect, it } from 'vitest';
import { createPaymentsService, DEMO_SEED_PAYMENT_REF } from './index';

const START = new Date('2026-11-21T08:00:00Z');
const key = (name: string) => ({ idempotencyKey: `test-${name}` });

function setup() {
  const platform = createLocalPlatform({ now: () => START });
  return { platform, payments: createPaymentsService(platform) };
}

const draftPayment = {
  personToken: DEMO.persons.sipho,
  draftId: DEMO.drafts.siphoPassport,
  caseId: null,
  description: 'Adult passport — sample amount',
  amountCents: 100,
};

describe('payments sandbox', () => {
  it('seeds one approved sandbox payment for Thandi’s passport application', async () => {
    const { payments } = setup();
    const seeded = await payments.listPayments(DEMO.persons.thandi);
    for (const payment of seeded) PaymentRecordSchema.parse(payment);
    expect(seeded).toHaveLength(1);
    expect(seeded[0]).toMatchObject({
      paymentRef: DEMO_SEED_PAYMENT_REF,
      personToken: DEMO.persons.thandi,
      caseId: DEMO.cases.passportInProduction,
      draftId: null,
      description: 'Adult passport — sample amount',
      amountCents: 100,
      currency: 'ZAR',
      status: 'APPROVED',
      receiptNumber: 'RCPT-DEMO-1001',
      sandbox: true,
    });
    expect(await payments.getPayment(DEMO_SEED_PAYMENT_REF)).toEqual(seeded[0]);
    expect(await payments.listPayments(DEMO.persons.aisha)).toEqual([]);
  });

  it('creates a pending payment with an opaque provider token', async () => {
    const { payments } = setup();
    const created = await payments.createPayment(draftPayment, key('create'));
    PaymentRecordSchema.parse(created);
    expect(created).toMatchObject({
      // The seeded payment already uses 1001.
      paymentRef: 'PAY-DEMO-1002',
      personToken: DEMO.persons.sipho,
      draftId: DEMO.drafts.siphoPassport,
      caseId: null,
      amountCents: 100,
      currency: 'ZAR',
      status: 'PENDING',
      receiptNumber: null,
      createdAt: '2026-11-21T10:00:00+02:00',
      sandbox: true,
    });
    expect(created.providerToken).toMatch(/^tok_demo_[a-z0-9]+$/);
    expect(await payments.getPayment(created.paymentRef)).toEqual(created);
  });

  it('rejects an empty description or an invalid amount', async () => {
    const { payments } = setup();
    for (const bad of [
      { ...draftPayment, description: '' },
      { ...draftPayment, description: '   ' },
      { ...draftPayment, amountCents: -1 },
      { ...draftPayment, amountCents: 10.5 },
      { ...draftPayment, amountCents: Number.NaN },
    ]) {
      await expect(payments.createPayment(bad, key('bad'))).rejects.toMatchObject({
        category: 'VALIDATION',
      });
    }
    expect(await payments.listPayments(DEMO.persons.sipho)).toEqual([]);
  });

  it('approves a payment and issues a receipt number', async () => {
    const { payments } = setup();
    const created = await payments.createPayment(draftPayment, key('create'));
    const approved = await payments.completeSandboxPayment(
      created.paymentRef,
      'APPROVE',
      key('ok'),
    );
    PaymentRecordSchema.parse(approved);
    expect(approved.status).toBe('APPROVED');
    // The seeded receipt already uses 1001.
    expect(approved.receiptNumber).toBe('RCPT-DEMO-1002');
    expect(await payments.getPayment(created.paymentRef)).toEqual(approved);
  });

  it('records a declined payment and a timed-out payment without a receipt', async () => {
    const { payments } = setup();
    const outcomes: [SandboxOutcome, string][] = [
      ['DECLINE', 'DECLINED'],
      ['TIMEOUT', 'TIMED_OUT'],
    ];
    for (const [outcome, status] of outcomes) {
      const created = await payments.createPayment(draftPayment, key(`create-${outcome}`));
      const result = await payments.completeSandboxPayment(
        created.paymentRef,
        outcome,
        key(outcome),
      );
      PaymentRecordSchema.parse(result);
      expect(result.status).toBe(status);
      expect(result.receiptNumber).toBeNull();
    }
  });

  it('lets a declined or timed-out payment be tried again', async () => {
    const { payments } = setup();
    const created = await payments.createPayment(draftPayment, key('create'));
    await payments.completeSandboxPayment(created.paymentRef, 'DECLINE', key('1'));
    const timedOut = await payments.completeSandboxPayment(created.paymentRef, 'TIMEOUT', key('2'));
    expect(timedOut.status).toBe('TIMED_OUT');
    const approved = await payments.completeSandboxPayment(created.paymentRef, 'APPROVE', key('3'));
    expect(approved).toMatchObject({ status: 'APPROVED', paymentRef: created.paymentRef });
    expect(approved.receiptNumber).toMatch(/^RCPT-DEMO-\d+$/);
  });

  it('refuses to complete a payment that is already approved', async () => {
    const { payments } = setup();
    const created = await payments.createPayment(draftPayment, key('create'));
    const approved = await payments.completeSandboxPayment(created.paymentRef, 'APPROVE', key('a'));
    for (const outcome of ['APPROVE', 'DECLINE', 'TIMEOUT'] as const) {
      await expect(
        payments.completeSandboxPayment(created.paymentRef, outcome, key(`again-${outcome}`)),
      ).rejects.toMatchObject({ category: 'CONFLICT' });
    }
    await expect(
      payments.completeSandboxPayment(DEMO_SEED_PAYMENT_REF, 'APPROVE', key('seed')),
    ).rejects.toMatchObject({ category: 'CONFLICT' });
    // The refusal changed nothing.
    expect(await payments.getPayment(created.paymentRef)).toEqual(approved);
  });

  it('throws NOT_FOUND for an unknown payment', async () => {
    const { payments } = setup();
    await expect(payments.getPayment('PAY-DEMO-9999')).rejects.toMatchObject({
      category: 'NOT_FOUND',
    });
    await expect(
      payments.completeSandboxPayment('PAY-DEMO-9999', 'APPROVE', key('missing')),
    ).rejects.toMatchObject({ category: 'NOT_FOUND' });
  });

  it('lists a person’s payments newest first and keeps them across instances', async () => {
    const { payments, platform } = setup();
    const first = await payments.createPayment(
      { ...draftPayment, personToken: DEMO.persons.thandi },
      key('first'),
    );
    const second = await payments.createPayment(
      { ...draftPayment, personToken: DEMO.persons.thandi, amountCents: 0 },
      key('second'),
    );
    const reopened = createPaymentsService(platform);
    const listed = await reopened.listPayments(DEMO.persons.thandi);
    expect(listed.map((payment) => payment.paymentRef)).toEqual([
      second.paymentRef,
      first.paymentRef,
      DEMO_SEED_PAYMENT_REF,
    ]);
    for (const payment of listed) {
      PaymentRecordSchema.parse(payment);
      expect(payment.sandbox).toBe(true);
    }
  });
});
