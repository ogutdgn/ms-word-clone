# Feature Specification: M6 glyph-tolerance → pass/fail gate

**Feature dir**: `specs/009-glyphgeom-gate/` | **Branch**: `009-glyphgeom-gate` (off `general-done`)
**Status**: Draft | **Type**: dev-box-only VALIDATION INFRA (no `src`/fork change)

## Why

M6 (`report:glyphgeom`) measured the paged PresentationEditor's glyph-geometry divergence from real Word-for-Windows
and WROTE the tolerance (`specs/001-paged-render-migration/contracts/m6-glyph-tolerance.md`) — but it is **REPORT-ONLY**:
it computes the distribution and never pass/fails. So a future change to the engine could silently degrade typesetting
fidelity (line breaks, start-X, line-Y, single-page pagination) and no gate would catch it. The contract itself names
009: *"A FUTURE milestone turns these numbers into a red/green gate (page count exact for single-page; wrap 100%;
start-X ≤ 1px; line-Y ≤ per-font p95, or 5pt universal) and tackles the multi-page pagination divergence."*

009 = turn the report into a **pass/fail gate**.

## What (scope)

Add tolerance ASSERTIONS to the existing `scripts/paged-glyphgeom-validate.js` driver so it emits a `gate` verdict
(pass/fail) and `process.exit(1)` on any breach, and surface it as a gate (`report:glyphgeom` becomes the gate; add a
`test:glyphgeom` alias). Dev-box-only (real Word COM, sandbox-disabled, PID-safe), **no `src`/fork change** — pure
validation infra (the producers — the PE painted-DOM probe + the COM ps1 + the diff driver — are unchanged).

The gate asserts, per fixture / per font, against the contract:

- **wrap-point agreement** = 100% (mismatchRate === 0) on every single-page fixture — break points match Word exactly.
- **per-line start-X** p95 ≤ **1.0pt** per font (the contract's "≤ 1px / 0.75pt grid floor" + a small noise-headroom).
- **per-line Y** p95 ≤ **6.0pt** per font (the contract's "5pt universal" / worst-measured 4.91pt + noise-headroom).
- **page count** EXACT on every **single-page** fixture (PE == Word).
- **enum-verified + font-applied + scale-verified + PID-safe** (the existing producer-health checks) all hold.

**Out of scope (→ 011 pagination calibration):** the **multi-page page-count divergence** (the 98-line fixture
paginates to PE 2 vs Word 3). 009 records it as a VISIBLE **known-gap** (⚠️, tracked to 011) — NOT a hard fail —
exactly as the contract scopes it. Per-line metrics are not compared across a multi-page fixture (the line-index
alignment drifts), so multi-page fixtures contribute only the page/line counts.

## Functional requirements

- **FR-001**: The driver MUST compute a `gate` verdict from the perFixture/perFontSummary metrics vs the thresholds
  above and `process.exit(1)` on any breach (it currently always `exit 0` unless a producer crashed).
- **FR-002**: The gate MUST assert the per-line tolerances (wrap/start-X/line-Y) on the single-page fixtures + the
  single-page page-count exactness — these are the real-fidelity assertions.
- **FR-003**: The multi-page page-count divergence MUST be recorded as a VISIBLE known-gap (reason + tracker=011), NOT
  a hard fail (FR-004 honesty: it is a real divergence, surfaced not hidden).
- **FR-004**: The thresholds MUST be derived from the contract (not invented), with a documented modest noise-headroom
  over the measured worst so the gate catches a real regression without flaking on Word-COM/renderer measurement noise.
- **FR-005**: NO `src/**` or `src/renderer/core/superdoc-fork/**` change; the 4 core gates (test:pm 416 / smoke 9 /
  roundtrip 27 / test:bundle 4) are unaffected. The gate is dev-box-only (Word COM), PID-safe, sandbox-disabled.
- **FR-006**: `report:glyphgeom` (and a `test:glyphgeom` alias) run the gate; the JSON report keeps the full
  distribution + adds `gate: { pass, tolerance, checks[], knownGaps[] }`.

## Success criteria

- **SC-001**: Against the current paged build, the gate PASSES (the M6 report showed the metrics already meet the
  tolerances: wrap 100%, start-X p95 ≤ 0.75pt, line-Y p95 ≤ 4.91pt, single-page page-count exact).
- **SC-002**: The gate FAILS (exit 1) if any single-page fixture breaches wrap/start-X/line-Y/page-count (verified by a
  temporary threshold-tightening probe, then reverted).
- **SC-003**: The multi-page page-count divergence appears as a ⚠️ known-gap (tracked to 011), not a fail.
- **SC-004**: The 4 core gates unaffected; no `src`/fork change.

## Assumptions

- The current paged build's glyph geometry still matches the M6-measured distribution (it was the same engine; 008
  changed no rendering code). If a fixture now breaches, that is a real signal to investigate, not a spec error.
- The dev box has real Word + the Office font set (the M6 fixtures author per installed font).
