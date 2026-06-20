---
description: "Task list — Milestone 4b (image-resize overlay retarget)"
---

# Tasks: Paged Render Migration — **Milestone 4b** (image-resize overlay retarget)

**Input**: Design documents from `specs/001-paged-render-migration/`
**Prerequisites**: [plan.md](plan.md) (M4b scope) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/image-resize.md](contracts/image-resize.md) · [quickstart.md](quickstart.md)
**Sequencing authority**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)

## Scope & format
- **M4b ONLY** (sub-slice of M4). M4c (ink) / M4d (notes+header-footer) and M5–M6 out of scope.
- Retargets the image resize-handle overlay to the painted image in paged mode (spec **US2 / FR-005 / SC-006**) via two new `WC.PM.coords` methods, **overlay byte-identical**. All tasks Setup/Foundational/Verification/Polish → **no `[US#]` label**.
- `[P]` = parallelizable (different file, no incomplete-task dependency).

---

## Phase 1: Setup
- [ ] T001 Create slice branch `slice/m4b-image-resize` off `layout-engine` (NEVER off/onto `main`). Confirm `git branch --show-current` before any edit.

---

## Phase 2: Foundational — seam methods
- [ ] T002 In `src/renderer/layout/coordinate-adapter.ts`: add `nodeBoxFor(pos): {left,top,width,height}|null` and `overlayScale(): number` to the `CoordinateAdapter` interface + impl, per [contracts/image-resize.md](contracts/image-resize.md). `nodeBoxFor`: `el = deps.getEditor()?.getElementAtPos?.(pos)`; if `!el || typeof el.getBoundingClientRect !== 'function'` → null; `c = el.getBoundingClientRect()`; `ps = pagesScale()` (the existing M4a local); if `!ps` → null; return `{ left:(c.left-ps.r.left)/ps.scale, top:(c.top-ps.r.top)/ps.scale, width:c.width/ps.scale, height:c.height/ps.scale }` (guard non-finite → null). `overlayScale`: `const ps = pagesScale(); return ps ? ps.scale : 1`. Null-safe; try/catch → null/1.

---

## Phase 3: Consumer retarget
- [ ] T003 In `src/renderer/imageresize/image-resize.ts`: (a) `boxFor(pos)` delegates → `((window as any).WC?.PM?.coords?.nodeBoxFor?.(pos)) ?? null` (handle render, `.wc-img-move-region`, selection detection, the drag pipeline, `onDragUp`/`update` UNCHANGED); (b) `zoom()` delegates → `((window as any).WC?.PM?.coords?.overlayScale?.()) ?? (((window as any).WC?.PM?.zoom) || 1)` (so the drag deltas at lines ~237/341 use the SAME rendered scale as positioning); (c) add, ONCE (module-guarded), `window.addEventListener('wc:paged-relayout', () => this.update())` (or the plugin's update) so handles follow the image on a no-transaction reflow. *(depends on T002)*

**Checkpoint**: handles position on the painted image in paged; overlay byte-identical.

---

## Phase 4: Verification artifact
- [ ] T004 [P] Create `scripts/paged-image-resize-probe.js` — mode-aware (same `{summary,results[]}` JSON). INSERT an image (`WC.PM.insertImage(...)` with a tiny data-URI/blob, or the available bridge verb) and SELECT it as a `NodeSelection` over the `image` node; find the image model pos. **paged**: `nodeBoxFor(imagePos)` finite {left,top,width,height}; the rendered `#pages .wc-img-resize` overlay box ≈ `nodeBoxFor(imagePos)` (within tolerance); painted-aware (≠ the hidden `view.nodeDOM(imagePos).getBoundingClientRect()` #pages-local box); `overlayScale()` finite > 0. **overlay**: `nodeBoxFor(imagePos)` === the legacy `boxFor` formula (`(view.nodeDOM rect − #pages.rect)/WC.PM.zoom`); `overlayScale()` === `WC.PM.zoom`. If image-insert/selection proves unreliable headless, FALL BACK to generic `nodeBoxFor(anyPos)` correctness + parity and mark the image-specific rows INFO (honest). Avoid bug-hiding slack.
- [ ] T005 Add `probe:imageresize` to `package.json` → `electron . --probe-out=/tmp/wc-imageresize.json --shot-evalfile=scripts/paged-image-resize-probe.js`. *(depends on T004)*

---

## Phase 5: VERIFY loop + close-out
- [ ] T006 `npm run build` (default/overlay), then the **3 gates** + bundle — `test:pm` (==**475**), `test:smoke` (==**9**), `test:roundtrip` (==**27**), `test:bundle` (4/4). *(depends on T002–T003)*
- [ ] T007 `WC_LAYOUT=paged npm run build` + run `paged-image-resize-probe.js` → all-PASS (handle box ≈ nodeBoxFor; painted-aware). Then default build + run it again → **overlay parity PASS** — this is the gate that confirms `getElementAtPos` ≡ `view.nodeDOM` in overlay (the plan's flagged risk). *(depends on T004, T006)*
- [ ] T008 Run **`/code-review`** on the slice diff (adversarial; scrutinize nodeBoxFor byte-identity, the probe for false-confidence, the listener for leaks). FIX every finding, then re-run T006–T007 until clean. *(depends on T006–T007)*
- [ ] T009 Commit per `.claude/skills/commit-style` (explicit `git add`; what/why body; **no AI trailer**). Update the runbook **Current Status** (M4b done; M4c next). **At CHECK-IN, only after the user is satisfied:** leave the paged app open for a manual corner-drag spot-check (computer-use is blocked for the dev build), then ff-merge `slice/m4b-image-resize` into `layout-engine`. *(depends on T008)*

---

## Dependencies & execution order
- **T001** → all. **T002 → T003**. **T004 → T005** (∥ the fix). **Verify**: T006 → T007 → T008 → T009.
- COM-oracle: **N/A** for M4b (overlay-chrome positioning; no docx artifact). Live drag-resize gesture: **manual** (synthetic drag unreliable; computer-use blocked).

## Parallel opportunities
- T004/T005 (probe) ∥ T002/T003 (the fix).

## MVP / increment
M4b is the increment. "Done" = T006–T007 green + T008 clean + T009 merged → STOP, return to the runbook for **M4c** (ink-overlay — the hard one: `clientToOverlayLocalPt` + SVG must track the visible page + pointer capture).

## Notes
- Keep the model **page-free**; keep the overlay default **byte-identical** (delegations equal the legacy formulas).
- image-resize.ts is a hand-authored owned module (NOT generated) — safe to edit. No fork edits.
