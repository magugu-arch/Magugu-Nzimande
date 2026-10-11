import { useCallback } from 'react';
import { useMarket } from './catalogue';

/** Times are stored as ISO 8601 UTC and shown in the customer's locale and zone. */
export function useTimeFormat(): (iso: string) => string {
  const market = useMarket();
  return useCallback(
    (iso: string) => {
      const d = new Date(iso);
      try {
        const sameDay = d.toDateString() === new Date().toDateString();
        const time = new Intl.DateTimeFormat(market.locale, {
          hour: '2-digit',
          minute: '2-digit',
        }).format(d);
        if (sameDay) return `today ${time}`;
        const day = new Intl.DateTimeFormat(market.locale, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }).format(d);
        return `${day}, ${time}`;
      } catch {
        return iso;
      }
    },
    [market.locale],
  );
}
