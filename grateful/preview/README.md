# Grateful website: offline preview

**Grateful-iPhone-WhatsApp.html** is the edition to send on WhatsApp or open on an iPhone. It has no code at all, because iPhone WhatsApp and Files only show a preview that can't run code: every page of the website is shown as a full-length phone screenshot, with the studio dashboard, the photographs, the audit and the costing. Rebuild with `npm run build:whatsapp`.

**Grateful-Handover.html** is everything in one file: the interactive website, screenshots of it, the five photographs, the completion audit and the costing, with the fonts, icon and page details built in. On a Mac, double-click it. On Android, open it from Files with Chrome. On an iPhone or iPad the Files app previews it without running the interactive website, so the screenshots, photographs, audit and costing show but the interactive frame stays blank: open the online preview link (inside the file) in Safari for the website. Rebuild with `npm run build:single` then `npm run build:handover`.

**Grateful-Website-Preview.html** is the whole website in one file. Download it and:

- **Mac:** double-click it. It opens in Safari or Chrome.
- **Android:** open it from the Downloads/Files app and choose Chrome.

No internet or server is needed.

**Grateful-Go-Live-Guide.html** is the plain-language guide to the ten account steps (domain, Supabase, Resend, PayFast, Vercel, checks, a test booking, Google) that switch the site on. It opens the same way and is also inside both handover editions.

**Grateful-Build-Audit.html** is the latest completion audit (how far along the site is, and what is left), and opens the same way. **Grateful-Website-Costing.html** is the costing: what a site like this costs to build in South Africa in 2026, and what it costs to run each month.

In the website preview, bookings, payments and messages are simulated inside the page, and nothing is saved or sent. Use the **Preview** box (bottom corner) to switch on sample prices or open the **studio dashboard** (any key works in the preview).

Regenerate it with `npm run build:single`, then copy `dist-single/index.html` here.

Rebuild all three files in order with `npm run build:previews` (set `PW_CHROMIUM` to use a local Chromium for the screenshots). Refresh the audit and costing pages first if they changed.
