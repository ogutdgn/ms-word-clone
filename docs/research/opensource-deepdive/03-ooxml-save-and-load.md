# 03 — OOXML save & load (the `.docx` pipeline)

Source read locally: `opensource-solutions/docx` (dolanmiu, v9.7.1, MIT),
`opensource-solutions/prosemirror-docx` (curvenote, v0.6.1, MIT).

## The core problem: import is the hard half
**Neither MIT library can IMPORT a `.docx` into a model.** `dolanmiu/docx`'s only "read" path
(`patcher/from-docx.ts`) is a **template placeholder-replacer**, not a parser that yields
styles/sections/headers as editable state. `prosemirror-docx` is **write-only** (its README:
"export to, cannot read from .docx"). So a bare-PM stack gives an **asymmetric pipeline**:
- **SAVE:** PM model → custom serializer → `dolanmiu/docx` → `.docx`.
- **LOAD:** a *separate* importer (mammoth today, or a reimplemented OOXML→model importer later).

→ **Per-construct round-trip tests are mandatory** (open A → save → reopen → assert equal), because
save and load run unrelated codebases with no shared schema. This is exactly where SuperDoc's
*bidirectional* converter earns its keep — and why we mine it as a reference for an importer later.

## `dolanmiu/docx` (recommended for SAVE)
MIT, v9.7.1, **pure-JS** (deps: `jszip` — which we already ship — `xml`/`xml-js`, `hash.js`,
`nanoid`). Runs in **Node and the browser** (`Packer.toBlob/toBuffer/toBase64`). Very capable,
strictly more faithful than our current `html-to-docx`:
- **Section properties:** page size/orientation, margins (incl. header/footer/gutter), borders,
  columns, line numbers, page numbering, `titlePage`, **even/odd headers/footers**, vertical align,
  section break types. *Evidence:* `docx/src/file/document/body/section-properties/`.
- **Headers/footers, styles, numbering, tables** (with track-revision cell merge/insert/delete),
  images/drawing/textbox, math, **footnotes/endnotes**, **comments + replies**, bookmarks,
  internal/external hyperlinks, **fields** (`SimpleField`, `PAGE`, `SEQ`, `PAGEREF`), and a **TOC**
  field/SDT. *Evidence:* `docx/src/file/{paragraph/run,table,header,footnotes,track-revision,
  table-of-contents}/`.
- Backed by vendored ISO-29500 XSDs.

**Fidelity only materializes if our PM model + serializer carry the information.** PM has no built-in
pages/sections/headers/footers/fields/track-changes/comments — those become custom nodes/marks +
section wiring we own.

## `prosemirror-docx` (fork-able skeleton, too thin to depend on)
A small (~6 files, single maintainer) write-only walker that emits a `dolanmiu/docx` Document.
Default coverage: paragraph, heading 1-6, blockquote, code_block, hr, hard_break, ordered/bullet
lists, list_item, image, math, table; marks em/strong/link/code/sub/super/strike/underline/
smallcaps/allcaps. **Unknown node types throw.** It exposes `addSection/nextSection/setSectionConfig`
(headers/footers/page-geometry reachable) but the **default serializer never calls them**, and its
list numbering is ad-hoc (a fresh `abstractNum` per list, hardcoded indents, no style binding/restart).
→ **Fork it as a starting skeleton, not a dependency.** *Evidence:* `prosemirror-docx/src/
{serializer,schema,numbering,utils}.ts`.

## Edge cases (must design around)
- **No import** → keep a separate importer; round-trip fidelity is not free and must be tested.
- **Default serializer drops our features** — headers/footers, sections, TOC/fields, comments,
  track changes (which we *already* implement) are not in the default mapping → re-author each as a
  custom node/mark serializer, or they silently vanish from the `.docx`.
- **Faked pagination must be stripped before emit** — our spacer page-sheets are renderer-only;
  `dolanmiu` emits page size/margins + explicit breaks and Word reflows. Don't serialize spacers.
- **Lists/numbering** need a custom numbering serializer (restart/continue, multilevel, style reuse).
- **Images** need preloaded buffers + dimensions (`ImageRun` needs explicit type; data-URI/remote →
  `Uint8Array` first).

## Recommendation
Build a **custom `DocxSerializer` over `dolanmiu/docx`** mapping our full node/mark set (incl.
sections, headers/footers, fields/TOC, comments, track changes); fork `prosemirror-docx` for the
PM-walk skeleton; keep a **separate importer** for LOAD; make per-construct round-trip tests a hard
requirement. **Spike first:** emit one section + header/footer + one tracked change + one comment via
`dolanmiu/docx` to size the bespoke serializer before committing. If true single-schema bidirectional
fidelity becomes the priority, that's the trigger to reconsider lifting/reimplementing SuperDoc's
importer.
