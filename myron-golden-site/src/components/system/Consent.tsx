'use client';

import Script from 'next/script';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { type ConsentState, readConsent, writeConsent } from '@/lib/analytics';
import { GA_ID } from '@/lib/env';
import { buttonClasses } from '../ui/Button';

function subscribe(onChange: () => void) {
  window.addEventListener('mg-consent', onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener('mg-consent', onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * Cookie consent, only where it is needed: the banner exists solely when an
 * analytics ID is configured. With no analytics there are no non-essential
 * cookies, so there is nothing to ask about. GA loads after "Allow", never
 * before.
 */
export function Consent() {
  const consent = useSyncExternalStore<ConsentState | 'unknown'>(
    subscribe,
    readConsent,
    () => 'unknown',
  );
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (consent === 'granted') window.__mgAnalyticsConsent = true;
  }, [consent]);

  useEffect(() => {
    const open = () => setPanelOpen(true);
    window.addEventListener('mg-open-cookie-settings', open);
    return () => window.removeEventListener('mg-open-cookie-settings', open);
  }, []);

  if (!GA_ID) return null;

  const showBanner = consent === null || panelOpen;

  return (
    <>
      {consent === 'granted' ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`}
          </Script>
        </>
      ) : null}
      {showBanner ? (
        <div
          role="region"
          aria-label="Cookie preferences"
          className="material fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-2xl bg-charcoal/85 p-5 text-ivory shadow-2xl ring-1 ring-ivory/10 backdrop-blur-xl sm:bottom-5"
        >
          <p className="type-small text-ivory/85">
            We use optional analytics cookies to understand which pages help people most. They stay
            off unless you allow them.{' '}
            <a href="/cookies" className="underline">
              Cookie policy
            </a>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClasses('primary')}
              onClick={() => {
                writeConsent('granted');
                setPanelOpen(false);
              }}
            >
              Allow analytics
            </button>
            <button
              type="button"
              className={buttonClasses('secondary')}
              onClick={() => {
                writeConsent('denied');
                setPanelOpen(false);
              }}
            >
              Essential only
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function CookieSettingsButton({ className }: { className?: string }) {
  if (!GA_ID) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event('mg-open-cookie-settings'))}
    >
      Cookie settings
    </button>
  );
}
