import { clickatellTransport } from './clickatell';
import { mailgunTransport, type MailgunRegion } from './mailgun';
import { loggingTransport, type Message, type NotificationTransport } from './transport';

/**
 * Which provider carries which channel.
 *
 * Two of them, because email and SMS are different products with different
 * economics and no vendor is good at both: Mailgun for email, Clickatell for
 * SMS because it terminates locally and an SMS to a South African network
 * costs what it should.
 *
 * Either can be absent independently, and an absent one falls back to the log
 * rather than dropping the message. That is the fulfilment rule rather than the
 * payment one: an order stands whether or not its confirmation email sends, and
 * a store with email configured and SMS not should still get the email.
 */

export type MessagingEnv = {
  BBQ_MAILGUN_API_KEY?: string | undefined;
  BBQ_MAILGUN_DOMAIN?: string | undefined;
  BBQ_MAILGUN_FROM?: string | undefined;
  BBQ_MAILGUN_REGION?: string | undefined;
  BBQ_MAILGUN_WEBHOOK_KEY?: string | undefined;
  BBQ_CLICKATELL_API_KEY?: string | undefined;
  BBQ_CLICKATELL_FROM?: string | undefined;
  readonly [other: string]: string | undefined;
};

/**
 * Which Mailgun region, defaulting to EU rather than to Mailgun's own US.
 *
 * A South African business storing customer data is answering to POPIA, and
 * the EU region is the one with a data-protection regime a lawyer can point
 * at. The safer default costs a deployment one variable when it is wrong and
 * costs nothing when nobody thinks about it.
 *
 * Exported because it is the decision worth testing, and a test that rebuilt
 * the transport by hand to check it was passing whatever the registry did.
 */
export function mailgunRegion(env: MessagingEnv = process.env): MailgunRegion {
  return env.BBQ_MAILGUN_REGION === 'us' ? 'us' : 'eu';
}

export function emailTransport(env: MessagingEnv = process.env): NotificationTransport | null {
  const apiKey = env.BBQ_MAILGUN_API_KEY;
  const domain = env.BBQ_MAILGUN_DOMAIN;
  const from = env.BBQ_MAILGUN_FROM;
  if (!apiKey || !domain || !from) return null;

  return mailgunTransport({ apiKey, domain, from, region: mailgunRegion(env) });
}

export function smsTransport(env: MessagingEnv = process.env): NotificationTransport | null {
  const apiKey = env.BBQ_CLICKATELL_API_KEY;
  if (!apiKey) return null;

  return clickatellTransport({ apiKey, from: env.BBQ_CLICKATELL_FROM });
}

export function mailgunWebhookKey(env: MessagingEnv = process.env): string | null {
  const key = env.BBQ_MAILGUN_WEBHOOK_KEY;
  return key && key.length > 0 ? key : null;
}

/**
 * One transport that routes by channel.
 *
 * `record` is what the unconfigured channels fall back to — the audit log, so
 * an operator can see exactly what would have been sent and to whom, and no
 * dashboard can mistake it for delivery.
 */
export function routedTransport(
  record: (message: Message) => void,
  env: MessagingEnv = process.env,
): NotificationTransport {
  const log = loggingTransport(record);
  const email = emailTransport(env);
  const sms = smsTransport(env);

  const chosen = (channel: Message['channel']) =>
    (channel === 'email' ? email : sms) ?? log;

  return {
    // Names the pair, so an audit line says which provider carried it rather
    // than just "sent".
    get name() {
      return `email:${email?.name ?? 'log'} sms:${sms?.name ?? 'log'}`;
    },
    deliver: (message) => chosen(message.channel).deliver(message),
  };
}
