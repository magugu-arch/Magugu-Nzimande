# Design system

## Working palette

Proposed concept tokens from the brief. The club's brand guide, colour
specifications, type licences and crest rules override all of them.

| Token        | Value     | Use                                    |
| ------------ | --------- | -------------------------------------- |
| Scarlet      | `#C8102E` | Primary action, active navigation      |
| Deep wine    | `#3B101B` | Match mode, Passport, premium surfaces |
| Near-black   | `#191619` | Text, dark panels                      |
| Warm ivory   | `#F6F2EC` | Page background                        |
| Warm gold    | `#B9975B` | Member accents, used sparingly         |
| Neutral grey | `#5E5A5C` | Secondary text                         |

Components name a role (`text`, `accent`, `onInverse`), never a hex, and each
role has a light and a dark value (`packages/ui/src/tokens.ts`). Fifty tests
check every allowed text-on-surface pair against WCAG AA in both schemes.

Two values depart from the brief for contrast, and say so in the code:

- Scarlet as **text on a dark surface** is 3.1:1, so dark mode uses a lighter
  tint for text and icons. Scarlet as a fill with white text is unchanged.
- Gold as **text on ivory** is 2.5:1, so light mode uses a darker gold for
  text. On the wine surface the brief's gold is used as given.
- In dark mode the scarlet **fill** is a shade lighter, to stay above the 3:1
  a control needs against a dark card.

## Type

The platform system face, so the app inherits its optical sizing and
legibility tuning. Tracking is size-specific: display sizes tighten, small
uppercase labels open up, body stays at zero. Leading runs the other way.
Figures that change (scores, countdowns) are tabular. The reader's text-size
setting is respected, with a cap so one word cannot break a layout.

## Motion

The rules, from Apple's fluid-interface guidance, and where each lives:

| Rule                                   | In this app                                                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Respond on touch-down                  | `Press`: the one pressable. It gives on press-in, on a critically damped spring, and springs back from wherever it is on release.                                                           |
| Springs, not fixed durations           | `spring(response, dampingRatio)` in `packages/ui/src/motion.ts`. Critically damped by default; overshoot only where a gesture carried momentum.                                             |
| Interruptible                          | The bottom sheet and the venue map cancel their spring when grabbed and continue from their position at that instant. A segmented control or tab marker retargets mid-slide.                |
| 1:1 tracking                           | The sheet and the map follow the finger from where they were grabbed.                                                                                                                       |
| Momentum projection                    | On release the sheet decides from where the gesture is going (position plus projected travel), not where it was let go. Carousels use native deceleration and snap to a card edge.          |
| Velocity handoff                       | The release velocity is passed into the settling spring, so there is no seam between dragging and animating.                                                                                |
| Rubber-banding                         | Past its limit the sheet, and the map at its edges and zoom limits, resist progressively instead of stopping.                                                                               |
| Same path in and out                   | The sheet enters and leaves from the bottom.                                                                                                                                                |
| Compositor-only                        | Only transform and opacity animate. Poll bars grow by scale, not width.                                                                                                                     |
| Translucent chrome                     | The tab bar and the page bar are a blurred material that content scrolls beneath. The page bar only takes on its material once content is under it, with a soft fade in place of a divider. |
| Haptics that mean something            | Selection, snap, success and error only, fired on the event that caused them. None on the web.                                                                                              |
| Reduced motion                         | Slides and springs become short fades; parallax stops. The system setting is honoured and there is a switch in Settings.                                                                    |
| Reduced transparency and more contrast | Translucent bars turn solid.                                                                                                                                                                |
| Gestures are never the only way        | The sheet has a Close button, a scrim, Escape and the back gesture. The map has zoom buttons and a list of every point.                                                                     |

Not on a device yet: these were reviewed in the web build. The spring values
and the sheet's feel should be tuned on real hardware.

## Components

`apps/mobile/src/components`

| Component                                               | What it is                                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Text`                                                  | All type: variant, colour role, tabular figures                                                                        |
| `Press`, `Button`                                       | Press feedback, focus ring for keyboard use, 44 pt targets                                                             |
| `Card`, `RowGroup`, `ListRow`, `SectionHeader`          | Surfaces and lists                                                                                                     |
| `Photo`                                                 | A supplied image: average colour and placeholder first, cropped on its focal point, alt text that never names a person |
| `DataStamp`, `DemoChip`, `Tag`, `PlacementTag`          | Update state, demo label, status, and the label every commercial tile carries                                          |
| `Notice`, `SourceNotice`, `ErrorState`, `Skeleton`      | Empty, unavailable, error and loading states                                                                           |
| `Segmented`, `ChipRow`, `CheckRow`, `Stepper`, `Toggle` | Controls                                                                                                               |
| `Sheet`                                                 | The draggable bottom sheet                                                                                             |
| `Page`, `BarButton`, `ModalScreen`                      | Page scaffold with the floating bar and parallax hero                                                                  |
| `TabBar`                                                | The five persistent destinations                                                                                       |
| `Countdown`, `TeamMark`, `StoryCard`, `StoryRow`        | Content pieces                                                                                                         |

Feature components: `PassportCard` (tilts under the finger), `VenueMap`
(pinch and pan), `MeetingPoint`, and the Fan Zone cards.

## Photography

All 39 supplied files are used and are listed, with their briefing labels,
under **More → Asset library**. The crest is the supplied file, unaltered; no
other crest is drawn, and teams are shown as a two-letter mark. Text, scores
and buttons sit outside the photographs. The four images the brief lists as
still needed are named in the library.
