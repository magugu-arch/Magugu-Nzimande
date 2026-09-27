import { useCallback, useEffect, useState } from 'react';
import type { PublicBooking } from '../../shared/types';
import { api, RequestError } from './api';

/** Load a booking by id; optionally poll while a condition holds (e.g. waiting for a payment webhook). */
export function useBooking(id: string | null, pollWhile?: (b: PublicBooking) => boolean) {
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [error, setError] = useState<string | null>(id ? null : 'No booking was specified.');
  const [attempts, setAttempts] = useState(0);

  const load = useCallback(() => {
    if (!id) return Promise.resolve();
    return api.booking(id).then(
      (b) => {
        setBooking(b);
        setError(null);
      },
      (e: unknown) => setError(e instanceof RequestError ? e.message : 'The booking could not be loaded.'),
    );
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let live = true;
    api.booking(id).then(
      (b) => live && setBooking(b),
      (e: unknown) => live && setError(e instanceof RequestError ? e.message : 'The booking could not be loaded.'),
    );
    return () => {
      live = false;
    };
  }, [id]);

  const polling = !!booking && !!pollWhile?.(booking) && attempts < 30;
  useEffect(() => {
    if (!polling) return;
    const t = setTimeout(() => {
      setAttempts((a) => a + 1);
      void load();
    }, 2000);
    return () => clearTimeout(t);
  }, [polling, attempts, load]);

  return { booking, error, loading: !booking && !error, polling, timedOut: attempts >= 30, reload: load };
}
