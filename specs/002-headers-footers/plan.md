# Implementation Plan: Headers & Footers in the paged editor

**Branch**: `feature/headers-footers-paged` | **Date**: 2026-06-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-headers-footers/spec.md`

## Summary

Make headers/footers a real, Word-faithful feature on the now-default paged engine. The key finding from a
6-agent landscape sweep is that **the engine work is largely done**: the paged PresentationEditor already paints
per-page header/footer regions and supports double-click-to-edit (`HeaderFooterSessionManager` wired into the PE
pointer callbacks). The remaining work is **wiring** — a "Header & Footer Tools" contextual tab, entry/exit/
navigation commands, replacing dead command handlers — plus **extending the owned doc-model bridge** for variants
and a page-number field, and **extending the Word-COM oracle**. The persistence/export path is the existing
headless story-runtime seam (`header-footer-story-runtime.ts`), which is mode-agnostic and already Word-COM
validated (M5). No fork edits are planned (a single minimal public-accessor exception is allowed only if the
probe-first spike proves it is the one clean way to drive on-page entry/exit — default is no-fork).

Delivered incrementally as the spec's three user stories, each its own verify → `/code-review` → ff-merge-to-main
→ push cycle: **P1** on-page enter/edit/close + the contextual tab + dead-handler rewire + un-defer; **P2**
Different First Page / Different Odd & Even variants; **P3** page-number fields.

## Technical Context

**Language/Version**: TypeScript (renderer bridge, `src/renderer/bridge/*.ts`) + vanilla JS on the `window.WC`
namespace (chrome: ribbon/commands under `src/renderer/public/js/`); Electron 31; build via electron-vite.

**Primary Dependencies**: the owned vendored SuperDoc ProseMirror fork (`src/renderer/core/superdoc-fork/`) — used
through its existing public seams only (the headless `resolveHeaderFooterSlotRuntime` story-runtime; the paged
`PresentationEditor`/`HeaderFooterSessionManager` for on-page painting/editing). No new npm deps.

**Storage**: `.docx` (OOXML) via the fork's super-converter — `word/headerN.xml` / `word/footerN.xml` + `sectPr`
`headerReference`/`footerReference`, `titlePg`, `evenAndOddHeaders`, and a `PAGE` field. The doc model stays
page-free.

**Testing**: the existing automated gates — `test:pm` (475), `test:smoke` (9), `test:roundtrip` (27),
`test:bundle` (4); the paged HF probe `scripts/paged-headerfooter-probe.js` (extended); `test:roundtrip:paged`;
and the **Word-for-Windows COM oracle** (`scripts/oracle/validate-headerfooter-win.ps1` via `com-validate.js`,
sandbox-disabled + PID-safe, dev-box-only).

**Target Platform**: Windows desktop (the native parity target); the on-page experience targets the **default
paged** rendering engine.

**Project Type**: desktop application (Electron renderer + main).

**Performance Goals**: header/footer entry/edit/exit feels immediate (≤ the existing paged repaint, ~50ms);
no new per-keystroke cost beyond the existing PE editing path.

**Constraints**: prefer **no fork edits** (`src/renderer/core/superdoc-fork/**`); doc model page-free; the
existing plain-text header/footer path must not regress; computer-use is BLOCKED for the dev Electron build
(verify via probes in the real renderer, never headless — the headless canvas is a measurement stub); Word-COM
gate is dev-box-only.

**Scale/Scope**: single primary section; default / first-page / even-page header & footer variants; the
long-tail Header & Footer Tools controls (Date & Time, Document Info, Quick Parts, pictures, alignment tab,
distance spinners, building-block galleries, multi-section Link to Previous) are out of scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repo's `.specify/memory/constitution.md` is the unfilled template, so the **de-facto governing rules** are
the project's working rules (CLAUDE.md / AGENTS.md + the `commit-style` and `merge-mode-ff` skills). Checked
against them:

- **Validate against real MS Word (COM oracle).** PASS — every fidelity claim (text, variant flags, page-number
  field) is read back from real Word; the oracle validator is extended + hardened (OpenAndRepair:=false + enum
  self-verify).
- **Every fix/feature ships a regression test.** PASS — each phase extends `scripts/paged-headerfooter-probe.js`
  and (for fidelity) the COM-oracle gate; the 4 core gates stay green.
- **Prefer no fork edits; doc model page-free.** PASS (with a guarded exception) — the design routes persistence
  through the existing headless story-runtime seam and the existing PE painting; a single minimal public-accessor
  fork touch is permitted ONLY if the spike proves it is the one clean way to drive on-page entry/exit, and it is
  documented in Complexity Tracking if taken.
- **Commit style + merge mode.** PASS — `type(scope): summary` with what/why, explicit `git add`, no AI trailer;
  ff-merge to `main` + push per the standing preference; `/code-review` each slice.
- **The owned-layers rule** (the `WC.PM` bridge is the only document-write path; generated files not hand-edited;
  no `window.prompt`). PASS — all new logic lands in the bridge + the owned chrome modules; `ribbon-data.js` is
  regenerated via `scripts/gen.js`, not hand-edited.

No unjustified violations. (If the spike forces the public-accessor fork touch, it is recorded below.)

## Project Structure

### Documentation (this feature)

```text
specs/002-headers-footers/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (spike outcomes feed the open ones)
├── data-model.md        # Phase 1 — header/footer entities + state
├── quickstart.md        # Phase 1 — how to run the probes + the COM oracle
├── contracts/           # Phase 1 — bridge-verb, contextual-tab, and oracle contracts
│   ├── bridge-verbs.md
│   ├── contextual-tab.md
│   └── oracle-validation.md
├── checklists/
│   └── requirements.md  # from /speckit-specify
└── tasks.md             # Phase 2 — /speckit-tasks output
```

### Source Code (repository root)

```text
src/renderer/
├── bridge/
│   ├── header-footer.ts          # EXTEND: variant-aware text verbs, sectPr-property verbs (titlePg,
│   │                             #   evenAndOddHeaders), page-number-field insert/remove. Headless
│   │                             #   story-runtime stays the persistence/export path.
│   ├── index.ts                  # EDIT: ENGINE_READY / AREA / DEFERRED — un-defer the now-delivered
│   │                             #   header/footer commands; merge the new verbs onto WC.PM.
│   └── state-sync.ts             # EDIT: drive the "Header & Footer Tools" contextual tab activation
│                                 #   (mirror picture/table tab activation) from an "in header/footer" signal.
├── public/js/
│   ├── header-footer-tools-pm.js # NEW owned chrome module: the contextual-tab def + syncContextualTab
│   │                             #   (modeled on picture-tools-pm.js / table-tools-pm.js).
│   ├── commands.js               # REWIRE the dead H[] handlers (399-408, 457): remove E()/WC.HeaderFooter;
│   │                             #   drive the bridge + the spike's chosen entry/exit mechanism.
│   └── ribbon-data (generated)   # via scripts/gen.js source — add the HF Tools contextual-tab controls.
└── core/superdoc-fork/**         # NO edits (default). Only-if-unavoidable: one minimal public accessor.

scripts/
├── paged-headerfooter-probe.js   # EXTEND: entry/exit, on-page edit, variants, page-number field (real renderer).
├── oracle/validate-headerfooter-win.ps1  # EXTEND + HARDEN: variant + flag + page-number read-back;
│                                          #   OpenAndRepair:=false; enum self-verify.
└── (spike throwaways, deleted before commit)
```

**Structure Decision**: All new logic lives in the **owned layers** — the TypeScript `WC.PM` bridge and the
vanilla-JS `window.WC` chrome — plus the dev-box-only oracle scripts. The vendored fork is used through its
existing seams (headless story-runtime for persistence/export; PE for on-page painting/editing). This keeps the
fork clean and re-vendorable and keeps the single document-write path through `WC.PM`.

## Complexity Tracking

> Fill ONLY if the Constitution Check has violations that must be justified.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (Possible) one minimal public accessor on the fork's PresentationEditor for header/footer activate/exit | If the spike finds NO no-fork way to drive on-page entry/exit programmatically (no existing accessor, and synthesizing the double-click pointer path proves unreliable), a single public passthrough is the clean alternative to a hacky synthetic-event approach | Decided at the spike. Default is no-fork (existing accessor or synthetic-pointer). Recorded here only if actually taken; kept to one method, documented at the call site. |
