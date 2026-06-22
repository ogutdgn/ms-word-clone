# Implementation Plan: Paged test-coverage port

**Branch**: `007-paged-test-coverage` (off `general-done`) | **Spec**: [spec.md](spec.md) | **Type**: test infra

## Technical context

- **Single file touched**: `scripts/test-suite-pm.js` (plus an npm `test:pm:paged` convenience in `package.json`
  and, if needed, a tiny harness-profile note). **NO `src/**`, no fork, no generated files** (FR-007).
- **Mode signal**: `window.__WC_LAYOUT_MODE` (already set by `main.ts` from the resolved engine). `MODE`/`PAGED`
  recorded once at suite start (the soft GATE MODE row — replaces the halting guard).
- **Skip mechanism**: a `PAGED_SKIP` map (exact name → reason+probe) consulted inside `t()`/`ta()`.
- **Baseline**: genuine paged = 406 pass / 70 fail (fresh profile); overlay = 475/475.

## Constitution check

| Principle | Compliance |
|-----------|-----------|
| I. No fork edits | ✅ only `scripts/test-suite-pm.js` + `package.json`. |
| II. WC.PM bridge only write path | ✅ no document writes; test-assertion change only. |
| III. Page-free model | ✅ unchanged. |
| IV. Real-Word fidelity oracle | ✅ N/A — 007 makes no fidelity claim (Decision 4); no oracle needed. |
| V. Test-gated / regression | ✅ this IS the test gate; overlay 475 + paged 0-fail + smoke/roundtrip/bundle. |
| VI. Spec-kit-driven | ✅ this chain. |
| VII. No hand-edited generated files | ✅ untouched. |

No violations; no complexity-tracking entry needed.

## Phases

- **Phase 1 — Setup (done in discovery)**: branch + feature.json; the genuine-paged baseline (70 fails by zone);
  soft GATE MODE record replacing the halting guard.
- **Phase 2 — Skip infra**: the `PAGED_SKIP` map + `t()`/`ta()` skip-with-reason branch + the reason format.
- **Phase 3 — Category A (62)**: populate `PAGED_SKIP` zone-by-zone from `research.md` Decision 2 (each entry
  names the construct + covering probe). Re-run paged after each zone; the zone's fails → skips.
- **Phase 4 — Category B (8)**: investigate `[7]`/`[8]`/`[0a]`/`[11]×2`; port each to a `PAGED`-aware assertion
  (assert the paged equivalent), or log a genuine paged gap. NONE silently skipped.
- **Phase 5 — Harden + verify**: `test:pm:paged` npm convenience (fresh profile); overlay 475 + paged 0-fail +
  smoke/roundtrip/bundle; `/code-review`; docs reconcile; ff-merge into `general-done`; checkpoint.

## Risks

- **Hiding a real paged gap by over-skipping** → mitigated by the Category-A/B split: only genuinely
  overlay-*rendering* constructs skip (each pointing to a probe); functional tests are ported, not skipped.
- **Skip-body side effects** → each test re-authors its own state (Assumptions); verified by the paged run
  staying green after each zone.
- **Overlay regression from a mis-scoped branch** → the skip is a `PAGED`-only branch; overlay path is
  byte-identical; SC-001 (475) re-checked at the end.
