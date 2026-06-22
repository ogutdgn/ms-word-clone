# Implementation Plan: Section Breaks

**Branch**: `006-section-breaks` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-section-breaks/spec.md`

## Summary

Wire Layout → Breaks → Section Breaks (Next Page / Continuous / Even Page / Odd Page) onto the paged engine via
the `WC.PM` bridge. Inserting a break calls the fork's public `editor.commands.insertSectionBreakAtSelection()`
(sets a paragraph-level `pPr/w:sectPr`); non-default types add `<w:type w:val="…"/>` to that created `sectPr` via
an owned write (the 003 columns `bodySectPr` pattern). Validated vs real Word (`Sections.Count` +
`PageSetup.SectionStart`). Feasibility spike-proven (Word reads 2 sections). In-app repagination at the break is
out of scope (the paged PE doesn't repaginate — known limitation; export-faithful, like hyphenation's render).

## Technical Context

**Language/Version**: TypeScript bridge (`src/renderer/bridge/*.ts`) + vanilla JS chrome
(`src/renderer/public/js/*.js`, `window.WC`); Electron 31; electron-vite.

**Primary Dependencies**: the fork's public command `editor.commands.insertSectionBreakAtSelection()` (paragraph
`pPr/w:sectPr` via `setNodeMarkup`); the paragraph node's `paragraphProperties.sectPr` attr (for the owned
`w:type` write); the `WC.PM` bridge; the already-un-deferred Layout → Breaks plumbing (003).

**Storage**: OOXML `.docx` — a section break = a paragraph-level `pPr/w:sectPr` (+ `w:type`). The model stays
page-free (the sectPr is a paragraph property, not a page node).

**Testing**: the real-renderer probe (`scripts/paged-sectionbreaks-probe.js`) + the dev-box-only Word-COM oracle
(`scripts/oracle/validate-sectionbreaks-win.ps1` via `com-validate.js`, sandbox-disabled, PID-safe). The 4 gates
stay green.

**Target Platform**: Windows (Word-for-Windows 16.0 COM oracle).

**Project Type**: desktop app — owned-layers wiring (no render overlay; in-app repagination out of scope).

**Constraints**: NO fork edits; `WC.PM` bridge is the only doc-write path; model stays page-free; every fidelity
claim read back from real Word.

**Scale/Scope**: insert the 4 section-break types; 2 incremental slices (P1 Next Page, P2 Continuous/Even/Odd).

## Constitution Check

*GATE: pass before Phase 0; re-check after Phase 1.* Checked against `.specify/memory/constitution.md` v1.0.0.

- **I. No Fork Edits** — PASS (spike-proven): insertion via the public `insertSectionBreakAtSelection`; the
  `w:type` write is an owned mutation of the paragraph's `paragraphProperties.sectPr` (the 003 `bodySectPr`
  precedent). No fork edit.
- **II. The WC.PM Bridge Is the Only Write Path** — PASS: a new `WC.PM.insertSectionBreak(type)` wraps the
  command + the owned write.
- **III. Page-Free Model** — PASS: the `sectPr` is a paragraph property.
- **IV. Real-Word Fidelity, Oracle-Validated** — PASS: a new `validate-sectionbreaks-win.ps1` reads
  `Sections.Count` + `PageSetup.SectionStart`, PID-safe, `OpenAndRepair:=false`, wired into `test:roundtrip:paged`.
- **V. Test-Gated** — PASS: the paged probe + the 4 gates + the COM oracle.
- **VI. Spec-Kit-Driven** — PASS: this feature; P1/P2 slices, each verify → review → ff-merge into general-done.
- **VII. Generated Files** — PASS: the Breaks dropdown is already in `ribbon-data.js`; only the handler + bridge change.

→ **GATE PASS** (the spike already confirmed the no-fork path).

## Project Structure

```text
specs/006-section-breaks/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/{bridge-verbs,oracle-validation}.md
└── tasks.md

src/renderer/bridge/
├── section-breaks.ts   # NEW: insertSectionBreak(type) — insertSectionBreakAtSelection() + an owned w:type write
└── index.ts            # merge onto WC.PM (+ no-op stub)

src/renderer/public/js/
└── commands.js         # rewire the Breaks flyout's Section Breaks group → WC.PM.insertSectionBreak(type)

scripts/
├── paged-sectionbreaks-probe.js          # NEW real-renderer probe (export 2 sectPr + w:type per type)
├── paged-export-sectionbreaks-probe.js   # NEW export probe → a .docx for the COM oracle
├── oracle/validate-sectionbreaks-win.ps1 # NEW Word-COM read-back: Sections.Count + SectionStart
└── test-roundtrip-paged.js               # wire the section-breaks doc + read-back (dev-box-only) — C8 block
```

**Structure Decision**: single project, owned-layers wiring (no render overlay). New `bridge/section-breaks.ts`;
`commands.js` Breaks-flyout rewire; merge in `bridge/index.ts` (no un-defer — `breaks` is already in ENGINE_READY
from 003, so NO D6-guard changes); new probe + `validate-sectionbreaks-win.ps1` (the 002–005 oracle pattern). No
fork edits.

## Complexity Tracking

> The feasibility risk was retired by the spike; one residual item recorded.

| Risk | Why | Resolution |
|------|-----|------------|
| **The `w:type` owned write must target the JUST-created paragraph sectPr** | FR-003 | After `insertSectionBreakAtSelection()`, find the governing paragraph (the caret's paragraph) and mutate its `paragraphProperties.sectPr` to add/replace `<w:type w:val="…"/>` (an owned PM transaction or `updateAttributes`); validate each type via the COM oracle (`SectionStart`). |
| **In-app repagination at the break** | FR-006 | OUT OF SCOPE (the paged PE doesn't repaginate — spike-confirmed). Recorded known-limitation; the export + Word read-back is the guarantee. |
