# Tasks: Pagination calibration (line-height → Word parity)

**Feature**: `specs/011-pagination-calibration/` | **Branch**: `011-pagination-calibration` (off `general-done`)
**Inputs**: spec.md, plan.md, research.md
**Merge mode**: ff-merge into `general-done`. `/code-review` before merge.
**Type**: ⚠️ vendored-fork edit (Constitution P1 EXCEPTION, user-authorized) + a 009-gate update.

---

## Phase 0: Spike (DONE — the no-fork gate + root cause)
- [x] T001 On `011-pagination-calibration` off `general-done`; feature.json → this dir.
- [x] T002 No-fork gate: confirmed the page-break/line-height math is entirely in `_vendor/superdoc/` with no
  app-reachable config seam → STOP-and-ask. User authorized the deeper spike.
- [x] T003 Deeper spike: pinned the root cause (flat 1.15× line-spacing floor vs Word's font-natural box) by measuring
  PE (painted DOM, pitch 12.65pt / 51 lines) vs Word (COM, pitch 13.5pt / 48 lines) for the 98-line fixture; verified
  Canvas `fontBoundingBox` Calibri = 13.5pt = Word exact. Reported findings + scoped fix → user authorized the fork edit.

## Phase 1: Implement (the fork edit)
- [x] T004 `_vendor/superdoc/measuring-dom/src/fontMetricsCache.ts`: add `fontBoxHeight?` to `FontMetricsResult`;
  capture `fontBoundingBoxAscent + fontBoundingBoxDescent` in `getFontMetrics` (distinct from the tight ascent/descent).
- [x] T005 `_vendor/superdoc/measuring-dom/src/index.ts` `calculateTypographyMetrics`: pass `naturalLineBox =
  max(ascent+descent, fontBoxHeight)` into `resolveLineHeight`. Baseline ascent/descent + empty-paragraph metrics
  UNCHANGED. Inline-documented as the 011 P1 exception.
- [x] T006 Build + verify (throwaway probe): the multi-page fixture now paginates 3 pages [48,48,2] @ 13.5pt == Word.

## Phase 2: Gate + verify
- [x] T007 `scripts/paged-glyphgeom-validate.js`: the `id==='multipage'` branch now ASSERTS `pageCount.equal` (a green
  check), not a deferred known-gap. (009's known-gap → closed.)
- [x] T008 009 gate (real Word COM, dev-box): **65/65 PASS**; all 15 fonts page-count exact; line-Y p95 IMPROVED
  (Segoe 4.91→1.5, Calibri 1.69→0.75); no known-gaps.
- [x] T009 4 core gates: test:pm 416 / smoke 9 / roundtrip 27 / test:bundle 4 — all green.

## Phase 3: Review + close-out
- [x] T010 `/code-review` (adversarial-review workflow) — focus: is the edit confined to the line-HEIGHT path (no
  baseline/glyph-position drift); is it monotonic (no shrink-corruption); does the empty-paragraph path stay correct;
  any font where fontBox overshoots Word and breaks a single-page page-count; the gate genuinely asserts the multipage.
  FIX confirmed findings.
- [x] T011 Docs: update `contracts/m6-glyph-tolerance.md` (the multipage divergence is CLOSED, not a future gap) +
  reconcile the 009 known-gap references. Tick this tasks.md.
- [x] T012 ff-merge `011-pagination-calibration` → `general-done` (NOT main, no push). plan-tracking checkpoint.
  Then 012.

---
## Notes
- The fix is font-metric-driven (Canvas `fontBoundingBox`), not a magic constant — it matches Word per-font.
- The 009 gate is the binding regression guard: a future change re-shrinking the line height re-fails it.
- This is the ONE authorized fork edit in the general-done loop; clearly marked `011` in 2 files for upstream-drift
  visibility.
