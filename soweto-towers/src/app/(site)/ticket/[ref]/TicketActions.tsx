'use client';

import { useEffect, useState } from 'react';
import { Bell, Calendar, Share, WhatsAppGlyph } from '@/components/ui/icons';
import { site, whatsappLink } from '@/content/site';
import { useClientValue } from '@/lib/client-values';
import { formatDayLong } from '@/lib/time';
import styles from './page.module.css';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type PushState = 'unknown' | 'unsupported' | 'ios-install' | 'off' | 'on' | 'denied' | 'busy';

/** What this browser can do about push reminders, known without any async work. */
function pushCapability(): PushState {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return ios && !standalone ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'unknown';
}

export function TicketActions({ refCode, token, date, summary }: { refCode: string; token: string; date: string | null; summary: string }) {
  const capability = useClientValue<PushState>(pushCapability, 'unknown');
  const [checked, setChecked] = useState<PushState | null>(null);
  const [shared, setShared] = useState(false);
  // Device limits win; otherwise what the subscription check (or the visitor) last set.
  const push: PushState = capability !== 'unknown' ? capability : (checked ?? 'unknown');
  const setPush = setChecked;

  useEffect(() => {
    if (capability !== 'unknown') return;
    let alive = true;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => alive && setChecked((p) => p ?? (sub ? 'on' : 'off')))
      .catch(() => alive && setChecked((p) => p ?? 'off'));
    // In development there is no service worker, so "ready" never settles; leave the button available.
    const t = window.setTimeout(() => setChecked((p) => p ?? 'off'), 1500);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [capability]);

  async function enablePush() {
    setPush('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setPush(permission === 'denied' ? 'denied' : 'off');
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch('/api/push')).json();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), topics: [`booking:${refCode}`, 'status'], bookingRef: refCode, token }),
      });
      setPush(res.ok ? 'on' : 'off');
    } catch {
      setPush('off');
    }
  }

  async function share() {
    const text = `I’m jumping 100m off the Soweto Towers${date ? ` on ${formatDayLong(date)}` : ''}. Who’s coming? #SowetoFromTheTop #100mClub`;
    const url = site.url;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Soweto Towers', text, url });
        setShared(true);
        return;
      }
    } catch {
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
  }

  return (
    <div className={styles.actions}>
      <a className="btn btn--dark" href={`/api/ics/${refCode}?t=${token}`}>
        <Calendar width={18} height={18} /> Add to calendar
      </a>
      {push === 'off' || push === 'busy' ? (
        <button type="button" className="btn btn--light" onClick={enablePush} disabled={push === 'busy'}>
          <Bell width={18} height={18} /> {push === 'busy' ? 'Turning on…' : 'Reminders on this phone'}
        </button>
      ) : push === 'on' ? (
        <span className={styles.on}>
          <Bell width={18} height={18} /> Reminders on
        </span>
      ) : push === 'ios-install' ? (
        <span className={styles.hint}>
          On iPhone: tap Share, then <strong>Add to Home Screen</strong>, and open this ticket from there to get reminders.
        </span>
      ) : null}
      <button type="button" className="btn btn--light" onClick={share}>
        <Share width={18} height={18} /> {shared ? 'Shared' : 'Tell your friends'}
      </button>
      <a className="btn btn--light" href={whatsappLink(`Hi! It’s about booking ${refCode} (${summary}). Can I `)} target="_blank" rel="noopener">
        <WhatsAppGlyph size={18} /> Move or ask
      </a>
    </div>
  );
}
