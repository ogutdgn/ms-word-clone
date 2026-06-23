# Feature Specification: Pagination calibration (line-height → Word parity)

**Feature dir**: `specs/011-pagination-calibration/` | **Branch**: `011-pagination-calibration` (off `general-done`)
**Status**: Draft | **Type**: ⚠️ **vendored-fork edit — a Constitution P1 EXCEPTION (user-authorized 2026-06-22)**

## Why

M6/009 surfaced a multi-page pagination divergence: the 98-line single-paragraph fixture paginates to **PE 2
pages vs Word 3 pages** (009's deferred ⚠️ known-gap). All 15 single-page fixtures already match Word exactly —
only the tall-paragraph multi-page case diverged.

A measurement spike (deeper-spike, user-approved) pinned the **exact root cause**: PE computes "single" line spacing
as a **flat 1.15× font-size** floor ([`measuring-dom/src/index.ts:369`](../../src/renderer/core/superdoc-fork/_vendor/superdoc/measuring-dom/src/index.ts) + the `Math.max(…, 1.15×fontSize)` at [:3637](../../src/renderer/core/superdoc-fork/_vendor/superdoc/measuring-dom/src/index.ts)). It feeds the *tight* per-glyph box (Canvas `actualBoundingBox`,
~13px for Calibri 11pt) into the max, so the 1.15× floor (12.65pt) always wins. **Word's "single" spacing is the
font's NATURAL line box** — and Canvas `fontBoundingBox` for Calibri 11pt = 18px = **13.5pt, exactly Word's measured
pitch**. PE's 0.85pt/line shortfall let it fit 51 lines/page where Word fits 48 — *just* enough to tip 98 lines from
3 pages to 2.

### The P1 exception (why a fork edit; why authorized)

The line-height math lives entirely in the vendored fork (`_vendor/superdoc/measuring-dom/`). There is NO no-fork
seam: `configureMeasurement()` controls only font mode/cache; the PE constructor takes no calibration option;
adjusting page geometry via the model would corrupt the real document (Word would read wrong margins). The spike was
presented to the user, who **explicitly authorized the scoped fork edit** as a documented P1 exception, gated by the
009 glyph-tolerance gate as the regression guard.

## What (scope)

Make PE's single line spacing match Word's by feeding the font's natural line box (`fontBoundingBox`) into the
line-height max, so tall-metric fonts (Calibri, Segoe UI) claim their real line height while fonts whose box ≤ 1.15×
keep the existing floor unchanged (no regression). Two-file fork edit + a gate update:

- `_vendor/superdoc/measuring-dom/src/fontMetricsCache.ts`: capture `fontBoxHeight = fontBoundingBoxAscent +
  fontBoundingBoxDescent` in `getFontMetrics` (distinct from the tight ascent/descent, which stay for baseline).
- `_vendor/superdoc/measuring-dom/src/index.ts` `calculateTypographyMetrics`: pass `max(ascent+descent,
  fontBoxHeight)` (the natural box) into `resolveLineHeight` instead of the tight `ascent+descent`. (Empty-paragraph
  metrics + baseline ascent/descent are UNCHANGED.)
- `scripts/paged-glyphgeom-validate.js`: turn the multipage page-count from a deferred known-gap into a GREEN gate
  ASSERTION (now that it's closed) — a future regression that re-shrinks the line height re-fails the gate.

**Out of scope**: changing baseline/glyph positioning; per-font hand-tuned factors; the `actualBoundingBox` ascent/
descent (kept for baseline). The fix is font-metric-driven, not a magic constant.

## Functional requirements

- **FR-001**: PE's single-spaced line height MUST equal the font's natural line box when that box exceeds the 1.15×
  floor (Calibri 11pt → 13.5pt = Word), and MUST keep the 1.15× floor otherwise (Arial/Times/etc. unchanged).
- **FR-002**: The change MUST be monotonic (lines only get taller-or-equal) so no existing layout shrink-corrupts.
- **FR-003**: The multi-page fixture MUST paginate to match Word (PE 3 == Word 3), and the 009 gate MUST ASSERT it
  (the former known-gap becomes a green check).
- **FR-004**: No single-page page-count regression; every font's line-Y p95 MUST stay ≤ 6pt (the 009 tolerance).
- **FR-005**: The 4 core gates (test:pm 416 / smoke 9 / roundtrip 27 / test:bundle 4) MUST stay green.
- **FR-006**: The fork edit MUST be confined to the line-HEIGHT path in `measuring-dom`; baseline ascent/descent +
  empty-paragraph metrics unchanged. Documented inline as a 011 P1 exception.

## Success criteria

- **SC-001**: The multi-page fixture paginates to 3 pages [48, 48, 2] at 13.5pt pitch — matching Word (verified).
- **SC-002**: 009 gate PASSES at **65/65** (was 64/64 + 1 known-gap) — the multipage page-count is now asserted, NOT
  deferred; no known-gaps remain.
- **SC-003**: Single-page fidelity IMPROVES, not regresses — Segoe UI line-Y p95 4.91pt → 1.5pt, Calibri 1.69pt →
  0.75pt; all 15 fonts page-count exact.
- **SC-004**: The 4 core gates stay green.

## Known limitation (v1, out of scope — follow-up)

The fix applies to the **populated-line** path (`calculateTypographyMetrics`); `calculateEmptyParagraphMetrics` is
unchanged. So for a tall-metric font, an EMPTY paragraph now renders ~0.85pt shorter than a populated line (Calibri
11pt: empty 12.65pt vs text 13.5pt) — they matched before 011. This is a documented, deliberately-out-of-scope
limitation (the empty-para path is a separate sub-case that needs its own Word-COM validation — does Word render an
empty Calibri para at 13.5 or 12.65pt? — before reconciling). Not covered by the 009 gate (no empty-para fixture).
The /code-review flagged it as informational, NOT a blocking defect. Tracked as a follow-up.

## Assumptions

- Canvas `fontBoundingBox` ≈ Word's "single" line height per font (verified: Calibri 18px = Word 13.5pt exact).
- The dev box has real Word + the Office font set. The 009 gate is the binding regression guard.
