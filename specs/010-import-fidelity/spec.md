# Feature Specification: Paged import fidelity (html/txt/csv)

**Feature dir**: `specs/010-import-fidelity/` | **Branch**: `010-import-fidelity` (off `general-done`)
**Status**: Draft | **Type**: paged open-flow fix (NO fork edit; WC.PM bridge)

## Why

007 surfaced the `[7]` PAGED_KNOWN_GAP: paged `WC.Files.open('*.html')` **dumps the raw HTML as literal text** into
one paragraph instead of parsing it. Spike-confirmed: the paged open flow's html leg did
`pres.editor.chain().selectAll().insertContent(extra.html).run()`, and `insertContent(htmlString)` in the paged
PresentationEditor inserts the markup as LITERAL TEXT (no parse) — the doc model held the entire `<!DOCTYPE html>…`
string as one text node, with NO bold/heading/list structure. The overlay path had parsed html via the Editor
constructor's `html` option (→ `createDocFromHTML`). So in paged, opening any `.html` (and, via the same leg, `.txt`
→ `<p>`-per-line and `.csv` → a table) produced a degraded doc.

## What (scope)

Fix the paged open flow so a `.html`/`.txt`/`.csv` import opens as PARSED structure (headings/bold/lists become real
PM nodes/marks, not literal text). NO fork edit — call the fork's public `createDocFromHTML` helper (the same parser
the Editor constructor + `replaceNodeWithHTML` use). WC.PM bridge only.

- In `src/renderer/bridge/index.ts` `replaceEditor`'s html leg: replace `insertContent(extra.html)` with
  `createDocFromHTML(extra.html, pres.editor)` → parse to a doc node → `tr.replaceWith(0, doc.content.size,
  parsed.content)` (full-body replace of the blank doc from `replaceFile`). Keep the §5.3 data-loss guard (an import
  that lands NOTHING must not bind a path to a blank doc).
- `.txt` (openText → `<p>`-per-line html) and `.csv` (openCsv → table html) ride the SAME leg → fixed for free.

**Out of scope**: changing the converter or the fork; markdown import; richer html (styles/CSS) beyond what
`createDocFromHTML` handles. The fork's schema represents Word-model headings/lists as paragraphs with attrs (not
separate node types) — that is the fork's choice, kept as-is.

## Functional requirements

- **FR-001**: Opening a `.html` in paged MUST produce a doc model with PARSED structure — a `<strong>` → a `bold`
  mark, text content present — NOT the raw html string as text.
- **FR-002**: The fix MUST call the fork's public `createDocFromHTML` helper (no fork edit) + apply it via a bridge
  transaction; the WC.PM bridge stays the only document-write path.
- **FR-003**: `.txt` (line-per-paragraph) + `.csv` (table) imports MUST also parse (they ride the same leg).
- **FR-004**: The §5.3 data-loss guard MUST survive — an import whose markup carries text but lands NOTHING (parse
  failed → blank) MUST set `lastImportBlanked` + return false (never bind a path to a blank doc).
- **FR-005**: The `[7]` test MUST move OUT of PAGED_KNOWN_GAP and pass as a genuine test. NO fork edit; the 4 core
  gates green.

## Success criteria

- **SC-001**: `[7] open .html imports headings/bold/list` passes as a real test (not a known-gap); `test:pm` 416/416,
  pagedKnownGaps 10 → 9.
- **SC-002**: A spike confirms `PM.openHtml(html)` yields `markTypes: ['bold']`, `rawHtmlDumpedAsText: false`, parsed
  text content — vs the pre-fix raw-dump.
- **SC-003**: `test:smoke` 9 / `test:roundtrip` 27 / `test:bundle` 4 unaffected; no fork edit.

## Assumptions

- `createDocFromHTML` works in the paged PE context (verified: `replaceNodeWithHTML`, which uses it, parses bold/text
  correctly in the spike).
- The fork's html parser produces the Word-model structure (headings/lists as styled paragraphs); the `[7]` test's
  bar (bold mark + content) is the acceptance signal.
