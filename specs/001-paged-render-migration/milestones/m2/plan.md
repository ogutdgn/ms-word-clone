# Implementation Plan: Paged Render Migration — **Milestone 2** (pointer click hit-test routing)

**Feature**: `001-paged-render-migration` (umbrella) · **This plan covers ONLY Milestone 2**
**Branch (slice)**: `slice/m2-pointer-hit-test` (off `layout-engine`) · **Date**: 2026-06-19
**Spec**: [spec.md](spec.md) · **Runbook (authoritative sequencing)**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)
**M1 (done)**: design archived at [milestones/m1/](milestones/m1/) · adapter at `src/renderer/layout/coordinate-adapter.ts` (`WC.PM.coords`)

> **Scope note:** detailed design per slice. This is the **Milestone-2** plan. M3–M6 are out of scope.
> A future milestone's `/speckit-plan` archives this into `milestones/m2/` before overwriting `plan.md`.

## Summary

A real pointer click on a painted page must place the caret at the correct model position in paged mode
(spec US1 / FR-003 / SC-002). **Key research finding:** PresentationEditor **already has a complete,
enabled click→caret pipeline** — `EditorInputManager` binds pointer events to the painted `#viewportHost`,
hit-tests via `PresentationEditor.hitTest` (DOM-first + geometry fallback), dispatches a `TextSelection`
into the hidden inner editor, and focuses it. Single-click, double-click (word), triple-click (paragraph),
and drag-select are all implemented. Our boot enables it; there is no gate.

**The actual bug is a CONFLICT:** the overlay bridge's `focus.ts` margin-click handler
([focus.ts:60-96](../../src/renderer/bridge/focus.ts)) is document-level and fires whenever a click lands in
`#pm-editor` but not `.ProseMirror`. In paged mode the editable `.ProseMirror` is **hidden off-screen**, so
*every painted-page click* matches that condition → `focus.ts` runs `view.posAtCoords` against the hidden
view (wrong coordinate space), `preventDefault()`s, and re-focuses — **clobbering PE's correct selection**.

**M2 therefore = fix the conflict + migrate the seam + verify the full pointer surface.** No new click
router is built.

## Decisions (from planning Q&A)

1. **Conflict fix = mode guard.** `focus.ts`'s margin-click handler returns early when
   `__WC_LAYOUT_MODE === 'paged'` — PE owns ALL paged clicks (it has native margin/below-text handling).
   Chosen over a `.presentation-editor__viewport` target check: identical behavior here, but the mode guard
   directly expresses the invariant ("the active renderer owns its input") and is more Word-faithful for
   gutter clicks (focus.ts fully bails → gutter click does nothing, like Word).
2. **Consume the M1 seam.** Replace `focus.ts`'s remaining direct `view.posAtCoords({left,top})`
   (focus.ts:90) with `WC.PM.coords.clientToPos(x, y)` — the first real consumer of the M1 adapter.
   After the paged bail this path runs only in overlay, where the adapter delegates to `view.posAtCoords`
   identically (M1 parity-proven) → behavior-identical, zero risk.
3. **Verify the full pointer suite** (single / double / triple / drag), since PE already implements them and
   they all flow through the conflict fix. Triage rule: a *deep* PE-native pointer bug surfaced by the suite
   is flagged for a fix-vs-defer decision, not silently absorbed into M2.

## Technical Context

**Language/Version**: TypeScript (ESM) renderer; Electron 31.
**Primary Dependencies**: vendored PresentationEditor (`EditorInputManager`, `PositionHitResolver`, `hitTest`); the `WC.PM` bridge; the M1 `WC.PM.coords` adapter.
**Testing**: 3 gates (`test:pm` 475 / `test:smoke` 9 / `test:roundtrip` 27); `test:bundle` (4); a NEW synthetic-pointer probe; Word click-semantics as the behavioral reference.
**Target Platform**: Electron renderer (Chromium), Windows parity target.
**Performance Goals**: no overlay-default regression.
**Constraints**: model page-free; overlay byte-identical; paged behavior change reachable only under `WC_LAYOUT=paged`.
**Scale/Scope**: ~2-line guard + 1-line seam swap in `focus.ts`; one new probe (synthetic pointer events on painted pages, incl. a forced multi-page doc for boundary clicks). No fork edits (unless a triaged small wiring fix is approved).

## Constitution Check

`.specify/memory/constitution.md` is an unratified template; gates = project rules + runbook invariants.

| Gate | M2 compliance |
|------|---------------|
| Model stays page-free | ✅ M2 changes click routing only. |
| Overlay default byte-identical | ✅ Paged bail only affects paged; the overlay `clientToPos` swap is behavior-identical (M1 parity). |
| 3 gates green (475 / 9 / 27) | ✅ Required for done. |
| New behavior behind `WC_LAYOUT=paged` | ✅ The fix activates PE's paged click pipeline; overlay path unchanged. |
| Every slice independently verifiable | ✅ Synthetic-pointer probe + 3 gates + bundle gate. |

**Result: PASS — no violations.**

## Project Structure

```text
specs/001-paged-render-migration/
├── spec.md                  # umbrella (unchanged)
├── plan.md                  # THIS FILE — M2
├── research.md              # Phase 0 — the PE pipeline + focus.ts conflict map
├── data-model.md            # Phase 1 — pointer/selection entities
├── contracts/
│   └── pointer-routing.md   # the click→caret contract + the focus.ts gate
├── quickstart.md            # Phase 1 — how to verify M2
└── milestones/m1/           # archived M1 design
```

### Source Code — M2 touch set
```text
src/renderer/bridge/focus.ts     # EDIT — (a) paged-mode bail in the margin-click handler;
                                 #        (b) view.posAtCoords({left,top}) -> WC.PM.coords.clientToPos(x,y)
scripts/paged-pointer-probe.js   # NEW — synthetic DOM pointer events on painted pages (full suite + overlay parity)
package.json                     # EDIT — add probe:pointer runner
```

**Structure Decision**: M2 is a surgical conflict fix in WC-owned `focus.ts` + a new verification probe.
The click pipeline itself is PE's (vendored) — we do NOT edit the fork.

## Phase 0 — Research
See [research.md](research.md). Resolved: PE's full click→caret path (file:line); our boot enables it; the
exact `focus.ts` conflict mechanism; what's PE-native (build-free) vs. what M2 changes.

## Phase 1 — Design & Contracts
- **Entities**: [data-model.md](data-model.md) — PointerInteraction, the focus.ts gate condition, selection outcome.
- **Contract**: [contracts/pointer-routing.md](contracts/pointer-routing.md) — the paged click→caret contract (who owns clicks per mode) + the `focus.ts` gate + the seam migration.
- **Validation**: [quickstart.md](quickstart.md).

## Verification (definition of done for M2)
1. `npm run build` clean.
2. **3 gates** green — `test:pm` **475**, `test:smoke` **9**, `test:roundtrip` **27** (overlay unchanged).
3. **`test:bundle`** still 4/4 (no bundle regression).
4. **New synthetic-pointer probe** (`WC_LAYOUT=paged`): on a forced multi-page doc —
   - single click at a known glyph → `selection.from` ≈ that pos; typing inserts there;
   - single click near a page boundary (last line of page N / first line of N+1) → caret on the correct line (the overlay-misplacement sites);
   - double-click → word selection; triple-click → paragraph selection; drag → extended selection;
   - and an **overlay run**: the `focus.ts` margin-click still places the caret (seam swap behavior-identical).
5. **Word fidelity:** the probe's expectations encode Word's click semantics (in-text → that glyph; side margin → nearest text on the line; below-text → document end). COM-oracle is N/A for interactive caret placement (no docx artifact); behavioral parity is the acceptance basis.
6. **`/code-review`** on the slice; fix all findings; re-verify.

## Complexity Tracking
*No constitution violations — empty.*
