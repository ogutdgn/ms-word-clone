# Research: Paged import fidelity (html/txt/csv)

## D1 — Where does the paged html import dump raw text? (spike)

**Decision**: The gap is `insertContent(htmlString)` in `replaceEditor`'s html leg (`bridge/index.ts`).
**Evidence**: Spike A/B/D — `PM.openHtml(html)`, `ed.commands.insertContent(html)`, and `insertContent(html,
{parseOptions})` ALL produced `rawHtmlDumpedAsText:true`, `markTypes:[textStyle]`, first text node = the whole
`<!DOCTYPE html>…` string. In the paged PE, `insertContent` does NOT parse an HTML string into nodes. No `setContent`
command exists (spike C).
**Alternatives rejected**: `insertContent` with parse options (still raw — D); a converter html path (the converter
is docx-oriented; out of scope + heavier).

## D2 — The no-fork parser

**Decision**: `createDocFromHTML(html, editor)` from `@core/helpers/index.js` — a PUBLIC fork helper.
**Rationale**: It is the SAME parser the Editor constructor uses for its `html` option (Editor.ts:2821, the path the
OVERLAY used) and that `replaceNodeWithHTML` uses (Editor.ts:4625). Importing + calling it is NOT a fork edit (P1
holds — we never modify `superdoc-fork/**`).
**Evidence**: Spike F — `ed.replaceNodeWithHTML(target, html)` (which calls `createDocFromHTML` internally) parsed to
`markTypes:['bold']`, `rawHtmlDumpedAsText:false`, texts `['Imported Title','plain with ','bold word','item one']`.
So `createDocFromHTML` works in the paged PE context.

## D3 — How to apply the parsed doc (full-body replace)

**Decision**: `tr.replaceWith(0, doc.content.size, parsed.content)` → `view.dispatch(tr)` — replace the whole body
of the blank doc (from `replaceFile(blankArrayBuffer())`) with the parsed block fragment.
**Rationale**: Keeps the doc node's attrs (sectPr / page setup from the blank `replaceFile`) and swaps in the parsed
content. A full-body replace (vs `replaceNodeWithHTML` on one node) preserves the parsed structure best.
**Evidence**: Post-fix spike A (`PM.openHtml`) → `markTypes:['bold']`, `rawHtmlDumpedAsText:false`, parsed texts.

## D4 — No new Word-COM oracle (the P5 scoping call)

**Decision**: 010 ships NO new `validate-*-win.ps1` oracle.
**Rationale**: 010 is a DOC-MODEL fidelity fix (html→PM nodes/marks). The deliverable is verified by the `[7]` test
asserting the model (bold mark + content). The downstream claim (an imported bold mark survives docx export → Word
reads it) mints NO new export behavior — the converter's bold/heading/list EXPORT is already round-trip-validated by
`test:roundtrip` (27) independently of how the marks got into the model. So no new Word-COM claim → no new oracle, per
the constitution's "every fidelity claim" being scoped to NEW claims. (If a future slice adds html-specific export
attrs, that would warrant an oracle.)

## D5 — txt/csv ride the same leg

**Decision**: No separate work for txt/csv.
**Rationale**: `PM.openText` → `textToParagraphHtml` → `openHtml`; `PM.openCsv` → table html → `openHtml`. Both go
through the SAME html leg, so the createDocFromHTML fix parses them too. (The pre-fix `[7]` txt/csv tests passed only
because they assert text PRESENCE, which survived even a raw-dump; they now parse properly.)
