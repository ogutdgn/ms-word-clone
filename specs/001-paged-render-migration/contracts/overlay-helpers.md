# Contract — Overlay Coordinate Helpers (Milestone 4a)

Two per-annotation helpers on `WC.PM.coords` that give the comment + tracked-change overlays painted-page-
correct positions in paged mode, byte-identical in overlay. M4a edits WC-owned code only (adapter + the two
overlays + the M3 onLayoutUpdated handler). No fork edits.

## Adapter — NEW methods on `WC.PM.coords`

```ts
export interface CoordinateAdapter {
  // ...M1 (clientToPos/posToClientRect/getPageCount/getPages) + M3 (getCurrentPage)...
  /** Model pos → {top,bottom,left} in #pages-local space (page-relative, zoom-divided). null off-page or hidden run. */
  posToOverlayLocalRect(pos: number): { top: number; bottom: number; left: number } | null
  /** Model pos → top in #pages-local space. null off-page. (Comments only need Y.) */
  posToOverlayLocalY(pos: number): number | null
}
```

Implementation (both): clamp `pos` to `[1, doc.content.size]`; `c = posToClientRect(clamped)`; read
`#pages` (`document.getElementById('pages')`) rect + `scale = rect.width/offsetWidth`; return
`(c.top − rect.top)/scale` (and bottom/left for the rect form). `posToOverlayLocalRect` returns null when
`c` is null OR `c.top===0 && c.bottom===0` (the hidden-run guard, verbatim from track-chrome.ts:97).
Both verbatim ports of the consumers' current formulas with ONLY `view.coordsAtPos` → `posToClientRect`.

## Consumer retarget (thin delegators — call sites unchanged)

- `src/renderer/bridge/comments-ui.ts`: make `localY(pos)` delegate → `WC.PM.coords.posToOverlayLocalY(pos)` (fallback null). Keeps glyph/card stacking + composer positioning unchanged.
- `src/renderer/bridge/track-chrome.ts`: make `localRect(pos)` delegate → `WC.PM.coords.posToOverlayLocalRect(pos)` (fallback null). Keeps bars + balloon stacking + comment-card collision detection unchanged.

## Relayout trigger

- `src/renderer/bridge/index.ts`: the M3 `presentation.onLayoutUpdated(() => StatusBar.update())` handler ALSO
  `window.dispatchEvent(new Event('wc:paged-relayout'))`.
- comments-ui + track-chrome each add (once, in their install) `window.addEventListener('wc:paged-relayout', () => schedule())`.

## Behavioral contract
| guarantee | detail |
|-----------|--------|
| Overlay byte-identical | For a visible pos, helper output == legacy `localY`/`localRect`. (Pathological non-finite rects now yield null instead of NaN — a strict improvement.) |
| Per-page visibility | Off-painted-page anchor → null → overlay skips until the page paints. |
| Paged refresh | comments/track reposition on `wc:paged-relayout` (no-transaction reflow), in addition to their existing transaction/selection/comment triggers. |
| No fork edits | PE keeps decorating text; the bridge keeps owning glyphs/cards/bars/balloons. |

## Probe contract (`scripts/paged-overlays-probe.js`)
Mode-aware; multi-page doc with a comment + a tracked change:
1. **paged anchoring**: for an anchor on a painted page, `posToOverlayLocalY`/`Rect` return finite #pages-local
   coords; for an off-page anchor → null. The rendered comment card top ≈ `posToOverlayLocalY(anchor)`; the
   rendered change bar top ≈ `posToOverlayLocalRect(anchor).top` (within tolerance).
2. **paged relayout**: dispatching `wc:paged-relayout` (or a no-transaction relayout) repositions both overlays.
3. **overlay parity**: `posToOverlayLocalY`/`Rect` === the legacy formula over `__pagination`/`view.coordsAtPos`
   for the same pos; rendered chrome positions byte-identical to pre-M4a.
4. Gates unchanged: `test:pm` 475 / `test:smoke` 9 / `test:roundtrip` 27 / `test:bundle` 4.
