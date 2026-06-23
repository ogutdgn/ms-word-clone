# Tasks: M6 glyph-tolerance → gate

**Feature**: `specs/009-glyphgeom-gate/` | **Branch**: `009-glyphgeom-gate` (off `general-done`)
**Inputs**: spec.md, plan.md, `contracts/m6-glyph-tolerance.md` (the thresholds)
**Merge mode**: ff-merge into `general-done`. `/code-review` before merge.
**Type**: dev-box-only validation infra — only `scripts/paged-glyphgeom-validate.js` + `package.json`. NO `src`/fork.

---

## Phase 1: Gate logic
- [ ] T001 On `009-glyphgeom-gate` off `general-done`; feature.json → this dir; baseline (the 4 core gates already green).
- [ ] T002 `paged-glyphgeom-validate.js`: add the threshold constants (WRAP_MISMATCH_RATE=0, START_X_P95_MAX_PT=1.0,
  LINE_Y_P95_MAX_PT=6.0) sourced from the contract + a documented noise-headroom.
- [ ] T003 Compute `gate = { pass, tolerance, checks[], knownGaps[] }` after perFixture/perFontSummary: single-page
  fixtures → assert page-count exact + wrap===100% + start-X p95 ≤ 1.0 + line-Y p95 ≤ 6.0 (one check per assertion,
  labelled by fixtureId); multi-page fixtures with a page-count divergence → push to `knownGaps` (tracker=011), NOT a
  fail. `report.ok = report.ok && gate.pass`. Print the gate verdict + the known-gaps. `process.exit(report.ok?0:1)`.

## Phase 2: npm + comment
- [ ] T004 `package.json`: add `test:glyphgeom` = `node scripts/paged-glyphgeom-validate.js` (alias of report:glyphgeom).
  Update the driver's header comment: REPORT-ONLY → "a dev-box-only GATE (asserts the m6-glyph-tolerance thresholds)".

## Phase 3: Verify (dev-box, Word COM)
- [ ] T005 Run `npm run report:glyphgeom` (or `test:glyphgeom`) on the dev box → gate PASSES (SC-001) + the multipage
  page-count appears as a ⚠️ known-gap (SC-003). Confirm enumVerified/fontVerified/scaleVerified/pidSafe still hold.
- [ ] T006 SC-002: temporarily tighten a threshold (e.g. LINE_Y_P95_MAX_PT=0.1) → confirm exit 1 + the breach is
  reported; REVERT.
- [ ] T007 Confirm the 4 core gates unaffected (test:pm 416 / smoke 9 / roundtrip 27 / test:bundle 4) — they don't run
  the glyphgeom path, so a quick spot-check (no src change) suffices.

## Phase 4: Review + close-out
- [ ] T008 `/code-review` (adversarial-review workflow) — focus: does the gate ACTUALLY assert (not just report); is
  the multipage-page-count known-gap honest (a real divergence, surfaced not hidden); the noise-headroom justified;
  PID-safety; no `src`/fork change. FIX confirmed findings.
- [ ] T009 Docs: a one-line note (glyphgeom is now a gate; the multipage page-count divergence is tracked to 011).
  Tick this tasks.md.
- [ ] T010 ff-merge `009-glyphgeom-gate` → `general-done` (NOT main, no push). plan-tracking checkpoint.

---
## Notes
- The gate is DEV-BOX-ONLY (real Word COM; sandbox-disabled; PID-safe) — excluded from headless CI, like
  test:roundtrip:paged + report:glyphgeom.
- Don't loosen a threshold to pass a genuine breach — that would be a real fidelity regression to investigate.
