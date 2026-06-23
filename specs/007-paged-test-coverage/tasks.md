# Tasks: Paged test-coverage port

**Feature**: `specs/007-paged-test-coverage/` | **Branch**: `007-paged-test-coverage` (off `general-done`)
**Inputs**: spec.md, plan.md, research.md (Decision 2 = the categorization), data-model.md, contracts/, quickstart.md
**Merge mode**: ff-merge into `general-done` (NOT main). `/code-review` before merge.
**Type**: TEST INFRA — only `scripts/test-suite-pm.js` + `package.json`. NO `src/**`, no fork, no generated files, NO Word oracle.

---

## Phase 1: Setup & baseline (DONE in discovery)

- [x] T001 Branch `007-paged-test-coverage` off `general-done`; feature.json → this dir.
- [x] T002 Capture the genuine-paged baseline (fresh `--user-data-dir`, build define wins): **406 pass / 70 fail**;
  70 fails grouped by zone (spec "Empirical baseline").
- [x] T003 Replace the halting boot-guard with a soft `MODE`/`PAGED` record; surface via `summary.mode` +
  `summary.pagedSkips` (NOT a counted row → both modes stay 475).

## Phase 2: Skip infrastructure

- [x] T004 Add the `PAGED_SKIP` Map (exact name → `{reason, probe}`), empty, with a zone-grouped comment scaffold.
- [x] T005 Teach `t(name, fn)` AND `ta(name, asyncFn)`: when `PAGED && PAGED_SKIP.has(name)` → push
  `{name, pass:true, detail:'⊘ paged-skip (overlay-only): '+reason+' — paged covered by '+probe}` and RETURN
  (do not run the body). Overlay path byte-unchanged (contract C2).

## Phase 3: Category A — populate `PAGED_SKIP` (62), zone by zone (research Decision 2)

After EACH zone: re-run `test:pm:paged`; the zone's fails must become skip-passes (paged fail count drops).
- [x] T006 `[4a]` (22) — overlay Pagination engine (`PM.__pagination`) → probe:coords + probe:statusbar + report:glyphgeom.
- [x] T007 `[6b]` (8) — overlay table render DOM → test:roundtrip (export) + `.superdoc-page` paint.
- [x] T008 `[4d]` (7) — ribbon→table ops via overlay table DOM (exports mode-agnostic) → test:roundtrip.
- [x] T009 `[2]` (7) — overlay list-marker / shading DOM → structure asserts + test:roundtrip.
- [x] T010 `[9]` (6) — `#pm-notes-area` (disabled in paged) + TOC "0" degrade → probe:notes.
- [x] T011 `[home]` (5) — paragraph-border / text-effect / hr DOM → `.superdoc-page` + test:roundtrip.
- [x] T012 `[4b]` (3) + `[4c]` (1) + `[insert]` (1) — image resize/render/float/natural-size → probe:imageresize + roundtrip.
- [x] T013 `[fix]` (3) — overlay caret-hit / selectednode DOM → probe:pointer.
- [x] T014 `[3]` (1) + `[1]` (1) — heading-color / strike-superscript decoration render → mark application + report:glyphgeom.

## Phase 4: Category B — investigate + paged-aware port (8). NO silent skip.

For each: reproduce in paged, find the paged-equivalent assertion (doc-model / PE view / paged class), port the
test to a `PAGED`-aware branch, confirm it genuinely PASSES in paged. If a real paged gap is proven, record it as
an explicit FAIL/known-gap (do NOT add to `PAGED_SKIP`).
- [x] T015 `[7]` open `.html` bold mark — assert the doc-model bold mark (mode-agnostic) / settle timing.
- [x] T016 `[8]` Restrict Editing read-only — assert on the PE view (`WC.view`) editability in paged.
- [x] T017 `[0a]` PK-junk import resilience — assert the live PE survived the junk import.
- [x] T018 `[11]` ×2 "PM is the only world" / "body is pm-active" — assert the paged single-world / body class.

## Phase 5: Harden + verify + close-out

- [x] T019 Add `test:pm:paged` to `package.json` (fresh `--user-data-dir=C:/tmp/wc-paged-test`,
  `--probe-out=C:/tmp/wc-pm-paged.json`) — a genuine paged run by construction (contract C6).
- [x] T020 VERIFY: overlay build → `test:pm` **475/475** (SC-001); `test:pm:paged` → **fail===0**, `mode=paged`,
  `pagedSkips≈62` (SC-002/003); `test:smoke` 9 / `test:roundtrip` 27 / `test:bundle` 4 unaffected (SC-004).
- [x] T021 Audit every paged-skip detail: starts `⊘ paged-skip (overlay-only):` + names construct + a probe (FR-004);
  confirm NO Category-B test is in `PAGED_SKIP` (FR-005).
- [x] T022 `/code-review` (adversarial-review workflow) — focus: any over-skip hiding a real paged gap; overlay
  byte-equivalence; reason honesty. FIX confirmed findings.
- [x] T023 Docs reconcile: update memory `paged-testpm-overlay-suite` (test:pm is now paged-aware; the 70 are
  ported/skipped; how to run the paged gate) + a docs/plan note. Tick this tasks.md.
- [x] T024 ff-merge `007-paged-test-coverage` → `general-done` (NOT main; no push). plan-tracking checkpoint.
  **Unblocks 008 (overlay retirement).**

---

## Dependencies & order
- Phase 2 (skip infra) before Phase 3 (the map is consumed by `t()`/`ta()`).
- Phase 3 zones are independent — any order; re-verify paged after each.
- Phase 4 independent of Phase 3 (different tests); both before Phase 5 verify.
- T024 (merge) is the prerequisite for feature 008.

## Notes
- The honesty invariant (FR-004/005) is the crux: Category A skips name a covering probe; Category B is ported,
  never skipped. The `/code-review` (T022) explicitly hunts for an over-skip that hides a real paged gap.
- No Word-COM oracle (Decision 4) — 007 makes no fidelity claim.
