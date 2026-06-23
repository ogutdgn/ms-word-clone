# Feature Specification: Frames group (position / align / rotate)

**Feature dir**: `specs/012-frames-group/` | **Branch**: `012-frames-group` (off `general-done`)
**Status**: Draft | **Type**: NO-FORK (WC.PM bridge; wires the residual `isBlocked` floating-object controls)

## Why

The Arrange/Picture-Format ribbon controls **Position**, **Align**, and **Rotate** were the last honest-deferral
stubs in the `layout-arrange` area — gated by the coarse `DEFERRED` flag and routed to the retired `WC.Layout`
(which would throw if reached). Yet the bridge already shipped the machinery: `setImageTransform` (rotate/flip →
`a:xfrm rot/flipH/flipV`) and `setImagePosition` (absolute offset → `wp:positionH/V posOffset`) were built in Phase
4 and round-trip. A spike confirmed they export correct OOXML and read back in real Word. So this is a wiring +
thin-helper feature — like 003/004/006 un-deferred their controls — no fork edit.

## What (scope — the NO-FORK subset)

Wire **Position**, **Align (horizontal)**, and **Rotate/Flip** onto `WC.PM`, un-defer them in `ENGINE_READY`, and
add the one missing verb (`setImageAlign`, a computed margin-relative horizontal offset). All operate on the selected
picture via the existing `selectedImage()` + `setNodeMarkup` path (the WC.PM bridge; model stays page-free).

- **Rotate / Flip** (`H.rotate` → `WC.PM.setImageTransform`): Rotate Right/Left 90° (relative delta → `a:xfrm rot`),
  Flip Horizontal/Vertical (toggle `flipH`/`flipV`). Works on in-line or floating pictures.
- **Align horizontal** (`H.align` → new `WC.PM.setImageAlign({h})`): Align Left/Center/Right relative to the margin —
  computes the column-relative offset from `getPageStyles` (page text width) minus the picture width, delegates to
  `setImagePosition`. Floating pictures only.
- **Position** (`H.position` → `setImageWrap('square')` + `setImageAlign`): the "In Line with Text" item +
  the 9 "With Text Wrapping" presets (each applies square wrap + horizontal margin align per column).

**Out of scope (stay deferred, documented):**
- **Group / Ungroup** — multi-object `a:grpSp`; needs multi-selection + group-shape modeling. Stays `isBlocked`
  (the D6 representative).
- **Selection Pane** — a UI dock, not an OOXML write. Stays deferred.
- **Vertical align** (Align Top/Middle/Bottom) + **Distribute** — need a vertical page/margin anchor or
  multi-selection; the v1 Align/Position presets apply HORIZONTAL alignment only (toast for the rest).
- **Imported-picture reposition** — `setImagePosition` refuses an imported anchor (it exports its verbatim
  `originalDrawingChildren`); freshly-inserted floating pictures position/align fully. (Pre-existing guard.)

## Functional requirements

- **FR-001**: Rotate Right/Left 90° + Flip H/V on the selected picture MUST write `transformData` → export
  `a:xfrm rot/flipH/flipV`, read back in Word as `Shape.Rotation` / `Shape.HorizontalFlip`.
- **FR-002**: Align Left/Center/Right MUST position a floating picture at the margin's left/center/right edge
  (`setImageAlign` computed offset → `wp:positionH posOffset`), read back as `Shape.Left` at the expected offset.
- **FR-003**: `position`/`align`/`rotate` MUST be removed from the `isBlocked` set (added to `ENGINE_READY`); their
  `H.*` handlers MUST be rewired off the retired `WC.Layout` onto `WC.PM`. NO dead `WC.Layout` call sites remain.
- **FR-004**: `group` + `selectionPane` MUST stay deferred (`isBlocked`); the D6 guards repoint `position`→`group`.
- **FR-005**: NO fork edit (`src/renderer/core/superdoc-fork/**` untouched); the 4 core gates green.

## Success criteria

- **SC-001**: `probe:frames` passes — rotate→rotation=90, flipH→horizontalFlip, align center/right/left → the
  expected `marginOffset.horizontal` (252/504/0 for a 120px picture at Letter/1in margins), the export produces a doc.
- **SC-002**: The Word-COM oracle (`validate-frames-win.ps1`) on the exported `.docx` reads back `Shape.Rotation=90`,
  `HorizontalFlip=msoTrue`, `Shape.Left` at the written offset, `WrapFormat.Type=square`, no repair.
- **SC-003**: `position`/`align`/`rotate` un-blocked, `group`/`selectionPane` deferred; the 4 core gates green
  (test:pm 416 / smoke 9 / roundtrip 27 / test:bundle 4); no fork edit.

## Assumptions

- Pictures are selected as a NodeSelection (the resize/transform path); the verbs require a selected image.
- Word reads the exported anchor/transform OOXML faithfully (verified by the oracle).
