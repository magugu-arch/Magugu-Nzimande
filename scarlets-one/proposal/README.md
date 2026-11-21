# Scarlets One: fan app proposal and costing

`Scarlets_One_Fan_App_Proposal.pdf` is a 28-slide proposal to build the full
Scarlets One supporter app, with an itemised and audited costing. It follows
the layout of the supplied reference deck (`Sundowns_One_Fan_App_Strategy.pdf`):
the same slide types, card system and running order, in Scarlets colours.

It is a proposal, not a club document, and says so on its cover and last slide.
All photography is the concept imagery in `assets/reference`, labelled as such.

## What it says

|                       |                                                       |
| --------------------- | ----------------------------------------------------- |
| Build                 | £125,000 fixed, excluding VAT: 500 days at £250 a day |
| Timeline              | 30 weeks to launch, a pilot at week 24, a week-3 gate |
| Running               | £1,900 a month                                        |
| Three-year cost       | £193,400                                              |
| Value a season (base) | About £196,500, illustrative                          |
| Payback (base)        | About nine months of a full season                    |

The costing is shown four ways, and each adds up to the same 500 days: by
deliverable (slide 19), by deliverable and discipline (20), by discipline,
phase and payment (21), and against what the working concept already has (22).
Running costs and three-year cost of ownership are on slide 23.

## Where the numbers come from

Everything is in `src/data.mjs`, which also checks that every total agrees.
Change a figure there and rebuild; the slides, tables and charts follow.

- **Scope and days** are an estimate for the brief's full app. They are ours,
  not the club's.
- **Day rate.** £250 for a senior person for a day. That is in line with the
  R690 an hour (R5,520 a day) quoted in the reference deck, at about R22 to
  £1. The mid-market rate was R22.35 on 17 November 2026 (keycurrency.co.uk).
- **Running costs** are allowances, not quotes.
- **The value model is illustrative.** It uses no club figures. Its
  assumptions are printed under the chart on slide 24: 11 home matches a
  season (nine URC, two European pool), £18 a ticket, and so on.
- **Partner fees** are indicative. No partner is named or implied.
- **The proposer's name and contact details** are those on the reference deck.

Before it is sent, someone who knows the club and the agency's pricing should
check the day rate, the scope and every assumption in the value model.

## Rebuild it

```sh
cd scarlets-one
npm run proposal:shots    # phone screens from the working app (needs Scarlets_One.html)
npm run proposal:build    # writes proposal/Scarlets_One_Fan_App_Proposal.pdf
```

The build stops if anything overflows a card, runs off a slide, or fails to
load. Fonts: Exo 2, under the SIL Open Font License (`fonts/OFL-Exo2.txt`).
