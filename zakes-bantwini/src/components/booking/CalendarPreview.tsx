'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { track } from '@/lib/analytics/client';
import { formatDayLong } from '@/lib/booking/dates';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import styles from './RequestWizard.module.css';

/** "Check preferred date" on the booking landing page — step 01 of the process. */
export function CalendarPreview() {
  const router = useRouter();
  const [date, setDate] = useState<string | null>(null);
  return (
    <div className={styles.dateStep}>
      <AvailabilityCalendar
        value={date}
        label="Check a preferred date"
        onChange={(d, state) => {
          setDate(d);
          track('book_date_selected', { state, source: 'preview' });
        }}
      />
      <div className={styles.dateAside}>
        <p className={styles.chosen} aria-live="polite">
          <span className="eyebrow">{date ? 'Preferred date' : 'Choose a date to begin'}</span>
          {date && <span>{formatDayLong(date)}</span>}
        </p>
        {date ? (
          <ButtonLink href={`/book/request?date=${date}`} arrow cursor="Book" onClick={() => router.prefetch('/book/request')}>
            Request this date
          </ButtonLink>
        ) : (
          <ButtonLink href="/book/request" variant="outline" arrow>
            Start without a date
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
