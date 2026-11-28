'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { dayHours, nextOpenDay } from '@/lib/hours';
import { addDays, hmInSast, hmToMinutes, weekday, weekdayName, ymdInSast } from '@/lib/time';
import { whatsappLink, site } from '@/content/site';
import { WhatsAppGlyph } from '@/components/ui/icons';
import type { TowerStatus } from '@/lib/status-types';
import styles from './StatusStrip.module.css';

type View = { tone: 'go' | 'hold' | 'stop' | 'idle'; text: string; detail?: string };

/** The next day the towers open, counting from tomorrow. */
function nextOpenLabel(today: string): string {
  const n = nextOpenDay(addDays(today, 1));
  return n ? `Next open ${weekdayName(weekday(n.date))} from ${n.opensAt}` : '';
}

function compute(status: TowerStatus | null, now: Date): View {
  const today = ymdInSast(now);
  const nowMin = hmToMinutes(hmInSast(now));
  const day = dayHours(today);
  const nextLabel = nextOpenLabel(today);

  if (status?.state === 'closed') {
    return { tone: 'stop', text: status.note || 'Closed today', detail: nextLabel };
  }
  if (!day.open && status?.state !== 'open') {
    return { tone: 'idle', text: 'Closed today', detail: nextLabel };
  }
  const opens = hmToMinutes(day.opensAt ?? '10:00');
  const sunset = hmToMinutes(day.sunset);
  if (nowMin < opens) {
    return { tone: 'idle', text: `Opens today at ${day.opensAt}`, detail: `Sunset ${day.sunset}` };
  }
  if (nowMin >= sunset) {
    return { tone: 'idle', text: 'Closed for today', detail: nextLabel };
  }
  if (status?.state === 'hold') {
    return { tone: 'hold', text: 'Weather hold', detail: status.note || 'Jumps paused while the weather passes. We’ll update here.' };
  }
  const queue = status?.queueMinutes ? ` · Queue about ${status.queueMinutes} min` : '';
  return { tone: 'go', text: 'Open now', detail: `Jumping till sunset ${day.sunset}${queue}` };
}

// One shared 30-second clock for the strip, read with useSyncExternalStore so the
// view is derived during render instead of being copied into state by an effect.
const clockListeners = new Set<() => void>();
let clockTimer: number | undefined;
function subscribeClock(onTick: () => void) {
  clockListeners.add(onTick);
  clockTimer ??= window.setInterval(() => clockListeners.forEach((l) => l()), 30_000);
  return () => {
    clockListeners.delete(onTick);
    if (!clockListeners.size) {
      window.clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}
const clockTick = () => Math.floor(Date.now() / 30_000);

export function StatusStrip({ initial }: { initial?: TowerStatus | null }) {
  const [status, setStatus] = useState<TowerStatus | null>(initial ?? null);
  // null on the server and while hydrating: the strip shows its placeholder, never a stale time.
  const tick = useSyncExternalStore(subscribeClock, clockTick, () => null);
  const view = tick === null ? null : compute(status, new Date(tick * 30_000));

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/status', { cache: 'no-store' });
        if (res.ok && alive) setStatus((await res.json()) as TowerStatus);
      } catch {
        /* offline: keep the schedule-based view */
      }
    };
    load();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  return (
    <div className={styles.strip}>
      <div className={`container ${styles.inner}`}>
        <p className={styles.status} role="status" aria-live="polite">
          <span className={`dot ${view?.tone === 'go' ? 'dot--live' : ''} ${styles[view?.tone ?? 'idle']}`} aria-hidden />
          {view ? (
            <>
              <strong>{view.text}</strong>
              {view.detail ? <span className={styles.detail}>{view.detail}</span> : null}
            </>
          ) : (
            <>
              <strong>Tower status</strong>
              <span className={styles.detail}>Open Thursday to Sunday till sunset</span>
            </>
          )}
        </p>
        <div className={styles.links}>
          <a href={`tel:${site.phone.e164}`} className={styles.link}>
            {site.phone.display}
          </a>
          <a href={whatsappLink('Hi Soweto Towers! I have a question about ')} className={styles.link} target="_blank" rel="noopener">
            <WhatsAppGlyph size={15} />
            WhatsApp us
          </a>
        </div>
      </div>
    </div>
  );
}
