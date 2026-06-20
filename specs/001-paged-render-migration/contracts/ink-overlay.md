# Contract — Milestone 4c (ink-overlay retarget)

## Seam: `WC.PM.coords` additions (coordinate-adapter.ts)

### `clientToOverlayLocalPt(clientX: number, clientY: number): { x: number; y: number; pageIndex: number } | null`
- Promotes the M4-deferred stub at coordinate-adapter.ts:81.
- **Body**: `const ps = pagesScale(); if (!ps) return null;` → `x=(clientX − ps.r.left)/ps.scale`,
  `y=(clientY − ps.r.top)/ps.scale`. **pageIndex**: in paged, scan
  `deps.getEditor()`'s painted pages — `#pm-editor`'s `.superdoc-page[data-page-index]` — for the one whose
  `getBoundingClientRect` contains `(clientX,clientY)`; return its `data-page-index` (int). Over a gap / off-page /
  virtualized → return `null`. In overlay → `pageIndex = 0`.
- **Guards**: non-finite `x`/`y` or missing `#pages` → `null`. Try/catch → `null`.
- **Invariant**: `x`/`y` are the exact inverse of `posToOverlayLocalRect`'s mapping (round-trips for a known pos on
  that page) → mode-agnostic and overlay-consistent.

### `overlayPageBox(pageIndex: number): { left: number; top: number; width: number; height: number } | null` *(OPTIONAL)*
- Add ONLY if `renderInk`'s `getElementAtPos` page-resolution proves insufficient (probe-decided).
- **Body**: find `#pm-editor`'s `.superdoc-page` with matching `data-page-index`; return its box in `#pages`-local px
  (same `(clientRect − #pages.rect)/scale` as `nodeBoxFor`). `null` for a virtualized/unmounted page.

## Consumer: `src/renderer/bridge/ink-overlay.ts` (ALL paged-branched on `window.__WC_LAYOUT_MODE === 'paged'`)

| Function | overlay (unchanged) | paged (new) |
|---|---|---|
| `localPt(e)` (141) | `(client − #pm-editor.rect)/scale` | `WC.PM.coords.clientToOverlayLocalPt(e.clientX, e.clientY)` → `{x,y}` (drop `pageIndex` after using it at `onDown`); `null` → ignore the move |
| `ensureLayer`/`sizeLayer` (107-138) | mount + size to `#pm-editor.offset*` | mount + size to `#pages(0,0)` at full `#pages.offsetWidth/Height` |
| `onDown` (157) | start stroke | **resolve `pageIndex` once** (clamp); `setPointerCapture(e.pointerId)` |
| `onMove`/`onUp` (179-214) | append / persist `#pm-editor`-local bbox | append in the clamped page space / persist **page-LOCAL** px; `releasePointerCapture` |
| `renderInk` fresh (286-309) | place `inkPoints` at `inkPos`-px | resolve page (`getElementAtPos(pos)` → `.superdoc-page` origin) + offset onto it |
| `renderInk` reopened `.paths` (310-325) | render EMU→px | **SUPPRESS** (PE paints reopened ink) |
| eraser/select/lasso (246-283) | hit-test rendered paths | **no logic change** (rides the consistent `localPt`+`renderInk` space) |

## Consumer: `src/renderer/bridge/draw.ts`
- `dInsertInk` — no signature change; in paged receives page-local px from `onUp`. Confirm `synthesizeInkDrawing`
  emits `wp:anchor relativeFrom='page'` and computes `posOffset` from the page top-left (else adjust the persist
  transform).

## Behavioral guarantees
- **Overlay byte-identical**: every paged branch is gated; overlay `.pm-ink-stroke` `d`-strings + layer geometry
  unchanged (probe-verified).
- **Paged correctness**: a stroke drawn on page *N* renders + persists on page *N*; tools delete/select the right
  `vectorShape`; reopened ink renders exactly once.
- **No fork edits**; **model page-free**; graceful `null` on virtualized pages.
