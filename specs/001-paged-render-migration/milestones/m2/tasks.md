---
description: "Task list — Milestone 2 (pointer click hit-test routing)"
---

# Tasks: Paged Render Migration — **Milestone 2** (pointer click hit-test routing)

**Input**: Design documents from `specs/001-paged-render-migration/`
**Prerequisites**: [plan.md](plan.md) (M2 scope) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/pointer-routing.md](contracts/pointer-routing.md) · [quickstart.md](quickstart.md)
**Sequencing authority**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)

## Scope & format

- **M2 ONLY.** M3–M6 out of scope.
- M2 is a **conflict-fix + verification** slice serving spec **US1 / FR-003 / SC-002** (a pointer click
  places the caret correctly on painted pages). PresentationEditor already routes clicks; M2 stops
  `focus.ts` from clobbering it and migrates focus.ts's overlay hit-test to the M1 `WC.PM.coords` seam.
  All tasks are Setup / Foundational / Verification / Polish → **no `[US#]` label** (per the format rules).
- `[P]` = parallelizable (different file, no incomplete-task dependency).

---

## Phase 1: Setup

- [ ] T001 Create slice branch `slice/m2-pointer-hit-test` off `layout-engine` (NEVER off/onto `main`). Confirm `git branch --show-current` before any edit.

---

## Phase 2: Foundational — the conflict fix (focus.ts)

Both edits are in the SAME margin-click handler (`src/renderer/bridge/focus.ts:60-96`) → sequential.

- [ ] T002 In `src/renderer/bridge/focus.ts`, the margin-click `mousedown` handler (starts line 60): add a **paged-mode bail** immediately after the existing early-returns (`button`, `target`, `WC.PM.active`, `#pm-editor`, `.ProseMirror`) — `if ((window as any).__WC_LAYOUT_MODE === 'paged') return`. Rationale comment: PresentationEditor's `EditorInputManager` owns ALL paged clicks (painted-page, margin, below-text); focus.ts's overlay margin heuristic mis-fires on every painted-page click (the editable `.ProseMirror` is hidden off-screen) and would clobber PE's selection.
- [ ] T003 In the same handler, migrate the hit-test (`focus.ts:90`): replace `const hit = view.posAtCoords({ left: x, top: y })` with `const hit = (window as any).WC?.PM?.coords?.clientToPos(x, y)`. Leave the clamp (`:87-89`), the below-text `Selection.atEnd` branch (`:81`), `view.focus()` and `e.preventDefault()` (`:94-95`) UNCHANGED. The existing `hit ? hit.pos : max` null-fallback already covers `clientToPos` returning null. *(depends on T002)*

**Checkpoint**: paged clicks reach PE unobstructed; overlay margin-click runs through the M1 seam (identical behavior).

---

## Phase 3: Verification artifact

- [ ] T004 [P] Create `scripts/paged-pointer-probe.js` — a **mode-aware** synthetic-DOM-pointer probe (same `{summary,results[]}` JSON contract as `scripts/paged-coords-probe.js`). Force a **multi-page** doc first (insert ~35k chars via `WC.view.dispatch(tr.insertText(...))`, as `paged-spike-probe.js` does). **paged**: for a known pos `P`, `rect = WC.PM.coords.posToClientRect(P)`; dispatch a real `pointerdown`+`pointerup` (`new PointerEvent(..., {clientX, clientY, button:0, pointerId:1, isPrimary:true, bubbles:true})`) at `rect` center on the element under those coords; assert `WC.editor.state.selection.from` is within tolerance of `P`; then insert a char and assert it landed at `P`. Also: a **boundary** click (last line of page N / first line of N+1) lands the caret on the correct line; **double-click** → word range (`from<to`); **triple-click** → paragraph range; **drag** (`pointerdown`→`pointermove`→`pointerup`) → extended range. **overlay**: a margin-region click still places a caret (focus.ts path via the adapter). Encode Word semantics (in-text→glyph, side-margin→nearest line, below-text→doc end). Avoid bug-hiding slack (tight tolerances; assert real selection change, not pass-by-omission).
- [ ] T005 Add `probe:pointer` to `package.json` → `electron . --probe-out=/tmp/wc-pointer.json --shot-evalfile=scripts/paged-pointer-probe.js`. *(depends on T004)*

---

## Phase 4: VERIFY loop + close-out (runbook per-milestone loop)

- [ ] T006 `npm run build` (default/overlay), then the **3 gates** + bundle — `test:pm` (==**475**), `test:smoke` (==**9**), `test:roundtrip` (==**27**), `test:bundle` (4/4). Any deviation fails M2. *(depends on T002–T003)*
- [ ] T007 `WC_LAYOUT=paged npm run build` + run `paged-pointer-probe.js` → all-PASS (single + boundary + double/triple/drag + typing). Then default build + run it again → overlay margin-click parity PASS. **Triage:** a deep PE-native pointer bug surfaced here is FLAGGED for a fix-vs-defer decision (not silently absorbed). *(depends on T004, T006)*
- [ ] T008 Run **`/code-review`** on the slice diff (ultracode: adversarial multi-agent — scrutinize the probe for false-confidence/bug-hiding slack and the focus.ts guard for overlay regressions). FIX every finding, then re-run T006–T007 until clean. Do NOT proceed with unresolved findings. *(depends on T006–T007)*
- [ ] T009 Commit per `.claude/skills/commit-style` (explicit `git add`; what/why body; **no AI trailer**). Update the runbook **Current Status** (M2 done; M3 next). **At CHECK-IN, only after the user is satisfied:** ff-merge `slice/m2-pointer-hit-test` into `layout-engine`. *(depends on T008)*

---

## Dependencies & execution order
- **T001** → everything. **T002 → T003** (same file). **T004 → T005** (∥ to the focus.ts edits).
- **Verify**: T006 (needs fix) → T007 (needs probe + build) → T008 (code-review) → T009 (close-out).
- COM-oracle: **N/A** for M2 (interactive caret placement produces no docx artifact; Word fidelity is behavioral, encoded in the probe).

## Parallel opportunities
- T004/T005 (the probe) run in parallel with T002/T003 (focus.ts) — different files.

## MVP / increment
M2 is itself the increment. "Done" = T006–T007 green + T008 clean + T009 merged → STOP, return to the runbook for M3 (status bar → getPages).

## Notes
- Keep the model **page-free**; keep the overlay default **byte-identical** (the paged bail is false in overlay; the `clientToPos` swap is M1-parity-identical).
- No fork edits (the click pipeline is PE's); M2's fix surface is `focus.ts` + the probe.
