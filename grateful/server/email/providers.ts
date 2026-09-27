import { config } from '../config';
import type { EmailMessage, EmailProvider } from './types';

/**
 * PROVIDER-SPECIFIC: Resend (https://resend.com/docs/api-reference/emails/send-email).
 * One HTTPS call; the API key stays on the server.
 */
export function createResendProvider(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): EmailProvider {
  return {
    name: 'resend',
    async send(m: EmailMessage) {
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text, reply_to: m.replyTo }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
    },
  };
}

/** Development: print the email instead of sending it. */
export function createConsoleProvider(): EmailProvider {
  return {
    name: 'console',
    async send(m: EmailMessage) {
      console.warn(`\n[email] to=${m.to} subject="${m.subject}"\n${m.text}\n`);
    },
  };
}

let override: EmailProvider | null = null;

export function emailProvider(): EmailProvider {
  if (override) return override;
  const c = config();
  if (c.emailProvider === 'resend') {
    if (!c.resendApiKey) throw new Error('RESEND_API_KEY must be set when EMAIL_PROVIDER=resend.');
    return createResendProvider(c.resendApiKey, c.emailFrom);
  }
  return createConsoleProvider();
}

/** Tests only. */
export function setEmailProvider(p: EmailProvider | null) {
  override = p;
}

/**
 * Send without letting a mail outage undo a booking or a payment: the
 * database is the record, the email is a courtesy. Failures are logged.
 */
export async function sendSafely(messages: EmailMessage[]): Promise<void> {
  const provider = emailProvider();
  await Promise.all(
    messages.map((m) =>
      provider.send(m).catch((err: unknown) => {
        console.error(`[email] failed to send "${m.subject}":`, err instanceof Error ? err.message : err);
      }),
    ),
  );
}
