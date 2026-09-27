import { useEffect, useState } from 'react';
import type { Service } from '../../shared/types';
import { api, RequestError } from './api';

let cache: Promise<Service[]> | null = null;

/** Services come from the database, so prices and durations change without a deploy. Fetched once per visit. */
export function useServices() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    cache ??= api.services();
    cache
      .then((s) => live && setServices(s))
      .catch((e: unknown) => {
        cache = null;
        if (live) setError(e instanceof RequestError ? e.message : 'Services could not be loaded.');
      });
    return () => {
      live = false;
    };
  }, []);

  return { services, error, loading: !services && !error };
}
