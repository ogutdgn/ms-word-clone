---
description: "Task list — Milestone 4c (ink-overlay retarget)"
---

# Tasks: Paged Render Migration — **Milestone 4c** (ink-overlay retarget)

**Input**: Design documents from `specs/001-paged-render-migration/`
**Prerequisites**: [plan.md](plan.md) (M4c scope) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/ink-overlay.md](contracts/ink-overlay.md) · [quickstart.md](quickstart.md)
**Sequencing authority**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)

## Scope & format
- **M4c ONLY** (sub-slice of M4). M4d (notes+header-footer) and M5–M6 out of scope.
- **Spike-corrected (see [research.md](research.md) ⚠️):** in-app paged ink ALREADY works. M4c **LOCKS** in-app
  correctness with a comprehensive probe **and FIXES the multi-page `.docx` EXPORT** (re-anchor the node to the draw
  page via `clientToPos` + persist page-local `posOffset`). Cross-page strokes **clamp to the start page**; overlay
  **byte-identical** (mode-branch). spec **US2 / FR-005 / SC-006**. All tasks Setup/Foundational/Verification/Polish →
  **no `[US#]` label**.
- `[P]` = parallelizable (different file, no incomplete-task dependency).

---

## Phase 1: Setup
- [ ] T001 Confirm on slice branch `slice/m4c-ink` (off `layout-engine`; NEVER off/onto `main`). Run `git branch --show-current` before any edit. (M4b/M4b.1 specs already archived to `specs/001-paged-render-migration/milestones/m4b/`.)

---

## Phase 2: Probe-FIRST spike — ✅ DONE (4 rounds; findings recorded in research.md)
- [x] T002 `scripts/paged-ink-spike.js` (4 rounds, `WC_LAYOUT=paged`) established: **(1)** `#pm-editor` is the VISIBLE paint host in paged (fills `#pages`, offset 0,0) → `localPt`/`sizeLayer` already resolve to `#pages`-local; **in-app capture+render+commit+tools ALREADY WORK** on page 0 AND page 1 (svg `zIndex:5`, `pointer-events` toggles, active layer captures). **(2)** `getElementAtPos`/`posToClientRect`/`computeCaretLayoutRect` all return **null for the anchored ink node**, but `computeCaretLayoutRect(nodePos−1).pageIndex` resolves the page. **(3)** `synthesizeInkDrawing` emits `wp:positionH/V relativeFrom='page'` `posOffset = pos` (vector-shape.js:137-138) → the persisted `#pages`-local `pos` is wrong for page 2+ export. **Conclusion:** the only defect is the multi-page EXPORT → re-anchor + page-local. *(done)*

---

## Phase 3: Foundational — seam methods (`src/renderer/layout/coordinate-adapter.ts`)
- [ ] T003 Add `clientToOverlayLocalPt(clientX, clientY): { x, y, pageIndex } | null` to the `CoordinateAdapter` interface + impl, per [contracts/ink-overlay.md](contracts/ink-overlay.md). Body: `const ps = pagesScale(); if (!ps) return null;` → `x=(clientX-ps.r.left)/ps.scale`, `y=(clientY-ps.r.top)/ps.scale`; **pageIndex**: scan `.superdoc-page[data-page-index]` (under `#pages`) for the rect containing `(clientX,clientY)` → its int index; overlay → `0`; gap/off-page/virtualized → `null`. Non-finite/missing `#pages` → `null`; try/catch → `null`. Promote the M4-DEFERRED comment at coordinate-adapter.ts:81. *(depends on T001)*
- [ ] T004 Add `overlayPageBox(pageIndex): {left,top,width,height}|null` to `coordinate-adapter.ts` — the `.superdoc-page[data-page-index]` box in `#pages`-local px (same `(clientRect-#pages.rect)/scale` as `nodeBoxFor`); `null` for a virtualized/missing page. (Spike confirmed `getElementAtPos` does NOT resolve ink nodes, so this is REQUIRED, not optional.) *(depends on T001)*

---

## Phase 4: The export fix + in-app consistency — `ink-overlay.ts` + `draw.ts` (ALL paged-branched on `window.__WC_LAYOUT_MODE === 'paged'`; overlay UNCHANGED = byte-identical)
- [ ] T005 In `src/renderer/bridge/draw.ts`: extend `dInsertInk(points, pen, pos, insertPos?)` with an OPTIONAL `insertPos` (a doc position). When given (paged re-anchor), insert the ink node at `insertPos` instead of the current selection — set a `TextSelection` at `insertPos` for the `insertContent`, so the node's anchor paragraph is on the draw page. No fork edit (`synthesizeInkDrawing` already emits `relativeFrom='page'` from `pos`; we only change the `pos` value + insertion point). Overlay callers pass no `insertPos` → unchanged. *(depends on T001)*
- [ ] T006 In `src/renderer/bridge/ink-overlay.ts` `onDown` (157), paged-branched: resolve the draw page ONCE — `const lp = WC.PM.coords.clientToOverlayLocalPt(e.clientX, e.clientY)` (pageIndex + `#pages`-local point) AND the draw doc position `const dp = WC.PM.coords.clientToPos(e.clientX, e.clientY)`; stash `{pageIndex, pageOrigin: overlayPageBox(pageIndex), drawDocPos: dp}` for `onUp` (clamp the whole stroke to this page). `setPointerCapture(e.pointerId)`. Overlay → unchanged. *(depends on T003, T004)*
- [ ] T007 In `ink-overlay.ts` `onUp` (191), paged-branched: persist `pos` = **page-LOCAL** = (`#pages`-local stroke bbox top-left) − `stashed.pageOrigin`; call `dInsertInk(strokePts, pen, pagePos, stashed.drawDocPos)` so the node anchors on the draw page with a correct page-local `posOffset`. `releasePointerCapture`. Overlay → the existing `#pm-editor`-local persist at the caret (unchanged). *(depends on T005, T006)*
- [ ] T008 In `ink-overlay.ts` `renderInk` FRESH strokes (286-309), paged-branched: `pos` is now page-local → resolve the node's page via `computeCaretLayoutRect(nodePos−1).pageIndex` (scan a few nearby positions for a finite pageIndex; null → fall back to the inkPos as-is) → `origin = WC.PM.coords.overlayPageBox(pageIndex)` → place the inkPoints at `(page-local pos + origin)` = `#pages`-local. Page 0 origin `(0,0)` → no-op. Overlay → the existing `inkPos`-px placement (unchanged). *(depends on T004)*
- [ ] T009 In `ink-overlay.ts` `renderInk` REOPENED `.paths` branch (310-325): **ONLY IF the T011 probe shows PE double-draws reopened ink in paged**, suppress this branch when `__WC_LAYOUT_MODE==='paged'` (PE owns reopened ink). If the probe shows no double-draw, leave it. Overlay → unchanged. *(depends on T011 finding)*

**Checkpoint**: a stroke drawn on page N still renders on page N in-app (unchanged) AND exports/reopens on page N (fixed); tools unaffected; overlay byte-identical.

---

## Phase 5: Verification artifact
- [ ] T010 Create `scripts/paged-ink-probe.js` (mode-aware `{summary,results[]}` JSON; fold the useful spike assertions in, then delete `scripts/paged-ink-spike.js`). **paged**: **in-app capture+render** — activate a pen, synthesize pointerdown+move+up on the active layer over page 1 AND page 2 (multi-page fixture); assert each committed `.pm-ink-stroke` lands inside the target `.superdoc-page[data-page-index]`; **tools** (synthetic eraser/select/lasso → right `vectorShape` via `data-ink-pos`); **page-local EXPORT round-trip** — draw on page 2, `export`→`openDocx`, assert the reopened stroke lands on page 2 (the crux gate; fails pre-fix); **reopened no-double-draw** (one render). **overlay**: a drawn stroke's `.pm-ink-stroke` `d`-strings + `svg.wc-ink-layer` geometry byte-identical to pre-M4c. Honest fail-returns (`(...&& false)`); no bug-hiding slack. *(depends on T003–T008)*
- [ ] T011 Add `probe:ink` to `package.json` → `electron . --probe-out=/tmp/wc-ink.json --shot-evalfile=scripts/paged-ink-probe.js`. Run it once to settle the T009 reopened-double-draw question. *(depends on T010)*

---

## Phase 6: VERIFY loop + close-out
- [ ] T012 `npm run build` (default/overlay), then the **3 gates** + bundle — `test:pm` (==**475**), `test:smoke` (==**9**), `test:roundtrip` (==**27**), `test:bundle` (4/4). *(depends on T005–T009)*
- [ ] T013 `WC_LAYOUT=paged npm run build` + run `paged-ink-probe.js` → all-PASS (in-app capture/render page 1+2, tools, page-2 export→reopen, reopened no-double-draw). Then default build + run it again → **overlay parity PASS** (byte-identical). *(depends on T010–T011, T012)*
- [ ] T014 Run **`/code-review`** on the slice diff (adversarial; scrutinize the mode-branch byte-identity, the re-anchor + page-local persist, the page-resolution, pointer-capture leaks, the probe for false-confidence). FIX every finding, then re-run T012–T013 until clean. *(depends on T012–T013)*
- [ ] T015 Commit per `.claude/skills/commit-style` (explicit `git add <path>`; what/why body; **no AI trailer**). Update the runbook **Current Status** (M4c done; M4d next) + memory. **At CHECK-IN, only after the user is satisfied:** leave the paged app open for a manual draw spot-check (computer-use blocked for the dev build), then ff-merge `slice/m4c-ink` into `layout-engine`. *(depends on T014)*

---

## Dependencies & execution order
- **T001 → all. T002 (spike) ✅ done.** **T003/T004 → T006/T008.** **T005 → T007.** **T006 → T007.** **T010 → T011.** **Verify**: T012 → T013 → T014 → T015. **T009 is gated on the T011 probe finding.**
- COM-oracle: **N/A** for live render positioning. The docx-fidelity touchpoint is the **export→reopen ink round-trip** (the probe's page-2 export row + `test:roundtrip`).

## Parallel opportunities
- T003 ∥ T004 ∥ T005 (different files / independent). T010 (probe) drafted ∥ the fix, finalized after.

## MVP / increment
"Done" = T012–T013 green + T014 clean + T015 merged → STOP, return to the runbook for **M4d** (notes-area disable in paged + header-footer integration test).

## Notes
- Keep the model **page-free**; keep the overlay default **byte-identical** (mode-branch; the parity rows are the gate).
- `ink-overlay.ts`/`draw.ts`/`coordinate-adapter.ts` are hand-authored owned modules (NOT generated) — safe to edit. **No fork edits.**
- Real-app paged verification is **BLOCKED** (computer-use can't target the dev Electron build) → headless probes are the gate.
