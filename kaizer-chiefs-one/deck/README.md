# Kaizer Chiefs One · marketing and investment strategy deck

**[`Kaizer_Chiefs_One_App_Marketing_and_Investment_Strategy.pdf`](Kaizer_Chiefs_One_App_Marketing_and_Investment_Strategy.pdf)**:
26 slides, 16:9, about 6 MB. A proposal prepared for the club; not a club document.

It follows the layout system of the agency's house deck (the Tashas App marketing strategy):
warm paper pages, soft light cards with one dark card per slide carrying the main point, light
uppercase Exo 2 display type and small tracked labels. The accent is the app's proposed Amakhosi
Gold.

## What it covers

| Slides | Part |
| --- | --- |
| 1–5 | Cover, executive summary, the opportunity, four levers of supporter revenue, six supporters |
| 6–10 | **Club engine**: Match Centre, tickets, membership, rewards, Fan Moments, the supporter journey, the staff console |
| 11–16 | **Marketing engine**: six ways the app markets the club, the self-marketing loop, five campaigns, lifecycle messages and guardrails, partner value |
| 17–18 | **Launch plan** and proof: the first 90 days, the working concept |
| 19–23 | **Investment**: three editions, the itemised costing, cost of ownership, payback, timeline and milestone payments |
| 24–26 | Measurement, how the investment is protected, next step |

## The numbers

Every commercial figure is in [`figures.mjs`](figures.mjs). Change a number there and rebuild:
prices, totals, VAT, milestone payments, the three-year view and the payback table all follow, and
the build stops if the sums no longer match what the slides say in words.

| Figure | Value | Where it comes from |
| --- | --- | --- |
| Rate | R690 an hour, 8-hour days | The rate in the agency's current proposals |
| Family edition (recommended) | 276 days, R1 525 000, 24 weeks | 16 itemised deliverables, rounded to the nearest R5 000 |
| Matchday edition | 154 days, R850 000, 16 weeks | Content, Match Centre, ticket handoff, notifications, console |
| Nation edition | 366 days, R2 020 000, 32 weeks | Family plus payments, partner tools, CRM, languages, data-light mode |
| Running cost | R25 000–R60 000 a month | Estimate at launch volumes; R40 000 is used in the sums |
| Payback | About R20 a year per known supporter | (build + a year of running) ÷ 100 000 known supporters |

These are **estimates for a proposal**. The effort per deliverable and the running-cost range are
the author's working estimates and should be reviewed before the deck goes out. The supporter
numbers in the payback table are illustrative scenarios, not club figures or forecasts.

## Rules it keeps

The same rules as the app:

- no club figures are invented: nothing states the size of the supporter base, attendance, revenue,
  prices or membership terms;
- sample messages use a placeholder fixture and no reward values;
- the crest is never drawn; the club's name is typeset;
- every photograph is a concept image, cropped so that no standalone crest rendering appears, and
  labelled as concept on every page that uses one;
- the screens are real captures of the working concept, with their own DEMO labels.

## Rebuilding

From `kaizer-chiefs-one/` (Node with Playwright; Python 3 with pypdf for the document metadata):

```bash
node deck/build.mjs                 # checks, then writes the PDF
node deck/build.mjs --check         # figures and layout checks only
node deck/build.mjs --pages .screens/deck   # also saves each page as a PNG
```

The build fails if a font or image is missing, if any text leaves its page or spills out of its
card, or if a headline collides with its supporting line. The PDF is tagged, has a bookmark for
every slide, and carries a title, author, subject and keywords.

| File | What it is |
| --- | --- |
| `slides.mjs` | The 26 slides: copy and structure |
| `figures.mjs` | Every commercial number, with its checks |
| `deck.css` | The layout system |
| `build.mjs`, `finish.py` | Layout checks, PDF output, metadata |
| `capture.mjs` | Takes the phone and console screenshots from the working concept |
| `prepare_images.py` | Crops the photographs from the original concept images (crop boxes recorded there) |
| `fonts/` | Exo 2, Latin subset, SIL OFL 1.1 (licence included) |
| `images/`, `screens/` | The cropped photographs and the captured screens |

Card shadows and edges are drawn as gradients on purpose: a blurred shadow, or a translucent
border over a gradient, is stored in the PDF as a picture per card and took the file from 6 MB
to 20 MB.
