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
    (verified via export-XML assertion). The style's border/shading visual cascade is a Phase-7 paint.
    *(Fix follow-up: the original commit wrote only the top-level attr, so the id was silently dropped
    on save despite the comment claiming round-trip.)*
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
  - `autoFitTable('fixed'|'contents'|'window')` — `'fixed'` sets `tableLayout:'fixed'` (works now);
    `'contents'`/`'window'` set the layout intent (`autofit`) + `'window'` marks width 100% (pct
    5000); the live-measurement reflow is a Phase-7 paint.
  - Private helper `getSelectedRowPositions(rect, selection, allWhenCaret?)` added (bottom of
    table.js) to resolve the absolute positions of the rows in the current selection for the
    row-sizing commands.
- **`textDirection` cell attr added (slice 6, 2026-06-09):** a new `textDirection` attribute (default
  `null`) on the `tableCell` (`extensions/table-cell/table-cell.js`) and `tableHeader`
  (`extensions/table-header/table-header.js`) nodes, rendering `writing-mode: vertical-rl` for `'tbRl'`
  and `vertical-lr` for `'btLr'`. Non-breaking (default null → no render output unless set); powers
  `setTextDirection`. Full BiDi/vertical metrics deferred to Phase 7.
- All other editing-engine logic (ProseMirror schema, extensions, converters, DOCX
  import/export) is unmodified from upstream commit 03ab3f3.

## License

This vendored code is derived from SuperDoc (AGPL-3.0). It is used and distributed
under the terms of the GNU Affero General Public License v3.0. A copy of the AGPL-3.0
is available at https://www.gnu.org/licenses/agpl-3.0.html.

Under AGPL-3.0, any modified version of this software that is made available over a
network must also make its complete source code available under the same license.
