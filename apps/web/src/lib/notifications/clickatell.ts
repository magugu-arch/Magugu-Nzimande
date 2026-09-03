import type { Delivery, Message, NotificationTransport } from './transport';

/**
 * Clickatell, for SMS.
 *
 * A South African gateway, which matters for more than sentiment: local
 * termination is what makes an SMS to a Vodacom number cost what it should.
 *
 * The authorization header is the bare API key. Not `Bearer <key>` — adding
 * the scheme is a 401 that reads like a wrong key, and it is the first thing
 * anyone types out of habit.
 */

const ENDPOINT = 'https://platform.clickatell.com/messages';

export type ClickatellConfig = {
  apiKey: string;
  /** The registered sender id or long number, if the account has one. */
  from?: string;
  fetcher?: typeof fetch;
};

/**
 * A South African mobile as Clickatell wants it: international, digits only.
 *
 * Deliberately not the same helper the courier adapter uses. Uber wants E.164
 * with the plus; Clickatell wants the same number without it. Sharing one
 * function between them would mean one of the two is quietly wrong, and the
 * failure — a message accepted and never delivered — is invisible from here.
 */
export function clickatellMsisdn(mobile: string): string | null {
  const digits = mobile.replace(/[\s()+-]/g, '');
  if (/^27[6-8]\d{8}$/.test(digits)) return digits;
  if (/^0[6-8]\d{8}$/.test(digits)) return `27${digits.slice(1)}`;
  return null;
}

type ClickatellReply = {
  messages?: { apiMessageId?: unknown; accepted?: unknown; error?: unknown }[];
  error?: unknown;
};

export function clickatellTransport(config: ClickatellConfig): NotificationTransport {
  const send = config.fetcher ?? fetch;

  return {
    name: 'clickatell',

    async deliver(message: Message): Promise<Delivery> {
      const to = clickatellMsisdn(message.to);
      if (!to) {
        return { ok: false, error: `Not a South African mobile number: ${message.to}` };
      }

      try {
        const response = await send(ENDPOINT, {
          method: 'POST',
          headers: {
            // The bare key. No scheme.
            authorization: config.apiKey,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                channel: 'sms',
                to,
                content: message.body,
                ...(config.from ? { from: config.from } : {}),
                // Our id, echoed in delivery reports, so a failure can be tied
                // to the order that caused it.
                clientMessageId: message.id,
              },
            ],
          }),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          return {
            ok: false,
            error: `Clickatell refused it (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
          };
        }

        const parsed = (await response.json().catch(() => null)) as ClickatellReply | null;
        const first = parsed?.messages?.[0];

        /**
         * A 200 is not an acceptance.
         *
         * Clickatell answers 200 with `accepted: false` and an error on the
         * individual message — an unroutable number, an account out of credit.
         * Reading only the status code is how a store discovers at the end of a
         * month that nothing has been delivered since the balance ran out.
         */
        if (!first || first.accepted !== true) {
          const reason = typeof first?.error === 'string' ? first.error : 'no reason given';
          return { ok: false, error: `Clickatell did not accept it: ${reason}` };
        }

        return {
          ok: true,
          id: typeof first.apiMessageId === 'string' ? first.apiMessageId : message.id,
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Clickatell unreachable',
        };
      }
    },
  };
}
