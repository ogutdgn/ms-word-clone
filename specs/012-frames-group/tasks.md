# Tasks: Frames group (position / align / rotate)

**Feature**: `specs/012-frames-group/` | **Branch**: `012-frames-group` (off `general-done`)
**Inputs**: spec.md, plan.md
**Merge mode**: ff-merge into `general-done`. `/code-review` before merge.
**Type**: NO-FORK — `bridge/insert.ts` + `bridge/index.ts` + `commands.js` + tests/probe/oracle.

---

## Phase 0: Spike (DONE)
- [x] T001 On `012-frames-group` off `general-done`; feature.json → this dir.
- [x] T002 Scope: `position`/`align`/`rotate` route to retired `WC.Layout` + are `isBlocked`; the bridge already has
  `setImageTransform`/`setImagePosition` (Phase 4). Spike: author+wrap+rotate+position an image → export confirmed
  `rot="5400000"` + `wp:posOffset`. `group`/`selectionPane` not node-attr writes → defer.

## Phase 1: Implement (NO-FORK)
- [x] T003 `bridge/insert.ts`: add `setImageAlign({h})` (column-relative offset from getPageStyles − imgWidth →
  setImagePosition); add to the returned verbs.
- [x] T004 `bridge/index.ts`: add `setImageAlign` pre-mount stub; add `position`/`align`/`rotate` to `ENGINE_READY`.
- [x] T005 `commands.js`: rewire `H.position`/`H.align`/`H.rotate` onto `WC.PM` (no dead `WC.Layout`); vertical
  align/distribute → toast; `H.selectionPane` → deferred toast.

## Phase 2: Test + gates
- [x] T006 `test-suite-pm.js`: repoint the D6 guards `position`→`group`; update `[4b]`/`[11]` (position/align/rotate
  un-blocked; group/selectionPane deferred).
- [x] T007 `scripts/paged-frames-probe.js` + `probe:frames`; `scripts/oracle/validate-frames-win.ps1`.
- [x] T008 `probe:frames` 13/13; Word-COM oracle: rotation=90, horizontalFlip=msoTrue, leftPt=75, wrapType=square,
  no repair. 4 core gates green (test:pm 416 / smoke 9 / roundtrip 27 / test:bundle 4).

## Phase 3: Review + close-out
- [x] T009 `/code-review` (adversarial-review workflow) — focus: no dead `WC.Layout` call sites; no fork edit; the
  un-defer is complete (D6 guards repointed, [4b]/[11] updated); setImageAlign offset math correct; group/
  selectionPane genuinely still blocked. FIX confirmed findings.
- [x] T010 Docs reconcile (FEATURES/SCOPE/LAYOUT_ENGINE — frames group wired; note vertical/group/selectionPane
  deferred). Tick this tasks.md.
- [x] T011 ff-merge `012-frames-group` → `general-done` (NOT main, no push). plan-tracking checkpoint. ALL 8 DONE →
  PushNotification + report to the user (general-done ready for THEIR final merge to main).

---
## Notes
- The frames machinery (`setImageTransform`/`setImagePosition`) pre-existed; 012 is wiring + the `setImageAlign`
  helper. NO fork edit.
- Deferred (documented v1): group/ungroup (multi-object a:grpSp), selectionPane (UI), vertical align + distribute,
  imported-picture reposition.
