# Implementation Plan: Multi-column page layout (Columns)

**Branch**: `feature/columns-paged` | **Date**: 2026-06-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-columns/spec.md`

## Summary

Wire the Layout → Columns control onto the paged engine so One/Two/Three (+ a More Columns surface and a
Column break) lay out the body text in newspaper-style columns that render live AND export real OOXML
`w:cols`, validated against real Word. The paged SuperDoc engine already renders multi-column text and the
section model/exporter already supports `w:cols` (feasibility-probed: `editor.doc.sections.setColumns(...)`
renders 2 columns live + exports `<w:cols w:num="2" w:space="720" w:equalWidth="1"/>`). The gap is purely
the owned-layer wiring (a `WC.PM` bridge verb + un-defer + the Columns dropdown), plus a spike to bound the
no-fork reach of unequal columns / line-between / column-break.

## Technical Context

**Language/Version**: TypeScript (renderer bridge, `src/renderer/bridge/*.ts`) + vanilla JS chrome
(`src/renderer/public/js/*.js`) on the `window.WC` namespace; Electron 31; electron-vite build.

**Primary Dependencies**: the vendored ProseMirror/SuperDoc fork's **PresentationEditor** (paged engine) +
its public Document API `editor.doc.sections.setColumns({count, gap, equalWidth, target})` /
`sectionsListAdapter` (section discovery); the `WC.PM` bridge (the only document-write path).

**Storage**: OOXML `.docx` — column layout lives in the section's `sectPr/w:cols`; a column break is a
`w:br w:type="column"` run. The document model stays **page-free**.

**Testing**: the real-paged-renderer probe harness (`scripts/paged-*-probe.js`, run via the isolated
Electron profile) + the dev-box-only **Word-COM oracle** (`scripts/oracle/com-validate.js` → a new/extended
`validate-*-win.ps1`, sandbox-disabled, PID-safe). The 4 core gates stay green.

**Target Platform**: Windows (Word-for-Windows 16.0 COM oracle is the parity ground truth).

**Project Type**: desktop app (Electron) — single project, owned-layers wiring over a vendored engine.

**Performance Goals**: column re-flow is interactive (the engine already paginates/relayouts on the order of
tens of ms); no new perf budget.

**Constraints**: **NO fork edits** (`src/renderer/core/superdoc-fork/*` is vendored/re-vendorable); the
`WC.PM` bridge is the only doc-write path; the model stays page-free; every fidelity claim is read back from
real Word.

**Scale/Scope**: single (primary) section, "apply to whole document". 3 incremental slices (P1 presets, P2
customize, P3 column break).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project has no formal `.specify/memory/constitution.md` principles file; the binding constraints are the
repo's standing rules (CLAUDE.md / AGENTS.md), treated as the constitution here:

- **No fork edits** — PASS by design: the feature is owned-layer wiring over the existing public
  `sections.setColumns` seam. (Risk: unequal columns / line-between / column-break may need OOXML the public
  adapter doesn't write — see Complexity Tracking; resolved at the Phase-0 spike, fork edit only as a last
  documented resort.)
- **`WC.PM` bridge is the only doc-write path** — PASS: a new `WC.PM.setColumns` (+ `insertColumnBreak`)
  verb wraps the fork API; the chrome dispatches commands, never writes the doc directly.
- **Model stays page-free** — PASS: `w:cols` is a `sectPr` property; a column break is an inline run; no
  page nodes added.
- **Every fidelity change ships a regression test + Word-COM validation** — PASS: a paged columns probe +
  an extended Word-COM oracle (`PageSetup.TextColumns`).
- **Don't hand-edit generated files** — PASS: the Columns dropdown already exists in `ribbon-data.js` (from
  `raw-research.json`); no ribbon regen needed (only the handler + bridge change).

No unjustified violations → **GATE PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/003-columns/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions + the spike's open questions
├── data-model.md        # Phase 1 — section column layout + column break entities
├── quickstart.md        # Phase 1 — how to run the probe + oracle
├── contracts/
│   ├── bridge-verbs.md      # WC.PM.setColumns / insertColumnBreak / getColumns contract
│   └── oracle-validation.md # Word-COM PageSetup.TextColumns read-back contract
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/renderer/bridge/
├── columns.ts           # NEW owned bridge module: setColumns({count,gap,equalWidth}) / getColumns() /
│                        #   insertColumnBreak() over editor.doc.sections.setColumns + a column-break insert
└── index.ts             # merge the verbs onto WC.PM (+ pre-mount no-op stubs) + un-defer columns/columnBreak
                         #   in ENGINE_READY

src/renderer/public/js/
├── commands.js          # rewire H.columns (columnsMenu) → WC.PM.setColumns; un-blocked dispatch; the
│                        #   "More Columns" dialog (P2); the Column break item under Breaks (P3)
└── (ribbon-data.js already has the Columns dropdown — NOT hand-edited)

scripts/
├── paged-columns-probe.js          # NEW real-paged-renderer probe (render N columns + export w:cols + break)
├── paged-export-columns-probe.js   # NEW export probe → saves a .docx for the COM oracle
├── oracle/validate-columns-win.ps1 # NEW Word-COM read-back: PageSetup.TextColumns count/spacing/even
└── test-roundtrip-paged.js         # wire the columns doc + read-back (dev-box-only gate)
```

**Structure Decision**: single project, owned-layers only. New owned bridge module `bridge/columns.ts`
(mirrors `bridge/header-footer.ts`); `commands.js` rewire of the existing `columnsMenu`; un-defer in
`bridge/index.ts`. No fork edits (pending the spike). New probe + a new `validate-columns-win.ps1` oracle
following the `validate-headerfooter-win.ps1` (002) pattern.

## Complexity Tracking

> Filled because three sub-capabilities may exceed the public `sections.setColumns` adapter's no-fork reach.

| Risk / "violation" | Why it might be needed | Resolution (Phase-0 spike) |
|--------------------|------------------------|----------------------------|
| **Unequal columns (Left/Right)** — `writeSectPrColumns` only writes `w:num`/`w:space`/`w:equalWidth`, not individual `<w:col w:w=.. w:space=..>` children | Word's Left/Right presets are unequal two-column layouts | Spike: can the public seam (or an owned post-process of the exported `sectPr`) emit `<w:col>` children no-fork? If not, P2 ships equal-width only + records Left/Right as a bounded gap (honest toast), NOT a fork edit. |
| **Line between (`w:cols w:sep="1"`)** | Word's "Line between" toggle | Spike: is `w:sep` reachable no-fork (an `setColumns` option or an owned attr write)? If not → honest toast, recorded. |
| **Column break (`w:br w:type="column"`)** | P3 column break | The fork's `w:br` handler supports `w:type="column"` (super-converter). Spike: is there a public insert (a break command/`insertContent` of a column-break run) reachable from the bridge no-fork? Likely yes (mirrors `insertPageBreak`). |

A minimal, documented fork accessor is the last resort for any of the above and would be recorded here — the
default is no-fork (equal-width + count + spacing is fully no-fork, feasibility-proven).
