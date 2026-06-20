---
description: "Task list — Milestone 3 (status bar → real page count)"
---

# Tasks: Paged Render Migration — **Milestone 3** (status bar → real page count)

**Input**: Design documents from `specs/001-paged-render-migration/`
**Prerequisites**: [plan.md](plan.md) (M3 scope) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/status-bar-pages.md](contracts/status-bar-pages.md) · [quickstart.md](quickstart.md)
**Sequencing authority**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)

## Scope & format

- **M3 ONLY.** M4–M6 out of scope.
- M3 makes the status-bar **"Page X of Y"** correct + caret-tracking in paged mode (spec **US1 / FR-002**) by
  consuming the M1 `WC.PM.coords` seam, with overlay output **byte-identical**. All tasks are Setup /
  Foundational / Verification / Polish → **no `[US#]` label** (per the format rules).
- `[P]` = parallelizable (different file, no incomplete-task dependency).

---

## Phase 1: Setup

- [ ] T001 Create slice branch `slice/m3-status-bar-pages` off `layout-engine` (NEVER off/onto `main`). Confirm `git branch --show-current` before any edit.

---

## Phase 2: Foundational — the fix

- [ ] T002 In `src/renderer/layout/coordinate-adapter.ts`: add `getCurrentPage(): number` to the `CoordinateAdapter` interface + impl (per [contracts/status-bar-pages.md](contracts/status-bar-pages.md)). paged (`deps.getPresentation()` present): `caret = editor.state.selection.from`; `r = presentation.computeCaretLayoutRect(caret)`; return `Number.isFinite(r?.pageIndex) ? r.pageIndex + 1 : 1`. overlay: scan the overlay pagination breaks **verbatim** from statusbar.js:70 — `breaks.filter(b => b.pos <= caret).reduce((a,b)=>a+(b.pages||1),0) + 1`. Null-safe (no editor → 1). Add a dep `getOverlayPagination(): { breaks?: any[] } | null` to `CoordinateAdapterDeps` so the break-scan reads breaks through a getter (mirrors `getOverlayPageCount`); read `editor.state.selection.from` defensively.
- [ ] T003 In `src/renderer/bridge/index.ts`: (a) wire the new `getOverlayPagination: () => ((window as any).WC?.PM?.__pagination ?? null)` dep into the `createCoordinateAdapter({...})` call in `preinstallBridge`; (b) in `installBridge`, subscribe the paged refresh trigger — `const pe = (window as any).WC?.presentation; if (pe && typeof pe.onLayoutUpdated === 'function') pe.onLayoutUpdated(() => (window as any).WC?.StatusBar?.update?.())`. Overlay path keeps its existing transaction/selection triggers untouched. *(depends on T002)*
- [ ] T004 [P] In `src/renderer/public/js/statusbar.js`: read the total **Y** via `WC.PM.coords.getPageCount()` (fallback `c.pages || 1`) and current **X** via `WC.PM.coords.getCurrentPage()` (fallback `1`); keep the render formula `'Page ' + Math.min(X, Y) + ' of ' + Y` (statusbar.js:71) UNCHANGED. Remove the direct `WC.PM.__pagination` read + the inline break-scan (now in the adapter). *(depends on T002; different file from T003 → [P] with it)*

**Checkpoint**: paged "Page X of Y" reads the seam (correct count + caret page); overlay output byte-identical.

---

## Phase 3: Verification artifact

- [ ] T005 [P] Create `scripts/paged-statusbar-probe.js` — mode-aware (same `{summary,results[]}` JSON contract). Force a multi-page doc. **paged**: `WC.PM.coords.getPageCount()` === `presentation.getPages().length` (>1) === the `Y` in the rendered `#`-status text; caret on page 0 → `getCurrentPage()` === 1; move caret to a pos on a later page → `getCurrentPage()` === `computeCaretLayoutRect(pos).pageIndex + 1` (>1) and the rendered `X` matches; after a no-transaction relayout (`WC.PM.setZoom(...)`) + `WC.StatusBar.update()`, the rendered text equals the live counts (the `onLayoutUpdated` trigger). **overlay**: `getCurrentPage()` === the legacy `__pagination.breaks` scan; `getPageCount()` === `__pagination.pageCount`; rendered text byte-identical to pre-M3. Read the status-bar text from the live pageEl DOM (`document.querySelector('.sb-item')` / the page span) after `WC.StatusBar.update()`. Avoid bug-hiding slack (assert exact values, not just ">0").
- [ ] T006 Add `probe:statusbar` to `package.json` → `electron . --probe-out=/tmp/wc-statusbar.json --shot-evalfile=scripts/paged-statusbar-probe.js`. *(depends on T005)*

---

## Phase 4: VERIFY loop + close-out (runbook per-milestone loop)

- [ ] T007 `npm run build` (default/overlay), then the **3 gates** + bundle — `test:pm` (==**475**), `test:smoke` (==**9**), `test:roundtrip` (==**27**), `test:bundle` (4/4). Any deviation fails M3. *(depends on T002–T004)*
- [ ] T008 `WC_LAYOUT=paged npm run build` + run `paged-statusbar-probe.js` → all-PASS (total + caret-tracking X + trigger). Then default build + run it again → overlay parity PASS (render byte-identical). *(depends on T005, T007)*
- [ ] T009 Run **`/code-review`** on the slice diff (adversarial; scrutinize the probe for false-confidence and the adapter/statusbar change for overlay regressions). FIX every finding, then re-run T007–T008 until clean. *(depends on T007–T008)*
- [ ] T010 Commit per `.claude/skills/commit-style` (explicit `git add`; what/why body; **no AI trailer**). Update the runbook **Current Status** (M3 done; M4 next). **At CHECK-IN, only after the user is satisfied:** ff-merge `slice/m3-status-bar-pages` into `layout-engine`. *(depends on T009)*

---

## Dependencies & execution order
- **T001** → everything. **T002 → T003** (T003 wires the dep T002 declares) and **T002 → T004**. T003 ∥ T004 (different files). **T005 → T006** (∥ to the fix). **Verify**: T007 → T008 → T009 → T010.
- COM-oracle: **N/A** for M3 (status-bar UI; no docx artifact).

## Parallel opportunities
- T003 (index.ts) ∥ T004 (statusbar.js) once T002 lands. T005/T006 (probe) ∥ the fix.

## MVP / increment
M3 is itself the increment. "Done" = T007–T008 green + T009 clean + T010 merged → STOP, return to the runbook for M4 (retarget the 6 overlays to the painted per-page DOM).

## Notes
- Keep the model **page-free**; keep the overlay default **byte-identical** (break-scan moved verbatim; render unchanged).
- statusbar.js is hand-authored (NOT generated) — safe to edit; do not touch `ribbon-data.js`/`icons-fluent.js`.
