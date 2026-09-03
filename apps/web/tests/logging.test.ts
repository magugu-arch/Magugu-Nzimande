import { afterEach, describe, expect, it } from 'vitest';
import { errorFields, log, logger, redact, setSink } from '@/lib/observability/log';
import { customer } from './fixtures';

/**
 * Structured logging, and the redaction that is the actual point of it.
 *
 * A log line is the most common way a secret escapes a system. Nobody sets out
 * to print a session cookie; they print the request that happened to carry one,
 * or the customer object that happened to include a password hash. So the tests
 * that matter here are the ones that throw whole realistic objects at it.
 */

const written: string[] = [];
const restore = setSink((line) => written.push(line));
const lastLine = () => JSON.parse(written[written.length - 1] ?? '{}') as Record<string, unknown>;

afterEach(() => {
  written.length = 0;
});

describe('the line itself', () => {
  it('is one JSON object per event', () => {
    logger.info('order.placed', { orderNumber: 'BBQ-260903-0001' });

    expect(written).toHaveLength(1);
    expect(() => JSON.parse(written[0] as string)).not.toThrow();
    expect(written[0]).not.toContain('\n');
  });

  it('carries a level, an event name and a timestamp', () => {
    logger.warn('payment.retried');
    const line = lastLine();

    expect(line.level).toBe('warn');
    expect(line.event).toBe('payment.retried');
    expect(Date.parse(String(line.at))).not.toBeNaN();
  });

  it('keeps the fields it was given', () => {
    logger.info('order.placed', { orderNumber: 'BBQ-1', totalCents: 12_900 });
    expect(lastLine()).toMatchObject({ orderNumber: 'BBQ-1', totalCents: 12_900 });
  });

  it('logs at every level', () => {
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      log(level, 'test.event');
      expect(lastLine().level).toBe(level);
    }
  });
});

describe('redaction', () => {
  /**
   * By field name, not by the look of the value. A session token and an order
   * id are both opaque strings of about the same length, and a redactor that
   * decides by shape will either leak the first or ruin the second.
   */
  it('never prints anything named like a secret', () => {
    logger.info('sign-in', {
      password: 'a-long-enough-password',
      passphrase: 'twice-fried-in-olive-oil',
      secret: 'sk_live_abc123',
      token: 'reset-token',
      cookie: 'bbq_customer=abc',
      authorization: 'Bearer abc',
      signature: 'deadbeef',
      passwordHash: 'scrypt$32768$8$1$salt$hash',
    });

    const line = written[0] as string;
    for (const leaked of [
      'a-long-enough-password',
      'twice-fried-in-olive-oil',
      'sk_live_abc123',
      'reset-token',
      'bbq_customer=abc',
      'Bearer abc',
      'deadbeef',
      'scrypt$32768',
    ]) {
      expect(line, `${leaked} reached the log`).not.toContain(leaked);
    }
  });

  /**
   * The one that would actually happen: somebody logs the whole request, or the
   * whole customer, rather than picking fields out of it.
   */
  it('walks into a nested object, because that is how a secret gets logged', () => {
    logger.info('request', {
      route: '/api/account/session',
      body: { email: customer.email, password: 'a-long-enough-password' },
      headers: { cookie: 'bbq_customer=abc', 'content-type': 'application/json' },
    });

    const line = written[0] as string;
    expect(line).not.toContain('a-long-enough-password');
    expect(line).not.toContain('bbq_customer=abc');
    expect(line, 'and keeps what is safe').toContain('application/json');
  });

  /**
   * Personal data is reduced rather than removed. Enough to tell two customers
   * apart in a trace; not enough for the log aggregator to become a copy of the
   * customer list that POPIA has never been told about.
   */
  it('reduces an email to its domain', () => {
    logger.info('order.placed', { email: customer.email });

    const line = written[0] as string;
    expect(line).not.toContain('thandi');
    expect(line).toContain('example.com');
  });

  it('reduces a mobile to its last two digits', () => {
    logger.info('order.placed', { mobile: customer.mobile });

    const line = written[0] as string;
    expect(line).not.toContain('082123');
    expect(line).toContain('67');
  });

  it('removes a name outright, since a name has no useful reduction', () => {
    logger.info('order.placed', { name: customer.name });
    expect(written[0]).not.toContain('Thandi');
  });

  it('leaves everything else alone', () => {
    expect(
      redact({ orderNumber: 'BBQ-1', totalCents: 900, mode: 'Collection', soldOut: false }),
    ).toEqual({ orderNumber: 'BBQ-1', totalCents: 900, mode: 'Collection', soldOut: false });
  });

  it('does not choke on a null or an array', () => {
    expect(() => logger.info('odd', { nothing: null, lines: [1, 2], deep: undefined })).not.toThrow();
  });

  /** A field called `emailTemplate` is not an email address. */
  it('reduces only the field named exactly, not anything containing it', () => {
    const line = redact({ emailTemplate: 'order-confirmation' });
    expect(line.emailTemplate).toBe('order-confirmation');
  });
});

describe('logging an error', () => {
  it('keeps the message and a bounded stack', () => {
    const fields = errorFields(new Error('the till is offline'));

    expect(fields.error).toBe('the till is offline');
    expect(String(fields.stack).split('\n').length).toBeLessThanOrEqual(5);
  });

  it('copes with something thrown that is not an Error', () => {
    expect(errorFields('just a string')).toEqual({ error: 'just a string' });
  });

  /**
   * The cause chain is not walked. A cause is frequently the thing carrying a
   * connection string, and a log line is not the place to discover that.
   */
  it('does not follow a cause into whatever it is holding', () => {
    const error = new Error('could not connect', {
      cause: new Error('postgres://bbq:hunter2@db.internal:5432'),
    });

    expect(JSON.stringify(errorFields(error))).not.toContain('hunter2');
  });
});

describe('the sink', () => {
  it('can be put back, so one test cannot silence the next', () => {
    const local: string[] = [];
    const undo = setSink((line) => local.push(line));

    logger.info('captured.here');
    undo();
    logger.info('captured.there');

    expect(local).toHaveLength(1);
    expect(written.map((line) => JSON.parse(line).event)).toContain('captured.there');
  });
});

// The suite-level sink stays installed for the whole file; nothing outside it
// should be writing to the console during a test run.
void restore;
