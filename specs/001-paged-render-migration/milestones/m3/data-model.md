# Phase 1 Data Model — Milestone 3 (status bar → real page count)

M3 is a UI-derivation fix; its "entities" are the page indicator and the per-mode current-page source. No
storage, no document-model change (page counts are DERIVED, never stored — the model stays page-free).

## Entities

### `PageIndicator` (rendered)
The status-bar "Page X of Y" element (`statusbar.js` pageEl).
| field | type | source |
|-------|------|--------|
| `current` (X) | `number` (1-based) | `WC.PM.coords.getCurrentPage()` |
| `total` (Y) | `number` (1-based) | `WC.PM.coords.getPageCount()` |
| render | string | `'Page ' + Math.min(X, Y) + ' of ' + Y` (unchanged formula) |

### `CurrentPageSource` (per mode)
How X is computed.
| mode | source |
|------|--------|
| paged | `presentation.computeCaretLayoutRect(caret).pageIndex + 1` (0-based → 1-based); null → 1 |
| overlay | `__pagination.breaks.filter(b => b.pos <= caret).reduce((a,b)=>a+(b.pages||1),0) + 1` (verbatim from statusbar.js:70) |

`caret` = `editor.state.selection.from` (the bridge-bound editor; inner editor in paged mode).

### `RefreshTrigger`
What causes the bar to re-read X/Y.
| trigger | mode | wired |
|---------|------|-------|
| `transaction` / `selectionUpdate` → rAF → `StatusBar.update()` | both | existing (state-sync.ts) |
| `presentation.onLayoutUpdated()` → `StatusBar.update()` | paged | **NEW (M3)** — covers no-transaction re-pagination (zoom/reflow) |

## Validation rules / invariants
- **X ≤ Y** enforced by the render (`Math.min(X, Y)`), unchanged.
- **Page-free model:** counts are derived at read time; nothing writes a page count into the doc.
- **Overlay byte-identical:** overlay X formula and the render string are preserved exactly; the only change is
  *where* the formula lives (moved into the adapter), not *what* it computes.
- **Null-safety:** `getCurrentPage()` returns 1 when editor/presentation/`computeCaretLayoutRect` is absent or
  returns null; `getPageCount()` already returns ≥1 (M1).

## State / lifecycle
- No new persistent state. `getCurrentPage()`/`getPageCount()` read live each refresh.
- The `onLayoutUpdated` subscription is established in `installBridge` (paged only) and is implicitly current
  across `replaceEditor` because `installBridge` re-runs on Open/New.
