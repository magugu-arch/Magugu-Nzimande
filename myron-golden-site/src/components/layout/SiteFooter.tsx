import { cacheLife } from 'next/cache';
import Link from 'next/link';
import { footerNav, site, verifiedSocials } from '@/content/site';
import { CookieSettingsButton } from '../system/Consent';
import { GoldRule } from '../ui/Section';
import { TikTokIcon } from '../ui/icons';
import { Wordmark } from './Wordmark';

async function CopyrightYear() {
  'use cache';
  cacheLife('days');
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter() {
  return (
    <footer className="grain relative bg-[#0b0b0d] text-ivory">
      <div className="container-site pt-20 pb-10">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <Wordmark />
            <p className="type-small mt-5 text-ivory/70">{site.description}</p>
            {verifiedSocials.length > 0 ? (
              <ul className="mt-6 flex gap-2" aria-label="Social media">
                {verifiedSocials.map((s) => (
                  <li key={s.platform}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pressable inline-flex h-10 items-center gap-2 rounded-full border border-ivory/15 px-4 text-[0.85rem] text-ivory/85 hover:border-gold/60 hover:text-ivory"
                    >
                      <TikTokIcon size={16} />
                      {s.handle}
                      <span className="sr-only"> on {s.platform} (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {footerNav.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <h2 className="type-eyebrow text-gold">{group.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="type-small text-ivory/72 transition-colors hover:text-ivory"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <GoldRule className="mt-16" />

        <div className="mt-8 flex flex-col gap-4 text-[0.8125rem] leading-relaxed text-ivory/60 md:flex-row md:items-start md:justify-between">
          <p className="max-w-2xl">
            Educational content only — not financial, legal or tax advice. Results depend on many
            factors and no particular outcome is promised.{' '}
            <Link href="/disclosures" className="underline hover:text-ivory">
              Disclosures
            </Link>
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2">
            <CookieSettingsButton className="underline hover:text-ivory" />
            <p>
              © <CopyrightYear /> {site.legalEntity}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
