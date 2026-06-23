# Implementation Plan: Pagination calibration (line-height → Word parity)

**Feature dir**: `specs/011-pagination-calibration/` | **Branch**: `011-pagination-calibration` (off `general-done`)
**Spec**: [spec.md](spec.md) | **Type**: ⚠️ vendored-fork edit (Constitution P1 EXCEPTION, user-authorized)

## Constitution check

- **P1 (no fork edit)**: ⚠️ **EXPLICIT EXCEPTION — user-authorized 2026-06-22.** The line-height math is entirely in
  `_vendor/superdoc/measuring-dom/`; there is no no-fork seam (see research.md D1–D3 + the spec). The deeper-spike
  found the exact root cause + a precise, gate-guarded fix; the user authorized the scoped fork edit. The edit is
  confined to the line-HEIGHT path; baseline/glyph positioning + empty-paragraph metrics are untouched.
- **P2 (WC.PM bridge write path)**: N/A — this is a render-measurement calibration, not a document write. The model
  stays page-free; no document content changes.
- **P4 (paged is the engine)**: ✅ — fixes the paged PE's pagination.
- **P5 (Word-COM validated)**: ✅ — the 009 glyph-tolerance gate (real Word COM) is the regression guard + the
  fidelity proof (multipage PE 3 == Word 3 asserted).
- **P6 (regression test + gates)**: ✅ — the 009 gate gains the multipage assertion (65/65); the 4 core gates stay
  green.

## Root cause (spike-confirmed — see research.md)

PE single line spacing = flat 1.15× font-size floor; the tight glyph box (Canvas `actualBoundingBox`) is smaller, so
the floor always wins. Word's single spacing = the font's NATURAL box (Canvas `fontBoundingBox`): Calibri 11pt = 18px
= 13.5pt (vs PE's 12.65pt). The 0.85pt/line shortfall → PE fits 51 lines/page vs Word's 48 → 98 lines: PE 2 vs Word 3.

## Approach (the fork edit + the gate)

1. `fontMetricsCache.ts` `getFontMetrics`: also capture `fontBoxHeight = fontBoundingBoxAscent +
   fontBoundingBoxDescent` (the font's natural line box), added to `FontMetricsResult` (optional — legacy browsers
   without the metric fall back to the existing floor).
2. `index.ts` `calculateTypographyMetrics`: pass `naturalLineBox = max(ascent+descent, fontBoxHeight)` into
   `resolveLineHeight` (which already maxes against the 1.15× floor). So `lineHeight = max(fontBox, 1.15×fontSize,
   …)`. Cross-font verified: Calibri → 18px (=Word), Segoe → 20px, Arial/Times/Georgia/Courier → floor unchanged.
   `calculateEmptyParagraphMetrics` and the baseline ascent/descent are UNCHANGED.
3. `scripts/paged-glyphgeom-validate.js`: the `id==='multipage'` branch now ASSERTS `pageCount.equal === true`
   (was: defer to known-gap). 009's known-gap → a green gate check (65/65).

## Verification (all done)

- Spike probe (throwaway): the multipage fixture now paginates 3 pages [48,48,2] at 13.5pt pitch == Word.
- 009 gate (real Word COM, dev-box): **65/65 PASS**; all 15 fonts page-count exact; line-Y p95 IMPROVED (Segoe
  4.91→1.5, Calibri 1.69→0.75); no known-gaps.
- 4 core gates: test:pm 416 / smoke 9 / roundtrip 27 / test:bundle 4 — all green (the line-height change is
  transparent to the structural/content assertions).

## Risk / why it's safe

- **Monotonic**: lines only get taller-or-equal (max), so nothing shrink-corrupts; fonts with box ≤ 1.15× are
  byte-unchanged.
- **Gate-bounded**: the 009 gate (real Word, 15 fonts) is the regression guard — it caught nothing (improvements
  only). A future change that re-shrinks the line height re-fails the gate (multipage assertion + line-Y p95).
- **Confined**: only the line-HEIGHT term changes; baseline glyph positioning is untouched (ascent/descent as-is).
- **Upstream drift**: this diverges the vendored fork from SuperDoc upstream by ~15 lines in 2 files, clearly marked
  `011` — a documented, contained delta (the project already accepts the vendored/AGPL fork model).
