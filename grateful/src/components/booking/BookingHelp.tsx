import { site } from '../../data/site';

/**
 * The one place the studio's phone number appears: the booking flow, where a
 * client may need a quick answer. Everywhere else the studio is reached by email.
 */
export function BookingHelp({ lead = 'Questions about your booking?', className = '' }: { lead?: string; className?: string }) {
  return (
    <p className={`font-sans text-sm opacity-70 ${className}`}>
      {lead} Call{' '}
      <a className="underline underline-offset-4" href={site.bookingPhoneHref}>
        {site.bookingPhone}
      </a>{' '}
      or email{' '}
      <a className="break-words underline underline-offset-4" href={`mailto:${site.email}`}>
        {site.email}
      </a>
      .
    </p>
  );
}
