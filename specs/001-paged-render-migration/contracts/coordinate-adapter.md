# Contract — `WC.PM.coords` Coordinate Adapter (Milestone 1)

The single seam for client↔model coordinate mapping and page enumeration across the overlay and paged
renderers. Installed at `WC.PM.coords` during bridge install. Later milestones route their consumers
through this instead of calling `editor.view.*` directly.

## Factory

```ts
// src/renderer/layout/coordinate-adapter.ts
export interface CoordinateAdapterDeps {
  getEditor(): any            // the bridge-bound Editor (WC.editor)
  getPresentation(): any | null   // WC.presentation in paged mode, else null
  getOverlayPageCount(): number   // overlay page count (from WC.PM.__pagination)
}
export function createCoordinateAdapter(deps: CoordinateAdapterDeps): CoordinateAdapter
```

## Interface — BUILT + TESTED in M1

```ts
export interface CoordinateAdapter {
  /** Client(viewport) coords → model position. overlay: view.posAtCoords; paged: PE.hitTest (painted). */
  clientToPos(clientX: number, clientY: number): { pos: number; inside: number } | null

  /** Model position → viewport-space caret/selection rect. overlay: view.coordsAtPos; paged: PE.coordsAtPos. */
  posToClientRect(pos: number): { top: number; bottom: number; left: number; right: number; width: number; height: number } | null

  /** Total page count. paged: editor.currentTotalPages; overlay: getOverlayPageCount(). */
  getPageCount(): number

  /** Enumerate pages. paged: presentation.getPages() (real Layout pages); overlay: length-only shim. */
  getPages(): Array<{ index: number; size?: { w: number; h: number }; margins?: any }>
}
```

### Behavioral contract
| guarantee | detail |
|-----------|--------|
| Mode transparency | Caller never branches on `WC_LAYOUT`; the adapter does. Core coordinate methods delegate to `editor.*`, which the vendored `Editor` already branches on `presentationEditor`. |
| Null-safety | Any method returns `null`/`0`/`[]` (never throws) when editor/presentation is absent. |
| No re-clamping | `posToClientRect` does not clamp `pos`; callers clamp to `[1, doc.content.size]` exactly as today (behavior-identical to the `view.*` call it replaces). |
| Remount-safe | Reads the editor/presentation through `deps` getters each call, so it survives `replaceEditor`. |
| Overlay parity | In overlay mode every method must produce the **same** result the current direct `view.*` / `__pagination` calls produce (verified by the probe). |

## Interface — DOCUMENTED, **DEFERRED to Milestone 4** (no code in M1)

Per the *defer, just document* decision, the following specialty helpers are **described here for the
M4 overlay retarget** but are **NOT implemented in M1**. M4 adds + tests each when it rewires its overlay.
They encapsulate the viewport→overlay-local (page-relative, zoom-divided) math that comments-ui,
track-chrome, ink-overlay, and image-resize currently each duplicate.

```ts
// M4 — DO NOT IMPLEMENT IN M1. Listed so M2/M3 consumers know the seam will grow here.
interface CoordinateAdapterM4 {
  /** Model pos → overlay-local Y (page-relative, scale-divided). Replaces comments-ui.ts localY(). */
  posToOverlayLocalY(pos: number): number | null
  /** Model pos → overlay-local rect. Replaces track-chrome.ts localRect(). */
  posToOverlayLocalRect(pos: number): { top: number; bottom: number; left: number } | null
  /** Image node box in overlay-local space. Replaces image-resize.ts boxFor(). */
  nodeBoxFor(pos: number): { left: number; top: number; width: number; height: number } | null
  /** Pointer event → layer-local point (zoom-divided). Replaces ink-overlay.ts localPt(). */
  clientToOverlayLocalPt(clientX: number, clientY: number): { x: number; y: number } | null
}
```

**M4 source call sites being unified** (from the surface map):
`bridge/comments-ui.ts:125` (`localY`), `bridge/track-chrome.ts:91` (`localRect`),
`bridge/ink-overlay.ts:122/140` (`sizeLayer`/`localPt`), `imageresize/image-resize.ts:156` (`boxFor`),
`bridge/focus.ts:88` (margin-click `posAtCoords`).

## Probe contract (the M1 acceptance check)

`scripts/paged-coords-probe.js` (run in `WC_LAYOUT=paged`) asserts:
1. `WC.PM.coords` exists with the 4 core methods.
2. `getPageCount()` === `presentation.getPages().length` (> 0).
3. For a painted glyph at known client (x,y): `clientToPos(x,y)` → a finite `pos`; `posToClientRect(pos)`
   → a rect whose center is within tolerance of (x,y) — i.e. client→pos→client round-trips.
4. Overlay parity (separate overlay-mode run or in-process check): `clientToPos`/`posToClientRect` equal
   the direct `view.posAtCoords`/`view.coordsAtPos` results for the same inputs.
