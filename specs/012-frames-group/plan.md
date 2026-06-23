# Implementation Plan: Frames group (position / align / rotate)

**Feature dir**: `specs/012-frames-group/` | **Branch**: `012-frames-group` (off `general-done`)
**Spec**: [spec.md](spec.md) | **Type**: NO-FORK (WC.PM bridge wiring + one helper)

## Constitution check

- **P1 (no fork edit)**: ✅ — spike confirmed the machinery (`setImageTransform`/`setImagePosition`) lives in the
  bridge (`insert.ts`) and already exports correct OOXML; `src/renderer/core/superdoc-fork/**` is untouched.
- **P2 (WC.PM bridge write path)**: ✅ — all writes go through `selectedImage()` + `setNodeMarkup` (the bridge).
- **P3 (model page-free)**: ✅ — the image node's `transformData`/`marginOffset`/`anchorData` attrs are document
  attrs; no page modeling.
- **P5 (Word-COM validated)**: ✅ — `validate-frames-win.ps1` reads Rotation/Flip/Left/Wrap back in real Word.
- **P6 (regression test + gates)**: ✅ — `probe:frames` + the D6 guard repoint; 4 core gates green.

## Spike findings (DONE)

- `H.position`/`H.align`/`H.rotate` routed to the retired `WC.Layout`; `position`/`align`/`rotate` were `isBlocked`
  (AREA `layout-arrange` ∈ DEFERRED, not in `ENGINE_READY`).
- The bridge already has `setImageTransform` (rotate/flip → `a:xfrm rot/flipH/flipV`) + `setImagePosition` (offset →
  `wp:positionH/V posOffset`), both fully implemented + re-asserting NodeSelection. A spike authored an image,
  wrapped/rotated/positioned it, exported → confirmed `rot="5400000"` (90°) + `wp:posOffset 952500/476250`.
- `group`/`ungroup` (multi-object) + `selectionPane` (UI) are NOT node-attr writes → stay deferred.

## Approach

1. `bridge/insert.ts`: add `setImageAlign({h})` — compute the column-relative offset (`(pageTextWidth − imgWidth)`
   per left/center/right) from `getPageStyles`, delegate to `setImagePosition`. Add to the returned verbs.
2. `bridge/index.ts`: add `setImageAlign` pre-mount stub; add `position`/`align`/`rotate` to `ENGINE_READY`.
3. `commands.js`: rewire `H.position` (9-grid → square wrap + `setImageAlign` per column), `H.align` (L/C/R →
   `setImageAlign`; vertical + distribute → toast), `H.rotate` (→ `setImageTransform`); `H.selectionPane` → a
   deferred toast (no dead `WC.Layout`).
4. `test-suite-pm.js`: repoint the D6 guards `position`→`group`; update `[4b]`/`[11]` to assert position/align/rotate
   un-blocked + group/selectionPane deferred.
5. `scripts/paged-frames-probe.js` + `probe:frames` npm script; `scripts/oracle/validate-frames-win.ps1`.

## Verification (DONE)

- `probe:frames` 13/13 (un-block state; rotate=90; flipH; align center=252/right=504/left=0; export).
- Word-COM oracle: shapes=1, rotation=90, horizontalFlip=msoTrue, leftPt=75, topPt=37.5, relHPos=column,
  wrapType=square, shapeType=picture — no repair.
- 4 core gates: test:pm 416 / smoke 9 / roundtrip 27 / test:bundle 4.

## Risk / known limits (v1)

- Horizontal align/position only (vertical needs a page anchor); group/ungroup/selectionPane deferred; imported-
  picture reposition refused (the pre-existing `originalDrawingChildren` guard). All documented; no fork edit.
