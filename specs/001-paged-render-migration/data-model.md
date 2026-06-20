# Phase 1 Data Model — Milestone 4b (image-resize overlay retarget)

Overlay-positioning fix; entities are coordinate value-types + the relayout trigger. No storage, no model
change (the image box is derived; model stays page-free).

## Value types

### `NodeBox`
An image node's box in **#pages-local** space (page-relative, zoom-divided) — what the resize overlay positions against.
| field | type | notes |
|-------|------|-------|
| `left` / `top` / `width` / `height` | `number` | #pages-local px (`(getBoundingClientRect − #pages.rect)/#pages.scale`). |

## Adapter methods (NEW on `WC.PM.coords`)
| method | signature | behavior |
|--------|-----------|----------|
| `nodeBoxFor` | `(pos:number) => {left,top,width,height} \| null` | `editor.getElementAtPos(pos)` (painted in paged, view in overlay, null off-page) → `(rect − #pages.rect)/#pages.scale`. |
| `overlayScale` | `() => number` | rendered `#pages` scale = `rect.width/offsetWidth` (or 1). = `WC.PM.zoom` in overlay. ONE scale source for positioning + dragging. |

- Both reuse the M4a `pagesScale()` local. `nodeBoxFor` returns null when no element / no #pages.

## Entity — `PagedRelayoutEvent` (reused from M4a)
`window` event `wc:paged-relayout` (dispatched by the bridge's `onLayoutUpdated` handler, paged only).
image-resize adds a once-bound listener → `update()` (reposition handles on no-transaction reflow).

## Validation rules / invariants
- **Overlay byte-identical:** `nodeBoxFor(pos)` == legacy `boxFor(pos)` for a selected image (gate-verified);
  `overlayScale()` == `WC.PM.zoom` in overlay.
- **Per-page visibility:** image on a non-painted page → `getElementAtPos` null → `nodeBoxFor` null → overlay
  hides handles until the page paints (matches virtualization).
- **Coherent scale:** handle positioning and drag deltas use the SAME `overlayScale()` → no divergence.
- **Page-free model:** the resize commits w/h to the image node (existing path, unchanged); no page data stored.

## State / lifecycle
- Helpers read live each call. The image-resize `wc:paged-relayout` listener is bound once (module guard),
  remount-safe. No new persistent state.
