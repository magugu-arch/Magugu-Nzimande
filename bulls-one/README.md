# Bulls One — The Loftus Experience (concept prototype)

A concept supporter app for the Vodacom Bulls at Loftus Versfeld. Not an
official Bulls product: tickets, scores, rewards and screens are sample data.

- **Interactive app:** https://claude.ai/artifact/SZ2ZYsZXFVykdLkdVtqs91
  (private until shared from the page's Share menu)
- **Single-file app:** `Bulls_One_Loftus_Experience.html`, about 4.3 MB, with
  all 22 reference images, fonts and metadata embedded. Works offline.
- **Social preview image:** `og-image.jpg` (1200 × 630)

## Opening and sharing it

| Where | How |
| --- | --- |
| iPhone | Open the link in Safari, then Share → Add to Home Screen. A downloaded file opens in Files as a static preview: every screen and image shows, but interactive features need the link. |
| Android | Open the link in Chrome, then ⋮ → Add to Home screen. The downloaded file also opens in Chrome, fully interactive. |
| WhatsApp | Use **Share on WhatsApp** in the app (sends the link), or send the HTML file as a document. |

The app's **Download the app file** button saves the single-file version. In
the claude.ai viewer it goes through the viewer's download prompt.

## Fixtures

The 2026/27 fixtures were compiled on 31 October 2026 from public United Rugby
Championship and club listings. Kick-off times are provisional, and some
sources disagree, so the app labels them "Time provisional" or "Time TBC". The
app does not copy results or the log. In production, fixtures come from the
club's approved feed.

## Rebuilding

From `src/`, with the briefing document as input:

```sh
python3 -I build.py <briefing.docx> .. --icon <apple-touch-icon.png> --og <og.png> \
    --app-url https://claude.ai/artifact/SZ2ZYsZXFVykdLkdVtqs91 \
    [--site-url https://your-host/bulls-one/]
node prerender.js ../Bulls_One_Loftus_Experience.html
python3 -I make_artifact.py ../Bulls_One_Loftus_Experience.html ../dist/artifact/index.html
```

- `build.py` embeds each image once as a CSS data URI, so pictures show without
  JavaScript and under strict viewers. It also fills the share and metadata URLs.
- `prerender.js` writes each screen's first render into the file, so the page
  reads fully when JavaScript is off (iPhone Files, WhatsApp document previews).
- `make_artifact.py` strips the document wrapper for the claude.ai viewer
  (`dist/` is generated and not committed).
- Set `--site-url` when hosting on your own domain, so link previews (Open
  Graph and Twitter) resolve, and switch `robots` to `index, follow` once the
  club approves a public release.

Fonts: Playfair Display and DM Mono, SIL Open Font License 1.1 (licences in
`src/fonts/`).
