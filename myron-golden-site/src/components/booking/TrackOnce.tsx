'use client';

import { useEffect } from 'react';
import { type AnalyticsEvent, track } from '@/lib/analytics';

/** Reports one conversion event when a server-rendered page shows it (consent permitting). */
export function TrackOnce({
  event,
  params,
}: {
  event: AnalyticsEvent;
  params?: Record<string, string | number>;
}) {
  const key = JSON.stringify(params ?? {});
  useEffect(() => {
    track(event, JSON.parse(key) as Record<string, string | number>);
  }, [event, key]);
  return null;
}
