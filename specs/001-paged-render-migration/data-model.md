# Data Model — Milestone 4c (ink-overlay retarget)

M4c adds NO document-model entities (the doc keeps the same `vectorShape` ink nodes). It introduces coordinate /
DOM-surface concepts at the bridge↔seam boundary.

## OverlayLocalPt — the return of `clientToOverlayLocalPt`
- **Shape**: `{ x: number; y: number; pageIndex: number } | null`.
- **`x`/`y`**: the pointer in `#pages`-local px = `(client − #pages.rect)/#pages.scale` (the inverse of the
  M4a/M4b `posToOverlayLocalRect`/`nodeBoxFor` mapping; `pagesScale()` supplies the rect+scale).
- **`pageIndex`**: which painted `.superdoc-page[data-page-index]` the pointer is over (paged); `0` in overlay
  (single sheet). Determined by `getBoundingClientRect` containment over `#pm-editor`'s `.superdoc-page` elements.
- **`null`**: pointer over an inter-page gap, off-page, or a virtualized/unmounted page (mirrors the null guards in
  `posToOverlayLocalRect`).
- **Validation**: all numbers finite; `pageIndex ≥ 0`; `null` on any non-finite intermediate or missing `#pages`.

## InkLayerSurface — the `svg.wc-ink-layer`
- **overlay (unchanged)**: a `#pages` child sized/positioned to `#pm-editor.offsetLeft/Top/Width/Height`; draws in
  `#pm-editor`-local px.
- **paged (new)**: a `#pages` child sized to `#pages(0,0)` at full `#pages.offsetWidth/Height` — ONE surface spanning
  all stacked painted pages; survives PE repaints (re-appended in `ensureLayer`); draws in `#pages`-local px.
- **Capture**: `setPointerCapture(pointerId)` on pointerdown, released on pointerup (paged), so a stroke clamped to its
  start page keeps receiving move/up across an inter-page gap. Window-level move/up listeners remain the fallback.

## InkPlacementModel — how a committed FRESH stroke renders per mode (`renderInk`)
- **overlay (unchanged)**: place `customGeometry.inkPoints` at the `inkPos`-offset px (free-floating over the
  continuous sheet).
- **paged (new)**: resolve the stroke's painted page from its node doc position, then offset the placed points onto
  that page's `#pages`-local origin. **Primary**: `editor.getElementAtPos(pos)` → the painted anchor element → its
  `.superdoc-page` origin. **Fallback (probe-gated)**: `overlayPageBox(pageIndex)` from a page index recovered off the
  node. (Reopened `.paths` strokes: NOT rendered by the overlay in paged — PE owns them.)

## InkPersistFrame — what `onUp` writes (`dInsertInk` `pos`)
- **overlay (unchanged)**: stroke bbox top-left in `#pm-editor`-local px.
- **paged (new)**: stroke bbox top-left in **page-LOCAL** px — the captured `#pages`-local point minus the
  onDown-page origin (clamp model). Aligns with the `wp:anchor relativeFrom='page'` `posOffset` so the stroke reopens
  at the right on-page position. (Verify `synthesizeInkDrawing`'s emitted `relativeFrom` during implementation.)

## State transitions (the live gesture — unchanged shape, retargeted space)
`idle → onDown(resolve page once, clamp) → onMove(append, same page space) → onUp(persist page-local + renderInk)`.
Eraser/select/lasso operate over the rendered `.pm-ink-stroke` paths (now in the painted-page space) → `data-ink-pos`
→ `deleteNodesAt`. No transition changes; only the coordinate space each step uses.
