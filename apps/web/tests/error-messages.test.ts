import { beforeEach, describe, expect, it } from 'vitest';
import {
  apiRouteCode,
  blankState,
  bodyOf,
  clientCode,
  errorOf,
  request,
} from './fixtures';

/**
 * What a refusal says, and to whom.
 *
 * Every other sweep asked whether the application does the right thing. This
 * one asks what it says when it has decided not to — because a refusal is a
 * message written under pressure, by whoever was closest to the failure, and it
 * is the one string in the system that goes straight to a stranger's screen
 * without anybody reviewing it.
 *
 * Three things were wrong, and they are three versions of the same mistake:
 * the message that reaches the customer was assembled from something that was
 * never written for them.
 */

beforeEach(blankState);

describe('a delivery quote the customer cannot answer', () => {
  async function quote(body: unknown): Promise<Response> {
    const { POST } = await import('@/app/api/delivery/quote/route');
    return POST(request('/api/delivery/quote', { method: 'POST', body }));
  }

  /**
   * The schema says "Enter your suburb". The route said "Invalid quote
   * request", which is not a sentence anybody can act on and not a sentence
   * about the customer's suburb.
   *
   * The order route had already found this and written it down: every rule in
   * the schema "carries a message written for the person who broke it", and
   * replacing them all with two generic words tells a customer nothing. This is
   * the same fix on the endpoint that runs one step earlier — the one that
   * decides whether they can have it delivered at all.
   */
  it('answers with the message the rule was given', async () => {
    const response = await quote({ suburb: '', subtotalCents: 1000 });

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe('Enter your suburb');
  });

  it('names the field, so the message can go beside it', async () => {
    const response = await quote({ suburb: '', subtotalCents: 1000 });
    const body = await bodyOf<{ fields?: { field: string; message: string }[] }>(response);

    expect(body.fields).toEqual([{ field: 'suburb', message: 'Enter your suburb' }]);
  });

  /**
   * A subtotal is computed by the basket, never typed by a person, so a bad one
   * is our bug and not theirs. It still has to say something a customer can
   * read, because it still arrives on their screen.
   */
  it('has something to say about the total as well', async () => {
    const response = await quote({ suburb: 'Rosebank', subtotalCents: 'lots' });

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toBe('We could not read your basket total');
  });

  /**
   * The raw issues used to ride along under `issues` — the code, the expected
   * type, the path — which no client has ever read and which describes the
   * schema rather than the problem.
   */
  it('does not ship the validator’s own notes', async () => {
    const body = await bodyOf<Record<string, unknown>>(
      await quote({ suburb: '', subtotalCents: 1000 }),
    );

    expect(body).not.toHaveProperty('issues');
  });

  /**
   * The standing half. Two routes map issues to messages and one serialised
   * them whole; this is what stops the fourth route from picking either at
   * random.
   */
  it('and neither does any other route', () => {
    const leaking = apiRouteCode()
      .filter(({ code }) => /issues\s*:\s*[\w.]*\berror\.issues/.test(code))
      .map(({ file }) => file);

    expect(leaking, 'a Zod issue list is a description of our schema').toEqual([]);
  });
});

describe('what a refusal says about the deployment', () => {
  /**
   * Registering on a build with no session secret answered 503 — correctly —
   * and then told whoever asked which environment variable was missing and how
   * long it has to be.
   *
   * Nobody who can act on that is reading an HTTP response: the variable is in
   * the README's table and in `.env.example`, where the person deploying this
   * is already looking. What the reply did instead was tell an anonymous caller
   * which variable gates authentication here and that it is currently not set,
   * which is a thing to volunteer to nobody.
   *
   * The health endpoint has the rule written above it — "no secret, hostname or
   * connection string appears here, only whether each is present" — and reports
   * `accounts: false` and stops. This is that rule, applied to the route that
   * was one rung past it.
   */
  it('does not name the environment variable that is missing', async () => {
    const { POST } = await import('@/app/api/account/route');
    const response = await POST(
      request('/api/account', { method: 'POST', body: { email: 'a@b.co', password: 'x' } }),
    );

    expect(response.status).toBe(503);
    expect(JSON.stringify(await bodyOf(response))).not.toMatch(/BBQ_[A-Z_]+/);
  });

  it('still says that accounts are off, which is the customer’s half of it', async () => {
    const { POST } = await import('@/app/api/account/route');
    const response = await POST(
      request('/api/account', { method: 'POST', body: { email: 'a@b.co', password: 'x' } }),
    );

    expect(await errorOf(response)).toContain('not configured');
  });

  /** Standing, over every route: a response body never names one. */
  it('and no route names one anywhere in what it sends back', () => {
    const naming = apiRouteCode()
      .filter(({ code }) => /BBQ_[A-Z_]+/.test(code.replace(/env\.BBQ_[A-Z_]+/g, '')))
      .map(({ file }) => file);

    expect(naming, 'reading a variable is fine; quoting its name at a caller is not').toEqual(
      [],
    );
  });
});

describe('what the browser puts on screen when a call fails', () => {
  /**
   * `catch (error) { show(error instanceof Error ? error.message : …) }` looks
   * careful and is not. Every failure is an `Error`: a fetch that could not
   * leave the machine throws `TypeError: Failed to fetch`, and a response that
   * does not match its schema throws a `ZodError` whose message is a JSON dump
   * of issue objects. Both were rendered verbatim into the payment panel of the
   * order journey, under a heading about the customer's food.
   *
   * Every other screen on the site already narrows to the error type this
   * application defines — checkout to `ApiError`, the account screens to
   * `AccountError` — and falls back to a sentence somebody wrote. The journey
   * was the one that did not.
   *
   * Checked as a rule over all of them rather than on the one file, because the
   * next person reaching for a message in a catch block will reach for the same
   * one. `instanceof Error` for logging or for re-throwing is untouched; it is
   * only the reading of `.message` off it that this forbids.
   */
  it('never shows the message off a bare Error', () => {
    const showing = clientCode()
      .filter(({ code }) => /instanceof\s+Error\s*\?[^:]*\.message/.test(code))
      .map(({ file }) => file);

    expect(showing, 'these put an internal error message on a customer’s screen').toEqual([]);
  });
});
