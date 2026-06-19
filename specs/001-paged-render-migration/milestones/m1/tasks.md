---
description: "Task list — Milestone 1 (coordinate adapter + dynamic-import)"
---

# Tasks: Paged Render Migration — **Milestone 1** (shared per-page coordinate adapter + dynamic-import)

**Input**: Design documents from `specs/001-paged-render-migration/`
**Prerequisites**: [plan.md](plan.md) (M1 scope) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/coordinate-adapter.md](contracts/coordinate-adapter.md) · [quickstart.md](quickstart.md)
**Sequencing authority**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)

## Scope & format

- **M1 ONLY.** M2–M6 are out of scope (planned when reached).
- **M1 is the umbrella's Foundational layer** — it ships the coordinate **seam** (`WC.PM.coords`) +
  dynamic-import, but **rewires no consumer** (decision: *pure infra*). M2 (clicks), M3 (status bar),
  M4 (6 overlays) consume this seam later. Because every M1 task is Setup / Foundational / Verification /
  Polish, **no task carries a `[US#]` label** (per the checklist-format rules). Traceability: M1
  underpins **US1** (FR-001/002/003 — pages + caret seam) and **US2** (FR-005 — annotation rects, via the
  M4-deferred helpers), and directly satisfies **FR-008/FR-010/FR-012** (toggle-selectable, lean default,
  independently verifiable).
- `[P]` = parallelizable (different file, no dependency on an incomplete task).

---

## Phase 1: Setup

- [ ] T001 Create slice branch `slice/m1-coordinate-adapter` off `layout-engine` (NEVER off/onto `main`; runbook branch model). Confirm `git branch --show-current` == the slice branch before any edit.

---

## Phase 2: Foundational — the two M1 deliverables

**⚠️ This phase IS Milestone 1.** Two independent deliverables (A: adapter, B: dynamic-import).

### Deliverable A — the coordinate adapter seam

- [ ] T002 Create the adapter module `src/renderer/layout/coordinate-adapter.ts` implementing `createCoordinateAdapter(deps: CoordinateAdapterDeps): CoordinateAdapter` per [contracts/coordinate-adapter.md](contracts/coordinate-adapter.md). Core methods: `clientToPos(x,y)` → `deps.getEditor().posAtCoords({clientX:x,clientY:y})`; `posToClientRect(pos)` → `deps.getEditor().coordsAtPos(pos)`; `getPageCount()` → paged `editor.currentTotalPages` else `deps.getOverlayPageCount()`; `getPages()` → paged `deps.getPresentation().getPages()` else a length-only shim. **Null-safe** (return `null`/`0`/`[]`, never throw); **no re-clamp** of `pos`; read editor/presentation **through the getters every call** (remount-safe). Include the **M4-deferred** specialty-helper interface as a documented, NON-implemented comment block (image box / comment-anchor Y / track-bar rect / ink point).
- [ ] T003 Install the adapter at `WC.PM.coords` in `src/renderer/bridge/index.ts` during bridge install, wiring `deps`: `getEditor: () => WC.editor`, `getPresentation: () => WC.presentation ?? null`, `getOverlayPageCount: () => <current overlay page count from WC.PM.__pagination>`. Install must not throw when `WC.presentation` is absent (overlay mode). *(depends on T002)*

### Deliverable B — dynamic-import the paged path (bundle leanness, FR-010)

- [ ] T004 [P] Convert the paged path to a lazy import in `src/renderer/bridge/create-editor.ts`: delete the top-level `import { PresentationEditor } from '@core/presentation-editor/index.js'` (line ~14); inside `constructPresentationEditor`, fetch it lazily — `const { PresentationEditor } = await import('@core/presentation-editor/index.js')` — before `new (PresentationEditor as any)({...})`. The overlay path (`createPmEditor`/`constructPmEditor`) must import nothing new. Verify no other **eager** renderer module imports the PE subgraph (else the chunk won't split). *(independent of T002/T003 → [P])*

**Checkpoint**: adapter exists + installed; PE is behind a dynamic import. Overlay behavior unchanged.

---

## Phase 3: Verification artifacts (new harnesses)

- [ ] T005 [P] Create `scripts/paged-coords-probe.js` — a **mode-aware** headless probe (same `{summary,results[]}` JSON contract as `scripts/paged-spike-probe.js`). **paged** (`__WC_LAYOUT_MODE==='paged'`): assert `WC.PM.coords` exposes the 4 core methods; `getPageCount() === presentation.getPages().length` (>0); for a painted glyph at known client (x,y), `clientToPos(x,y)` → finite `pos` and `posToClientRect(pos)` center is within tolerance of (x,y) (client→pos→client round-trip). **overlay**: assert `clientToPos`/`posToClientRect` deep-equal the direct `view.posAtCoords({left,top})`/`view.coordsAtPos(pos)` for the same inputs (parity).
- [ ] T006 [P] Create `scripts/check-overlay-bundle.js` — build/inspect the **default (overlay)** renderer output; assert (a) the `PresentationEditor` subgraph lives in a **separate lazy chunk** (not the eager entry graph) and (b) eager renderer JS total ≤ a pinned threshold near the **~8.5 MB** baseline (would FAIL near the ~10.9 MB static-import regression). Exit non-zero on violation.
- [ ] T007 Add npm scripts to `package.json`: `test:bundle` → `node scripts/check-overlay-bundle.js`, and a convenience `probe:coords` runner mirroring how `paged-spike-probe.js` is launched. *(depends on T005, T006)*

---

## Phase 4: VERIFY loop + close-out (runbook per-milestone loop, step 4–5)

- [ ] T008 `npm run build` (default/overlay), then the **3 gates** — `npm run test:pm` (==**268**), `npm run test:smoke` (==**9**), `npm run test:roundtrip` (==**27**). Any deviation fails M1. *(depends on T002–T004)*
- [ ] T009 `WC_LAYOUT=paged npm run build` + run `scripts/paged-coords-probe.js` → all-PASS (round-trip + page count). Then default build + run the probe again for **overlay parity** → all-PASS. *(depends on T005, T008)*
- [ ] T010 `npm run build` (default) + `npm run test:bundle` → PASS (PE code-split; overlay near 8.5 MB). Pin the exact threshold in `scripts/check-overlay-bundle.js` from the measured size. *(depends on T006, T007)*
- [ ] T011 Run **`/code-review`** on the slice diff. **FIX every finding, then re-run T008–T010 until clean.** Do NOT proceed with unresolved findings. *(depends on T008–T010)*
- [ ] T012 Commit per `.claude/skills/commit-style` (explicit `git add <path>`; what/why body; **no AI trailer**). Update the runbook **Current Status** (M1 done, gates recorded). **At CHECK-IN, only after the user is satisfied:** ff-merge `slice/m1-coordinate-adapter` into `layout-engine`. *(depends on T011)*

---

## Dependencies & execution order

- **T001** (branch) → everything.
- **Deliverable A**: T002 → T003. **Deliverable B**: T004 (parallel to A).
- **Artifacts**: T005 ∥ T006 → T007.
- **Verify**: T008 (needs A+B) → T009 (needs probe+build) ; T010 (needs bundle script) → T011 (code-review, gates green) → T012 (close-out).
- COM-oracle: **N/A for M1** (no export/geometry behavior change) — record as N/A.

## Parallel opportunities

- T004 runs in parallel with T002/T003 (different file).
- T005 and T006 run in parallel (different new files).

## MVP / increment

M1 is itself the foundational increment — there is no sub-MVP. "Done" = T008–T010 all green + T011 clean
+ T012 merged. After merge, **STOP** and return to the runbook for Milestone 2 planning (one milestone at a time).

## Notes

- `[P]` = different files, no incomplete-task dependency.
- Keep the document model **page-free**; keep the overlay default **byte-identical**.
- All new render/behavior stays reachable only under `WC_LAYOUT=paged`; M1 rewires no consumer.
