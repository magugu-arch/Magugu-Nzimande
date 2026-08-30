import {
  reportError,
  scrub,
  setErrorReporter,
  type ErrorContext,
  type ErrorReporter,
} from '@/ux/errorReporting';

/**
 * §13: "Log operational errors without leaking sensitive customer information."
 *
 * The second half is the part with teeth. An error message is the least
 * disciplined string in an application — nobody writes one expecting it to be
 * stored, so they collect whatever was in scope. Point a crash reporter at
 * that and you have a second customer database in a third-party system that
 * nobody declared and no retention policy covers.
 *
 * Every case below is a string this app can actually produce: an API client
 * that quotes the URL it called, a 401 that quotes the token it sent, a
 * validation error that echoes what somebody typed.
 */
describe('scrubbing what an error message picked up', () => {
  it('redacts an email, wherever it sits in the sentence', () => {
    expect(scrub('Failed to update magugu@totalitycreative.com')).toBe('Failed to update [email]');
    expect(scrub('POST /v1/account {"email":"a.b@c.co.za"} 422')).toContain('[email]');
  });

  it('redacts a bearer token and a raw JWT', () => {
    expect(scrub('401 with Authorization: Bearer abc123.def456.ghi')).toContain(
      'Bearer [redacted]',
    );
    expect(scrub('rejected eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.QWxhZGRpbg')).toContain('[jwt]');
  });

  it('redacts a credential named in a query string or a JSON field', () => {
    expect(scrub('GET /v1/x?api_key=sk_live_9f2b')).not.toContain('sk_live_9f2b');
    expect(scrub('{"password":"hunter2"}')).not.toContain('hunter2');
  });

  it('redacts a South African mobile number however it is typed', () => {
    for (const phone of ['+27 82 555 1234', '0825551234', '082 555 1234', '082-555-1234']) {
      expect(scrub(`Could not reach ${phone}`)).toBe('Could not reach [phone]');
    }
  });

  it('redacts anything card-shaped', () => {
    expect(scrub('declined 4242 4242 4242 4242')).toBe('declined [card]');
    expect(scrub('declined 4242424242424242')).toBe('declined [card]');
  });

  it('redacts coordinates, which are somebody’s home', () => {
    expect(scrub('no store near -26.10745, 28.05646')).toBe('no store near [coords]');
  });

  /**
   * The single most common carrier. A URL's path is useful for grouping and
   * its query string is where the email, the token and the coordinates all
   * ended up, so the path survives and everything after `?` does not.
   */
  it('keeps a URL path and drops its query string', () => {
    const scrubbed = scrub(
      'Request failed: https://api.bbqchicken.co.za/v1/stores?lat=-26.1&email=a@b.co',
    );
    expect(scrubbed).toContain('https://api.bbqchicken.co.za/v1/stores');
    expect(scrubbed).not.toContain('a@b.co');
    expect(scrubbed).not.toContain('lat=');
  });

  it('caps the length, because past a point it is a stack and not a message', () => {
    expect(scrub('x'.repeat(2000)).length).toBeLessThanOrEqual(501);
  });

  it('leaves an ordinary operational message alone', () => {
    // Over-redaction has a cost too — a breadcrumb that says nothing is not
    // worth reporting. This is the shape most errors actually take.
    const message = 'Store store-sandton is closed — schedule for later';
    expect(scrub(message)).toBe(message);
  });
});

describe('reporting', () => {
  const sent: { error: { name: string; message: string }; context: ErrorContext }[] = [];
  const reporter: ErrorReporter = { report: (error, context) => sent.push({ error, context }) };

  beforeEach(() => {
    sent.length = 0;
    setErrorReporter(reporter);
  });
  afterEach(() => setErrorReporter(null));

  it('scrubs the message before it reaches the reporter', () => {
    reportError(new Error('failed for magugu@totalitycreative.com'), { scope: 'checkout.submit' });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.error.message).toBe('failed for [email]');
    expect(sent[0]?.context.scope).toBe('checkout.submit');
  });

  it('scrubs the component stack too', () => {
    // A render crash inside checkout carries props down its stack.
    reportError(new Error('boom'), {
      scope: 'render',
      componentStack: 'at Checkout (email=a@b.co)',
    });

    expect(sent[0]?.context.componentStack).toContain('[email]');
    expect(sent[0]?.context.componentStack).not.toContain('a@b.co');
  });

  it('handles something thrown that was never an Error', () => {
    reportError('a string with a@b.co in it', { scope: 'push.register' });

    expect(sent[0]?.error.name).toBe('UnknownError');
    expect(sent[0]?.error.message).toContain('[email]');
  });

  it('passes nothing but scope and stack through as context', () => {
    // A caller cannot smuggle a customer id in by adding a field: only the two
    // declared keys are forwarded.
    reportError(new Error('boom'), {
      scope: 'checkout.submit',
      ...({ customerId: 'user-1' } as object),
    });

    expect(Object.keys(sent[0]?.context ?? {})).toEqual(['scope']);
  });

  it('never throws, even when the reporter does', () => {
    setErrorReporter({
      report: () => {
        throw new Error('reporter is down');
      },
    });

    // This runs inside an error boundary and inside catch blocks. A reporter
    // that can throw turns a handled failure into a crash.
    expect(() => reportError(new Error('boom'), { scope: 'render' })).not.toThrow();
  });

  it('sends nothing at all until a reporter is injected', () => {
    setErrorReporter(null);
    expect(() => reportError(new Error('boom'), { scope: 'render' })).not.toThrow();
    expect(sent).toHaveLength(0);
  });
});
