import 'server-only';
import type { ChannelAdapter, NotificationEvent, OutboundMessage, SendResult } from './types';

async function post(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ''}`);
  }
  return res;
}

/** Email via Resend's HTTP API (RESEND_API_KEY, EMAIL_FROM). */
export class ResendEmail implements ChannelAdapter {
  readonly channel = 'email' as const;
  readonly provider = 'resend';
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly replyTo?: string,
  ) {}

  async send(m: OutboundMessage): Promise<SendResult> {
    const res = await post('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [m.to], subject: m.subject, text: m.text, html: m.html, reply_to: this.replyTo }),
    });
    const json = (await res.json()) as { id?: string };
    return { status: 'sent', provider: this.provider, providerId: json.id };
  }
}

/** SMS via Twilio's Messages API (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM). */
export class TwilioSms implements ChannelAdapter {
  readonly channel = 'sms' as const;
  readonly provider = 'twilio';
  constructor(
    private readonly sid: string,
    private readonly token: string,
    private readonly from: string,
  ) {}

  async send(m: OutboundMessage): Promise<SendResult> {
    const res = await post(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.sid)}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${this.sid}:${this.token}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: m.to, From: this.from, Body: m.text }).toString(),
    });
    const json = (await res.json()) as { sid?: string };
    return { status: 'sent', provider: this.provider, providerId: json.sid };
  }
}

/**
 * WhatsApp via the Meta Cloud API. Business-initiated messages must use
 * pre-approved templates: one template per notification event, named
 * `zb_<event>` (override with WHATSAPP_TEMPLATE_PREFIX), body parameters in
 * the order `templateParams` lists them.
 */
export class WhatsAppCloud implements ChannelAdapter {
  readonly channel = 'whatsapp' as const;
  readonly provider = 'meta-cloud';
  constructor(
    private readonly token: string,
    private readonly phoneNumberId: string,
    private readonly templatePrefix = 'zb_',
    private readonly language = 'en',
  ) {}

  async send(m: OutboundMessage, event: NotificationEvent): Promise<SendResult> {
    const res = await post(`https://graph.facebook.com/v21.0/${encodeURIComponent(this.phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: m.to.replace(/[^\d]/g, ''),
        type: 'template',
        template: {
          name: `${this.templatePrefix}${event}`,
          language: { code: this.language },
          components: [{ type: 'body', parameters: (m.templateParams ?? []).map((text) => ({ type: 'text', text })) }],
        },
      }),
    });
    const json = (await res.json()) as { messages?: { id: string }[] };
    return { status: 'sent', provider: this.provider, providerId: json.messages?.[0]?.id };
  }
}

/** Development and unconfigured channels: record the message, deliver nothing. */
export class LogOnly implements ChannelAdapter {
  readonly provider = 'log';
  constructor(readonly channel: ChannelAdapter['channel']) {}

  async send(m: OutboundMessage, event: NotificationEvent): Promise<SendResult> {
    if (process.env.NODE_ENV !== 'test') {
      console.info(`[notify:${this.channel}] ${event} → ${m.to}\n  ${m.subject}\n  ${m.text.split('\n').join('\n  ')}`);
    }
    return { status: 'logged', provider: this.provider };
  }
}

export function emailAdapter(): ChannelAdapter {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  return key && from ? new ResendEmail(key, from, process.env.EMAIL_REPLY_TO) : new LogOnly('email');
}

export function smsAdapter(): ChannelAdapter | null {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = process.env;
  return sid && token && from ? new TwilioSms(sid, token, from) : null;
}

export function whatsappAdapter(): ChannelAdapter | null {
  const { WHATSAPP_TOKEN: token, WHATSAPP_PHONE_NUMBER_ID: id } = process.env;
  return token && id ? new WhatsAppCloud(token, id, process.env.WHATSAPP_TEMPLATE_PREFIX, process.env.WHATSAPP_TEMPLATE_LANGUAGE) : null;
}
