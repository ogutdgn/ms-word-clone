# Implementation Plan: Paged import fidelity (html/txt/csv)

**Feature dir**: `specs/010-import-fidelity/` | **Branch**: `010-import-fidelity` (off `general-done`)
**Spec**: [spec.md](spec.md) | **Type**: paged open-flow fix (no fork edit; WC.PM bridge)

## Constitution check

- **P1 (no fork edit)**: ✅ — `createDocFromHTML` is a PUBLIC fork helper (`@core/helpers/index.js`, the same one the
  Editor constructor + `replaceNodeWithHTML` use). We IMPORT and CALL it from the bridge; we do NOT edit
  `src/renderer/core/superdoc-fork/**`.
- **P2 (WC.PM bridge is the only write path)**: ✅ — the fix is in `src/renderer/bridge/index.ts` `replaceEditor`; the
  doc write is a bridge transaction (`tr.replaceWith` on the PE's editor view).
- **P3 (model stays page-free)**: ✅ — html→PM parsing produces only document nodes/marks; no page modeling.
- **P4 (paged is the engine)**: ✅ — the fix targets the paged open flow (the only flow post-008).
- **P6 (regression test + gates)**: ✅ — the existing `[7]` test becomes a genuine pass (out of PAGED_KNOWN_GAP); the
  4 core gates stay green.
- **P5 (Word-COM oracle)**: N/A-as-primary — the deliverable is a DOC-MODEL fidelity fix (html→PM). The `[7]` test
  asserts the model (bold mark + content). The export-of-marks → Word path is already covered by `test:roundtrip`
  (the converter's bold/heading/list export is round-trip-validated independently); no NEW Word-COM claim is minted
  by this fix, so no new oracle ps1 is required. (Documented in research.md.)

## Root cause (spike-confirmed)

`replaceEditor`'s html leg did `pres.editor.chain().selectAll().insertContent(extra.html).run()`. In the paged PE,
`insertContent(htmlString)` inserts the markup as LITERAL TEXT (the spike: `markTypes:[textStyle]`,
`rawHtmlDumpedAsText:true`, the first text node = the whole `<!DOCTYPE html>…` string). `insertContent`'s
`createNodeFromContent` did not parse the html into nodes in this context. The overlay never hit this — it parsed via
the Editor constructor's `html` option (→ `createDocFromHTML`).

## Approach

Parse, don't insert-raw. In the html leg:
1. `const parsed = createDocFromHTML(extra.html, pres.editor)` → a doc node (real nodes/marks: bold mark, etc.).
2. Replace the whole (blank, from `replaceFile`) body with the parsed block fragment:
   `tr.replaceWith(0, doc.content.size, parsed.content)` → `view.dispatch(tr)`. This keeps the doc node's attrs
   (sectPr/page setup from the blank `replaceFile`) and swaps in the parsed content.
3. Keep the §5.3 data-loss guard (`landed = textContent.trim().length > 0`; if markup carried text but landed
   nothing → `lastImportBlanked` + return false).

`.txt` (openText → `<p>`-per-line html) and `.csv` (openCsv → table html) ride the same leg → fixed for free.

## Verification

- Spike (throwaway): `PM.openHtml(html)` → assert `markTypes:['bold']`, `rawHtmlDumpedAsText:false`, parsed texts.
  (Done — confirmed both pre-fix raw-dump and post-fix parse.)
- `[7]` test moved OUT of PAGED_KNOWN_GAP → runs as a genuine pass; `test:pm` 416/416, pagedKnownGaps 10→9.
- 4 gates: test:pm 416 / smoke 9 / roundtrip 27 / test:bundle 4.

## Risk / known limits

- The fork's schema represents Word-model headings/lists as styled paragraphs (not separate node types). The fix
  parses faithfully into that schema; the `[7]` bar (bold mark + content) is met. (Not a regression — the same
  schema the overlay produced.)
- `createDocFromHTML` requires a DOM (browser/renderer) — always present in the renderer; the catch degrades to a
  blank doc + the data-loss guard on any parse throw.
