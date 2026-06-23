# Implementation Plan: M6 glyph-tolerance → gate

**Branch**: `009-glyphgeom-gate` (off `general-done`) | **Spec**: [spec.md](spec.md) | **Type**: dev-box validation infra

## Technical context

- **Files touched**: `scripts/paged-glyphgeom-validate.js` (add the `gate` verdict + exit code) + `package.json`
  (`test:glyphgeom` alias). NO `src/**`, no fork, no other gate. The producers (probe + ps1) are unchanged.
- **Thresholds** (from `contracts/m6-glyph-tolerance.md`, + a documented noise-headroom):
  `WRAP_MISMATCH_RATE = 0` · `START_X_P95_MAX_PT = 1.0` · `LINE_Y_P95_MAX_PT = 6.0` · single-page page-count exact.
- **Existing report shape** (reused): `perFixture[]` (`kind`, `pageCount.equal`, `wrapPoints.mismatchRate`,
  `dist.lineYPt.p95`/`dist.lineStartXPt.p95` — `dist` null for multi-page) + `perFontSummary[]`.

## Constitution check

| Principle | Compliance |
|-----------|-----------|
| I. No fork edits | ✅ only the driver + package.json. |
| II. WC.PM bridge only write path | ✅ no document writes. |
| III. Page-free model | ✅ unchanged. |
| IV. Real-Word fidelity oracle | ✅ this IS a real-Word oracle gate (the whole point). |
| V. Test-gated / regression | ✅ this adds a regression gate; the 4 core gates unaffected. |
| VI. Spec-kit-driven | ✅ this chain. |
| VII. No hand-edited generated files | ✅ untouched. |

## Phases

- **Phase 1 — gate logic**: in `paged-glyphgeom-validate.js`, after `perFixture`/`perFontSummary` are built, compute
  `gate = { pass, tolerance, checks[], knownGaps[] }`: iterate `perFixture` — single-page → assert page-count exact +
  wrap===100% + start-X p95 ≤ 1.0 + line-Y p95 ≤ 6.0; multi-page → push the page-count divergence to `knownGaps`
  (tracker 011), don't fail. `report.ok &&= gate.pass`; `process.exit(report.ok ? 0 : 1)`. Print the gate verdict.
- **Phase 2 — npm**: add `test:glyphgeom` (= `node scripts/paged-glyphgeom-validate.js`); `report:glyphgeom` stays
  (now the gate). Note dev-box-only in the script comment.
- **Phase 3 — verify**: run it on the dev box (real Word COM) → must PASS (SC-001) + show the multipage known-gap.
  Temporarily tighten a threshold → confirm exit 1 (SC-002), then revert. The 4 core gates unaffected.
- **Phase 4 — review + close**: `/code-review` (honest-gate focus) + fix; docs note (glyphgeom is a gate;
  multipage→011); tick tasks; ff-merge → `general-done`; checkpoint.

## Risks

- **Flaky thresholds** → the noise-headroom (start-X 0.75→1.0, line-Y 5→6) is the mitigation; if a fixture still
  flakes, widen with a measured justification (don't gate at the exact measured value).
- **A fixture genuinely breaches** → that is a real fidelity regression to investigate, not a spec bug (don't loosen
  the gate to pass it).
