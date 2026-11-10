# Brand assets

## Rules

- The crest, wordmark, kit marks and sponsor artwork are used **only** from files supplied by an
  authorised club representative. They are never redrawn, approximated, recoloured, stretched or
  given effects, and never generated.
- Until those files arrive, every crest position renders `CrestSlot`, a neutral dashed placeholder.
  Opponent badges render a neutral shield; their marks are not drawn either.
- The app wordmark "KAIZER CHIEFS" is typeset text in the display face, not logo artwork.

## Register

| Asset | Status | Location |
| --- | --- | --- |
| Official crest | **Pending** from the club | Register in `apps/mobile/src/config/brandAssets.ts` |
| Colour palette | Proposed (brief, 10 Nov 2026) | `packages/ui/src/color.ts` |
| Typefaces | Proposed: Barlow Condensed, Inter, DM Mono (SIL OFL 1.1) | `packages/ui/src/type.ts`; admin copies in `apps/admin/src/app/fonts` with licences |
| App icon | Concept "KC ONE" monogram, typeset, marked CONCEPT; not a crest and pending approval | `apps/mobile/assets/brand` |
| Photography | **Concept images** generated on the Higgsfield reference canvas | `apps/mobile/assets/concept`, registered in `apps/mobile/src/config/imagery.ts` |

## Concept photography

Each image carries its canvas node id in `imagery.ts` and shows a visible CONCEPT IMAGE tag in the
app. The images contain generated approximations of club marks (on scarves, flags and shirts), so
they must not ship. Before release, replace each with licensed photography that has model releases,
and parental consent for any image of a child, then change its `status` to `approved`.

The stadium image was cropped to remove a standalone crest rendering from the original
concept frame.

## When the official files arrive

1. Add them to `apps/mobile/assets/brand/official/` (vector or @3x PNG) with a note of who supplied
   them and when, in this file.
2. Point `brandAssets.crest` at the file. Every `CrestSlot` then shows it exactly as supplied.
3. Replace the palette and typefaces in `packages/ui` from the CI manual; the contrast tests will
   flag any pair that falls below WCAG AA.
4. Replace the concept app icon and splash.
