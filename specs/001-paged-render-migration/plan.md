# Implementation Plan: Paged Render Migration — **Milestone 1** (shared per-page coordinate adapter + dynamic-import)

**Feature**: `001-paged-render-migration` (umbrella) · **This plan covers ONLY Milestone 1**
**Branch (slice)**: `slice/m1-coordinate-adapter` (off `layout-engine`) · **Date**: 2026-06-19
**Spec**: [spec.md](spec.md) · **Runbook (authoritative sequencing)**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)

> **Scope note (per runbook "Scope = A"):** detailed design is produced **per slice**. This `plan.md`
> is the **Milestone-1** plan. M2–M6 are explicitly **out of scope** here and will be planned when
> reached. A future milestone's `/speckit-plan` should archive this M1 design (e.g. into
> `milestones/m1/`) before overwriting `plan.md`.

## Summary

Milestone 1 delivers the **foundation** for the paged render migration with **zero user-visible
behavior change** (decision: *pure infra*):

1. A **shared, mode-aware coordinate adapter** (`src/renderer/layout/coordinate-adapter.ts`, surfaced
   as `WC.PM.coords`) that is the single seam for client↔model coordinate mapping and page enumeration.
   Later milestones route their consumers through it instead of touching `editor.view.*` directly.
2. **Dynamic-import of the paged path** so the heavy `PresentationEditor` subgraph is code-split out of
   the default (overlay) bundle, restoring it to its lean baseline.

**Key enabling discovery (research):** the vendored `Editor` **already** abstracts the mode difference —
`Editor.coordsAtPos` → `presentationEditor.coordsAtPos` ([Editor.ts:2053](../../src/renderer/core/superdoc-fork/core/Editor.ts)),
`Editor.posAtCoords` → `presentationEditor.hitTest` (Editor.ts:2102),
`Editor.currentTotalPages` → `presentationEditor.getPages().length` (Editor.ts:642), and the
`PresentationEditor` wires the **inner** editor's back-reference
(`#editor.presentationEditor = this`, [PresentationEditor.ts:933](../../src/renderer/core/superdoc-fork/core/presentation-editor/PresentationEditor.ts)).
Our bridge binds to that inner editor, so the adapter's **core methods are mode-agnostic delegations to
`editor.*` (NOT `editor.view.*`)**. The overlay consumers' latent paged-mode bug is precisely that they
call `editor.view.coordsAtPos` / `view.posAtCoords` directly, bypassing this delegation.

## Technical Context

**Language/Version**: TypeScript (ESM) on the electron-vite renderer build; Electron 31 shell.
**Primary Dependencies**: vendored SuperDoc fork (`@core/*`, `@superdoc/layout-bridge`, `@superdoc/contracts`); the `WC.PM` bridge (`src/renderer/bridge/*`); the vendored `PresentationEditor`.
**Storage**: N/A (render layer).
**Testing**: Node test harness — `scripts/test-suite-pm.js` (test:pm), `test:smoke`, `test:roundtrip`; headless Electron probe (`scripts/paged-spike-probe.js` pattern) for paged-mode adapter assertions; a new overlay-bundle-size check.
**Target Platform**: Electron renderer (Chromium), Windows native parity target.
**Project Type**: Desktop app (Electron, single renderer).
**Performance Goals**: default (overlay) startup/bundle must not regress (FR-010); paged path is lazy.
**Constraints**: model stays **page-free** (invariant); overlay default stays **byte-identical**; all new render behind `WC_LAYOUT=paged`.
**Scale/Scope**: one new ~150-line adapter module + one import-shape change in `create-editor.ts` + one new bundle-size check + one new probe. No consumer is rewired in M1.

## Constitution Check

*GATE: must pass before Phase 0; re-checked post-design.*

`.specify/memory/constitution.md` is an **unratified template** (no project-specific principles).
The de-facto gates are the project working rules ([CLAUDE.md](../../CLAUDE.md), [AGENTS.md](../../AGENTS.md))
and the runbook invariants:

| Gate | M1 compliance |
|------|---------------|
| Model stays page-free | ✅ M1 touches no model/schema; adds a read-only coordinate seam. |
| Overlay default byte-identical | ✅ No consumer rewired; adapter is added but unused by overlay paths; dynamic-import is behavior-preserving. |
| 3 gates green (268 / 9 / 27) | ✅ Required for "done"; overlay path unchanged. |
| New render behind `WC_LAYOUT=paged` | ✅ Adapter's paged branch only activates when `presentationEditor` is present (paged boot). |
| Every slice independently verifiable | ✅ Probe + 3 gates + bundle check. |
| No hand-edit of generated files | ✅ Not touched. |

**Result: PASS — no violations, Complexity Tracking not required.**

## Project Structure

### Documentation (this feature)

```text
specs/001-paged-render-migration/
├── spec.md              # umbrella feature spec (already written)
├── plan.md              # THIS FILE — Milestone 1 plan
├── research.md          # Phase 0 — the delegation discovery + surface map + decisions
├── data-model.md        # Phase 1 — coordinate entities/types
├── contracts/
│   └── coordinate-adapter.md   # the WC.PM.coords interface contract (core now; M4 helpers documented-deferred)
└── quickstart.md        # Phase 1 — how to verify M1 (probe + gates + bundle check)
```

### Source Code (repository root) — M1 touch set

```text
src/renderer/
├── layout/                         # NEW — WC-owned glue for the paged migration (sibling to bridge/, pagination/)
│   └── coordinate-adapter.ts       # NEW — createCoordinateAdapter(...) → { clientToPos, posToClientRect, getPageCount, getPages }
├── bridge/
│   ├── create-editor.ts            # EDIT — static `import { PresentationEditor }` → lazy `await import()` (code-split)
│   └── index.ts                    # EDIT — install adapter onto WC.PM.coords during bridge install
scripts/
├── paged-coords-probe.js           # NEW — headless probe: paged-mode adapter round-trip + overlay parity
└── check-overlay-bundle.js         # NEW — bundle-size gate: assert PE is code-split out of the eager overlay graph
package.json                        # EDIT — add `test:bundle` (and optionally a probe runner) script
```

**Structure Decision**: WC-owned migration glue lives under `src/renderer/layout/` (NOT under
`src/renderer/core/`, which is the vendored fork we keep out of). The adapter is consumed by `WC.PM`
bridge code and exposed on `WC.PM.coords` for probe + later-milestone consumers.

## Phase 0 — Research

See [research.md](research.md). All NEEDS CLARIFICATION resolved:
- **Engine already delegates by mode** → core adapter = thin `editor.*` delegation (resolved).
- **Inner-editor back-reference is wired** (PresentationEditor.ts:933) → bridge-bound inner editor delegates correctly (resolved).
- **Adapter location/name** → `src/renderer/layout/coordinate-adapter.ts`, surfaced as `WC.PM.coords` (resolved).
- **getPages source per mode** → paged: `editor.currentTotalPages` / `presentation.getPages()`; overlay: existing `WC.PM.__pagination` count (resolved).
- **Bundle gate mechanism** → build default, assert PE subgraph is a separate lazy chunk + eager total under threshold (resolved; exact threshold measured at implement time).

## Phase 1 — Design & Contracts

- **Entities/types**: [data-model.md](data-model.md) — `PositionHit`, `ClientRect`, `PageInfo`, `CoordinateAdapter`.
- **Contract**: [contracts/coordinate-adapter.md](contracts/coordinate-adapter.md) — the `WC.PM.coords`
  interface. **Built + tested in M1:** `clientToPos`, `posToClientRect`, `getPageCount`, `getPages`.
  **Documented-but-deferred to M4** (decision: *defer, just document*): the per-annotation specialty
  rect helpers (image-node box, comment-anchor Y, track-bar rect) — described in the contract, **no code
  in M1**.
- **Quickstart / validation**: [quickstart.md](quickstart.md).

## Verification (definition of done for M1)

Per the runbook's per-milestone loop, **all** of:

1. `npm run build` clean.
2. **3 gates** green at baseline — `test:pm` **268**, `test:smoke` **9**, `test:roundtrip` **27** (overlay default unchanged).
3. **New paged-coords probe** passes: in `WC_LAYOUT=paged`, `WC.PM.coords.clientToPos(x,y)` on a painted
   page → a model pos whose `posToClientRect` round-trips back within tolerance; `getPageCount` equals
   `presentation.getPages().length`; in overlay mode the adapter delegates identically to `view.*` (parity).
4. **Bundle-size gate** (`test:bundle`): the default build code-splits `PresentationEditor` out of the
   eager graph; overlay eager renderer JS is back near its ~8.5 MB baseline (not ~10.9 MB).
5. **COM-oracle**: N/A for M1 (no export/geometry behavior changes) — recorded as N/A.
6. **`/code-review`** on the slice diff; fix ALL findings, then re-run build + gates before "done".

## Complexity Tracking

*No constitution violations — section intentionally empty.*
