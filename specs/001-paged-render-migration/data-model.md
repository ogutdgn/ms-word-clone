# Phase 1 Data Model — Milestone 1 (coordinate adapter)

The adapter is a render-layer seam; its "entities" are coordinate value-types plus the adapter handle.
No persistent storage, no document-model changes (the model stays page-free).

## Value types

### `PositionHit`
A resolved model position from a client-coordinate hit test. Mirrors ProseMirror's `posAtCoords` return.
| field | type | notes |
|-------|------|-------|
| `pos` | `number` | 1-based model position (clamped to doc bounds by the caller, as today). |
| `inside` | `number` | node depth/inside marker; `-1` for layout-engine hits (PM-compat). |

Source: overlay → `view.posAtCoords`; paged → `presentationEditor.hitTest` (via `Editor.posAtCoords`).

### `ClientRect`
A caret/selection rectangle in **viewport (client) space**, already zoom-corrected by the engine.
| field | type | notes |
|-------|------|-------|
| `top` / `bottom` / `left` / `right` | `number` | viewport-space px. |
| `width` / `height` | `number` | present in the PE form; overlay form derives them. |

Source: overlay → `view.coordsAtPos`; paged → `presentationEditor.coordsAtPos` (via `Editor.coordsAtPos`).
**Note:** consumers that need *overlay-local* (page-relative, scale-divided) rects do the `#pages`-rect /
scale division themselves today; encapsulating that is an **M4-deferred** helper (see contract), not M1.

### `PageInfo` (paged) / page count (overlay)
| field | type | notes |
|-------|------|-------|
| `index` | `number` | 0-based page index. |
| `size` | `{ w: number; h: number }` | px (paged-real). |
| `margins?` | `{ top; bottom; left; right; header; footer }` | present in paged `Layout` pages. |

In **paged** mode `getPages()` returns the engine's real `Layout['pages']` (richer than the table above;
see `@superdoc/contracts`). In **overlay** mode there is no real per-page geometry; `getPages()` returns a
minimal length-only shim and `getPageCount()` is the source of truth for M3.

## Adapter handle

### `CoordinateAdapter`
Returned by `createCoordinateAdapter(deps)`, installed at `WC.PM.coords`.
| method | signature | mode behavior |
|--------|-----------|---------------|
| `clientToPos` | `(clientX:number, clientY:number) => PositionHit \| null` | `editor.posAtCoords({clientX,clientY})`. |
| `posToClientRect` | `(pos:number) => ClientRect \| null` | `editor.coordsAtPos(pos)`. |
| `getPageCount` | `() => number` | paged: `editor.currentTotalPages`; overlay: `WC.PM.__pagination` count. |
| `getPages` | `() => PageInfo[]` | paged: `presentation.getPages()`; overlay: length-only shim. |

**Dependencies (`deps`)**: lazy getters so the adapter survives `replaceEditor` remounts —
`{ getEditor(): Editor, getPresentation(): PresentationEditor \| null, getOverlayPageCount(): number }`.
The adapter holds no editor reference directly; it reads through the getters each call.

## Validation rules
- All methods return `null`/`0`/`[]` rather than throw on a missing editor/presentation (parity with the
  defensive try/catch the current consumers already wrap these calls in).
- `pos` inputs are clamped to `[1, doc.content.size]` by callers (unchanged from today); the adapter does
  not re-clamp, to keep behavior identical to the direct `view.*` calls it replaces.

## State / lifecycle
- Installed once during `installBridge`; rebound implicitly via the `getEditor`/`getPresentation` getters
  after any `replaceEditor` (Open/New) so it never holds a stale editor.
- No internal mutable state beyond the injected getters.
