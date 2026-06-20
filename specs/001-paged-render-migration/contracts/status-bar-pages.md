# Contract — Status-Bar Page Indicator (Milestone 3)

Makes "Page X of Y" correct and caret-tracking in paged mode via the M1 `WC.PM.coords` seam, with overlay
output byte-identical. M3 edits WC-owned code only (`coordinate-adapter.ts`, `bridge/index.ts`, `statusbar.js`);
PE is consumed, not changed.

## Adapter — NEW method on `WC.PM.coords`

```ts
export interface CoordinateAdapter {
  // ...existing M1 methods (clientToPos / posToClientRect / getPageCount / getPages)...
  /** 1-based current page of the caret. paged: PE.computeCaretLayoutRect(caret).pageIndex+1; overlay: __pagination break-scan. */
  getCurrentPage(): number
}
```

Behavior:
| mode | getCurrentPage() |
|------|------------------|
| paged | `caret = editor.state.selection.from`; `r = presentation.computeCaretLayoutRect(caret)`; return `Number.isFinite(r?.pageIndex) ? r.pageIndex + 1 : 1`. |
| overlay | `caret = editor.state.selection.from`; scan the overlay pagination breaks: `breaks.filter(b => b.pos <= caret).reduce((a,b)=>a+(b.pages||1),0) + 1` (verbatim from statusbar.js:70). |
| no editor | `1`. |

- The adapter gains read access to the overlay pagination object (breaks) via a dep wired in `bridge/index.ts`
  (mirrors the existing `getOverlayPageCount` dep). The break-scan logic lives in the adapter, not statusbar.js.
- `getPageCount()` (Y) is UNCHANGED from M1.

## statusbar.js — the consumer (thin)

`statusbar.js` reads only the seam:
```js
const total = (WC.PM.coords && WC.PM.coords.getPageCount && WC.PM.coords.getPageCount()) || (c.pages || 1)
const cur   = (WC.PM.coords && WC.PM.coords.getCurrentPage && WC.PM.coords.getCurrentPage()) || 1
pageEl.textContent = 'Page ' + Math.min(cur, total) + ' of ' + total   // render formula UNCHANGED
```
- It no longer reads `WC.PM.__pagination` or scans breaks itself. The `c.pages` fallback is retained only as a
  pre-`coords` defensive default (parity with the existing `|| 1` guards).

## Refresh trigger — `bridge/index.ts`

In `installBridge`, paged only:
```ts
const pe = (window as any).WC?.presentation
if (pe && typeof pe.onLayoutUpdated === 'function') {
  pe.onLayoutUpdated(() => { (window as any).WC?.StatusBar?.update?.() })
}
```
- Covers the no-transaction re-pagination case (zoom/reflow). Overlay keeps its transaction/selection triggers
  (state-sync.ts) untouched. Subscription is re-established by `installBridge` on Open/New.

## Probe contract (`scripts/paged-statusbar-probe.js`)

Mode-aware; multi-page doc (insert text):
1. **paged total**: `getPageCount()` === `presentation.getPages().length` (> 1) === the `Y` in the rendered text.
2. **paged current**: with caret on page 0 → `getCurrentPage()` === 1; move caret to a pos on a later page →
   `getCurrentPage()` === `computeCaretLayoutRect(thatPos).pageIndex + 1` (> 1) and the rendered `X` matches.
3. **paged trigger**: after a no-transaction relayout (e.g. `WC.PM.setZoom`), `WC.StatusBar.update` having been
   invoked, the rendered text still equals the live `getCurrentPage()`/`getPageCount()` (no stale bar).
4. **overlay parity**: `getCurrentPage()` === the legacy break-scan over `__pagination.breaks`; `getPageCount()`
   === `__pagination.pageCount`; rendered text byte-identical to the pre-M3 output.
5. Gates unchanged: `test:pm` 475 / `test:smoke` 9 / `test:roundtrip` 27 / `test:bundle` 4.
