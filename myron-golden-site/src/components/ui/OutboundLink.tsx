'use client';

import type { ReactNode } from 'react';
import { type AnalyticsEvent, track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { withUtm } from '@/lib/links';
import { type ButtonSize, type ButtonVariant, ExternalArrow, buttonClasses } from './Button';

/**
 * A link to an official external destination (enrolment, checkout, retailer).
 * Adds UTM parameters, opens in a new tab, says so to screen readers, and
 * records the click when analytics consent has been given.
 */
export function OutboundLink({
  href,
  children,
  campaign,
  event = 'cta_click',
  label,
  variant,
  size = 'md',
  className,
}: {
  href: string;
  children: ReactNode;
  /** UTM campaign — usually the page or record slug. */
  campaign: string;
  event?: AnalyticsEvent;
  /** Analytics label for the click. */
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const url = withUtm(href, campaign, label);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        track(event, { destination: new URL(href).hostname, label: label ?? campaign })
      }
      className={cn(
        variant ? buttonClasses(variant, size) : 'group inline-flex items-center gap-1.5',
        className,
      )}
    >
      {children}
      <ExternalArrow />
    </a>
  );
}
