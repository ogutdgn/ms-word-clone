# Research — Section Breaks

## Decision 1 — Insertion via the public `insertSectionBreakAtSelection` (no fork edit) — SPIKE-PROVEN

**Decision**: insert a mid-document section break by calling the fork's public command
`editor.commands.insertSectionBreakAtSelection()`, which sets a **paragraph-level `pPr/w:sectPr`** on the caret's
paragraph (OOXML's mid-doc section-break form) via `setNodeMarkup`. Wrap it in a new owned bridge verb
`WC.PM.insertSectionBreak(type)`.

**SPIKE — RESOLVED (2026-06-22, throwaway probe + a Word-COM check).** NO-FORK and Word-correct:
- `editor.commands.insertSectionBreakAtSelection` EXISTS as a public command
  (`core/commands/insertSectionBreakAtSelection.js`, previously unused by the repo). It clones/creates a
  `w:sectPr` and writes it to the governing paragraph's `attrs.paragraphProperties.sectPr` (+ `pageBreakSource:
  'sectPr'`).
- After a fresh blank doc (baseline: exactly **1** `<w:sectPr>` = the trailing body sectPr), calling the command
  mid-document makes `exportDocx` carry **2** `<w:sectPr>` — the mid-doc one **inside a `<w:pPr>`** + the body one.
- **Real Word read-back (COM):** the saved `.docx` opens with `ActiveDocument.Sections.Count == 2`, each
  `PageSetup.SectionStart == 2` (wdSectionNewPage). So a bare `w:sectPr` = a **Next Page** section break.
- **Caret note:** the command reads `state.selection.$from` to find the governing paragraph. In the spike a
  programmatic `chain().setTextSelection(p2).insertSectionBreakAtSelection()` returned a non-`true` value and the
  node re-read didn't show the sectPr on para-2 (a relayout/return-value artifact), yet the EXPORT still carried a
  valid mid-doc sectPr — so the real bridge verb operates on the USER's live selection (no programmatic
  re-targeting needed) and is validated by the export + the COM oracle.

**Rationale**: a public command + an owned paragraph-attr write, the same no-fork shape as 003/005. `editor.doc.styles.apply`
and section-level APIs don't insert a mid-doc break; this command is the purpose-built path.

## Decision 2 — Section TYPE via an owned `w:type` write

**Decision**: a bare `w:sectPr` defaults to **Next Page**. For **Continuous / Even Page / Odd Page**, after the
command runs, find the governing paragraph's `paragraphProperties.sectPr` and add/replace
`<w:type w:val="continuous|evenPage|oddPage"/>` as its FIRST child (CT_SectPr places `w:type` early) — an owned
PM write (`updateAttributes('paragraph', {...})` merging the sectPr, or a direct `setNodeMarkup`). The export then
carries the type and Word reads `SectionStart` = Continuous / EvenPage / OddPage.

**Rationale**: `insertSectionBreakAtSelection` only sets margins/header-footer, not the type; the type is a small
owned mutation of the created sectPr (the 003 `bodySectPr` precedent on a paragraph sectPr). No fork edit.
**Validate each type via the COM oracle** (`SectionStart` enum: wdSectionContinuous=0 / wdSectionEvenPage=3 /
wdSectionOddPage=4 / wdSectionNewColumn=1 / wdSectionNewPage=2).

## Decision 3 — In-app repagination is OUT OF SCOPE (known limitation)

**Decision**: the paged PE does NOT start a new sheet at the break (spike: `pages=1`). In-app repagination is out
of scope; the on-disk OOXML + real-Word read-back (Word paginates on open) is the fidelity guarantee. Mirrors
005 hyphenation's in-app render being out of scope.

**Rationale**: repaginating the PE at a mid-doc sectPr is a layout-engine change (the paged engine's pagination is
the 011 calibration / a future engine concern); 006 delivers the Word-correct document. Recorded.

## Decision 4 — Word-COM oracle: a new `validate-sectionbreaks-win.ps1`

**Decision**: read `ActiveDocument.Sections.Count` + each `Sections(i).PageSetup.SectionStart` (the
WdSectionStart enum, self-verified in range 0–4); PID-safe, `OpenAndRepair:=false`; invoked via `com-validate.js`,
wired into `test:roundtrip:paged` (a new C8 block). XML inspection (2 `<w:sectPr>` + `w:type`) stays the fast
in-probe pre-check. Mirrors 002–005.

## Decision 5 — Incremental delivery (P1 → P2)

P1 = Next Page (the default/bare sectPr) + export + ribbon + oracle (a Word-correct 2-section document — the
prerequisite). P2 = the Continuous / Even Page / Odd Page types (the `w:type` write). Each its own verify →
`/code-review` → ff-merge-into-`general-done` cycle. Matches the 002–005 cadence. `breaks` is already un-deferred
(003) → no D6-guard changes.
