# Progress Log

A running log of the major work on ms-word-clone. Newest first.

## Phase 4 — Bug-busting (in progress)

A 12-area find→adversarial-verify workflow audited every subsystem and produced
**55 confirmed real bugs** (22 high, 30 medium, 3 low) — see
`docs/BUG_BUST_FINDINGS.md`.

- **All 22 high-severity bugs fixed** across PRs #2–#5 (data loss + corruption):
  Track-Changes deletions, CSV import, save-as-text, .docx header/footer +
  comments + nested tables, undo/redo, Change Case, Format Painter, table
  pagination, footnotes, line numbers, cover pages, mail-merge, and more.
- The hardest two each got their own branch:
  - `feat/undo-history` — replaced the native execCommand undo stack (which
    ignored direct-DOM edits) with a MutationObserver-driven snapshot history.
  - `feat/comments-docx` — html-to-docx has no comment support, so comments are
    injected as a real `word/comments.xml` part (JSZip post-process). **Validated
    against real Microsoft Word over COM**: Word opens the file and reports the
    comments with correct text and anchor ranges.
- **Round 3 (medium/low) is the remaining work.**

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

- Functional in-renderer suite (`scripts/test-suite.js`): **245 pass / 0 fail**.
- DOCX suite (`scripts/test_docx.js`): **17 pass / 0 fail** (incl. header/footer,
  nested tables, comment injection).
