---
description: "Task list — Milestone 4a (overlay retarget: helpers + comments + track-chrome)"
---

# Tasks: Paged Render Migration — **Milestone 4a** (overlay helpers + comments + track-chrome)

**Input**: Design documents from `specs/001-paged-render-migration/`
**Prerequisites**: [plan.md](plan.md) (M4a scope) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/overlay-helpers.md](contracts/overlay-helpers.md) · [quickstart.md](quickstart.md)
**Sequencing authority**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)

## Scope & format

- **M4a ONLY** (first sub-slice of M4). M4b (image-resize) / M4c (ink) / M4d (notes-disable + header-footer-test) and M5–M6 are out of scope.
- M4a retargets the comment + tracked-change overlays to the painted pages in paged mode (spec **US2 / FR-005 / SC-006**) via two new `WC.PM.coords` helpers, **overlay byte-identical**. All tasks are Setup / Foundational / Verification / Polish → **no `[US#]` label**.
- `[P]` = parallelizable (different file, no incomplete-task dependency).

---

## Phase 1: Setup
- [ ] T001 Create slice branch `slice/m4a-overlay-helpers-comments-track` off `layout-engine` (NEVER off/onto `main`). Confirm `git branch --show-current` before any edit.

---

## Phase 2: Foundational — helpers + the relayout event

- [ ] T002 In `src/renderer/layout/coordinate-adapter.ts`: add `posToOverlayLocalRect(pos): {top,bottom,left}|null` and `posToOverlayLocalY(pos): number|null` to the `CoordinateAdapter` interface + impl, per [contracts/overlay-helpers.md](contracts/overlay-helpers.md). Both = clamp `pos` to `[1, doc.content.size]` (via `deps.getEditor().view.state.doc.content.size`); `c = posToClientRect(clamped)` (the existing local helper — painted-aware in paged, identical in overlay); read `#pages` via `document.getElementById('pages')`, `scale = pages.offsetWidth ? rect.width/pages.offsetWidth : 1`; return `(c.top - rect.top)/(scale||1)` (rect form also bottom/left). **Verbatim ports** of track-chrome.ts:91-106 / comments-ui.ts:125-136 with ONLY `view.coordsAtPos`→`posToClientRect`. `posToOverlayLocalRect` returns null when `c` is null OR `c.top===0 && c.bottom===0` (the hidden-run guard). Null-safe throughout.
- [ ] T003 In `src/renderer/bridge/index.ts`: extend the M3 `presentation.onLayoutUpdated` handler (in `installBridge`) so it ALSO `window.dispatchEvent(new Event('wc:paged-relayout'))` (keep the existing `w.WC?.StatusBar?.update?.()` call). One line added inside the existing handler.

**Checkpoint**: the seam exposes overlay-local coords; paged relayout emits an event consumers can listen to.

---

## Phase 3: Consumer retargets (parallel — different files)

- [ ] T004 [P] In `src/renderer/bridge/comments-ui.ts`: make `localY(pos)` delegate to `((window as any).WC?.PM?.coords?.posToOverlayLocalY?.(pos)) ?? null` (keep the function name + all call sites). Add, once in `installCommentsUI`, `window.addEventListener('wc:paged-relayout', () => schedule())` (use the existing `schedule`/debounced refresh). *(depends on T002, T003)*
- [ ] T005 [P] In `src/renderer/bridge/track-chrome.ts`: make `localRect(pos)` delegate to `((window as any).WC?.PM?.coords?.posToOverlayLocalRect?.(pos)) ?? null` (keep the name + `rectWithFallback` + bar/balloon stacking + the comment-card collision detection unchanged). Add, once in `installTrackChrome`, `window.addEventListener('wc:paged-relayout', () => schedule())`. *(depends on T002, T003; different file from T004 → [P])*

---

## Phase 4: Verification artifact

- [ ] T006 [P] Create `scripts/paged-overlays-probe.js` — mode-aware (same `{summary,results[]}` JSON contract). Force a multi-page doc; add a comment + a tracked change (via the `WC.PM` verbs / fixtures available). **paged**: `posToOverlayLocalY`/`posToOverlayLocalRect` return finite #pages-local coords for an anchor on a painted page and `null` for an off-page anchor; the rendered comment card top (`#wc-comments-overlay .wc-cc-card`/glyph) ≈ `posToOverlayLocalY(anchor)`; the rendered change bar top (`#wc-track-chrome .wc-track-bar`) ≈ `posToOverlayLocalRect(anchor).top` (within tolerance); dispatching `wc:paged-relayout` repositions both. **overlay**: `posToOverlayLocalY`/`Rect` === the legacy `localY`/`localRect` formula for the same pos (parity); rendered chrome byte-identical. Avoid bug-hiding slack (assert finite/near-equal, not just "exists").
- [ ] T007 Add `probe:overlays` to `package.json` → `electron . --probe-out=/tmp/wc-overlays.json --shot-evalfile=scripts/paged-overlays-probe.js`. *(depends on T006)*

---

## Phase 5: VERIFY loop + close-out

- [ ] T008 `npm run build` (default/overlay), then the **3 gates** + bundle — `test:pm` (==**475**), `test:smoke` (==**9**), `test:roundtrip` (==**27**), `test:bundle` (4/4). *(depends on T002–T005)*
- [ ] T009 `WC_LAYOUT=paged npm run build` + run `paged-overlays-probe.js` → all-PASS (anchoring + relayout). Then default build + run it again → overlay parity PASS (chrome byte-identical). *(depends on T006, T008)*
- [ ] T010 Run **`/code-review`** on the slice diff (adversarial; scrutinize the helpers for overlay byte-identity, the probe for false-confidence, the event listeners for leaks/double-add). FIX every finding, then re-run T008–T009 until clean. *(depends on T008–T009)*
- [ ] T011 Commit per `.claude/skills/commit-style` (explicit `git add`; what/why body; **no AI trailer**). Update the runbook **Current Status** (M4a done; M4b next). **At CHECK-IN, only after the user is satisfied:** ff-merge `slice/m4a-overlay-helpers-comments-track` into `layout-engine`. *(depends on T010)*

---

## Dependencies & execution order
- **T001** → all. **T002 + T003** (foundational) → **T004 ∥ T005** (consumers). **T006 → T007** (∥ the fix). **Verify**: T008 → T009 → T010 → T011.
- COM-oracle: **N/A** for M4a (overlay-chrome positioning; no docx artifact).

## Parallel opportunities
- T004 (comments-ui) ∥ T005 (track-chrome). T006/T007 (probe) ∥ the fix.

## MVP / increment
M4a is the increment. "Done" = T008–T009 green + T010 clean + T011 merged → STOP, return to the runbook for **M4b** (image-resize: retarget via `nodeBoxFor`, or disable if PE's ImageInteractionLayer already draws handles — verify first).

## Notes
- Keep the model **page-free**; keep the overlay default **byte-identical** (helpers = verbatim ports; consumers delegate).
- comments-ui/track-chrome are hand-authored bridge modules (NOT generated) — safe to edit.
