'use client';

import { useEffect, useState } from 'react';
import { Ticket } from '@/components/ui/icons';

type Saved = { href: string; ref: string };

/**
 * Tickets this device has opened before (and so has in its offline cache).
 * Reads Cache Storage directly, so it works whatever the service worker names its caches.
 */
export function SavedTickets() {
  const [tickets, setTickets] = useState<Saved[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const found = new Map<string, Saved>();
      try {
        if ('caches' in window) {
          for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            for (const req of await cache.keys()) {
              const url = new URL(req.url);
              const match = url.pathname.match(/^\/ticket\/(ST-[A-Z0-9]{6})/i);
              if (match && url.origin === window.location.origin) {
                found.set(match[1]!.toUpperCase(), { href: url.pathname + url.search, ref: match[1]!.toUpperCase() });
              }
            }
          }
        }
      } catch {
        /* storage unavailable (private mode) */
      }
      if (alive) setTickets([...found.values()]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (tickets === null) return null;
  if (tickets.length === 0) {
    return <p className="muted">No tickets saved on this device yet. Open your ticket once while online and it will be here next time.</p>;
  }
  return (
    <ul role="list" className="cluster">
      {tickets.map((t) => (
        <li key={t.ref}>
          {/* A plain link: the service worker answers from its cache while offline. */}
          <a href={t.href} className="pill pill--light">
            <Ticket width={18} height={18} /> {t.ref}
          </a>
        </li>
      ))}
    </ul>
  );
}
