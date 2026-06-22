# Contract — `WC.PM` section-breaks bridge verbs

New verb in `bridge/section-breaks.ts`, merged onto `WC.PM` in `bridge/index.ts`. No fork edit.

## New — P1 (Next Page) + P2 (types)

- `WC.PM.insertSectionBreak(type)` — `type ∈ 'nextPage'|'continuous'|'evenPage'|'oddPage'`. Runs
  `editor.commands.insertSectionBreakAtSelection()` (sets a paragraph-level `pPr/w:sectPr` on the caret's
  paragraph). For a non-`nextPage` type, then mutates that created `paragraphProperties.sectPr` to add/replace
  `<w:type w:val="…"/>` as the first child (owned write). `markDirty`. Returns `true` on success.

## Inactive-bridge fallback

`insertSectionBreak` → `false`.

## Invariants

- Single document-write path (the public command + the owned `w:type` write); model stays page-free
  (the `sectPr` is a paragraph property).
- `nextPage` writes a bare `w:sectPr` (Word's default Next-Page start); the other types add `w:type`.
- No fork edit (insertion = the public command; the type = an owned paragraph-attr write).
- In-app repagination is out of scope (export-faithful; the COM oracle validates `Sections.Count` + `SectionStart`).
