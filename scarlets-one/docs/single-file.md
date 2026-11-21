# Scarlets One in one file

`Scarlets_One.html` is the whole supporter app in a single file: the metadata,
all 39 images, the icon font and the app itself. It loads nothing from the
internet and sends nothing anywhere, so it can be attached to a WhatsApp
message, emailed, or copied to a phone and opened there.

It is a concept. It is not an official Scarlets product, and the file says so
in its metadata, on its first screen and in "About this file".

## What each phone shows

The same file behaves in one of two ways, depending on what opens it.

| Opened with                                           | What you get                                                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Android, Chrome (or Samsung Internet, Edge, Firefox)  | The working app: every screen and every interaction.                                                      |
| Android, "HTML Viewer"                                | The still preview (see below). That viewer does not run scripts.                                          |
| iPhone or iPad, from WhatsApp or the Files app        | The still preview. Apple's file preview does not run scripts, and iOS cannot open a local file in Safari. |
| A computer, any browser                               | The working app.                                                                                          |
| Any phone, from the Artifact link (once it is shared) | The working app, in Safari or Chrome.                                                                     |

**The still preview** is a copy of the real screens, captured from the running
app when the file is built: Home, Match, Matchday, Passport (as the demo
member), Fan Zone and the image library. The tab bar switches between them and
every page scrolls. Buttons inside a page do nothing. A bar at the top says it
is a preview, and "About this file" explains how to open the working app.

Whether choices are remembered after the app is closed depends on the browser:
some refuse storage to a file handed over by another app. The app then keeps
them until it is closed.

So on Android the file is the app. On an iPhone, a file can only ever be the
preview; the working app on an iPhone needs a web address. The app is
published at one, as a private claude.ai Artifact: see
[As a claude.ai Artifact](#as-a-claudeai-artifact) below.

## Sending it on WhatsApp

1. Attach `Scarlets_One.html` as a **Document** (not as a photo).
2. Android: tap the document, then choose **Chrome**.
3. iPhone: tap the document to see the preview.

WhatsApp shows a file attachment with its name and size. The title,
description and image a link preview shows come from a web address, not from
an attached file.

## What is embedded

- **Metadata**: title, description, language, theme colour, `noindex`,
  Open Graph and Twitter tags, a favicon and a home-screen icon.
- **Images**: all 39, once each. The crest and the shirt reference are the
  supplied files, byte for byte. The 37 photographs are resized to at most
  1200 px and saved as WebP, 2.3 MB in total.
- **Icon font**: Ionicons, 390 KB.
- **The app**: one 3.2 MB script.
- **The still preview**: 0.7 MB of HTML and styles.

The file is 7.5 MB.

## Build it

```sh
cd scarlets-one
npm run single:build    # writes Scarlets_One.html
npm run single:check    # opens it the ways described above
```

The build needs Chromium (Playwright), because it captures the still preview
from the running app.

## How it works

| File                          | What it does                                                                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/metro.config.js` | Switches the single-file behaviour on when `SCARLETS_SINGLE_FILE=1`. Every other build is unchanged.                                                                                                                         |
| `single/metro-transformer.js` | Wraps Expo's Metro transformer. Images and the font compile to modules that read from the page. Four Expo Router modules are pointed at an address adapter; each replacement is counted, so an Expo upgrade fails the build. |
| `single/boot.js`              | First script in the page. Switches from the preview to the app, and back again if the app has not started within 15 seconds or raises an error first.                                                                        |
| `single/runtime.js`           | The address adapter and the embedded media. Screens are addressed as `Scarlets_One.html#/match`, which a page opened from a file is allowed to change; the browser's own history is used, so the phone's Back button works.  |
| `single/shell.css`            | The splash and the still preview's frame.                                                                                                                                                                                    |
| `single/build.mjs`            | Compresses the images, exports the bundle, captures the preview, writes the file.                                                                                                                                            |
| `single/check.mjs`            | The checks below.                                                                                                                                                                                                            |
| `single/artifact.css`         | Styles added only to the Artifact build: the notice bar, the themed ground, the safe-area rule.                                                                                                                              |
| `single/check-artifact.mjs`   | The Artifact build's checks, in a stand-in for its viewer.                                                                                                                                                                   |

Two things the app itself gained from this work. Storage that is refused (a
browser with site data blocked, or a file handed over by another app) no
longer stops it starting; preferences then last for the session. And the
translucent bars carry a second tint, so the tab labels stay readable when a
dark card or photo scrolls beneath them.

## Checks

Run on 21 November 2026 with Playwright's Chromium, using each device's
screen size, touch input and browser identity. 34 of 34 pass.

| Where                                                         | Check                                                                           | Result | Detail                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| Android phone · Chrome, file opened from storage              | The app starts from the file and onboarding finishes on Home                    | Pass   |                                                                   |
| Android phone · Chrome, file opened from storage              | Five tabs open, each with its address kept in the file link                     | Pass   | …Scarlets_One.html#/match and so on                               |
| Android phone · Chrome, file opened from storage              | Every image on the five tabs shows                                              | Pass   | 68 images, 0 broken                                               |
| Android phone · Chrome, file opened from storage              | No tab scrolls sideways                                                         | Pass   |                                                                   |
| Android phone · Chrome, file opened from storage              | A fixture opens in Match Centre                                                 | Pass   | demo score 25–20                                                  |
| Android phone · Chrome, file opened from storage              | The phone's Back button returns to the previous screen                          | Pass   |                                                                   |
| Android phone · Chrome, file opened from storage              | The image library shows all 39 embedded images                                  | Pass   | 39 of 39                                                          |
| Android phone · Chrome, file opened from storage              | A Fan Zone poll takes a vote and shows the result                               | Pass   |                                                                   |
| Android phone · Chrome, file opened from storage              | Reopening the file keeps the place and the vote                                 | Pass   |                                                                   |
| Android phone · Chrome, file opened from storage              | The icon font is loaded from the file                                           | Pass   |                                                                   |
| Android phone · Chrome, file opened from storage              | The still preview is removed once the app is running                            | Pass   |                                                                   |
| Android phone · Chrome, file opened from storage              | Nothing is fetched from the internet and nothing fails                          | Pass   | 0 requests, 0 errors                                              |
| iPhone-sized screen · JavaScript off (as a file preview)      | The still preview shows instead of a blank page                                 | Pass   | laid out 390 px wide; names the example fixture and marks it DEMO |
| iPhone-sized screen · JavaScript off (as a file preview)      | The five tabs switch from the tab bar, each page scrolls, none scrolls sideways | Pass   | 5 of 5                                                            |
| iPhone-sized screen · JavaScript off (as a file preview)      | "About this file" says it is a concept and how to open the working app          | Pass   |                                                                   |
| iPhone-sized screen · JavaScript off (as a file preview)      | All 39 embedded images decode and the image library lists them                  | Pass   | 39 of 39 decode; 39 in the library                                |
| iPhone-sized screen · JavaScript off (as a file preview)      | Icons draw from the embedded font                                               | Pass   |                                                                   |
| iPhone-sized screen · JavaScript off (as a file preview)      | Nothing is fetched from the internet                                            | Pass   | 0 requests                                                        |
| Android phone · JavaScript off (as HTML Viewer)               | The still preview shows instead of a blank page                                 | Pass   | laid out 390 px wide; names the example fixture and marks it DEMO |
| Android phone · JavaScript off (as HTML Viewer)               | The five tabs switch from the tab bar, each page scrolls, none scrolls sideways | Pass   | 5 of 5                                                            |
| Android phone · JavaScript off (as HTML Viewer)               | "About this file" says it is a concept and how to open the working app          | Pass   |                                                                   |
| Android phone · JavaScript off (as HTML Viewer)               | All 39 embedded images decode and the image library lists them                  | Pass   | 39 of 39 decode; 39 in the library                                |
| Android phone · JavaScript off (as HTML Viewer)               | Icons draw from the embedded font                                               | Pass   |                                                                   |
| Android phone · JavaScript off (as HTML Viewer)               | Nothing is fetched from the internet                                            | Pass   | 0 requests                                                        |
| JavaScript off · other screen sizes                           | Phones from 320 to 430 px lay the preview out at 390 px with no sideways scroll | Pass   | 320→390, 360→390, 414→390, 430→390                                |
| JavaScript off · other screen sizes                           | On a computer the preview is a centred phone-width column                       | Pass   | 390 px wide at x=445                                              |
| Storage refused (as when a messaging app hands the file over) | The app still starts, and choices last until it is closed                       | Pass   | 0 errors                                                          |
| History changes refused by the viewer                         | Screens open and the app's own back button works                                | Pass   | 0 errors                                                          |
| The app fails to start (simulated)                            | The still preview comes back instead of a stuck splash                          | Pass   |                                                                   |
| iPhone-sized screen · served over HTTP (as a hosted copy)     | One request serves the whole app; tabs, images and layout hold                  | Pass   | 1 request, 11 images on Matchday, 0 errors                        |
| iPhone-sized screen · served over HTTP (as a hosted copy)     | A link to a screen opens that screen                                            | Pass   |                                                                   |
| The file                                                      | Title, description, sharing tags, theme colour and icons are embedded           | Pass   | 10 of 10                                                          |
| The file                                                      | The page refers to no outside file                                              | Pass   | 0 found                                                           |
| The file                                                      | Size                                                                            | Pass   | 7.52 MB                                                           |

The HTML also parses with no errors (parse5).

## As a claude.ai Artifact

The same app is published as a claude.ai Artifact:
<https://claude.ai/artifact/SNQeBZiz39bYLRoBfHjyVM> (21 November 2026). It is
**private**: only its owner can open it until they share it from the page's
Share menu. Anyone it is shared with gets the working app in their browser,
iPhone included.

```sh
npm run single:artifact          # writes single/.cache/Scarlets-One-Concept.html
npm run single:check:artifact    # runs it in a stand-in for the viewer
```

To update the published page, rebuild and publish that file to the same
address.

An Artifact wraps the page in its own document and runs it in a locked-down
frame, so this build differs from the file in five ways:

- **It says what it is on every screen.** A bar at the top reads "Concept.
  Not an official Scarlets product. All data is demo data." A link can travel
  further than a file someone chose to send.
- **It is page content only.** The Artifact supplies the document, so there is
  no wrapper of its own, and its title is the name "Scarlets One Concept".
- **Its history stays in the page.** The viewer owns the address bar and the
  Back button. The app's own back buttons work as before.
- **Official pages open as links.** The viewer refuses `window.open` for most
  people, so Tickets and the other link-outs follow a real link in a new tab.
- **It follows the viewer's light or dark setting**, and leaves the space
  around a phone's system bars to the viewer.

Checked on 21 November 2026, 12 of 12, in a stand-in for the viewer: a
sandboxed frame with no storage of its own, under a content policy with no
`eval` and no outside hosts. It starts, the notice stays on screen, Tickets
follows a link to the official ticket page, images show as they scroll into
view, the page address never changes, the theme follows both ways, and it
makes no request beyond the page itself.

The stand-in is built from the published rules for Artifacts. The real viewer
has not been driven by these checks.

## Not verified

- **No physical phone has opened this file.** Every row above is Chromium
  pretending to be a phone.
- **Safari's engine has not run it.** WebKit is not installed where this was
  built. "iPhone-sized screen" means the screen size and browser identity of
  an iPhone 14 in Chromium. The still preview uses plain HTML and CSS for that
  reason, and includes the prefixed blur Safari needed before version 18, but
  how Apple's file preview lays it out is untested. If that preview ignores
  the page's width setting, the preview shows as a 390 px column, centred on a
  wider screen.
- **The published Artifact has not been opened by these checks**, only a
  stand-in for its viewer. Inside the Claude phone app the space around the
  system bars is untested.
- **WhatsApp itself has not been used.** Opening from WhatsApp on Android is
  represented by opening the file from storage, and by refusing storage and
  history changes, which is how a browser can treat a file handed to it by
  another app.
- The still preview is light mode, English, and the "two weeks before the
  match" demo state. The working app has dark mode, Welsh and the other match
  states.
