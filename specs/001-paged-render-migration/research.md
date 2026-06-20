# Phase 0 Research — Milestone 4b (image-resize overlay retarget)

From a read-only map of `imageresize/image-resize.ts` + the PresentationEditor image surface. File:line exact.

## Finding 1 — PE draws NO resize handles → RETARGET (not disable)

- **Decision**: retarget the bridge's `.wc-img-resize` handle overlay to the painted pages. Disabling it in
  paged mode is NOT viable because nothing else would draw handles.
- **Evidence**: PE's `ImageInteractionLayer.apply()` (`ImageInteractionLayer.ts:64-105`) only stamps drag
  METADATA on painted images — `root.draggable = true`, `root.dataset.dragSourceKind = 'existingImage'`,
  `imageKind`/`nodeType`/`displayLabel`/`pmStart`/`pmEnd` (:83-89). **No handle DOM, no resize math.**
  `FieldAnnotationInteractionLayer` is the same pattern; `PresentationPostPaintPipeline.ts:139` just calls
  `imageLayer.apply()` post-paint. PE owns image SELECTION/drag-source metadata, not resize affordances.

## Finding 2 — The image-resize coordinate surface (what M4b retargets)

- Mounts `div.wc-img-resize` into `#pages` (`image-resize.ts:116-150`): 8 grips `.wc-img-handle-{nw…w}` + a
  `.wc-img-move-region` (floating images). z-index 40.
- **`boxFor(pos)`** (`image-resize.ts:153-161`): `const dom = this.view.nodeDOM(pos); const r =
  dom.getBoundingClientRect(); const pr = this.pagesEl.getBoundingClientRect(); return {left:(r.left-pr.left)/z,
  top:(r.top-pr.top)/z, width:r.width/z, height:r.height/z}` where `z = this.zoom()`. **`view.nodeDOM(pos)` is
  the hidden off-screen image in paged → wrong geometry.** This is the only coordinate surface to retarget.
- **`zoom()`** (`:101-103`): `return WC?.PM?.zoom || 1`. Used by boxFor AND the drag deltas
  (`onDragMove` :234-239, `onMoveDragMove` :341): `(e.clientX - startClientX) / z`.
- **Selection** (`:106-112`): a `NodeSelection` over an `image` node. **Update**: plugin-view `update()` on
  selection; rAF on window resize (`:93-96`); manual after `onDragUp` (`:293`).

## Finding 3 — `editor.getElementAtPos(pos)` is the painted-image access for nodeBoxFor

- **Decision**: `nodeBoxFor` reads `editor.getElementAtPos(pos)` (NOT `view.nodeDOM`). It is mode-aware:
  `Editor.getElementAtPos` delegates to `presentationEditor.getElementAtPos` in paged (the PAINTED element,
  null if off-page/virtualized) and a view-based path in overlay. Then apply the proven M4a formula
  `(rect − #pages.rect)/#pages.scale` for `{left,top,width,height}`.
- **Risk to gate**: confirm the OVERLAY path of `getElementAtPos` returns the SAME element/box as the legacy
  `view.nodeDOM(pos)`, else overlay parity breaks. The parity probe checks `nodeBoxFor === legacy boxFor`.
- **Alternative**: `EntityRectFinder.elementsToRangeRects` (`EntityRectFinder.ts:136-156`) — overkill for a
  single node; `getElementAtPos` is the single-element path. Rejected for M4b.

## Finding 4 — Zoom is SAFE; use ONE scale source (overlayScale)

- **Decision**: expose `WC.PM.coords.overlayScale()` = `#pages.rect.width/offsetWidth` (the rendered scale),
  and use it for BOTH `nodeBoxFor` positioning and the image-resize drag deltas (replacing `WC.PM.zoom`).
- **Rationale**: `#pages` carries the only zoom transform in all modes (`bridge/index.ts:429-430`:
  `pages.style.transform = scale(WC.PM.zoom)`), and PE's internal zoom is never set (stays 1), so the rendered
  `#pages` scale IS the total visible scale. Using the rendered ratio (not the `WC.PM.zoom` global) as ONE
  source for positioning + dragging keeps them coherent (no divergence bug) and is robust if PE ever owns an
  inner zoom. In overlay `overlayScale() === WC.PM.zoom` → byte-identical.

## Finding 5 — Verification (computer-use blocked)

- The handle POSITIONING is automatable: a probe inserts an image, selects it, and asserts the rendered
  `.wc-img-resize` box ≈ `nodeBoxFor(imagePos)` + painted-aware. The live DRAG-resize gesture is not reliably
  drivable by synthetic events (cf. M2's drag) and **computer-use cannot target the CLI-launched dev Electron
  build** (M2 lesson — not a Start-menu app; "Document1 - Word" collides with MS Word) → manual real-app spot-check.

## Open questions
None blocking. M4c (ink) will reuse `overlayScale()`.
