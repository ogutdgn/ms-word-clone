# Phase 0 Research — Milestone 3 (status bar → real page count)

Grounded in a read-only sweep of `statusbar.js`, `state-sync.ts`, the M1 adapter, and the vendored
PresentationEditor. File:line references are exact.

## Finding 1 — The status-bar render + its two overlay-only data sources

- `src/renderer/public/js/statusbar.js:71` renders `pageEl.textContent = 'Page ' + Math.min(cur, pg.pageCount || 1) + ' of ' + (pg.pageCount || 1)`.
- **Total Y** (`statusbar.js:66`): `const pg = WC.PM.__pagination || { pageCount: c.pages || 1, breaks: [] }` — i.e. the overlay decoration-paginator's count (`c.pages` ← `WC.PM.counts()` ← `io.ts:49` ← `__pagination.pageCount`).
- **Current X** (`statusbar.js:70`): `cur = (pg.breaks || []).filter(b => b.pos <= caret).reduce((a,b) => a + (b.pages||1), 0) + 1`, where `caret = WC.view.state.selection.from`. The breaks come from `pagination.ts:664` (`{ pos, height, pages: bands.length||1 }`).
- **In paged mode** `__pagination` is null → `pg` falls back to `{ pageCount: 1, breaks: [] }` → renders **"Page 1 of 1"**, regardless of the real layout.

## Finding 2 — Refresh trigger + the no-transaction gap

- `state-sync.ts` `installStateSync` registers `editor.on('transaction', schedule)` and `editor.on('selectionUpdate', schedule)` (≈:297-298); `schedule` rAF-coalesces into `sync()`, which calls `WC?.StatusBar?.update?.()` (state-sync.ts:286). (`app.js:137-138` wraps `StatusBar.update` to also touch the dirty flag.)
- **Decision:** add a paged-only `presentation.onLayoutUpdated(() => WC.StatusBar.update())` subscription.
- **Rationale:** in paged mode PE can re-paginate WITHOUT a doc transaction (zoom, reflow) → the existing
  transaction/selection triggers do not fire → the bar goes stale. `onLayoutUpdated` (PE.ts:2021) is the public
  hook that fires on every (re)layout. Overlay keeps its existing triggers (no `onLayoutUpdated` there).

## Finding 3 — PE exposes current-page; total already on the seam

- **Decision:** current-page in paged mode = `presentation.computeCaretLayoutRect(caret).pageIndex + 1`.
- `PresentationEditor.computeCaretLayoutRect(pos)` (PE.ts:10253) → `{ pageIndex, x, y, height } | null` (0-based
  `pageIndex`); internally DOM-first (`#computeDomCaretPageLocal`) with a geometry fallback
  (`#getCurrentPageIndex` scans `layout.pages[].fragments[].pmStart/pmEnd`). Returns null if unresolved → caller defaults to page 1.
- Total **Y** needs no new primitive: `WC.PM.coords.getPageCount()` already returns `editor.currentTotalPages`
  (= `presentation.getPages().length`, Editor.ts:642) in paged and `__pagination.pageCount` in overlay (M1).
- **Alternative considered:** derive X by scanning `getPages()[].fragments[].pmStart/pmEnd` ourselves — rejected;
  `computeCaretLayoutRect` already does exactly this (DOM-first, more accurate) and is the PE-owned path.

## Finding 4 — Overlay current-page moves verbatim (keep byte-identical)

- The overlay formula (`statusbar.js:70`) is the only correct overlay current-page source and MUST be preserved
  exactly. **Decision:** move it verbatim into `WC.PM.coords.getCurrentPage()`'s overlay branch (reading
  `__pagination.breaks` via a dep), so `statusbar.js` becomes a thin consumer and overlay output is unchanged.

## Finding 5 — Wiring seam (the cleanest integration)

- **Decision:** `WC.PM.coords.getCurrentPage()` (new) + `getPageCount()` (existing) are the two reads
  `statusbar.js` makes. The adapter (`src/renderer/layout/coordinate-adapter.ts`) gains `getCurrentPage()` and a
  dep to read the overlay pagination breaks; `bridge/index.ts` wires that dep and adds the `onLayoutUpdated`
  subscription (paged only). statusbar.js never touches PE/`__pagination` directly.
- **Rationale:** single seam (M1 philosophy), one mode-branch, reusable by M4; overlay logic centralized + verbatim.

## Open questions
None blocking. COM-oracle N/A (status-bar UI yields no docx artifact). Edge cases to cover in the probe: empty/
single-page doc (X=Y=1), caret at a page boundary, rapid updates (rAF-coalesced), `computeCaretLayoutRect` null.
