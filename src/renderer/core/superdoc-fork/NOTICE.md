# NOTICE — Vendored SuperDoc Fork

## Upstream

- **Project:** SuperDoc
- **Repository:** https://github.com/opensource-solutions/SuperDoc
- **Git commit:** 03ab3f3
- **Published version:** 1.38.0
- **License:** AGPL-3.0

## What is vendored

The following upstream packages are included in this directory tree:

- `core/`, `extensions/`, `components/`, `utils/`, `schema/`, `types/` — the SuperDoc
  editors/v1 editing engine (core + all extensions + super-converter)
- `_vendor/superdoc/contracts/` — `@superdoc/contracts`
- `_vendor/superdoc/common/` — `@superdoc/common`
- `_vendor/superdoc/style-engine/` — `@superdoc/style-engine`
- `_vendor/superdoc/url-validation/` — `@superdoc/url-validation`
- `_vendor/superdoc/document-api/` — `@superdoc/document-api`
- `_vendor/superdoc/presentation-editor/` — `@superdoc/presentation-editor`
- `_vendor/superdoc/layout-adapter/` — layout-adapter sibling package

## Modifications made in this fork

- **Vue UI removed:** the Vue application shell (`SuperEditor.vue`, `Toolbar.vue`,
  `SuperInput.vue`, `AIWriter.vue`, `ContextMenu.vue`) and all Vue-rendered overlay
  surfaces are excluded from the build. Remaining `.vue` imports are stubbed to inert
  no-op components by a Vite plugin (`fork-vue-stub` in `electron.vite.config.ts`).
- **Telemetry routed to no-op:** `telemetry-noop.ts` replaces all analytics/telemetry
  calls so no network traffic is emitted during editor initialisation or operation.
- **Geometry helpers stubbed:** browser layout helpers that depend on a full DOM at
  module evaluation time are guarded or replaced with no-op stubs to allow headless
  operation in the Electron renderer.
- **Paragraph shading rendered:** `encodeCSSFromPPr` (core/super-converter/styles.js)
  additionally maps `paragraphProperties.shading.fill` → `background-color`; upstream
  imported/serialized w:shd but never painted it (slice 2, 2026-06-06).
- **SuperDoc align keymap removed:** `Mod-Shift-L/E/R/J` shortcuts deleted from the
  TextAlign extension — they shadow Word's Ctrl+Shift+L (List Bullet) semantics; the
  app already binds Word's real Ctrl+L/E/R/J in its document-level keydown map
  (app.js), and Ctrl+Shift+L's PM list wiring lands with the slice-2 area flip
  (slice 2, 2026-06-06).
- **`applyListDefinition` command added:** mints a list definition with explicit
  per-level `w:numFmt`/`w:lvlText` overrides and assigns it to the selection — powers
  the Word-style multilevel-list gallery and custom bullet glyphs (slice 2, 2026-06-06).
- **`changeListLevelBy` command added:** command-shaped wrapper applying an arbitrary
  list-level delta in one transaction (chained ±1 steps re-read stale editor.state and
  land one level short) — powers the Change List Level menu (slice 2, 2026-06-06).
- **SuperDoc heading keymap removed:** `Mod-Alt-1..6` shortcuts deleted from the
  Heading extension — they collide with the app's Ctrl/Cmd+Alt+1-3 heading chords
  (document-level keydown map) and their toggle-to-no-style semantics contradict
  Word's apply-only behavior (slice 3, 2026-06-06).
- **Four built-in style definitions added to import defaults:**
  `DEFAULT_LINKED_STYLES` (core/super-converter/exporter-docx-defs.js) additionally
  carries NoSpacing, Strong, Emphasis, SubtleEmphasis (Word-standard definitions) so
  `addDefaultStylesIfMissing` makes the full Quick-Styles gallery resolvable in every
  document, like real Word's always-available built-ins (slice 3, 2026-06-06).
- **resolvedPropertiesCache TableInfo fix:** both resolver entry points previously
  passed the raw `tableStyleId` string where the style-engine expects a TableInfo
  object — the table-style paragraph cascade was silently skipped for in-table
  paragraphs. Now builds `{ tableProperties, rowIndex, cellIndex, numRows, numCells }`
  with real indices from the ancestor chain (slice 3, 2026-06-06).
- **Format painter extended to Word scope:** `FormatCommands` stores paragraph
  properties (incl. numbering) alongside marks, captures first-run marks on a
  non-empty selection (oracle B9) and caret marks when collapsed, applies
  generically (replace-not-merge per oracle B6, `link` mark preserved per oracle
  B8), gains `cancelFormatPainter` (Esc path) and an idempotent `persistent`
  option on `copyFormat` (the 500ms double-click heuristic now only serves no-arg
  callers, fixing the ribbon click,click,dblclick disarm trap); the UI-guard
  selector covers the app's ribbon/flyout/dialog chrome so chrome clicks never
  consume the armed painter (slice 4, 2026-06-08).
  - The painter copies DIRECT character formatting + the paragraph style (not the
    resolved style cascade), matching Word — captured via the run's inline-override
    marks (`getFormattingStateAtPos(...).inlineMarks`), so a styled (e.g. Heading 1)
    source no longer bakes the style's font/color as explicit inline overrides on the
    target; the style travels via paragraphProperties (slice 4, 2026-06-08).
- **Search extension named + session extended for whole-word + Word wildcards:** the
  `Search` extension now declares `name: 'search'` (was the unnamed `'extension'`
  default, which left `extensionStorage.search` undefined and risked key collisions);
  `SearchIndex` gains `static wildcardToRegExp()` (Word "Use wildcards" → RegExp,
  oracle-matched operator set) and `isWholeWordMatch(start,end)` (word-boundary filter);
  `setSearchSession`, the search-index invalidator, AND `replaceSearchMatch` accept +
  thread `{wholeWord, useWildcards}`, building the pattern / post-filter accordingly.
  Non-destructive (decorations only), back-compatible (`search()` signature unchanged)
  (slice 5, 2026-06-09). Oracle fidelity fix (A4 verdict vs Word 16.77.1): wildcard
  searches are forced case-sensitive (`'g'` only, no `'i'`) — Word greys/ignores
  Match Case when Use Wildcards is on; our engine now matches this behavior in both
  `setSearchSession` and the search-index invalidator plugin (slice 5, 2026-06-09).
- **Table Tools commands added (slice 6, 2026-06-09):** net-new `addCommands` entries on the
  `table` extension (`extensions/table/table.js`), each mutating an EXISTING node attr via
  `tr.setNodeMarkup` / the prosemirror-tables `setCellAttr` (which honors a plain caret-in-cell
  and a CellSelection alike). Several land model/attr only with the visual cascade pagination-gated
  to Phase 7:
  - `setTableStyle(styleId)` — DUAL-WRITES the top-level `tableStyleId` AND the nested
    `tableProperties.tableStyleId` (preserving the rest of `tableProperties`). The nested key is the
    one the `w:tblPr` decoder iterates, so the id exports as `<w:tblStyle w:val="…">` and round-trips
    (verified via export-XML assertion).
    *(Fix follow-up: the original commit wrote only the top-level attr, so the id was silently dropped
    on save despite the comment claiming round-trip.)*
    *(T4 follow-up, 2026-06-10: the apply now also BAKES the style's stable visuals — see the
    dedicated "Table styles end-to-end" entry below; the original "visual cascade is a Phase-7
    paint" deferral is narrowed to banding/conditional formats only.)*
  - `setTableAlignment('left'|'center'|'right')` — sets table `justification` (+ `tableProperties.justification`); exports `<w:jc>`.
  - `setTableIndent(px)` — DUAL-WRITES the top-level `tableIndent: { width:<px>, type:'dxa' }` (the px
    shape the fork's layout reads, matching the importer's `twipsToPixels` projection) AND the nested
    `tableProperties.tableIndent: { value:<twips>, type:'dxa' }` (the OOXML measurement shape the
    `w:tblInd` decoder reads — `value` goes straight into `w:w` with NO px→twips conversion on export,
    so it must already be twips). Exports `<w:tblInd w:w="<twips>" w:type="dxa">` and round-trips
    (e.g. 48px → 720 twips; verified via export-XML assertion). *(Fix follow-up: the original commit
    wrote only the top-level px attr mislabeled `type:'dxa'`, so the indent never reached the save.)*
  - `setCellWidth(px)` — sets `colwidth` on every cell of the selected column(s) (column-scoped,
    matching Word; a per-cell width is re-normalized by the column-resizing plugin) and marks the
    table `userEdited`; best-effort pixel landing (Phase-7 layout).
  - `setRowHeight(px, rule)` — sets the row's `rowHeight` + `tableRowProperties.rowHeight:{value,rule}`.
  - `setCellMargins({top,right,bottom,left})` — `setCellAttr('cellMargins', …)`.
  - `setCellBorders(borders)` — `setCellAttr('borders', …)` (the set-path counterpart to the
    existing `deleteCellAndTableBorders` clear-path; the fork's tableStyleNormalization plugin then
    migrates `attrs.borders` → the canonical `tableCellProperties.borders`).
  - `distributeColumnsEvenly()` — writes an equal `colwidth` across all cells (best-effort; exact
    pixel landing is a Phase-7 layout refinement).
  - `distributeRowsEvenly()` — sets every row's `rowHeight` to the average; the height ATTR lands
    now, the visual row-height honoring is a pagination-gated Phase-7 paint.
  - `splitTableAtRow()` — splits the table at the caret's row boundary into two tables (separator
    paragraph between; mints a fresh `sdBlockId` for the second). KNOWN DEVIATION: refuses
    (returns false) when a vertically-merged (`rowspan>1`) cell straddles the boundary rather than
    corrupt the model — callers may `fixTables` and retry.
  - `convertTableToText(delimiter='\t')` — replaces the table node with one paragraph per row,
    cell text joined by the delimiter.
  - `convertTextToTable(delimiter='\t')` — parses the selected top-level paragraphs (split on the
    delimiter) into a table (rows = paragraphs, cols = max split count); handles an AllSelection
    (depth-0) range.
  - `setTextDirection('btLr'|'tbRl'|null)` — DUAL-WRITES the top-level `textDirection` cell attr (drives
    the writing-mode render, see the new cell attr below) AND the nested `tableCellProperties.textDirection`
    (preserving the rest), walking the selected cells itself (the prosemirror-tables `setCellAttr` would
    set only the top-level attr). The nested key is the one the `w:tcPr` decoder iterates, and a
    `w:textDirection` exporter translator already exists (wired into `tcPr`), so it exports as
    `<w:textDirection w:val="…">` and round-trips (verified via export-XML assertion). Basic CSS
    writing-mode lands now; vertical metrics / BiDi polish is Phase-7. *(Fix follow-up: the original
    commit wrote only the top-level attr, so the direction was silently dropped on save.)*
  - `autoFitTable('fixed'|'contents'|'window')` — `'fixed'` sets `tableLayout:'fixed'` AND deletes
    `tableProperties.tableWidth` (T3 fix, 2026-06-10: a previous `'window'` 100% stretch — or any
    explicit table width — is cleared; the absent key is the importer's no-explicit-width shape and
    Word's Fixed Column Width writes `w:tblW` type `auto`, so the table returns to its natural
    column-width-driven size); `'contents'`/`'window'` set the layout intent (`autofit`) +
    `'window'` marks width 100% (pct 5000); the live-measurement reflow is a Phase-7 paint.
  - Private helper `getSelectedRowPositions(rect, selection, allWhenCaret?)` added (bottom of
    table.js) to resolve the absolute positions of the rows in the current selection for the
    row-sizing commands.
  - `setCellBackground` caret fallback (T3 fix, 2026-06-10) — Word parity: upstream hard-returned
    `false` on a non-CellSelection; with a plain caret inside a table it now falls back to the
    caret-safe `setCellAttr('background', { color })` (prosemirror-tables resolves the caret cell
    via `selectionCell`), shading the caret cell like Word. The CellSelection multi-cell path and
    the hex normalization (strip leading `#`) are unchanged; outside a table it still returns false.
- **TableView margin-left write gated on an explicit indent (slice 6 fix, 2026-06-10):**
  `extensions/table/TableView.js` `updateColumns()` no longer unconditionally overwrites
  `table.style.marginLeft` from a zero indent (`tableIndent?.value ?? 0` always produced
  `'0px'`, stomping — on every NodeView construct/update — the justification margins
  `margin: 0 auto` / `margin-left: auto` that `updateTable()` had just applied from the
  renderDOM attrs, so `setTableAlignment('center'|'right')` was visually inert). The
  margin-left write now runs only for an explicit non-zero indent (honoring BOTH the
  canonical nested `tableProperties.tableIndent.value` twips shape and the top-level
  `tableIndent.width` px shape) or, when the table is not center/right justified, the
  legacy cell-padding/zero-indent default — justification margins now take effect;
  explicit indents still apply (and win over justification when both are set).
- **Table styles end-to-end (slice 6 T4, 2026-06-10):** table styles previously existed as a bare
  attr write — the referenced definition never reached `word/styles.xml` (real Word DROPS an
  orphaned `<w:tblStyle>` reference: slice-6 oracle Leg C) and nothing repainted in the clone.
  Five coordinated fork changes:
  - **Real-Word table-style definitions minted into `DEFAULT_LINKED_STYLES`**
    (`core/super-converter/exporter-docx-defs.js`), added by the existing
    `addDefaultStylesIfMissing` import hook (which is type-agnostic — no change needed):
    `TableGrid` (extracted byte-faithfully from `tests/fixtures/oracle-word-s6-tablestyles.docx`,
    a doc authored by REAL Word 16.77.1 via the AppleScript oracle for this task) and
    `GridTable4-Accent1` (extracted from the real-Word slice-3 fixture
    `tests/fixtures/oracle-word-s3-table.docx`), the latter with all six `w:tblStylePr`
    conditional blocks intact (they are what makes Word render the header row / banding).
    The two other ids the old hardcoded gallery offered (`GridTable5Dark-Accent2`,
    `ListTable3-Accent3`) had NO definition anywhere and were dropped — the gallery is now
    built dynamically from the runtime catalog (`WC.PM.getTableStyles()`), so it only offers
    styles that genuinely exist in the saved file. (AppleScript `set style of table` cannot
    instantiate those two latent styles, so no real-Word definition could be extracted for them.)
  - **`resolveTableStyleVisuals(editor, styleId, tblLook?)` helper added**
    (`extensions/table/tableHelpers/resolveTableStyleVisuals.js`): resolves a styleId from the
    runtime catalog (`converter.translatedLinkedStyles`) through the style-engine cascade
    primitives (`resolveTableProperties` for base `w:tblPr` borders down the basedOn chain;
    `resolveTableCellProperties` for the `w:tblStylePr` conditional cascade) into the fork's
    renderable shapes: the px `borders` table attr (importer projection) + the firstRow fill.
    `setTableStyle` bakes both at apply time (table borders with Word precedence — see the
    "direct table borders beat the baked style frame" entry below; first-row cell `background`
    honoring `tblLook.firstRow`), and
    `normalizeNewTableAttrs`'s style-resolved branch bakes the borders so newly inserted tables
    keep their TableGrid outline (the upstream comment's "borders come from the style at render
    time via `resolveTableProperties`" only ever existed in the layout-adapter, which the live PM
    view does not use; once TableGrid is minted, style resolution flips from 'none' to
    'builtin-fallback' and the old inline-fallback borders no longer apply). REMAINING DEFERRAL
    (Phase 7): banded rows/columns and the other conditional formats (lastRow, firstCol/lastCol
    run props, firstRow white-bold run props) are NOT baked — they would go stale on row/column
    edits (Word recomputes them dynamically); the exported file carries the full definition, so
    real Word renders the complete style. A row inserted above a baked first row also keeps the
    baked fill until the style is re-applied (same staleness class).
  - **`styleBakedBackground` provenance attr added** (default `null`, `rendered: false`) on
    `tableCell` (`extensions/table-cell/table-cell.js`) and `tableHeader`
    (`extensions/table-header/table-header.js`): records the hex a style bake wrote into
    `background` so (a) a re-apply/clear can replace OUR fill while an explicit user-set shading
    (direct formatting, which diverges from the marker) survives — Word precedence — and (b) the
    exporter can tell the two apart. Non-breaking (no render output; absent on user-shaded cells).
  - **Export suppression of style-baked fills**
    (`core/super-converter/v3/handlers/w/tc/helpers/translate-table-cell.js`): a cell whose
    `background.color` equals its `styleBakedBackground` is style-owned and emits NO explicit
    per-cell `<w:shd>` (the minted definition in styles.xml owns the look in Word — same contract
    as `tableCellPropertiesInlineKeys` for inherited tcPr). User shading exports unchanged.
  - **Import-side firstRow fill bake**
    (`core/super-converter/v3/handlers/w/tc/helpers/legacy-handle-table-cell-node.js`): the
    referenced table style's `w:tblStylePr[firstRow]` `w:tcPr` `w:shd` is now baked into first-row
    cell `background` attrs at import (gated on `tblLook.firstRow`, never overriding an explicit
    `w:tcPr`/`w:tblPr` shading, marked with `styleBakedBackground`) — previously only the style's
    borders/cellMargins were baked, so imported styled tables rendered the frame but lost the
    header-row fill; this also makes the clone's own save→reopen visually stable.
  - **Direct table borders beat the baked style frame (T4 review fix, 2026-06-10):** the original
    bake OVERWROTE `attrs.borders` with the style's borders (and cleared to `{}` on style removal),
    ignoring any existing DIRECT `tableProperties.borders` — importable from Word docs with explicit
    `w:tblBorders` (no UI-reachable table-level writer yet). Word precedence: direct borders win.
    The clone rendered the style frame until save→reopen, where the importer's merge
    (`{ ...referencedStyles.borders, ...borderProps }`, tbl-translator.js encode) flipped it back —
    the table changed appearance across its own save cycle. `setTableStyle` now mirrors that merge
    exactly: the direct `tableProperties.borders` are projected through the importer's OWN
    `_processTableBorders` px projection (imported from the tbl translator — a pure hoisted helper,
    no cycle back into the extension; single source of truth, no drift) and spread OVER the style
    visuals; on style CLEAR the attr falls back to the direct projection instead of `{}`.
  - **Explicit user shading clears the `styleBakedBackground` marker (T4 review Minor,
    2026-06-10):** `setCellBackground` (and therefore the bridge's `tableSetCellShading`, which
    routes through it) now nulls the provenance marker on the cells it shades — both the
    CellSelection path (`forEachCell`) and the caret fallback (`cellAround`), on the SAME
    transaction as the background write (CommandService threads one `tr` through nested
    `commands.*`). Without this, a user-picked color EQUAL to the previously baked fill stayed
    marker-matched ("style-owned") and the exporter suppressed its `<w:shd>` — a user choice
    must become user-owned and export.
- **Table-level inside borders paint cell gridlines (slice 6 gridline fix, 2026-06-10):** the
  table node's `borders` attr carries all six OOXML sides, but the renderDOM emitted
  `border-${key}` for EVERY key — `border-insideH`/`border-insideV` are invalid CSS and were
  silently dropped, and cells in the style-driven path carry no `borders` attr (the importer
  puts explicit `w:tcBorders` into the non-rendered `tableCellProperties.borders`; styled cells
  have neither), so every style-driven table — freshly inserted TableGrid AND imported
  real-Word styled tables (probe-verified on `tests/fixtures/oracle-word-s3-table.docx`) —
  rendered as a bare outer frame ("a big box", no row/column lines). RENDER-ONLY fix, two
  halves: the `borders` attr handler (`extensions/table/table.js`) now publishes visible
  `insideH`/`insideV` (val not `none`/`nil`, px size > 0 — so `deleteCellAndTableBorders`'
  size-0 write paints nothing) as the inherited custom properties
  `--wc-inside-h`/`--wc-inside-v` on the table's inline style, and
  `assets/styles/elements/prosemirror.css` paints INTERIOR cell edges from them (top edge of
  rows 2+, left edge of columns 2+ — outer edges stay table-frame-owned, Word's inside/outside
  split). No doc-model or export impact (nothing new in attrs; fresh tables stay free of direct
  `w:tcBorders`/`w:tblBorders`, like real Word's style-driven tables). A cell with an explicit
  `borders` attr keeps winning (its inline `border-*` style beats the stylesheet rule), and a
  `--wc-inside-*: none` reset on `table` stops an outer table's vars from leaking into nested
  tables. Conditional-format border overrides (e.g. a style's firstRow `w:tcBorders`) remain
  un-painted — same Phase-7 deferral as banding above.
- **`textDirection` cell attr added (slice 6, 2026-06-09):** a new `textDirection` attribute (default
  `null`) on the `tableCell` (`extensions/table-cell/table-cell.js`) and `tableHeader`
  (`extensions/table-header/table-header.js`) nodes, rendering `writing-mode: vertical-rl` for `'tbRl'`
  and `vertical-lr` for `'btLr'`. Non-breaking (default null → no render output unless set); powers
  `setTextDirection`. Full BiDi/vertical metrics deferred to Phase 7.
- **Word paste without conditional comments leaked literal list markers (slice 7, 2026-06-10):**
  `handleDocxPaste` (`core/inputRules/docx-paste/docx-paste.js`) only stripped Word list-marker
  runs wrapped in `<!--[if !supportLists]-->…<!--[endif]-->` comments
  (`extractAndRemoveConditionalPrefix`), but Chromium's clipboard sanitizer strips conditional
  comments — sanitized Word HTML carries the bare marker run (`style="mso-list:Ignore"`), which
  parsed into the model as literal text ("1.Alpha item", the slice-4 recorded leak). Fix: tag
  `mso-list:Ignore` runs up front with `data-mso-list-ignore` while the style attribute is
  still raw (the per-item `style.setProperty` calls re-serialize it and drop unknown `mso-*`
  entries) and remove them after the per-item pass, so the marker text still feeds list-start/punctuation detection and
  comment-wrapped runs keep going through the existing strip unchanged. Also guarded the
  unconditional `tempDiv.querySelector('style').innerHTML` deref — Word HTML without a
  `<style>` block threw a TypeError and aborted the whole paste; it now resolves to `''` and
  the paste proceeds with inline/default styles.
- **TOC `\u` applied-outline collection reads both outline-level keys (slice 9, 2026-06-12):**
  `collectTocSources` (`document-api-adapters/helpers/toc-entry-builder.ts`) `\u`
  (useAppliedOutlineLevel) branch read only `paragraphProperties.outlineLevel`, but the live
  outline setter `format.paragraph.setOutlineLevel`
  (`document-api-adapters/plan-engine/paragraphs-wrappers.ts`) persists the value under
  `paragraphProperties.outlineLvl` (the canonical OOXML `w:outlineLvl` key; `outlineLevel` is
  only the projected sd-props shape). A paragraph given an outline level via the setter (the
  clone's `refSetOutlineLevel` / Add Text → Level N) was therefore NOT collected into a `\u` TOC.
  Fix: read `paragraphProps?.outlineLevel ?? paragraphProps?.outlineLvl` (both 0-based, so
  `tocLevel = raw + 1` is unchanged). Reading `outlineLevel` first keeps the fork's own
  `toc-entry-builder.test.ts` fixtures (which set `outlineLevel`) byte-identical while collecting
  setter-applied levels.
- **Merge-field `fieldAnnotation` nodes exported as real Word field codes (slice 10, 2026-06-12):**
  `translate-field-annotation.js` gains a merge-field branch that fires when
  `attrs.fieldType` is in `MERGE_FIELD_CODES` (`MERGEFIELD`, `GREETINGLINE`, `NEXT`,
  `NEXTIF`, `MERGEREC`, `MERGESEQ`, `SET`, `ASK`, `SKIPIF`, `ADDRESSBLOCK`, `IF`,
  `FILLIN`). The fork's default path emits a `w:sdt` content control, which Word accepts
  but treats as a form field, not a mail-merge field — Word's own mail-merge engine
  ignores `w:sdt`-wrapped field codes. The branch maps each code to the OOXML shape Word
  actually writes: `MERGEFIELD`/`GREETINGLINE` → `<w:fldSimple w:instr=" MERGEFIELD … ">`
  with a `<w:noProof/>` result run; control fields (`NEXT`, `MERGEREC`, etc.) → a 3-run
  begin/instrText/end complex field (no result run, matching Word's own output); composite
  and rule fields (`ADDRESSBLOCK`, `IF`, `FILLIN`) → the shared 5-run `buildComplexFieldRuns`
  helper with `<w:noProof/>` in every run's `w:rPr`. Non-merge `fieldAnnotation` nodes
  (unrecognized or absent `fieldType`) fall through to the existing `w:sdt` path unchanged,
  keeping the docx round-trip gate green.
- **Word merge fields imported as `fieldAnnotation` PM nodes (slice 10, 2026-06-12):** the
  fork's importer now turns a Word `MERGEFIELD`/`ADDRESSBLOCK`/`GREETINGLINE`/`NEXT` (+ the
  rule codes `NEXTIF`/`MERGEREC`/`MERGESEQ`/`IF`/`FILLIN`/`ASK`/`SET`/`SKIPIF`) field into a
  `fieldAnnotation` node, flag-INDEPENDENT of `editor.options.annotations` (which the clone
  never sets, so the upstream `handleAnnotationNode` path never fires). Five coordinated
  additions, mirroring the `indexEntry` precedent exactly:
  - **Stage-1 preprocessor** `field-references/fld-preprocessors/mergefield-preprocessor.js`
    (`preProcessMergefieldInstruction`) collapses a merge field into an `sd:mergeField`
    OpenXmlNode (`{ name:'sd:mergeField', attributes:{ instruction }, elements }`). Mirrors
    `xe-preprocessor.js`. Covers BOTH the `w:fldSimple` and the combined `w:fldChar` forms —
    `preProcessNodesForFldChar` dispatches both through `getInstructionPreProcessor` by keyword.
  - **Registry** `field-references/fld-preprocessors/index.js` — the field keywords above are
    added as `case` lines in `getInstructionPreProcessor` (before `default`), all returning
    `preProcessMergefieldInstruction`.
  - **`NodeTranslator`** `v3/handlers/sd/mergeField/mergeField-translator.js` (+ `index.js`
    barrel): a `NodeTranslator.from(config)` instance whose `encode` maps `sd:mergeField` →
    `{ type:'fieldAnnotation', attrs:{ type:'text', fieldType:<code>, fieldId, displayLabel:«…»,
    defaultDisplayLabel } }`. Uses a UNIQUE `sdNodeOrKeyName` (`'fieldAnnotation-mergeField'`)
    to avoid a decode-routing collision with the `w:sdt` translator's `'fieldAnnotation'`;
    `decode` is an inert `() => null` (export goes via `translate-field-annotation.js`).
  - **v2 handler entity** `v2/importer/mergefieldImporter.js` —
    `generateV2HandlerEntity('mergeFieldHandler', translator)`. MANDATORY: registering only in
    the v3 `translatorList` makes `passthroughNodeImporter` REFUSE the node (it skips anything in
    `registeredHandlers`) and the node is dropped.
  - **`v2/importer/docxImporter.js` wiring** — `mergeFieldHandlerEntity` is imported and inserted
    into the `defaultNodeListHandler` `entities` array next to `indexEntryHandlerEntity`, BEFORE
    `passthroughNodeHandlerEntity`.
  KNOWN deviation (ledger C, D10.12): the encode discards `node.elements` (the cached result runs)
  and reconstructs the label from the instruction — lossless for MERGEFIELD, but a
  previewed/merged ADDRESSBLOCK/GREETINGLINE source imports as the `«…»` placeholder, not the
  rendered multi-line text.
- `extensions/linked-styles/linked-styles.js` — NET-NEW `redefineNamedStyles(updates, {export})` command
  (slice 10 PR2 themes): redefines named-style definitions (Heading1/Title/Normal …) for real Word fidelity.
  Mutates BOTH the export structure (`translatedLinkedStyles.styles` + `syncStylesDiffToConvertedXml`) and the
  visual structure (`converter.linkedStyles[].definition.styles`), then forces a linked-styles decoration regen
  (re-stamp styled paragraphs, addToHistory:false) and emits `stylesDefaultsChanged`. `{export:false}` = visual-only
  (hover preview). Imports `syncStylesDiffToConvertedXml` from `core/helpers/styles-xml-helpers`.
- `extensions/document/document.js` — NET-NEW `background` doc-node attr (slice 10 themes): raw <w:background>
  element JSON, rendered:false (export-only, mirrors bodySectPr).
- `core/super-converter/exporter.js` (`translateDocumentNode`) — NET-NEW: inject <w:background> as the first child
  of <w:document> from the doc node's `background` attr.
- `core/super-converter/v2/importer/docxImporter.js` (`createDocumentJson`) — NET-NEW: read the <w:background>
  sibling of <w:body> into result.attrs.background (round-trips with the exporter).
- `core/super-converter/v2/importer/settings-background.js` — NET-NEW `ensureDisplayBackgroundShape(converter,on)`:
  add/removes <w:displayBackgroundShape/> in word/settings.xml so Word renders the page color on open.
- `extensions/shape-textbox/shape-textbox.js` — NET-NEW `insertTextBox` command (slice 10 PR3): inserts an editable
  shapeContainer>shapeTextbox>paragraph; the existing VML exporter synthesizes a real <v:textbox>/<w:txbxContent>.
- `extensions/vector-shape/vector-shape.js` — NET-NEW `isWordArt` attr + `synthesizeWordArtDrawing` + `insertWordArt`
  command (slice 10 PR3): inserts a vectorShape with a synthesized DrawingML blob (wps:wsp + bodyPr fromWordArt +
  a:prstTxWarp + w14:textFill) on drawingContent; the replay exporter re-emits it (round-trips Word + fork). Sets
  textContent for a flat in-app SVG render (warp renders in Word only).
- extensions/vector-shape/vector-shape.js — NET-NEW isInk attr + synthesizeInkDrawing + insertInkShape command (slice 10 PR4): inserts a real a:custGeom freeform ink shape (wp:anchor|wp:inline) replayed by translateVectorShape.
- All other editing-engine logic (ProseMirror schema, extensions, converters, DOCX
  import/export) is unmodified from upstream commit 03ab3f3.

## License

This vendored code is derived from SuperDoc (AGPL-3.0). It is used and distributed
under the terms of the GNU Affero General Public License v3.0. A copy of the AGPL-3.0
is available at https://www.gnu.org/licenses/agpl-3.0.html.

Under AGPL-3.0, any modified version of this software that is made available over a
network must also make its complete source code available under the same license.
