# Quest4Best website — security

The site is static: no server code, no database, no logins, no cookies and no analytics. Its
attack surface is the page itself and the request form, and both are hardened.

## What is in place

| Layer                       | Protection                                                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content Security Policy     | Hosted build: only the site's own scripts, styles, fonts and images load (`'self'`); no inline script; `object-src 'none'`; `base-uri 'self'`; HTTPS upgrade.          |
|                             | Single-file preview: `default-src 'none'`; the one script and stylesheet allowed are identified by SHA-256 hash; images and fonts only as embedded data.               |
|                             | The form may only post to the site itself, the visitor's mail app, or the configured `https://` form service.                                                          |
| Clickjacking                | The page hides itself when framed by another site. Tested: embedded from a different origin, it stays hidden. `X-Frame-Options: DENY` is also set in `_headers`.       |
| Referrer policy             | `strict-origin-when-cross-origin`: other sites never see full page addresses. The form service request sends no referrer and no cookies.                               |
| Request form                | Length limits on every field; control characters and line breaks stripped from single-line fields (no email-header injection); only the four listed areas accepted.    |
|                             | Anti-spam: hidden honeypot field; valid submissions sent within 3 seconds of page load are dropped as bots; one submission per 30 seconds.                             |
|                             | The optional form service must be `https://`, or it is ignored and the form falls back to the mail app.                                                                |
| No risky code               | No `eval`, no raw HTML injection (`dangerouslySetInnerHTML`), no inline style attributes, no third-party scripts, fonts or trackers.                                   |
| Dependencies                | `npm audit`: 0 known vulnerabilities (checked 27 September 2026). Only React, lucide-react and the self-hosted Inter font ship to visitors.                            |
| Server headers (`_headers`) | For Netlify or Cloudflare Pages: HSTS, `nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, Permissions-Policy (camera, microphone, location off), COOP/CORP. |
| Vulnerability disclosure    | `/.well-known/security.txt` (RFC 9116) with the contact address, refreshed on every build.                                                                             |

## Verified

- Hosted build and single file (desktop and Android): zero CSP violations, zero console errors,
  all images and the font load.
- Form: empty submit shows five messages; an instant bot-style submit is dropped; a real submit
  after 3 seconds opens the mail app; a repeat within 30 seconds is throttled.
- Framing from another origin: the page stays hidden.
- Lighthouse: best practices 100; its XSS/CSP check passes.

## Limits and recommendations

- **GitHub Pages cannot send HTTP headers.** HSTS, `nosniff`, `frame-ancestors` and
  Permissions-Policy only apply on hosts that read `_headers` (Netlify, Cloudflare Pages), or
  behind Cloudflare in front of the custom domain. The meta-tag policy and frame guard cover the
  essentials meanwhile. GitHub Pages already serves HTTPS.
- **Domain:** once `quest4best.co.za` is live, tick "Enforce HTTPS" in the Pages settings, and
  consider DNSSEC at the registrar.
- **Email:** set up SPF, DKIM and DMARC for `quest4best.co.za` when the mailbox is created, so
  nobody can send convincing email pretending to be Quest4Best.
- **Form service:** if one is added, enable its own spam filtering (for example reCAPTCHA or
  Turnstile in Formspree or Web3Forms) and restrict it to the site's domain.
- **Keep it current:** run `npm audit` and update dependencies every few months.
