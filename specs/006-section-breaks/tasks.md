# Tasks: Section Breaks

**Feature**: `specs/006-section-breaks/` | **Branch**: `006-section-breaks` (off `general-done`)
**Inputs**: plan.md, research.md, data-model.md, contracts/{bridge-verbs,oracle-validation}.md, quickstart.md
**Merge mode**: ff-merge into `general-done` (NOT main). `/code-review` each slice.

**Conventions**: probes run in the REAL paged renderer (isolated `C:/tmp/wc-probe-profile`). COM oracle is
dev-box-only (sandbox-disabled, PID-safe). Every fidelity claim is read back from real Word. The `WC.PM`
bridge is the only document-write path. NO fork edits.

---

## Phase 1: Setup

- [x] T001 Confirm on `006-section-breaks` (off `general-done`); `npm run build` clean; baseline gates green —
  `test:pm` overlay 475 / `test:smoke` 9 / `test:roundtrip` 27 / `test:bundle` 4.
- [x] T002 Commit the spec-kit planning artifacts (spec/clarify/plan/research/data-model/contracts/quickstart/
  checklists/tasks + `.specify/feature.json`) on the feature branch.

---

## Phase 2: Foundational — THE SPIKE (DONE)

- [x] T003 SPIKE (research.md Decision 1): feasibility PROVEN no-fork — `editor.commands.insertSectionBreakAtSelection()`
  sets a paragraph `pPr/w:sectPr`; export → 2 `<w:sectPr>`; real Word reads `Sections.Count == 2`,
  `SectionStart == NewPage`. Bare sectPr = Next Page; types need an owned `w:type` write. PE doesn't repaginate
  (known limitation). Recorded; spike script deleted.

**Checkpoint**: the no-fork mechanism is decided; no Principle-I exception needed.

---

## Phase 3: User Story 1 — Next Page section break (P1) 🎯 MVP

**Goal**: insert a Next Page break → export 2 `sectPr` → Word reads `Sections.Count == 2`, `SectionStart == NewPage`.
**Independent test**: caret mid-doc → Next Page → save → Word 2 sections, section 1 start = NewPage.

- [x] T004 [US1] Create `src/renderer/bridge/section-breaks.ts`: `insertSectionBreak(type)` →
  `editor.commands.insertSectionBreakAtSelection()` (P1 handles `nextPage` = bare sectPr); `markDirty`; returns true.
  Mirror `bridge/columns.ts`/`hyphenation.ts`.
- [x] T005 [US1] Merge onto `WC.PM` in `src/renderer/bridge/index.ts` (+ no-op stub). NO un-defer / NO D6 change
  (`breaks` already in ENGINE_READY from 003).
- [x] T006 [US1] REWIRE `src/renderer/public/js/commands.js` the Breaks flyout's **Section Breaks** group: Next
  Page → `WC.PM.insertSectionBreak('nextPage')`. Keep Continuous/Even/Odd as P2 placeholders until T012. No `E()`.
- [x] T007 [US1] Create `scripts/paged-sectionbreaks-probe.js` (real renderer): baseline 1 `sectPr`; after
  `insertSectionBreak('nextPage')` ⇒ export 2 `<w:sectPr>` with the mid-doc one inside a `<w:pPr>`. Add a
  `probe:sectionbreaks` npm script. Mode-agnostic.
- [x] T008 [US1] Create `scripts/oracle/validate-sectionbreaks-win.ps1` (PID-safe, OpenAndRepair:=false, enum
  self-verify 0–4): read `Sections.Count` + each `SectionStart`. Create `scripts/paged-export-sectionbreaks-probe.js`
  (author a Next-Page-break doc, save `C:/tmp/wc-<mode>-sectionbreaks.docx`).
- [x] T009 [US1] Wire the doc + read-back into `scripts/test-roundtrip-paged.js` (C8: validate-open no-repair +
  `Sections.Count == 2` + `Sections(1).SectionStart == 2`).
- [x] T010 [US1] VERIFY P1: build + 4 gates + `probe:sectionbreaks` + the COM oracle green. `/code-review`; FIX.

**Checkpoint**: a Next-Page section break exports + reads back in real Word.

---

## Phase 4: User Story 2 — Continuous / Even Page / Odd Page (P2)

**Goal**: the type variants set `w:type` + Word reads the matching `SectionStart`. **Independent test**: Continuous
→ Word `SectionStart` 0; Even Page → 3; Odd Page → 4.

- [x] T012 [US2] Extend `insertSectionBreak(type)` in `section-breaks.ts`: for `continuous`/`evenPage`/`oddPage`,
  after the command, find the governing paragraph's `paragraphProperties.sectPr` and add/replace
  `<w:type w:val="…"/>` as its first child (owned PM write; CT_SectPr order).
- [x] T013 [US2] Wire the Continuous / Even Page / Odd Page items in the Breaks flyout → `WC.PM.insertSectionBreak(type)`.
- [x] T014 [US2] Extend `scripts/paged-sectionbreaks-probe.js`: each type ⇒ the section's `sectPr` carries the
  right `w:type` (continuous/evenPage/oddPage).
- [x] T015 [US2] Extend `validate-sectionbreaks-win.ps1` + the export probe + the C8 block: per-type `SectionStart`
  (continuous 0 / evenPage 3 / oddPage 4).
- [x] T016 [US2] VERIFY P2: build + 4 gates + `probe:sectionbreaks` + the COM oracle green; `/code-review`; FIX.

**Checkpoint**: all four section-break types export + read back in real Word.

---

## Phase 5: Polish & Close-out

- [x] T021 Grep-confirm NO `E()`/`WC.Layout` in the rewired Breaks Section-Breaks items; confirm `ribbon-data.js`
  not hand-edited.
- [x] T022 Docs reconciliation: `docs/SCOPE.md` (mid-doc section breaks row → ✅, conservative: insertion +
  Sections.Count/SectionStart Word-validated; in-app repagination out of scope) + `docs/FEATURES.md`. Then
  **ff-merge `006-section-breaks` → `general-done`** + checkpoint (last-point + execution-map + runbook + memory +
  tick this tasks.md). Do NOT merge into main.

---

## Dependencies & order

- **Spike (T003) DONE** — feasibility proven no-fork.
- **P1 (T004–T010) → P2 (T012–T016)** sequential (shared `section-breaks.ts`, `commands.js`, probe, validator).
- Polish (T021–T022) after P2; the ff-merge into `general-done` is the very last step.

## Notes

- Tests = `scripts/paged-sectionbreaks-probe.js` + the dev-box-only `validate-sectionbreaks-win.ps1`.
- NO D6-guard change (`breaks` already un-deferred in 003).
- In-app repagination at the break is OUT OF SCOPE (known-limitation); export + Word read-back is the guarantee.
