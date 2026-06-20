# Contract — Image-Resize Overlay Retarget (Milestone 4b)

Makes the image resize-handle overlay position on the painted image in paged mode, byte-identical in overlay.
M4b edits WC-owned code only (adapter + image-resize.ts); PE is consumed (`getElementAtPos`), not changed.

## Adapter — NEW methods on `WC.PM.coords`

```ts
export interface CoordinateAdapter {
  // ...M1/M3/M4a methods...
  /** Image-node box in #pages-local space (page-relative, zoom-divided). null off-page / no element. */
  nodeBoxFor(pos: number): { left: number; top: number; width: number; height: number } | null
  /** Rendered #pages scale (rect.width/offsetWidth, = WC.PM.zoom today). ONE scale source for overlays. */
  overlayScale(): number
}
```

`nodeBoxFor(pos)`: `el = editor.getElementAtPos(pos)` (painted in paged via PE; view-based in overlay; null
off-page) → if `!el` null → `c = el.getBoundingClientRect()`, `ps = pagesScale()` (the M4a local) → return
`{ left:(c.left-ps.r.left)/ps.scale, top:(c.top-ps.r.top)/ps.scale, width:c.width/ps.scale, height:c.height/ps.scale }`.
`overlayScale()`: `pagesScale()?.scale ?? 1`.

## image-resize.ts retarget (thin delegators)

- `boxFor(pos)` → `return ((window).WC?.PM?.coords?.nodeBoxFor?.(pos)) ?? null`. (Handle render, selection
  detection, the drag pipeline, and `onDragUp`/`update` stay unchanged.)
- `zoom()` → `return ((window).WC?.PM?.coords?.overlayScale?.()) ?? (((window).WC?.PM?.zoom) || 1)`. Now BOTH
  handle positioning (via nodeBoxFor) and the drag deltas (`(clientX-startClientX)/zoom()`) use the rendered scale.
- Add, once (module guard), `window.addEventListener('wc:paged-relayout', () => update())` so handles follow the
  image on a no-transaction reflow.

## Behavioral contract
| guarantee | detail |
|-----------|--------|
| Overlay byte-identical | nodeBoxFor==legacy boxFor (requires getElementAtPos≡view.nodeDOM in overlay — gate-checked); overlayScale==WC.PM.zoom in overlay. |
| Paged correctness | handles position on the PAINTED image; nodeBoxFor uses PE's painted element, not the hidden view. |
| Per-page visibility | off-painted-page image → null → handles hidden until the page paints. |
| Coherent scale | positioning + dragging share `overlayScale()` (no divergence). |
| No fork edits | PE draws no handles; the bridge keeps owning them. |

## Probe contract (`scripts/paged-image-resize-probe.js`)
Mode-aware; inserts an image + selects it (NodeSelection):
1. **paged**: `nodeBoxFor(imagePos)` finite; the rendered `.wc-img-resize` box ≈ `nodeBoxFor(imagePos)` (within
   tolerance); painted-aware (≠ the hidden `view.nodeDOM` box); `overlayScale()` finite > 0.
2. **overlay parity**: `nodeBoxFor(imagePos)` === the legacy boxFor formula; `overlayScale()` === `WC.PM.zoom`.
3. Gates unchanged: `test:pm` 475 / `test:smoke` 9 / `test:roundtrip` 27 / `test:bundle` 4.
4. **Manual** (not automated): drag a corner handle in paged → the image resizes following the cursor.
