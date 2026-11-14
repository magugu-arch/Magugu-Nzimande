# Sundowns One: fan app strategy and investment (deck)

`Sundowns_One_Fan_App_Strategy.pdf`: 28 slides, 16:9, about 5.4 MB, set in the
layout of the LegacyLeverage Kaizer Chiefs proposal and recoloured for
Sundowns. A proposal, not a club document.

| Part | Slides |
| --- | --- |
| Opening | Cover, executive summary, why a fan app, the strategy on a page, the six supporters |
| 1 · The fan app | Matchday (tickets, planner, stadium guide), belonging (Match Centre, Fan Zone, Passport), the supporter journey, proof from the working app |
| 2 · Marketing system | The self-marketing loop, the eight-step growth calendar for every home match, six campaigns, lifecycle messages and guardrails, the first 90 days, measurement tied to rand |
| 3 · Partners | Why a known audience is worth more, six partner properties (up to R3.3m a season), how three partners fund the build |
| 4 · Value and investment | Value to the club in three cases, payback, the R2 400 000 costing, timeline and payments, protection, next step |

## The numbers

Every figure comes from `src/model.py`, and `src/check_numbers.py` fails if the
deck and the model disagree (60 figures checked).

- **Build:** R2 400 000 fixed, excluding VAT (R2 760 000 including): 435
  person-days, 3 480 hours at R690 an hour, 16 work packages, rounded down
  by R1 200. Paid 30 / 30 / 30 / 10% at signature, pilot (week 22), launch
  (week 28) and after 30 days of hypercare (week 32).
- **Running:** R40 000 a month planning figure (R25 000 to R60 000).
- **Value a season (illustrative):** conservative R2 064 000, base R5 108 000,
  stretch R8 980 000, from extra tickets, memberships, store share, partner
  fees and paid reach replaced. Assumptions are stated on slide 23 and are
  replaced with the club's figures in discovery.
- **Payback after launch:** 3.4 months (stretch), 6.2 (base), 18.2
  (conservative). Three seasons in the base case: R15.3m of value against
  R3.84m to build and run.
- **Partner rate card:** six properties, R300 000 to R1 200 000 a season each,
  indicative and set after a rights audit. No partner is named or implied.

## Rebuilding

Requires Python 3 with Pillow, and Node with Playwright.

```sh
cd src
python3 -I prepare_deck_images.py <folder with the 51 uploads>   # photos (committed in img/)
node app_shots.js ../../Sundowns_One_Fan_App.html img             # app screenshots
python3 -I model.py && python3 -I check_numbers.py                # the numbers
node render.js "$PWD/deck.html" "$PWD/../Sundowns_One_Fan_App_Strategy.pdf"
```

`render.js` prints any text that overflows its card, runs off the slide or
collides with a title; it should report no issues. Set `PW_CHROMIUM` to a
Chromium path if Playwright can't find its own browser. Fonts: Exo 2, SIL
Open Font License 1.1 (`src/fonts/`).
