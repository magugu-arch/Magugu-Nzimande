# Offline preview

**`Zakes-Bantwini-Website-Preview.html`** is the whole website in one file, about 4.4 MB. It works
offline, with nothing to install.

## Opening it

- **Mac:** double-click the file.
- **Android:** open it from Files (or Downloads) and choose **Chrome**.
- **iPhone/iPad:** in Files, tap the file, then Share → open in Safari.

## What's inside

- **Every public page as built:** 35 pages, including each release, video, journal story and live
  listing. They are captured from the production build and keep their real layouts on desktop,
  tablet and phone.
- **Booking & admin:** a booking from request to confirmation on a phone, plus the management
  workspace (dashboard, booking, calendar, content, assets, team, inbox).
- **Images:** all 41 supplied photographs, with their registry (alt text, sections, focal points,
  notes).
- **Audit and costing:** the same documents as [`AUDIT.md`](../AUDIT.md) and [`COSTING.md`](../COSTING.md).

The machine-readable metadata (pages, image registry, completion figures, costing, test results) is
embedded in the file as JSON: `<script id="zb-metadata">`.

## Limits of a static file

- Names, bookings and listings are **fictional sample data**.
- Forms, payments, downloads and the admin are live features. In the preview they show a notice or
  appear as screenshots.
- Pages switch even with scripts blocked, but photographs need JavaScript.

## Rebuilding it

```bash
npm run build
FILE_STORE_PATH=/tmp/zb/store.json npm run seed:demo -- --reset
FILE_STORE_PATH=/tmp/zb/store.json ALLOW_FILE_STORE=true ALLOW_SANDBOX_PAYMENTS=true PAYMENTS_PROVIDER=sandbox \
  APP_SECRET=<32+ chars> npm start -- -p 3220 &
PREVIEW_BASE_URL=http://localhost:3220 npm run preview:build
```
