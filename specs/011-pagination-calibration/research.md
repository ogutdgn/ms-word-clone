# Research: Pagination calibration (the deeper-spike)

## D1 — Where is the page-break decided? (no-fork gate)

**Decision**: Entirely inside the vendored fork — `_vendor/superdoc/layout-engine/paginator.ts` (`contentBottom =
pageSize.h − bottomMargin`; `cursorY` accumulates per line; overflow → new page) + line heights from
`measuring-dom/`. **No no-fork seam.**
**Evidence**: `configureMeasurement()` (measuring-dom index.ts:121) controls only font mode/cache. The app's PE
construction `constructPresentationEditor(mountEl, parsed)` (bridge/create-editor.ts) passes NO layout/calibration
option. Page geometry comes from the document model (sectPr) via callbacks — adjusting it would corrupt the doc.
**Conclusion**: a fix REQUIRES a fork edit → STOP-and-ask (user authorized the deeper spike, then the edit).

## D2 — The exact root cause (measured)

**Decision**: PE's flat 1.15× single-line-spacing floor is too short for tall-metric fonts.
**Evidence** (the 98-line Calibri 11pt fixture, Letter/1in margins, identical text both sides):
| | line pitch | lines/page 1 | total pages |
|---|---|---|---|
| Word (COM, measured) | 13.5pt | 48 | 3 (48+48+2) |
| PE (painted DOM) | 12.65pt | 51 | 2 (51+47) |
Word: single spacing (LineSpacingRule 0), 0 space-before/after, Normal style, pitch 13.5pt. PE: pitch 16.86px =
12.65pt = exactly `1.15 × 11pt × 96/72`. The 0.85pt/line shortfall (3 lines/page) tips 98 lines from 3→2 pages.

## D3 — The fix: the font's natural box (Canvas fontBoundingBox)

**Decision**: feed `fontBoundingBoxAscent + fontBoundingBoxDescent` into the line-height max.
**Evidence** (Canvas measureText at 11pt, vs the flat 1.15× = 12.65pt):
| Font | `fontBoundingBox` | multiplier | vs Word |
|---|---|---|---|
| Calibri | **13.5pt** | 1.227× | = Word 13.5pt EXACT |
| Segoe UI | 15.0pt | 1.364× | (M6 worst font) |
| Arial / Times / Georgia / Courier | 12.0pt | 1.091× | < 1.15× floor → floor wins (unchanged) |
`getFontMetrics` currently reads only `actualBoundingBox` (tight glyph box, ~13px Calibri) → never the font box
(18px). Using `max(tightBox, fontBox, 1.15×fontSize)` gives: Calibri 13.5 (=Word), Segoe 15, Arial/etc 12.65 (floor,
no change). **Monotonic** (taller-or-equal) → safe.
**Alternatives rejected**: a single calibrated constant (e.g. 1.22×) — would fix Calibri but mis-fit Segoe (1.36×)
and Arial (1.09×); the per-font `fontBoundingBox` is the principled, Word-matching source. Editing page geometry —
corrupts the doc model. `configureMeasurement` — controls only font mode/cache, not line height.

## D4 — Verification + the gate

**Decision**: the 009 gate is the regression guard + the fidelity proof.
**Evidence**: after the fix — multipage 3 pages [48,48,2] @ 13.5pt == Word; 009 gate **65/65 PASS** (the multipage
page-count is now ASSERTED, not a known-gap); single-page line-Y p95 IMPROVED (Segoe 4.91→1.5, Calibri 1.69→0.75);
all 15 fonts page-count exact; 4 core gates green. The change is confined to the line-HEIGHT path (baseline
ascent/descent + empty-paragraph metrics untouched).
