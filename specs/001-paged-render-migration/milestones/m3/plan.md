# Implementation Plan: Paged Render Migration — **Milestone 3** (status bar → real page count)

**Feature**: `001-paged-render-migration` (umbrella) · **This plan covers ONLY Milestone 3**
**Branch (slice)**: `slice/m3-status-bar-pages` (off `layout-engine`) · **Date**: 2026-06-20
**Spec**: [spec.md](spec.md) · **Runbook**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)
**M1/M2 (done)**: archived at [milestones/m1/](milestones/m1/), [milestones/m2/](milestones/m2/) · adapter at `src/renderer/layout/coordinate-adapter.ts` (`WC.PM.coords`)

> **Scope note:** M4–M6 out of scope. A future milestone's `/speckit-plan` archives this into `milestones/m3/`.

## Summary

In paged mode the status bar shows **"Page 1 of 1"** — both numbers are wrong, because both read the
overlay decoration-paginator's `WC.PM.__pagination` (null in paged mode). M3 makes **"Page X of Y"** correct
and caret-tracking in paged mode, with **zero overlay regression**.

**Research findings (grounded):**
- `statusbar.js:71` renders `'Page ' + min(cur, pageCount) + ' of ' + pageCount`. Total **Y** = `__pagination.pageCount` (statusbar.js:66); current **X** = a break-scan over `__pagination.breaks` vs the caret (statusbar.js:70). Both overlay-only.
- The status bar refreshes via `state-sync.ts:286` on `transaction` + `selectionUpdate` (rAF-coalesced). **Gap:** in paged mode PE can re-paginate WITHOUT a transaction (zoom, reflow) → the bar goes stale.
- PE exposes current-page: **`computeCaretLayoutRect(pos)` → `{ pageIndex, … } | null`** (PresentationEditor.ts:10253, 0-based) and a public **`onLayoutUpdated(handler)`** (PE.ts:2021). Total Y already comes from the M1 seam `WC.PM.coords.getPageCount()` (paged → `editor.currentTotalPages`; overlay → `__pagination.pageCount`).

## Decisions (from planning Q&A)

1. **Fix BOTH X and Y.** A half-fix ("Page 1 of 12" with X stuck at 1) is more confusing than today's "1 of 1".
2. **Put current-page on the seam.** Add `WC.PM.coords.getCurrentPage()` (mode-agnostic: paged → `presentation.computeCaretLayoutRect(caret).pageIndex + 1`; overlay → the existing `__pagination.breaks` scan moved **verbatim**). `statusbar.js` reads only `getPageCount()` + `getCurrentPage()` — it never reaches into PE or `__pagination` directly (M1's single-seam philosophy; chosen over inline branching in statusbar.js).
3. **Add a paged refresh trigger.** Subscribe `presentation.onLayoutUpdated(() => WC.StatusBar.update())` so the bar refreshes when PE re-paginates without a transaction. Overlay path keeps its transaction/selection triggers unchanged.

## Technical Context

**Language/Version**: TypeScript (adapter) + vanilla JS (statusbar.js) on the `window.WC` namespace; Electron 31.
**Primary Dependencies**: the M1 `WC.PM.coords` adapter; PE `computeCaretLayoutRect` / `getPages` / `onLayoutUpdated`; `state-sync.ts` refresh; `statusbar.js` render.
**Testing**: 3 gates (475/9/27) + `test:bundle` (4); a NEW status-bar/page probe (paged correctness + overlay parity).
**Target Platform**: Electron renderer; Windows parity target.
**Constraints**: model page-free; **overlay byte-identical** (break-scan moved verbatim; render unchanged); paged behavior behind `WC_LAYOUT=paged`.
**Scale/Scope**: add `getCurrentPage()` to the adapter (+ a dep to read overlay breaks); rewire `statusbar.js` 2 reads (Y, X); add one `onLayoutUpdated` subscription in `installBridge`. One new probe.

## Constitution Check

Unratified template; gates = project rules + runbook invariants.

| Gate | M3 compliance |
|------|---------------|
| Model page-free | ✅ read-only page-count derivation. |
| Overlay byte-identical | ✅ break-scan moved verbatim into the adapter; statusbar render + overlay triggers unchanged; gate-verified. |
| 3 gates (475/9/27) + bundle 4 | ✅ required for done. |
| New behavior behind `WC_LAYOUT=paged` | ✅ paged branch only active when `presentation` present; `onLayoutUpdated` only subscribed in paged. |
| Every slice independently verifiable | ✅ status-bar probe + gates. |
| No hand-edit of generated files | ✅ `statusbar.js` is hand-authored (not generated); `ribbon-data.js`/`icons-fluent.js` untouched. |

**Result: PASS.**

## Project Structure

```text
specs/001-paged-render-migration/
├── spec.md · plan.md (THIS) · research.md · data-model.md
├── contracts/status-bar-pages.md   # the getCurrentPage()/getPageCount() + render + trigger contract
├── quickstart.md
└── milestones/{m1,m2}/             # archived
```

### Source Code — M3 touch set
```text
src/renderer/layout/coordinate-adapter.ts  # ADD getCurrentPage() (+ overlay-breaks dep); export type
src/renderer/bridge/index.ts               # wire getCurrentPage dep; subscribe presentation.onLayoutUpdated -> WC.StatusBar.update() (paged only)
src/renderer/public/js/statusbar.js        # read Y via WC.PM.coords.getPageCount(); X via WC.PM.coords.getCurrentPage()
scripts/paged-statusbar-probe.js           # NEW — paged "Page X of Y" correctness + caret-tracking + overlay parity
package.json                               # add probe:statusbar
```

**Structure Decision**: current-page logic is centralized on the WC-owned `WC.PM.coords` seam; `statusbar.js`
becomes a thin consumer. No fork edits (PE's `computeCaretLayoutRect`/`onLayoutUpdated` are consumed, not changed).

## Phase 0 — Research
See [research.md](research.md). Resolved: the render + both data sources (file:line); the refresh trigger + its
no-transaction gap; PE's current-page API; the overlay current-page formula (moved verbatim); the wiring seam.

## Phase 1 — Design & Contracts
- **Entities**: [data-model.md](data-model.md) — PageIndicator (X/Y), the per-mode current-page source, the refresh triggers.
- **Contract**: [contracts/status-bar-pages.md](contracts/status-bar-pages.md) — `getCurrentPage()`/`getPageCount()` semantics per mode, the statusbar render contract, the `onLayoutUpdated` trigger.
- **Validation**: [quickstart.md](quickstart.md).

## Verification (definition of done for M3)
1. `npm run build` clean.
2. **3 gates** green — `test:pm` **475**, `test:smoke` **9**, `test:roundtrip` **27** (overlay unchanged) — and `test:bundle` 4/4.
3. **New status-bar probe** (`WC_LAYOUT=paged`, multi-page doc): `getPageCount()` === `presentation.getPages().length`; `getCurrentPage()` === `computeCaretLayoutRect(caret).pageIndex + 1`; moving the caret from page 0 to a later page updates X; the rendered `"Page X of Y"` text matches; a no-transaction relayout still refreshes the bar (the `onLayoutUpdated` trigger).
4. **Overlay parity** (default build): `getCurrentPage()` equals the legacy break-scan result; `getPageCount()` equals `__pagination.pageCount`; rendered text byte-identical to today.
5. **`/code-review`** on the slice; fix all findings; re-verify.

COM-oracle: **N/A** (status-bar UI; no docx artifact).

## Complexity Tracking
*No constitution violations — empty.*
