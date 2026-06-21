# Contract — "Header & Footer Tools" contextual tab

A new owned chrome module `src/renderer/public/js/header-footer-tools-pm.js`, modeled on
`picture-tools-pm.js` (`pictureFormatTab()` + `syncContextualTab()`) and `table-tools-pm.js`. Uses the existing
`WC.Ribbon.showContextualTab(def)` / `hideContextualTab(id)` (`ribbon.js:515-575`).

## Activation

- Driven from `bridge/state-sync.ts`, mirroring how picture/table tabs activate: when
  `WC.PM.headerFooterState().active` becomes true → `WC.Ribbon.showContextualTab(headerFooterToolsTab)`; when it
  becomes false → `WC.Ribbon.hideContextualTab(id)`.
- The tab auto-selects when shown (Word behavior), and the ribbon returns to the prior tab on Close.

## Controls (v1)

| Control | Command | Phase | Behavior |
|---------|---------|-------|----------|
| Go to Header | `goToHeader` | P1 | `WC.PM.enterHeaderFooter('header')` |
| Go to Footer | `goToFooter` | P1 | `WC.PM.enterHeaderFooter('footer')` |
| Close Header and Footer | `closeHeaderFooter` | P1 | `WC.PM.closeHeaderFooter()` |
| Different First Page | `differentFirstPage` | P2 | toggle → `WC.PM.setDifferentFirstPage(on)`; checked state from `getHeaderFooterOptions()` |
| Different Odd & Even Pages | `differentOddEven` | P2 | toggle → `WC.PM.setDifferentOddEven(on)`; checked state from `getHeaderFooterOptions()` |
| Page Number | `pageNumber` | P3 | flyout (Top / Bottom / Current Position / Remove) → `insertPageNumber`/`removePageNumbers` |
| Link to Previous | `linkToPrevious` | P1 (inert) | shown for parity; inert in a single section (honest disabled/no-op, no throw) |

Deferred (NOT in v1): Date & Time, Document Info, Quick Parts, Pictures, Header/Footer from Top/Bottom, Insert
Alignment Tab, building-block galleries.

## Command rewire (FR-014)

`commands.js:399-408,457` handlers are rewritten to call the `WC.PM` verbs above. **No handler may reference**
`E()` (`= WC.Editor`, retired) or `WC.HeaderFooter` (deleted). The `isBlocked` gate
(`commands.js:1549,1558`) for the delivered commands is removed by un-deferring them in `bridge/index.ts`
(ENGINE_READY / AREA / DEFERRED), so dispatch reaches the real handler.

## Invariants

- The existing Insert → Header/Footer dropdowns keep working (the plain-text modal remains a fallback).
- Ribbon controls are generated via `scripts/gen.js` source (not hand-edited `ribbon-data.js`).
- Contextual tab shows ⇔ a header/footer editing session is active; never orphaned.
