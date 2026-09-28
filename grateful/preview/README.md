# Grateful website: offline preview

**Grateful-Handover.html** is everything in one file: the interactive website, screenshots of it, the five photographs, the completion audit and the costing, with the fonts, icon and page details built in. On a Mac, double-click it. On Android, open it from Files with Chrome. On an iPhone or iPad the Files app previews it without running the interactive website, so the screenshots, photographs, audit and costing show but the interactive frame stays blank: open the online preview link (inside the file) in Safari for the website. Rebuild with `npm run build:single` then `npm run build:handover`.

**Grateful-Website-Preview.html** is the whole website in one file. Download it and:

- **Mac:** double-click it. It opens in Safari or Chrome.
- **Android:** open it from the Downloads/Files app and choose Chrome.

No internet or server is needed.

**Grateful-Build-Audit.html** is the latest completion audit (how far along the site is, and what is left), and opens the same way. **Grateful-Website-Costing.html** is the costing: what a site like this costs to build in South Africa in 2026, and what it costs to run each month.

In the website preview, bookings, payments and messages are simulated inside the page, and nothing is saved or sent. Use the **Preview** box (bottom corner) to switch on sample prices or open the **studio dashboard** (any key works in the preview).

Regenerate it with `npm run build:single`, then copy `dist-single/index.html` here.
