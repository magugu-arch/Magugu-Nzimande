'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useSyncExternalStore } from 'react';
import styles from './ConsentManager.module.css';

const GA = process.env.NEXT_PUBLIC_GA_ID;
const META = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const TIKTOK = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
const KEY = 'st-consent-v1';

type Choice = 'all' | 'essential';

// The choice lives in localStorage; this small store lets React read it without
// an effect, and re-render when it changes (here, in another tab, or on "reopen").
let memoryChoice: Choice | null = null; // when storage is blocked (private mode)
let reopened = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(): Choice | null {
  if (reopened) return null;
  try {
    const v = localStorage.getItem(KEY);
    return v === 'all' || v === 'essential' ? v : memoryChoice;
  } catch {
    return memoryChoice;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  const onReopen = () => {
    reopened = true;
    emit();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('st:consent', onReopen);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('st:consent', onReopen);
  };
}

/**
 * POPIA-friendly: no analytics or ad pixels load until the visitor says yes,
 * and nothing is shown at all when no analytics IDs are configured.
 */
export function ConsentManager() {
  const enabled = !!(GA || META || TIKTOK);
  // "pending" on the server and during hydration: the banner never flashes for people who already chose.
  const choice = useSyncExternalStore<Choice | null | 'pending'>(subscribe, read, () => 'pending');

  if (!enabled || choice === 'pending') return null;

  const decide = (c: Choice) => {
    try {
      localStorage.setItem(KEY, c);
    } catch {
      memoryChoice = c; // private mode: the choice lasts this visit
    }
    reopened = false;
    emit();
  };

  return (
    <>
      {choice === 'all' && GA && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {choice === 'all' && META && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META}');fbq('track','PageView');`}
        </Script>
      )}
      {choice === 'all' && TIKTOK && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${TIKTOK}');ttq.page()}(window,document,'ttq');`}
        </Script>
      )}
      {choice === null && (
        <div className={`glass-light ${styles.banner}`} role="region" aria-label="Cookie choices">
          <p>
            We use essential cookies to run bookings. With your OK we also measure visits and ads to improve the site.{' '}
            <Link href="/legal/privacy">Privacy</Link>
          </p>
          <div className={styles.actions}>
            <button className="btn btn--light btn--sm" onClick={() => decide('essential')}>
              Essential only
            </button>
            <button className="btn btn--primary btn--sm" onClick={() => decide('all')}>
              Allow all
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Lets a footer or privacy-page link reopen the choice. */
export function openConsent() {
  window.dispatchEvent(new Event('st:consent'));
}
