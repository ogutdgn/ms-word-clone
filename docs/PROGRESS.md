# Progress Log

A running log of the major work on ms-word-clone. Newest first.

## Phase 4 — Bug-busting

A 12-area find→adversarial-verify workflow audited every subsystem and produced
**55 confirmed real bugs** (22 high, 30 medium, 3 low) — see
`docs/BUG_BUST_FINDINGS.md`.

- **All 22 high-severity bugs fixed** (PRs #2–#5) — data loss + corruption:
  Track-Changes deletions, CSV import, save-as-text, .docx header/footer +
  comments + nested tables, undo/redo, Change Case, Format Painter, table
  pagination, footnotes, line numbers, cover pages, mail-merge, and more.
  - `feat/undo-history` (PR #4) — replaced the native execCommand undo stack
    (which ignored direct-DOM edits) with a MutationObserver-driven snapshot history.
  - `feat/comments-docx` (PR #5) — comments injected as a real `word/comments.xml`
    part (JSZip post-process). **Validated against real MS Word over COM**: Word
    opens the file and reports the comments with correct text and anchor ranges.
- **~20 of the 33 medium/low bugs fixed** (PRs #6–#7):
  - Tables: Split Cell (just that cell), colspan-aware Insert/Delete Column,
    Convert-Text-to-Table out of a list.
  - References: bibliography title out of the TOC, captions numbered by position,
    Update Table rebuilds the ToF, IEEE numbered/source-order, stable citation ids
    (restyle survives source deletion), no-duplicate bibliography/ToF.
  - Mailings: Match Fields applied + column resolution; Greeting/Address dialog
    choices honored.
  - Misc: lasso ink delete, bookmark dedupe, Replace repaginate, page color keeps
    watermark, Go-To / Page-Width zoom, thesaurus replace-word, rotate keeps flip.
- **Remaining (deferred — harder/architectural or low value), documented in
  `docs/BUG_BUST_FINDINGS.md`:** Preview-Results edit-discard (preview replaces the
  whole doc), positioned-object per-page anchor, Align-center at 50% edge (conflicts
  with the rotate/flip transform), applyInlineStyle empty-span nesting, Track-Changes
  paste, Comments-pane stale cards, print stylesheet (PDF/Print captures chrome),
  oversized-inline-image pagination, eraser point/segment modes (needs SVG path
  splitting), and two low-severity cosmetic items.

## Phase 3 — Documentation (done, PR #1)

`docs/ARCHITECTURE.md`, `TECH_STACK.md`, `RIBBON.md`, `ICONS.md`, `PAGINATION.md`,
`FEATURES.md`, `BUILD_AND_RUN.md`, `TESTING.md`, plus root `AGENTS.md` + `CLAUDE.md`,
all written from the real source by a parallel docs workflow.

## Phase 2 — Pagination + visual fixes

- Real multi-page pagination: one `#editor` contenteditable rendered as discrete
  page sheets via in-flow gap spacers, with **line-level splitting** (a single long
  paragraph splits across pages, word-boundary aware, char-level fallback).
  **Validated against real Word** (816×1056, 96px margins, ~26 Aptos-12 lines/page;
  `#editor` line-height 1.4 calibrates the Linux fallback font).
- Caret preserved across pagination by absolute char-offset; single-page fast path;
  overlays excluded; spacers stripped from saved files.
- Title-bar buttons fixed (drag-region), faux-maximize for WSLg, overflow-wrap.

## Phase 1 — UI-outcome fidelity + icons

- 53 on-screen-outcome divergences vs Word fixed (`docs/UI_FIDELITY_AUDIT.md`).
- Authentic Fluent (Office) icons for all 212 controls.

## Phase 0 — Per-tab build

All 10 ribbon tabs implemented, web-researched, and validated against the real
MS Word COM oracle. Per-tab status in `docs/*_TAB.md`.

## Test counts (current)

- Functional in-renderer suite (`scripts/test-suite.js`): **257 pass / 0 fail**.
- DOCX suite (`scripts/test_docx.js`): **17 pass / 0 fail** (incl. header/footer,
  nested tables, comment injection).

## Merged PRs

1. docs — architecture + subsystem docs, CLAUDE.md, AGENTS.md
2. round-1 high-severity bug fixes (data loss + corruption)
3. round-2 — footnotes, line numbers, .docx header/footer + nested tables
4. real undo/redo history
5. comments → native Word comments (COM-validated)
6. round-3 medium batch 1 (page color, zoom, go-to, thesaurus, transforms)
7. round-3 medium/low (tables, references, mailings, misc)

## JS → TS decision

A full TypeScript/React migration was evaluated and **declined** for now: the
deliberate no-bundler / global-`WC` architecture works and is covered by 257+17
tests, and a rewrite would risk that for moderate gain. The recommended low-risk
path (future, optional) is JSDoc + `// @ts-check` + `tsconfig{checkJs}` for type
safety with no build step, or a gradual Vite+React shell for the ribbon/dialogs
while leaving the contenteditable editor core vanilla.
