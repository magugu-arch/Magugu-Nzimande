import type { ServiceContext } from '../context';
import type { NotificationMessage, NotificationProvider, RenderedMessage } from './types';

/** Expo's push service: one endpoint for APNs and FCM. */
export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export function isExpoPushToken(token: string): boolean {
  return TOKEN.test(token);
}

type Fetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

interface Ticket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * §37 push delivery through Expo. Sends to every device the guest has
 * registered; a device Expo reports as unregistered is forgotten. Lock-screen
 * copy is the rendered, lock-screen-safe template (§39) — never the raw data.
 *
 * `accessToken` is optional (Expo's "enhanced push security"); when set it is
 * a server secret and must never reach the app.
 */
export class ExpoPushProvider implements NotificationProvider {
  readonly channel = 'push' as const;

  constructor(
    private readonly ctx: ServiceContext,
    private readonly fetchImpl: Fetch,
    private readonly accessToken?: string,
  ) {}

  async send(message: NotificationMessage, rendered: RenderedMessage) {
    const tokens = this.ctx.db.pushTokens.filter((t) => t.guestId === message.guestId);
    if (!tokens.length) return { accepted: false, reason: 'NO_REGISTERED_DEVICE' };
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    let response;
    try {
      response = await this.fetchImpl(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(
          tokens.map((t) => ({
            to: t.id,
            title: rendered.subject,
            body: rendered.body,
            sound: 'default',
            data: { deepLink: message.deepLink, notificationId: message.id },
          })),
        ),
      });
    } catch (error) {
      return { accepted: false, reason: `expo push unreachable: ${String(error)}` };
    }
    if (!response.ok) return { accepted: false, reason: `expo push HTTP ${response.status}` };
    const body = (await response.json().catch(() => ({}))) as { data?: Ticket[] };
    const tickets = body.data ?? [];
    let delivered: string | undefined;
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'ok') delivered ??= ticket.id;
      else if (ticket.details?.error === 'DeviceNotRegistered' && tokens[i])
        this.ctx.db.pushTokens.delete(tokens[i].id);
    });
    return delivered
      ? { accepted: true, providerMessageId: delivered }
      : { accepted: false, reason: tickets[0]?.message ?? 'expo push rejected' };
  }
}
