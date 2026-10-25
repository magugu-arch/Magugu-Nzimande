/**
 * Channel adapters. In-app is native; email and push are SANDBOX adapters
 * that accept messages without sending anything; SMS and WhatsApp stay
 * switched off until Tashas approves a provider, sender identity, templates
 * and a consent process for them (brief §6).
 */

import type { Ctx } from '../context.ts';
import type { Channel, Guest, NotificationRecord } from '../types.ts';

export type SendOutcome =
  | { ok: true; status: 'accepted' | 'delivered'; providerMessageId: string }
  | { ok: false; permanent: boolean; error: string };

export interface ChannelAdapter {
  channel: Channel;
  label: string;
  configured: boolean;
  isSandbox: boolean;
  send(notification: NotificationRecord, guest: Guest): Promise<SendOutcome>;
}

export function inAppAdapter(ctx: Ctx): ChannelAdapter {
  return {
    channel: 'in-app',
    label: 'In-app inbox',
    configured: true,
    isSandbox: false,
    async send() {
      return { ok: true, status: 'delivered', providerMessageId: ctx.ids.id('inapp') };
    },
  };
}

export function sandboxEmailAdapter(ctx: Ctx): ChannelAdapter {
  return {
    channel: 'email',
    label: 'Email (sandbox: nothing is sent)',
    configured: true,
    isSandbox: true,
    async send(_n, guest) {
      if (!guest.email) return { ok: false, permanent: true, error: 'no-address' };
      if (guest.email.includes('bounce')) return { ok: false, permanent: true, error: 'hard-bounce' };
      const settings = ctx.db.require('settings', 'global');
      if (settings.sandbox.emailFailures > 0) {
        ctx.db.update('settings', 'global', {
          sandbox: { ...settings.sandbox, emailFailures: settings.sandbox.emailFailures - 1 },
        });
        return { ok: false, permanent: false, error: 'temporary-failure' };
      }
      return { ok: true, status: 'delivered', providerMessageId: ctx.ids.id('eml') };
    },
  };
}

export function sandboxPushAdapter(ctx: Ctx): ChannelAdapter {
  return {
    channel: 'push',
    label: 'Push (sandbox: nothing is sent)',
    configured: true,
    isSandbox: true,
    async send(_n, guest) {
      if (!guest.pushToken || !guest.pushTokenValid) return { ok: false, permanent: true, error: 'no-device' };
      if (guest.pushToken.includes('invalid')) return { ok: false, permanent: true, error: 'token-invalid' };
      return { ok: true, status: 'accepted', providerMessageId: ctx.ids.id('psh') };
    },
  };
}

export function notConfiguredAdapter(channel: Channel, label: string): ChannelAdapter {
  return {
    channel,
    label: `${label} (not configured)`,
    configured: false,
    isSandbox: false,
    async send() {
      return { ok: false, permanent: true, error: 'channel-not-configured' };
    },
  };
}

export function defaultAdapters(ctx: Ctx): Record<Channel, ChannelAdapter> {
  return {
    'in-app': inAppAdapter(ctx),
    email: sandboxEmailAdapter(ctx),
    push: sandboxPushAdapter(ctx),
    sms: notConfiguredAdapter('sms', 'SMS'),
    whatsapp: notConfiguredAdapter('whatsapp', 'WhatsApp'),
  };
}
