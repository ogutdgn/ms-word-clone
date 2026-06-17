# ms-word-clone — Feature Improvements (Table & Picture contextual tabs)

Gap analysis vs **real Microsoft Word for Windows** (ADR-0006: M365 Current Channel, build 16.0.20026.20168). Per feature: Word behavior, clone state (works / partial / stub / missing / wrong), priority (P1 core · P2 · P3 niche), where in the clone code, and how to implement. Bugs and improvements are connected — improvements ADD/COMPLETE features; bugs FIX wrong behavior (cross-ref BUGS-DETAILED.md).

**Totals:** 76 features across 4 tabs — 2 wrong · 36 missing · 2 stub · 24 partial · 12 works

**Gaps to close (missing/stub/partial/wrong), by priority:** P1=9 · P2=37 · P3=18

---

## Table — Layout tab (Table Tools contextual)

**Real Word tab inventory:** Table — Select (dropdown: Select Cell / Select Column / Select Row / Select Table) · Table — View Gridlines (toggle: show/hide non-printing cell gridlines) · Table — Properties (opens Table Properties dialog: Table/Row/Column/Cell/Alt Text tabs) · Draw — Draw Table (pen cursor to draw cell borders) · Draw — Eraser (erase cell borders / merge by erasing) · Rows & Columns — Delete (dropdown: Delete Cells / Delete Columns / Delete Rows / Delete Table) · Rows & Columns — Insert Above · Rows & Columns — Insert Below · Rows & Columns — Insert Left · Rows & Columns — Insert Right · Rows & Columns — dialog launcher (Insert Cells dialog) · Merge — Merge Cells · Merge — Split Cells (dialog: number of columns/rows) · Merge — Split Table · Cell Size — AutoFit (dropdown: AutoFit Contents / AutoFit Window / Fixed Column Width) · Cell Size — Table Row Height (spinner, inches, applies to selected rows) · Cell Size — Table Column Width (spinner, inches, applies to selected columns) · Cell Size — Distribute Rows · Cell Size — Distribute Columns · Cell Size — dialog launcher (Table Properties → Row/Column) · Alignment — Align Top Left · Alignment — Align Top Center · Alignment — Align Top Right · Alignment — Align Center Left · Alignment — Align Center (middle) · Alignment — Align Center Right · Alignment — Align Bottom Left · Alignment — Align Bottom Center · Alignment — Align Bottom Right · Alignment — Text Direction (cycles horizontal / rotate-90 / rotate-270) · Alignment — Cell Margins (opens Table Options dialog: default cell margins + cell spacing) · Data — Sort (dialog: up to 3 sort keys, type, asc/desc, header row) · Data — Repeat Header Rows (toggle: repeat selected header rows at top of each page) · Data — Convert to Text (dialog: separator paragraph/tab/comma/other) · Data — Formula (dialog: =SUM/AVERAGE etc., number format, paste function)

| Feature | Group | State | Pri | Word behavior |
|---|---|---|---|---|
| Repeat Header Rows | Data | **wrong** | P2 | Toggle: marks the selected header row(s) to repeat at the top of each page when the table spans pages (w:tblHeader on th |
| Header Column toggle | Data (clone) / N/A in Word Layout | **wrong** | P3 | Word has NO 'Header Column' button on the Layout tab — first-column emphasis is a tblLook checkbox on the Table Design t |
| Properties (Table Properties dialog) | Table | **missing** | P2 | Opens the multi-tab Table Properties dialog (Table: alignment/indent/text-wrap; Row: height; Column: width; Cell: width/ |
| Select (Cell/Column/Row/Table) | Table | **missing** | P2 | Dropdown to programmatically select the current cell, column, row, or whole table. |
| Sort | Data | **missing** | P2 | Opens the Sort dialog: up to 3 sort keys, type (text/number/date), ascending/descending, header-row option. |
| View Gridlines | Table | **missing** | P2 | Toggles display of the light-blue non-printing cell gridlines (visible only for borderless tables). |
| Eraser (table border eraser) | Draw | **missing** | P3 | Erases cell borders, effectively merging cells by removing the divider. |
| Formula | Data | **missing** | P3 | Opens the Formula dialog: =SUM(ABOVE)/AVERAGE/etc., number format, paste-function list; inserts a calculated field. |
| Draw Table | Draw | **stub** | P3 | Pen cursor to draw new cell borders / subdivide cells by dragging. |
| Alignment — 9 cell-content align buttons | Alignment | **partial** | P1 | 3x3 grid: top/center/bottom vertical x left/center/right horizontal, sets the caret/selected cells' text alignment. |
| AutoFit (Contents / Window / Fixed Column Width) | Cell Size | **partial** | P2 | Dropdown: AutoFit Contents shrinks columns to content; AutoFit Window stretches to text-column width; Fixed locks widths |
| Cell Margins | Alignment | **partial** | P2 | Opens the Table Options dialog: default cell margins (top/bottom/left/right) + cell spacing + 'automatically resize to f |
| Convert to Text | Data | **partial** | P2 | Dialog: choose separator (paragraph marks / tabs / commas / other); converts the table to delimited text. |
| Delete (Cells/Columns/Rows/Table) | Rows & Columns | **partial** | P2 | Single split-button dropdown: Delete Cells (with shift dialog), Delete Columns, Delete Rows, Delete Table. |
| Distribute Rows | Cell Size | **partial** | P2 | Equalizes the height of selected rows. |
| Split Cells | Merge | **partial** | P2 | Opens a dialog asking number of columns/rows; splits the current/selected cell into that grid. |
| Table Column Width spinner | Cell Size | **partial** | P2 | Live numeric spinner (inches) setting the selected columns' width; shows current value. |
| Table Row Height spinner | Cell Size | **partial** | P2 | A live numeric spinner (inches) that sets the selected rows' height; shows current value. |
| Text Direction | Alignment | **partial** | P2 | Cycles cell text direction: horizontal -> rotate all text 90 (top-to-bottom) -> rotate 270 (bottom-to-top). |
| Insert Above / Insert Below / Insert Left / Insert Right | Rows & Columns | **works** | P1 | Inserts a row above/below or a column left/right of the current cell; with a multi-row/col selection inserts that many. |
| Merge Cells | Merge | **works** | P1 | Merges the selected (multi-cell) CellSelection into one cell. |
| Distribute Columns | Cell Size | **works** | P2 | Equalizes the width of selected columns. |
| Split Table | Merge | **works** | P2 | Splits the table into two tables at the current row (inserts an empty paragraph between). |

### Improvements to make (this tab)

- **[P2 · wrong] Repeat Header Rows** (Data)
  - Word: Toggle: marks the selected header row(s) to repeat at the top of each page when the table spans pages (w:tblHeader on the row).
  - Where: table-tools-pm.js:55 (label 'Header Row') -> commands.js:124 -> table.ts:95-99 (tableToggleHeaderRow -> toggleHeaderRow)
  - How: MISLABELED/MISPLACED. The clone's 'Header Row' button toggles the header-CELL type (tableHeader vs tableCell) which is a Table DESIGN concept; Word's Data-group control is 'Repeat Header Rows' (the page-repeat flag). The fork's toggleHeaderRow DOES also set tableRowProperties.repeatHeader (table.js:1343), so the export side is partly right, but the button is named 'Header Row'/'Header Column' and grouped under Data, conflating two distinct Word features. Also the actual page-repeat RENDER is pagination-gated (row-split-across-pages deferred, §A.1e). Improvement: rename to 'Repeat Header Rows', keep it a state-aware toggle; move header-styling toggles to Table Design's tblLook options.
- **[P3 · wrong] Header Column toggle** (Data (clone) / N/A in Word Layout)
  - Word: Word has NO 'Header Column' button on the Layout tab — first-column emphasis is a tblLook checkbox on the Table Design tab.
  - Where: table-tools-pm.js:56 -> commands.js:125 -> table.ts:101-105 (toggleHeaderColumn)
  - How: Extra control that doesn't belong on Word's Layout tab; it's a Table Design (tblLook firstColumn) concern. Functionally toggles header-column cells. Improvement: remove from Layout/Data and surface as a Table Design 'First Column' option.
- **[P2 · missing] Properties (Table Properties dialog)** (Table)
  - Word: Opens the multi-tab Table Properties dialog (Table: alignment/indent/text-wrap; Row: height; Column: width; Cell: width/vertical-align; Alt Text).
  - Where: absent — no tblProperties cmd; the underlying verbs (tableSetAlignment, tableSetIndent, tableSetCellWidth, tableSetRowHeight, tableSetCellVAlign, alt text) ALL exist in table.ts but are scattered across other buttons
  - How: The unified Properties dialog is missing even though every field it would drive already exists as a bridge verb. Building it is mostly a UI assembly job (one dialog wrapping existing verbs) — high user value, medium effort. P2.
- **[P2 · missing] Select (Cell/Column/Row/Table)** (Table)
  - Word: Dropdown to programmatically select the current cell, column, row, or whole table.
  - Where: absent — no tblSelect cmd in table-tools-pm.js; no select-row/col/table verb in table.ts
  - How: Missing from the Layout tab. prosemirror-tables HAS the primitives (CellSelection.colSelection/rowSelection, setCellSelection — see tableSelectFirstRowPair in table.ts:323) so wiring Select Row/Column/Table is low effort. Useful as a precursor to Delete/Distribute/Sort. P2.
- **[P2 · missing] Sort** (Data)
  - Word: Opens the Sort dialog: up to 3 sort keys, type (text/number/date), ascending/descending, header-row option.
  - Where: absent — no tblSort cmd in table-tools-pm.js; no sort verb in table.ts; grep of fork table.js shows no table-sort command
  - How: Entirely missing. A real Word Data-group staple. Needs a new fork command (reorder rows by a chosen column's text/number/date key, asc/desc, honor header row) + a Sort dialog + ribbon button. Medium effort; high visibility for data tables.
- **[P2 · missing] View Gridlines** (Table)
  - Word: Toggles display of the light-blue non-printing cell gridlines (visible only for borderless tables).
  - Where: absent — no tblViewGridlines cmd; no gridline toggle in table-tools-pm.js or CSS toggle hook
  - How: Missing. Purely a view toggle (a body class that draws 1px dashed gridlines on cells without explicit borders). No model/export impact, low effort. Helpful because borderless tables are invisible to edit otherwise. P2.
- **[P3 · missing] Eraser (table border eraser)** (Draw)
  - Word: Erases cell borders, effectively merging cells by removing the divider.
  - Where: absent — note the 'eraser' cmd in the codebase is the DRAW/ink eraser (commands.js:1608, ink-overlay.ts), unrelated to table borders
  - How: Table-border eraser is missing; closest real behavior is Merge Cells. Niche; P3. Do not confuse with the ink Eraser.
- **[P3 · missing] Formula** (Data)
  - Word: Opens the Formula dialog: =SUM(ABOVE)/AVERAGE/etc., number format, paste-function list; inserts a calculated field.
  - Where: absent — no tblFormula cmd anywhere; no formula field support in table.ts/commands.js
  - How: Missing. Word inserts a field (={SUM(ABOVE)}) that recalculates. Needs a formula parser/evaluator over cell references (ABOVE/LEFT/A1) + a field insert + dialog. Higher effort, niche; P3.
- **[P3 · stub] Draw Table** (Draw)
  - Word: Pen cursor to draw new cell borders / subdivide cells by dragging.
  - Where: absent on this tab; the Insert-tab Draw Table already degrades to an honest toast (deferrals.md line 408 'Draw-Table inserts now show an honest toast')
  - How: No PM construct; layout-pass dependent. Word-faithful free-draw of borders is far out of scope. Leave as honest toast / omit. P3.
- **[P1 · partial] Alignment — 9 cell-content align buttons** (Alignment)
  - Word: 3x3 grid: top/center/bottom vertical x left/center/right horizontal, sets the caret/selected cells' text alignment.
  - Where: table-tools-pm.js:47-49 (only 3 buttons: Align Top/Middle/Bottom) -> commands.js:127-129 -> table.ts:117-121 (setCellAttr verticalAlign)
  - How: Only the 3 VERTICAL-alignment buttons exist. The other 6 of Word's 9 combine vertical + HORIZONTAL paragraph alignment in one click; clone has no combined buttons and relies on the Home tab for horizontal. Improvement: add the full 3x3 (each button sets BOTH verticalAlign cell attr AND paragraph alignment). P1 because it's a core, visible table-formatting affordance.
- **[P2 · partial] AutoFit (Contents / Window / Fixed Column Width)** (Cell Size)
  - Word: Dropdown: AutoFit Contents shrinks columns to content; AutoFit Window stretches to text-column width; Fixed locks widths.
  - Where: table-tools-pm.js:44 -> commands.js:211-215 (flyout) -> table.ts:302-316 + measureColumnContentWidths (table.ts:259-300)
  - How: Window + Fixed are oracle-validated and work. AutoFit CONTENTS reflow is layout-gated (deferrals §A.1e): the per-column content measurement is best-effort DOM reflow, EXPORT intent is correct but in-app reflow is approximate. Keep but note the keystone dependency.
- **[P2 · partial] Cell Margins** (Alignment)
  - Word: Opens the Table Options dialog: default cell margins (top/bottom/left/right) + cell spacing + 'automatically resize to fit contents'.
  - Where: table-tools-pm.js:51 -> commands.js:139-176 (4-side inches flyout, prefills via tableGetCellMargins) -> table.ts:170-201
  - How: Good: a 4-side inches flyout that prefills the caret cell's current margins. Gaps vs Word: (a) sets the CARET CELL margins (w:tcMar) not the TABLE DEFAULT cell margins (w:tblCellMar) which is what Word's Cell Margins button does; (b) no cell-spacing field; (c) no 'fit contents' checkbox. Improvement: target table-default margins + add cell spacing.
- **[P2 · partial] Convert to Text** (Data)
  - Word: Dialog: choose separator (paragraph marks / tabs / commas / other); converts the table to delimited text.
  - Where: table-tools-pm.js:54 -> commands.js:126 (hardcoded '\t') -> table.ts:227-231 (convertTableToText)
  - How: Works but the separator is HARDCODED to tab with no dialog. Word lets you pick paragraph/comma/tab/other. Improvement: add a small separator-picker flyout before calling convertTableToText. NOTE: the INVERSE (Convert Text to Table) is reachable in the engine (table.ts textToTable) but is NOT exposed on this Layout tab and its Insert-tab entry is a dead toast — already logged as BUG-016.
- **[P2 · partial] Delete (Cells/Columns/Rows/Table)** (Rows & Columns)
  - Word: Single split-button dropdown: Delete Cells (with shift dialog), Delete Columns, Delete Rows, Delete Table.
  - Where: table-tools-pm.js:30-32 (three separate buttons tblDeleteRow/Column/Table) -> commands.js:116-118 -> table.ts:61-77
  - How: Delete Row/Column/Table each work as separate buttons. MISSING vs Word: (a) it should be ONE 'Delete' dropdown not three flat buttons; (b) 'Delete Cells' (with the shift-cells-up/left dialog) is absent entirely — no deleteCells verb. Low-effort polish: regroup into a dropdown; deleteCells needs a new fork command.
- **[P2 · partial] Distribute Rows** (Cell Size)
  - Word: Equalizes the height of selected rows.
  - Where: table-tools-pm.js:42 -> commands.js:122 -> table.ts:215-219 (distributeRowsEvenly)
  - How: Command wired; model attrs set. The HEIGHT render of distributed rows is layout-pass-deferred (deferrals.md §A 'distribute-rows height render'). Export/model correct, visual equalization approximate.
- **[P2 · partial] Split Cells** (Merge)
  - Word: Opens a dialog asking number of columns/rows; splits the current/selected cell into that grid.
  - Where: table-tools-pm.js:36 -> commands.js:120 -> table.ts:89-93 (editor.commands.splitCell())
  - How: Clone does a single 1->2 splitCell with NO dialog. Word's Split Cells prompts for an arbitrary cols x rows grid and 'merge cells before split'. Improvement: add a flyout/dialog collecting cols & rows and loop splitCell, or a dedicated fork splitCells(cols,rows) command.
- **[P2 · partial] Table Column Width spinner** (Cell Size)
  - Word: Live numeric spinner (inches) setting the selected columns' width; shows current value.
  - Where: table-tools-pm.js:41 (dropdown 'Column Width') -> commands.js:237-238 -> table.ts:158-162 (setCellWidth)
  - How: Dropdown flyout + inches input, not an inline spinner; does not prefill current width. Functional (oracle: 1.5" -> 108pt). Improvement: inline spinner + prefill.
- **[P2 · partial] Table Row Height spinner** (Cell Size)
  - Word: A live numeric spinner (inches) that sets the selected rows' height; shows current value.
  - Where: table-tools-pm.js:40 (dropdown 'Row Height') -> commands.js:235-236 -> table.ts:164-168 (setRowHeight px,'atLeast')
  - How: Implemented as a dropdown flyout with an inches input + presets, NOT Word's inline spinner. Sets w:trHeight heightRule=atLeast (oracle-validated). Improvement: render as a true ribbon spinner that prefills the caret row's current height; also Word offers 'exactly' vs 'at least' rule (clone hardcodes atLeast).
- **[P2 · partial] Text Direction** (Alignment)
  - Word: Cycles cell text direction: horizontal -> rotate all text 90 (top-to-bottom) -> rotate 270 (bottom-to-top).
  - Where: table-tools-pm.js:50 -> commands.js:130 (hardcoded 'tbRl') -> table.ts:239-243 (setTextDirection)
  - How: Single button hardwired to one direction ('tbRl'); does NOT cycle through Word's three states (horizontal / tbRl / btLr) and cannot return to horizontal. Improvement: make it cycle / track current direction.

**Top:** Add the 6 missing combined cell-alignment buttons so the Alignment group is the full Word 3x3 (each sets BOTH the cell verticalAlign attr AND the paragraph horizontal alignment in one click). Today only the 3 vertical buttons exist (table-tools-pm.js:47-49) — this is the most visible everyday table-formatting gap and is P1.; Build the Data group properly: (a) ADD Sort (new fork row-reorder command + Sort dialog — currently entirely missing), (b) RENAME the mislabeled 'Header Row' button to 'Repeat Header Rows' and make it a state-aware toggle (table-tools-pm.js:55 conflates header-cell styling with the page-repeat flag), (c) give Convert to Text a separator picker instead of the hardcoded tab (commands.js:126), (d) add Formula (P3).; Add the Table group (Select dropdown, View Gridlines toggle, Properties dialog). All three are missing; the primitives mostly exist already — Select via prosemirror-tables CellSelection.row/colSelection, View Gridlines is a pure CSS body-class toggle, and the Properties dialog is just a UI shell over the existing tableSetAlignment/Indent/CellWidth/RowHeight/VAlign bridge verbs (table.ts). High value, mostly UI assembly.; Convert Row Height / Column Width from dropdown flyouts into true inline ribbon spinners that PREFILL the caret row/column's current value, and expose the 'exactly' vs 'at least' height rule (currently hardcoded 'atLeast' in commands.js:236). Same for making Text Direction cycle through Word's three states instead of the single hardcoded 'tbRl' (commands.js:130).; Flesh out the half-built dialogs: Split Cells should prompt for an arbitrary cols x rows grid (currently a single 1->2 splitCell, table.ts:89-93); Cell Margins should target the TABLE-DEFAULT cell margins (w:tblCellMar) plus cell spacing rather than only the caret cell's w:tcMar (table.ts:170-201); add a 'Delete Cells' option and fold Delete Row/Column/Table into one Delete dropdown to match Word's layout.

_Scope: the Table Layout tab is NOT in ribbon-data.js — it is runtime-injected by table-tools-pm.js (layoutTab(), lines 22-60) and only appears when the caret is inside a table (syncContextualTabs, lines 84-97). So the clone ships a deliberately reduced subset of Word's Layout tab (5 groups: Rows & Columns, Merge, Cell Size, Alignment, Data) and OMITS Word's entire 'Table' group (Select/View Gridlines/Properties) and 'Draw' group (Draw Table/Eraser), and within the kept groups omits Sort, Formula, the dialog launchers, Delete Cells, and 6 of the 9 alignment buttons.

Dedup notes: BUG-016 (Insert-tab Convert Text to Table dead toast over a working bridge) is ALREADY logged in BUG-LEDGER.md:292 / BUGS-DETAILED.md:409 — I did NOT re-report it; I only note that the Layout tab itself has no Text-to-Table entry. BUG-005 (restrict-editing read-only LEAK) applies to all table edits too but is already logged. The AutoFit-Contents in-app reflow, distribute-rows height render, row-split-across-pages (repeat-header render), and table relocate are KEYSTONE-DEFERRED in deferrals.md §A.1e and line 371 (the slice-6 recorded deferrals list: tblLook checkboxes, ~50-style gallery, border pen/Border Painter, Height/Width spinners, View Gridlines/Draw/Eraser/Properties, Cell Margins dialog, AutoFit-Contents, banded-row render, text-direction gallery) — I marked those P2/P3 with the layout-gate noted rather than as fresh improvements.

Verification basis: read table-tools-pm.js (tab def + handlers), bridge/table.ts (all verbs), commands.js:108-242 + 1587 (dispatch + dropdown allow-list), bridge/index.ts (DEFERRED/ENGINE_READY — table cmds are mapped to 'insert-basics' so none are D6-blocked; the contextual tab is fully reachable), and fork extensions/table/table.js (confirmed NO sort/formula/select-row commands exist, but splitCell/setRowHeight/distribute/convertTableToText/setTextDirection/repeatHeader DO). File paths cited are absolute-resolvable under src/renderer/._

---

## Table — Design tab (Table Tools › Table Design contextual ribbon)

**Real Word tab inventory:** Table Style Options (checkboxes) — Header Row · Table Style Options — Total Row · Table Style Options — Banded Rows · Table Style Options — First Column · Table Style Options — Last Column · Table Style Options — Banded Columns · Table Styles — Styles gallery (Plain Tables / Grid Tables / List Tables, all Accent variants, with live-preview on hover) · Table Styles — gallery More/scroll button (expand the full gallery) · Table Styles — Modify Table Style… (gallery footer) · Table Styles — Clear (gallery footer; removes table style) · Table Styles — New Table Style… (gallery footer) · Table Styles — Shading split-button (theme colors + Standard Colors + No Color + More Colors… + recent) · Borders — Border Styles gallery (themed sample-border presets dropdown) · Borders — Line Style dropdown (no border / single / dotted / dashed / double / etc.) · Borders — Line Weight dropdown (¼ pt … 6 pt) · Borders — Pen Color dropdown (theme + standard + more colors) · Borders — Borders split-button dropdown (Bottom, Top, Left, Right, No Border, All Borders, Outside Borders, Inside Borders, Inside Horizontal, Inside Vertical, Diagonal Down, Diagonal Up, Borders and Shading…) · Borders — Border Painter toggle (paint borders with the chosen pen)

| Feature | Group | State | Pri | Word behavior |
|---|---|---|---|---|
| Table Style Options group (the whole 6-checkbox group: Header Row, Total Row, Banded Rows, First Column, Last Column, Banded Columns) | Table Style Options | **missing** | P1 | Six checkboxes that toggle the table's w:tblLook conditional-format flags; the table style instantly repaints emphasis o |
| Line Style dropdown (pen line style: none/single/dotted/dashed/double…) | Borders | **missing** | P2 | Sets the active border pen's line style used by the Borders dropdown and Border Painter. |
| Line Weight dropdown (¼–6 pt) | Borders | **missing** | P2 | Sets the active pen's border width. |
| Pen Color dropdown | Borders | **missing** | P2 | Sets the active pen's border color (theme/standard/more colors). |
| Table Styles gallery — live hover preview | Table Styles | **missing** | P2 | Hovering a style thumbnail temporarily applies it to the table; mouse-out reverts. |
| Border Painter (toggle) | Borders | **missing** | P3 | Toggle that turns the cursor into a border brush; clicking/dragging cell edges paints the active pen onto them; Esc/re-c |
| Border Styles gallery (themed sample-border presets) | Borders | **missing** | P3 | Dropdown of pre-built border samples (combinations of style+weight+color matched to the theme) that set the active pen i |
| Modify Table Style… | Table Styles | **missing** | P3 | Opens the Modify Style dialog scoped to a table style (edit conditional formats per Whole table / Header row / Banded ro |
| New Table Style… | Table Styles | **missing** | P3 | Create a brand-new named table style and add it to styles.xml. |
| Borders split-button dropdown (edge selection: All/No/Outside/Inside/Inside-H/Inside-V/Top/Bottom/Left/Right/Diagonal/Borders and Shading…) | Borders | **partial** | P1 | 12+ edge presets that apply the CURRENT pen (line style/weight/color) to the chosen edges of the selected cells; plus 'B |
| Header Row toggle (specifically) | Table Style Options | **partial** | P1 | Checkbox controlling tblLook firstRow — emphasizes the header row per the table style AND marks the row to repeat across |
| Shading split-button (apply cell/table fill) | Table Styles | **partial** | P1 | Theme-color grid + Standard Colors + No Color + More Colors… + recent; applies to selected cell(s); the main button repe |
| Table Styles gallery (Plain/Grid/List Tables galleries with Accent variants) | Table Styles | **partial** | P1 | Visual thumbnail gallery; hover = live preview on the current table, click = apply the style id. Grouped into Plain Tabl |
| Clear (table style) | Table Styles | **partial** | P2 | Gallery footer 'Clear' removes the applied table style (reverts to Table Normal / no style). |
| Table alignment (Align Left/Center/Right) + Indent | (clone-extra, NOT on Word's Table Design tab) | **works** | P3 | In real Word these live in Table Properties (Table tab) / the Layout tab area, NOT on Table Design. Word's Table Design  |

### Improvements to make (this tab)

- **[P1 · missing] Table Style Options group (the whole 6-checkbox group: Header Row, Total Row, Banded Rows, First Column, Last Column, Banded Columns)** (Table Style Options)
  - Word: Six checkboxes that toggle the table's w:tblLook conditional-format flags; the table style instantly repaints emphasis on the chosen rows/columns (e.g. unchecking Banded Rows removes the zebra striping; checking First Column bolds/shades col 1).
  - Where: absent (not in designTab() src/renderer/public/js/table-tools-pm.js:63-79)
  - How: The entire group is absent from the Table Design contextual tab — designTab() only has Table Styles + Alignment groups. The model layer is ready: tblLook is fully imported/exported (super-converter v3 w/tblLook/tblLook-translator.js) and setTableStyle already reads nextProps.tblLook.firstRow (table.js:1652-1654) and resolveTableStyleVisuals honors tblLook (resolveTableStyleVisuals.js:75). Add a 'td-styleoptions' group of 6 toggle controls + a tableSetTblLook(flags) bridge verb that writes table.attrs.tableProperties.tblLook and re-bakes visuals via resolveTableStyleVisuals. Note: live banded-row/column/lastRow/firstCol PAINT is a Phase-7 deferral (resolveTableStyleVisuals.js:16-20 only bakes whole-table borders + firstRow fill), but the toggles + export + firstRow rendering are achievable now.
- **[P2 · missing] Line Style dropdown (pen line style: none/single/dotted/dashed/double…)** (Borders)
  - Word: Sets the active border pen's line style used by the Borders dropdown and Border Painter.
  - Where: absent (table-tools-pm.js:66-70; H.tblBorders hardcodes val:'single', commands.js:207)
  - How: No pen-state at all. setCellBorders supports a val field (the 'single' is just hardcoded), so adding a Line Style dropdown that updates a module-level pen object and feeds H.tblBorders is straightforward. P2 because it gates faithful border application.
- **[P2 · missing] Line Weight dropdown (¼–6 pt)** (Borders)
  - Word: Sets the active pen's border width.
  - Where: absent (table-tools-pm.js:66-70; size hardcoded to 4 eighth-pts, commands.js:207)
  - How: No control. The border spec size is hardcoded (size:4). Add a weight dropdown feeding the pen object; setCellBorders already takes size in eighth-points (table.js:1858, eighthPoints elsewhere).
- **[P2 · missing] Pen Color dropdown** (Borders)
  - Word: Sets the active pen's border color (theme/standard/more colors).
  - Where: absent (table-tools-pm.js:66-70; color hardcoded '000000', commands.js:207)
  - How: No control; color hardcoded black. Add a color dropdown feeding the pen object; setCellBorders takes color (table.js:1858).
- **[P2 · missing] Table Styles gallery — live hover preview** (Table Styles)
  - Word: Hovering a style thumbnail temporarily applies it to the table; mouse-out reverts.
  - Where: absent (H.tblStyles flyItem onClick only, commands.js:193)
  - How: flyItem is wired with onClick only — no mouseenter/mouseleave preview. A preview path exists for design style-sets (dePreviewTheme/dePreviewRestore in bridge/design.ts); mirror it: on hover dispatch setTableStyle to a scratch txn and revert on leave.
- **[P3 · missing] Border Painter (toggle)** (Borders)
  - Word: Toggle that turns the cursor into a border brush; clicking/dragging cell edges paints the active pen onto them; Esc/re-click exits.
  - Where: absent (no control or handler anywhere; only the clipboard Format Painter exists, index.ts:65)
  - How: Entirely absent. Needs a stateful edge-hit-testing overlay on the table DOM + pen state. Niche/high-effort; defer behind the layout/frames overlay work. Note: a Format-Painter Esc-cancel pattern exists (index.ts:446) to mirror for arm/disarm UX.
- **[P3 · missing] Border Styles gallery (themed sample-border presets)** (Borders)
  - Word: Dropdown of pre-built border samples (combinations of style+weight+color matched to the theme) that set the active pen in one click.
  - Where: absent (no control in designTab() td-styles group, table-tools-pm.js:66-70)
  - How: Not present. Depends on the pen-state concept (Line Style/Weight/Pen Color) which also doesn't exist. Niche; defer.
- **[P3 · missing] Modify Table Style…** (Table Styles)
  - Word: Opens the Modify Style dialog scoped to a table style (edit conditional formats per Whole table / Header row / Banded rows etc., font, borders, shading).
  - Where: absent (no entry in H.tblStyles flyout, commands.js:185-194)
  - How: No gallery footer commands at all. Niche; requires a full conditional-format editor. Defer but note as a gallery-footer gap.
- **[P3 · missing] New Table Style…** (Table Styles)
  - Word: Create a brand-new named table style and add it to styles.xml.
  - Where: absent (commands.js:185-194)
  - How: No footer command. Would mint a new w:style w:type=table into convertedXml styles.xml. Niche.
- **[P1 · partial] Borders split-button dropdown (edge selection: All/No/Outside/Inside/Inside-H/Inside-V/Top/Bottom/Left/Right/Diagonal/Borders and Shading…)** (Borders)
  - Word: 12+ edge presets that apply the CURRENT pen (line style/weight/color) to the chosen edges of the selected cells; plus 'Borders and Shading…' dialog.
  - Where: src/renderer/public/js/commands.js:205-210 (H.tblBorders) + bridge/table.ts:203-207 (tableSetCellBorders) + table.js:1858 setCellBorders
  - How: Severely abbreviated: the flyout offers ONLY 'All Borders' and 'No Border' (commands.js:208-209). Missing Outside, Inside, Inside Horizontal, Inside Vertical, Top, Bottom, Left, Right, Diagonal Down/Up, and 'Borders and Shading…'. The fork's setCellBorders accepts a full per-side {top,bottom,left,right,...} object (table.js:1858) so most edge presets are wireable now (insideH/insideV across a CellSelection, diagonal needs a tlbr/trbl attr). Also the border spec is hardcoded single/000000/size4 (commands.js:207) ignoring any pen settings (because pen settings don't exist — see below).
- **[P1 · partial] Header Row toggle (specifically)** (Table Style Options)
  - Word: Checkbox controlling tblLook firstRow — emphasizes the header row per the table style AND marks the row to repeat across pages.
  - Where: src/renderer/public/js/table-tools-pm.js:55 (tblHeaderRow lives on the LAYOUT tab, not Design)
  - How: There IS a 'Header Row' button but (a) it's on the wrong tab (Table Layout › Data group, table-tools-pm.js:55) and (b) it calls toggleHeaderRow → fork's toggleHeaderRowCommand which flips the row's header-cell type and does NOT modify tblLook.firstRow (table.js:1346 comment explicitly: 'Does NOT modify tblLook.firstRow'). So it's a structural header-cell toggle, not the Design-tab style-options flag. Real Word's Design checkbox drives tblLook; clone's is semantically different and mislocated.
- **[P1 · partial] Shading split-button (apply cell/table fill)** (Table Styles)
  - Word: Theme-color grid + Standard Colors + No Color + More Colors… + recent; applies to selected cell(s); the main button repeats the last color.
  - Where: src/renderer/public/js/commands.js:195-204 (H.tblShading) + bridge/table.ts:107-115 (tableSetCellShading) + table.js:1458 setCellBackground
  - How: Works but the palette is a hardcoded 6-swatch set (#FFF2CC/#DEEAF6/#E2EFDA/#FCE4D6/#D9D9D9/transparent — commands.js:198), none of which are theme colors. No theme-color grid, no Standard Colors row, no More Colors… custom picker, no recent-colors, no 'No Color' label (the transparent swatch clears). The bridge correctly shades the caret cell or a multi-cell CellSelection (table.ts:107). Improvement: replace the 6 swatches with the full Word shading palette + a custom picker.
- **[P1 · partial] Table Styles gallery (Plain/Grid/List Tables galleries with Accent variants)** (Table Styles)
  - Word: Visual thumbnail gallery; hover = live preview on the current table, click = apply the style id. Grouped into Plain Tables, Grid Tables, List Tables.
  - Where: src/renderer/public/js/commands.js:185-194 (H.tblStyles) + table-tools-pm.js:67
  - How: Functional but degraded to a plain TEXT-LIST flyout, not a thumbnail gallery, and built dynamically from only the styles present in the in-memory styles.xml (getTableStyles, table-tools-pm.js:371-387) — a blank doc has just the minted defaults, so the gallery is sparse vs Word's ~105 built-in table styles. No grouping (Plain/Grid/List), no thumbnails, no live hover-preview (apply is click-only). The apply itself works and only bakes whole-table borders + firstRow fill (banding NOT rendered live — Phase-7, resolveTableStyleVisuals.js:16). Improvement: render a swatch grid + add hover live-preview (dispatch+revert like the style-set preview pattern).
- **[P2 · partial] Clear (table style)** (Table Styles)
  - Word: Gallery footer 'Clear' removes the applied table style (reverts to Table Normal / no style).
  - Where: engine supports it (table.js:1624-1647 'else delete nextProps.tableStyleId') but no UI entry (commands.js:185-194)
  - How: setTableStyle('' / null) already CLEARS the style and falls back to direct borders (table.js:1647). But the gallery flyout never offers a 'Clear' item — there's no way for the user to invoke the clear path from the Design tab. Add a 'Clear' flyItem calling tableSetStyle('').

**Top:** Add the Table Style Options group (6 tblLook checkboxes: Header Row/Total Row/Banded Rows/First Column/Last Column/Banded Columns) to designTab() with a new tableSetTblLook(flags) bridge verb — the model/converter already round-trips tblLook (tblLook-translator.js) and setTableStyle reads tblLook.firstRow, so this is the single biggest missing P1 group and is mostly wiring (live banding paint stays a Phase-7 deferral but toggles+export+firstRow fill work now).; Expand H.tblBorders (commands.js:205-210) from just All/No Border to the full Word edge set — Outside, Inside, Inside Horizontal, Inside Vertical, Top/Bottom/Left/Right, and Diagonal — feeding setCellBorders which already accepts a full per-side spec (table.js:1858).; Add pen state to the Borders group: Line Style + Line Weight + Pen Color dropdowns that populate a module-level pen object, and have H.tblBorders read it instead of the hardcoded single/000000/size4 (commands.js:207).; Replace the hardcoded 6-swatch Shading flyout (commands.js:198) with the real Word shading palette (theme colors grid + standard colors + No Color + More Colors custom picker + recent).; Upgrade the Table Styles gallery from a plain text-list flyout to a thumbnail swatch grid with live hover-preview (mirror design.ts dePreviewTheme/dePreviewRestore) and add the gallery-footer 'Clear' item — the clear PATH already works in setTableStyle('') but has no UI entry.

_Files read: src/renderer/public/js/table-tools-pm.js (designTab def lines 63-79), src/renderer/public/js/commands.js:108-242 (H.tbl* handlers; tblStyles/tblShading/tblBorders at 185-210), src/renderer/bridge/table.ts (tableSetStyle/tableSetCellShading/tableSetCellBorders/getTableStyles), src/renderer/bridge/index.ts (DEFERRED/ENGINE_READY; tbl* mapped to 'insert-basics' so NOT D6-blocked — the Design tab cmds dispatch live), src/renderer/core/superdoc-fork/extensions/table/table.js (setTableStyle 1617-1685, setCellBorders 1858-1863, setCellBackground 1458), resolveTableStyleVisuals.js, and the w/tblLook converter handlers.\n\nKey architecture facts: (1) tblLook is FULLY supported in the converter (import+export) but has ZERO ribbon UI — the entire Table Style Options group is the headline gap. (2) Live rendering of banded rows/columns/lastRow/firstCol is an explicit Phase-7 deferral (resolveTableStyleVisuals.js:16-20 bakes only whole-table borders + firstRow fill; the EXPORTED docx carries the full definition so real Word renders banding). (3) setTableStyle/setCellShading/setCellBorders all WORK on a plain caret-in-cell (no CellSelection gate needed except merge). (4) The Borders + Shading + Styles UI is functional but heavily abbreviated vs Word.\n\nDedup: BUG-LEDGER's 'Design' bugs (BUG-007/008/024 style-sets, themes, page color, cover pages) are the STANDARD Design tab, not this contextual Table Design tab — no overlap. No existing ledger entry covers the Table Design tab specifically, so the gaps above are net-new. Known deferrals respected: live table-style banding paint = Phase-7 (deferrals.md §A render tier).\n\nPriority rationale: Table Style Options group and the Shading/Borders/Styles core actions are P1 (every table-formatting workflow). Pen state (Line Style/Weight/Color) is P2 (gates faithful borders). Border Painter, Border Styles gallery, Modify/New Table Style are P3 (niche/high-effort)._

---

## Table — moving / positioning (move handle, Table Properties → Table tab: alignment/indent/text-wrapping/positioning, plus Row/Column/Cell tabs)

**Real Word tab inventory:** === Table move handle (on-canvas, not a ribbon button) === · Top-left 4-arrow move handle: appears at the top-left corner of any table on hover; click-drag relocates the WHOLE table (inline tables snap between paragraphs; dragging away from text flow converts the table to a FLOATING/text-wrapped table with a tblpPr anchor) · Bottom-right square resize handle: drag to scale the entire table (proportionally resizes all columns) · Click the move handle once = selects the entire table (equivalent to Table Layout > Select > Select Table) · === Table Properties dialog (right-click table > Table Properties, or Table Layout > Properties) — Table tab === · Preferred width: checkbox + value + Measure in (Inches/Percent) · Alignment: Left / Center / Right (three icon buttons) · Indent from left: spinner (enabled only when Alignment = Left and table is not full-width) · Text wrapping: None / Around (two icon buttons) · Positioning... button (enabled only when Text wrapping = Around) -> opens Table Positioning sub-dialog · Borders and Shading... button · Options... button (default cell margins + cell spacing + 'Automatically resize to fit contents') · === Table Positioning sub-dialog (from Positioning...) === · Horizontal: Position (Left/Center/Right/Inside/Outside or value) + relative to (Margin/Page/Column) · Vertical: Position (Top/Bottom/Center/Inside/Outside or value) + relative to (Margin/Page/Paragraph) · Distance from surrounding text: Top / Bottom / Left / Right spinners · Options: 'Move with text' checkbox + 'Allow overlap' checkbox · === Table Properties — Row tab === · Size: 'Specify height' checkbox + value + Row height is (At least/Exactly) · Options: 'Allow row to break across pages' checkbox + 'Repeat as header row at the top of each page' checkbox · Previous Row / Next Row navigation buttons · === Table Properties — Column tab === · Size: 'Preferred width' checkbox + value + Measure in (Inches/Percent) · Previous Column / Next Column navigation buttons · === Table Properties — Cell tab === · Size: 'Preferred width' checkbox + value + Measure in · Vertical alignment: Top / Center / Bottom · Options... button (cell-specific margins + 'Wrap text' + 'Fit text') · === Table Properties — Alt Text tab === · Title + Description fields for accessibility

| Feature | Group | State | Pri | Word behavior |
|---|---|---|---|---|
| Table bottom-right resize handle — drag to scale the whole table | On-canvas table handles | **missing** | P2 | A small square at the table's bottom-right; dragging scales every column proportionally (resizes the whole table). Disti |
| Table move handle (top-left 4-arrow) — drag to relocate the whole table | On-canvas table handles | **missing** | P2 | Hovering a table shows a 4-arrow handle at its top-left; dragging it moves the entire table (between paragraphs inline,  |
| Table Properties dialog itself (the unified Table/Row/Column/Cell/Alt-Text tabbed dialog + 'Properties' ribbon button) | Table Properties dialog (container) | **missing** | P2 | Right-click table > Table Properties (or Table Layout > Properties) opens a 5-tab modal that is the canonical home for a |
| Text wrapping — None / Around (Table Properties > Table tab) | Table Properties > Table tab — Text wrapping | **missing** | P2 | Toggles the table between inline (None) and floating/text-wrapped (Around). 'Around' enables the Positioning... button a |
| Row tab — 'Allow row to break across pages' checkbox | Table Properties > Row tab | **missing** | P3 | Toggles w:trPr/w:cantSplit; controls whether a tall row may split across a page boundary. |
| Row tab — 'Repeat as header row at the top of each page' checkbox | Table Properties > Row tab | **missing** | P3 | Toggles w:trPr/w:tblHeader so the selected header row(s) repeat on every page a long table spans. |
| Table Positioning sub-dialog (Horizontal/Vertical position, relative-to anchors, distance-from-text, Move-with-text/Allow-overlap) | Table Positioning sub-dialog | **missing** | P3 | Sets the floating table's exact anchored position (tblpX/tblpY, horzAnchor/vertAnchor) and the four distance-from-text g |
| Column tab — Preferred width (Inches/Percent) + Prev/Next Column nav | Table Properties > Column tab | **partial** | P2 | Sets the column's preferred width and lets you step through columns. |
| Row tab — 'Specify height' + 'Row height is (At least/Exactly)' | Table Properties > Row tab — Size | **partial** | P2 | Sets explicit row height and the height rule (atLeast vs exact). |
| Options... — default cell margins + 'Automatically resize to fit contents' | Table Properties > Table tab — Options button | **partial** | P3 | Table-level default cell margins (w:tblCellMar) + cell spacing + the AutoFit-contents toggle. |
| Table alignment — Left / Center / Right (Table Properties > Table tab; also exposed on Table Design contextual tab in clone) | Table Properties > Table tab — Alignment | **works** | P1 | Three radio/icon buttons set the table's horizontal alignment within the text column; Center => margin 0 auto, Right =>  |
| Cell tab — Vertical alignment (Top/Center/Bottom) | Table Properties > Cell tab | **works** | P2 | Sets the caret cell's (or selected cells') vertical text alignment. |
| Indent from left (Table Properties > Table tab; clone exposes as 'Indent' dropdown on Table Design) | Table Properties > Table tab — Indent from left | **works** | P2 | Spinner indents the whole table from the left text margin (only valid when alignment=Left). Persists as w:tblPr/w:tblInd |

### Improvements to make (this tab)

- **[P2 · missing] Table bottom-right resize handle — drag to scale the whole table** (On-canvas table handles)
  - Word: A small square at the table's bottom-right; dragging scales every column proportionally (resizes the whole table). Distinct from the per-column border drag.
  - Where: absent — only per-COLUMN resize exists (prosemirror-tables columnResizing re-enabled per deferrals §A.1e 4d.1); no whole-table corner handle
  - How: Per-column border resize is DONE (handleWidth 0->5, colwidth grid-sync) but the whole-table corner-scale handle is not built. Could be implemented as an overlay handle that calls autoFitTable-style proportional scaling (the fork already has proportional column scaling in autoFitTable('window')). Layout/overlay-adjacent; P2.
- **[P2 · missing] Table move handle (top-left 4-arrow) — drag to relocate the whole table** (On-canvas table handles)
  - Word: Hovering a table shows a 4-arrow handle at its top-left; dragging it moves the entire table (between paragraphs inline, or out into the text to create a FLOATING text-wrapped table with a w:tblpPr anchor). A single click selects the whole table.
  - Where: absent — no move handle anywhere (grep moveHandle/table-drag/4-arrow across src/renderer returns only unrelated structured-content SDT handles); table-tools-pm.js has no handle, only contextual ribbon tabs
  - How: Keystone-deferred (deferrals §A.1e: 'Table RELOCATE (drag the table) is not built. Needs a move handle + (for a floating table) an anchor; mirror the image frames-overlay.'). Converges on the frames-overlay/paged-layout rework (§A.1d/§A.1e). For inline-only relocation a lighter overlay handle that re-orders the table between block positions could ship before the full overlay; floating relocation is fully overlay-gated. Mark P2 (faithful affordance but layout-engine-gated).
- **[P2 · missing] Table Properties dialog itself (the unified Table/Row/Column/Cell/Alt-Text tabbed dialog + 'Properties' ribbon button)** (Table Properties dialog (container))
  - Word: Right-click table > Table Properties (or Table Layout > Properties) opens a 5-tab modal that is the canonical home for alignment, indent, wrapping, row height/break/header-repeat, column width, cell width/valign, and alt text.
  - Where: absent — no 'Properties' control in table-tools-pm.js (layoutTab/designTab groups, lines 22-79) and no dialog (grep 'Properties' in table-tools-pm.js = none; only a comment reference in commands.js:239)
  - How: The clone scatters the dialog's functions across ribbon buttons/flyouts (alignment, indent, cell margins, row height, column width, valign) but has NO consolidated Table Properties dialog and no 'Properties' ribbon entry. Building the dialog would unify already-working bridge verbs (tableSetAlignment/Indent/RowHeight/CellWidth/CellVAlign/CellMargins) plus the missing wrapping+positioning+header-repeat. High-leverage UX parity even though most underlying verbs exist. P2.
- **[P2 · missing] Text wrapping — None / Around (Table Properties > Table tab)** (Table Properties > Table tab — Text wrapping)
  - Word: Toggles the table between inline (None) and floating/text-wrapped (Around). 'Around' enables the Positioning... button and writes a w:tblpPr anchor so surrounding paragraphs wrap around the table.
  - Where: absent — no setFloatingTable/setTableWrap command in superdoc-fork/extensions/table/table.js (grep returns none); no UI control. Import/export of w:tblpPr exists (handlers/w/tblpPr/tblpPr-translator.js) but is read/write round-trip only, with NO authoring command
  - How: The fork ALREADY round-trips floatingTableProperties (tblpPr-translator.js encodes/decodes w:leftFromText/rightFromText/topFromText/bottomFromText/tblpX/tblpY/horzAnchor/vertAnchor) — so the data model supports floating tables, but there is no editor command to SET it and TableView.js does not render a floating table specially (grep floatingTableProperties in TableView.js = none). A floating-table render is overlay/layout-gated like floating images (§A.1d). P2 — niche-ish for most docs but a true Word feature with model support already half-present.
- **[P3 · missing] Row tab — 'Allow row to break across pages' checkbox** (Table Properties > Row tab)
  - Word: Toggles w:trPr/w:cantSplit; controls whether a tall row may split across a page boundary.
  - Where: absent — no command/UI; bridge table.ts has setRowHeight but no cantSplit verb (table.ts:164-168)
  - How: Row-split-across-pages is itself a known keystone deferral (deferrals §A.1e: row-split needs the frames-overlay/paged-layout rework), so the cantSplit toggle is moot until pagination splits rows. P3, layout-gated.
- **[P3 · missing] Row tab — 'Repeat as header row at the top of each page' checkbox** (Table Properties > Row tab)
  - Word: Toggles w:trPr/w:tblHeader so the selected header row(s) repeat on every page a long table spans.
  - Where: absent — no command/UI (clone's 'Header Row' button at table-tools-pm.js:55 toggles STYLE banding via tableToggleHeaderRow, NOT the cross-page repeat attribute)
  - How: Note the naming trap: the clone's 'Header Row' (tblHeaderRow -> toggleHeaderRow, table.ts:95-99) is the Table-Design first-row-style toggle, which is DIFFERENT from Word's Row-tab 'Repeat as header row' (w:tblHeader cross-page repeat). The repeat-header feature is missing and is layout-gated (only meaningful once tables split across pages). P3.
- **[P3 · missing] Table Positioning sub-dialog (Horizontal/Vertical position, relative-to anchors, distance-from-text, Move-with-text/Allow-overlap)** (Table Positioning sub-dialog)
  - Word: Sets the floating table's exact anchored position (tblpX/tblpY, horzAnchor/vertAnchor) and the four distance-from-text gaps; toggles move-with-text and allow-overlap.
  - Where: absent — no UI and no command; the data shape exists only via the tblpPr round-trip importer/exporter (handlers/w/tblpPr/tblpPr-translator.js:9-24)
  - How: Fully missing authoring path; only reachable through round-tripping an imported floating table. Depends on the floating-table render (above) which is overlay-gated. P3 (niche, and downstream of text-wrapping=Around).
- **[P2 · partial] Column tab — Preferred width (Inches/Percent) + Prev/Next Column nav** (Table Properties > Column tab)
  - Word: Sets the column's preferred width and lets you step through columns.
  - Where: bridge/table.ts:158-162 (tableSetCellWidth) + commands.js:237-238 (Column Width flyout, inches presets)
  - How: Column width is settable in inches via the ribbon flyout and per-column drag-resize works. Missing: the Percent measure option and the dialog-level Prev/Next column stepping. Functional core present; dialog parity partial. P2.
- **[P2 · partial] Row tab — 'Specify height' + 'Row height is (At least/Exactly)'** (Table Properties > Row tab — Size)
  - Word: Sets explicit row height and the height rule (atLeast vs exact).
  - Where: bridge/table.ts:164-168 (tableSetRowHeight, hardcoded 'atLeast' from commands.js:236) -> superdoc-fork/extensions/table/table.js:1804+ (setRowHeight)
  - How: Row height IS settable (ribbon Row Height flyout, 4d.2/4d.3) and exports w:trHeight correctly. But the UI hardcodes the rule to 'atLeast' (commands.js:236) — there is no way to choose 'Exactly', which the fork's setRowHeight(px, rule) already supports. Easy win: expose the rule choice. P2 partial.
- **[P3 · partial] Options... — default cell margins + 'Automatically resize to fit contents'** (Table Properties > Table tab — Options button)
  - Word: Table-level default cell margins (w:tblCellMar) + cell spacing + the AutoFit-contents toggle.
  - Where: commands.js:139-176 (H.tblCellMargins, per-CELL margins flyout) + bridge/table.ts:170-201; AutoFit at commands.js:211-215 / bridge/table.ts:302-316
  - How: Cell margins are settable but at the CELL level (w:tcMar) via the flyout, not the TABLE default (w:tblCellMar from the Options dialog). AutoFit contents/window/fixed exists separately on the AutoFit dropdown. Cell spacing (w:tblCellSpacing) is entirely absent. P3, scattered-but-mostly-present.

**Top:** Build a real Table Properties dialog (the 5-tab modal + a 'Properties' entry on the Table Layout contextual tab). Most of its Table/Row/Column/Cell verbs already exist as working bridge calls (tableSetAlignment/Indent, tableSetRowHeight, tableSetCellWidth, tableSetCellVAlign, tableSetCellMargins) — wiring them into one dialog is high UX-parity leverage for low engine risk, and gives a home for the still-missing wrapping/positioning/header-repeat options.; Expose the row-height RULE (At least / Exactly). The fork's setRowHeight(px, rule) already accepts the rule but commands.js:236 hardcodes 'atLeast', so 'Exactly' is unreachable — a one-line UI gap with full engine support behind it.; Add the Table move handle (top-left 4-arrow) for INLINE relocation first. Even before the frames-overlay lands, an overlay handle that reorders an inline table between block positions (and click-selects the whole table) closes a very visible Word affordance; floating relocation stays overlay-gated (deferrals §A.1e).; Wire a Text wrapping None/Around toggle + setFloatingTable command. The fork already round-trips floatingTableProperties (w:tblpPr) — adding an authoring command and a floating render would unlock real text-wrapped tables (currently the data model supports them but nothing can create one).; Disambiguate / correct the 'Header Row' naming: the ribbon 'Header Row' button toggles first-row STYLE banding (toggleHeaderRow), NOT Word's Row-tab 'Repeat as header row' (w:tblHeader cross-page repeat). Consider relabeling and adding the true repeat-header attribute (layout-gated for actual repetition).

_Scope verified by reading: table-tools-pm.js (contextual tabs — no Properties/move/wrap controls), bridge/table.ts (verbs: align/indent/rowHeight/cellWidth/cellVAlign/cellMargins present; NO position/wrap/cantSplit/tblHeader), commands.js:120-242 (handlers + flyouts), superdoc-fork/extensions/table/table.js (setTableAlignment:1695, setTableIndent:1727; NO setFloatingTable/setTablePosition command exists), TableView.js (renders align/indent via margin; NO floating-table render), and the tblpPr-translator (import/export round-trip of w:tblpPr EXISTS but is read/write-only with no authoring command). DEDUP: BUG-026 (page-setup render) and the layout-engine deferrals are NOT re-reported. Key dedup vs deferrals: table RELOCATE/move-handle and floating-table render are explicitly keystone-deferred in §A.1e/§A.1d (frames-overlay/paged-layout rework) — marked P2/P3 accordingly rather than as fresh improvements. The genuinely actionable-without-the-engine improvements are: the Table Properties DIALOG (verbs mostly exist), the row-height RULE exposure, and the Header-Row naming fix. Bridge isBlocked/DEFERRED set (bridge/index.ts:52) does NOT include any table cmds — table positioning is simply ABSENT, not blocked._

---

## Picture Format tab (Picture Tools contextual ribbon: Adjust / Picture Styles / Accessibility / Arrange / Size)

**Real Word tab inventory:** === ADJUST group === · Remove Background (button — opens Background Removal mode with Mark Areas to Keep/Remove, Discard/Keep Changes) · Corrections (gallery dropdown — Sharpen/Soften presets + Brightness/Contrast preset grid + Picture Corrections Options…) · Color (gallery dropdown — Color Saturation row, Color Tone row, Recolor row incl. Grayscale/Sepia/Washout/Black&White/accent washes + More Variations + Set Transparent Color + Picture Color Options…) · Artistic Effects (gallery dropdown — 23 effect thumbnails + Artistic Effects Options…) · Transparency (gallery dropdown — 0/15/30/50/65/80/100% presets + Picture Transparency Options…) · Compress Pictures (button — dialog: apply-to-selection toggle, delete cropped areas, resolution radio set) · Change Picture (split/dropdown — From a File / From Stock Images / From Online Sources / From Icons / From Clipboard) · Reset Picture (split — Reset Picture / Reset Picture & Size) · === PICTURE STYLES group === · Picture Styles gallery (28-style quick gallery: frames, soft edges, bevels, rotated/perspective 3-D, etc., with More flyout) · Picture Border (dropdown — theme/standard color palette + No Outline + More Outline Colors + Weight submenu + Dashes submenu) · Picture Effects (dropdown — Preset / Shadow / Reflection / Glow / Soft Edges / Bevel / 3-D Rotation submenus, each with Options…) · Picture Layout (dropdown — convert picture(s) to a SmartArt graphic layout gallery) · === ACCESSIBILITY group === · Alt Text (button — opens Alt Text pane: description box, Generate a description for me, Mark as decorative) · === ARRANGE group === · Position (dropdown — In Line with Text + 9 With-Text-Wrapping presets + More Layout Options…) · Wrap Text (dropdown — In Line / Square / Tight / Through / Top and Bottom / Behind Text / In Front of Text / Edit Wrap Points / More Layout Options…) · Bring Forward (split — Bring Forward / Bring to Front / Bring in Front of Text) · Send Backward (split — Send Backward / Send to Back / Send Behind Text) · Selection Pane (button — opens Selection task pane listing objects, show/hide/reorder) · Align (dropdown — Align Left/Center/Right/Top/Middle/Bottom, Distribute Horizontally/Vertically, Align to Page/Margin/Selected Objects, View Gridlines, Grid Settings…) · Group (split — Group / Ungroup / Regroup) · Rotate (dropdown — Rotate Right 90 / Rotate Left 90 / Flip Vertical / Flip Horizontal / More Rotation Options…) · === SIZE group === · Crop (split — Crop / Crop to Shape / Aspect Ratio / Fill / Fit) · Shape Height (numeric spinner inches) · Shape Width (numeric spinner inches) · Size dialog launcher (opens Layout dialog → Size tab: height/width abs+rel, rotation, scale, lock aspect, relative to original)

| Feature | Group | State | Pri | Word behavior |
|---|---|---|---|---|
| Picture Border | Picture Styles | **missing** | P1 | Outline color palette + No Outline + More Colors + Weight submenu + Dashes submenu, drawing a line around the picture bo |
| Align | Arrange | **missing** | P2 | Align Left/Center/Right/Top/Middle/Bottom, Distribute H/V, Align to Page/Margin/Selected, View Gridlines, Grid Settings. |
| Change Picture | Adjust | **missing** | P2 | Replaces the selected picture's bits while preserving size/position/formatting (From File/Stock/Online/Icons/Clipboard). |
| Corrections (Sharpen/Soften + Brightness/Contrast) | Adjust | **missing** | P2 | Gallery of Sharpen/Soften and Brightness/Contrast preset thumbnails plus a Picture Corrections Options dialog with fine  |
| Picture Effects | Picture Styles | **missing** | P2 | Preset / Shadow / Reflection / Glow / Soft Edges / Bevel / 3-D Rotation submenus, each a preset grid + Options. |
| Picture Styles gallery | Picture Styles | **missing** | P2 | 28 one-click composite styles (frames, drop-shadow rectangle, soft-edge oval, bevels, rotated 3-D perspective, etc.). |
| Reset Picture / Reset Picture & Size | Adjust | **missing** | P2 | Reset clears all Adjust/Style formatting (corrections/color/effects/crop); Reset Picture & Size also restores original d |
| Size dialog launcher | Size | **missing** | P2 | Opens Layout dialog Size tab: abs+relative height/width, rotation angle, scale %, lock aspect, relative-to-original-size |
| Transparency | Adjust | **missing** | P2 | Preset 0/15/30/50/65/80/100% picture transparency + Options. |
| Artistic Effects | Adjust | **missing** | P3 | 23-thumbnail gallery (Pencil Sketch, Paint Strokes, Blur, Glow Edges, etc.) + Options dialog. |
| Compress Pictures | Adjust | **missing** | P3 | Dialog: apply to this picture only, delete cropped areas of pictures, target resolution (HD/Print/Web/E-mail/keep). |
| Picture Layout (convert to SmartArt) | Picture Styles | **missing** | P3 | Converts selected picture(s) into a SmartArt picture-layout graphic with caption placeholders. |
| Remove Background | Adjust | **missing** | P3 | Enters Background Removal mode; auto-detects foreground, Mark Areas to Keep/Remove, Keep/Discard Changes. |
| Selection Pane | Arrange | **missing** | P3 | Opens the Selection task pane: list all page objects, toggle visibility, reorder, rename. |
| Group / Ungroup | Arrange | **stub** | P3 | Group / Ungroup / Regroup multiple selected objects into one. |
| Crop | Size | **partial** | P1 | Crop (drag handles) / Crop to Shape / Aspect Ratio / Fill / Fit. |
| Wrap Text | Arrange | **partial** | P1 | In Line / Square / Tight / Through / Top and Bottom / Behind Text / In Front of Text / Edit Wrap Points / More Layout Op |
| Bring Forward | Arrange | **partial** | P2 | Bring Forward / Bring to Front / Bring in Front of Text. |
| Color / Recolor (Adjust) | Adjust | **partial** | P2 | Color gallery: Saturation row, Tone (warm/cool) row, and a Recolor row with Grayscale, Sepia, Washout, Black & White and |
| Position | Arrange | **partial** | P2 | In Line with Text + 9 With-Text-Wrapping anchor presets (top/middle/bottom × left/center/right) + More Layout Options. |
| Send Backward | Arrange | **partial** | P2 | Send Backward / Send to Back / Send Behind Text. |
| Alt Text | Accessibility | **works** | P1 | Alt Text pane: description textarea, generate-for-me, Mark as decorative. |
| Height / Width | Size | **works** | P1 | Numeric height/width spinners in inches, honoring the aspect lock. |
| Lock Aspect Ratio | Size | **works** | P2 | Checkbox in the Size dialog; when off, height/width move independently. |
| Rotate | Arrange | **works** | P2 | Rotate Right 90 / Left 90 / Flip Vertical / Flip Horizontal / More Rotation Options (arbitrary angle). |

### Improvements to make (this tab)

- **[P1 · missing] Picture Border** (Picture Styles)
  - Word: Outline color palette + No Outline + More Colors + Weight submenu + Dashes submenu, drawing a line around the picture box.
  - Where: absent (no imgBorder / setImageBorder — grep = 0 hits)
  - How: Core and very common. Render = CSS border on the image wrapper (color/width/dash); export = a:ln (w, a:solidFill, a:prstDash) inside the pic's spPr. New border attr + a color/weight/dash flyout. Highest-leverage missing Picture-Styles feature.
- **[P2 · missing] Align** (Arrange)
  - Word: Align Left/Center/Right/Top/Middle/Bottom, Distribute H/V, Align to Page/Margin/Selected, View Gridlines, Grid Settings.
  - Where: src/renderer/public/js/commands.js:915-922 (H.align) — routes every item to undefined WC.Layout.align/distribute; NOT in pictureFormatTab (picture-tools-pm.js:46-55)
  - How: The Align button is absent from the Picture Format tab, and its handler depends on the never-defined WC.Layout (dead since legacy retirement) — invoking it throws. Re-implement single-object align (left/center/right/top/middle/bottom relative to page/margin) by computing marginOffset and calling setImagePosition. Multi-object distribute is lower value.
- **[P2 · missing] Change Picture** (Adjust)
  - Word: Replaces the selected picture's bits while preserving size/position/formatting (From File/Stock/Online/Icons/Clipboard).
  - Where: absent (no changePicture handler; insertImage at insert.ts inserts a NEW node, doesn't swap — grep changePicture = 0 hits)
  - How: Common workflow. Implement as a file-picker that setNodeMarkups the selected image node's src/rId in place (keep size, wrap, crop, transform, position). Reuse insertImage's media-registration path but target the existing node.
- **[P2 · missing] Corrections (Sharpen/Soften + Brightness/Contrast)** (Adjust)
  - Word: Gallery of Sharpen/Soften and Brightness/Contrast preset thumbnails plus a Picture Corrections Options dialog with fine sliders.
  - Where: absent (no imgCorrections/imgBrightness handler; no setImageBrightness verb — grep over src/renderer = 0 hits)
  - How: No handler, no bridge verb. Render is trivial via CSS filter brightness()/contrast()/blur+sharpen; OOXML export maps to a:lumMod/a:lumOff + a:sharpenSoften (a14 ext) in the a:blip. New image attrs corrections={brightness,contrast,sharpen} + a flyout grid.
- **[P2 · missing] Picture Effects** (Picture Styles)
  - Word: Preset / Shadow / Reflection / Glow / Soft Edges / Bevel / 3-D Rotation submenus, each a preset grid + Options.
  - Where: absent (no imgEffects / setImageEffect — grep = 0 hits). NB shape effects DO exist for AutoShapes (commands.js:799 deEffects) and text effects (commands.js:567-609) — patterns to mirror.
  - How: Shadow/Glow/Soft-Edges/Reflection map well to CSS box-shadow/filter drop-shadow/blur + mask; export = a:effectLst (a:outerShdw/a:glow/a:softEdge/a:reflection) in spPr. Reuse the existing shape-effect preset machinery (deEffects) but target the image node. 3-D bevel/rotation are render-deferred (no 3-D engine).
- **[P2 · missing] Picture Styles gallery** (Picture Styles)
  - Word: 28 one-click composite styles (frames, drop-shadow rectangle, soft-edge oval, bevels, rotated 3-D perspective, etc.).
  - Where: absent (no picture-styles group in pictureFormatTab() — picture-tools-pm.js:22-62; no pictureStyle handler — grep = 0 hits)
  - How: Each style = a bundle of border + effect + crop-to-shape + 3-D attrs. Gated on Picture Border + Picture Effects existing first. A border-only subset (simple-frame, thick-frame) is achievable today; full gallery needs the effects/border infra.
- **[P2 · missing] Reset Picture / Reset Picture & Size** (Adjust)
  - Word: Reset clears all Adjust/Style formatting (corrections/color/effects/crop); Reset Picture & Size also restores original dimensions.
  - Where: absent (no resetPicture handler — grep = 0 hits)
  - How: Easy and high-value once other Adjust attrs exist: one setNodeMarkup that strips grayscale/clipPath/transformData/corrections/effects (and, for &Size, restores natural size via imageNaturalSize at commands.js:353). Cheap to add even now to undo grayscale+crop+rotate in one click.
- **[P2 · missing] Size dialog launcher** (Size)
  - Word: Opens Layout dialog Size tab: abs+relative height/width, rotation angle, scale %, lock aspect, relative-to-original-size.
  - Where: absent (no dialog-launcher control in the pf-size group — picture-tools-pm.js:37-43)
  - How: No combined Size dialog; functions are split across separate flyouts (crop/height/width/lock/rotate). Scale-% and relative-size inputs and arbitrary rotation angle have no UI. Consolidate into one Layout-style dialog. Medium value.
- **[P2 · missing] Transparency** (Adjust)
  - Word: Preset 0/15/30/50/65/80/100% picture transparency + Options.
  - Where: absent (no imgTransparency / setImageTransparency — grep = 0 hits). NB unrelated to watermark-transparency BUG-WATERMARK.
  - How: Modern (2021+) Word feature, common. Render = CSS opacity on the <img>; export = a:alphaModFix amt in the a:blip. Cheap to add: new transparency attr + a 7-item preset flyout.
- **[P3 · missing] Artistic Effects** (Adjust)
  - Word: 23-thumbnail gallery (Pencil Sketch, Paint Strokes, Blur, Glow Edges, etc.) + Options dialog.
  - Where: absent (no imgArtistic / setImageArtistic — grep = 0 hits)
  - How: Niche. Faithful raster effects need a canvas/SVG-filter pipeline; export is a14:artisticEffect lst in the blip. Could approximate the common few (Blur, Pencil Grayscale) with SVG filters. Low priority — most users never touch it.
- **[P3 · missing] Compress Pictures** (Adjust)
  - Word: Dialog: apply to this picture only, delete cropped areas of pictures, target resolution (HD/Print/Web/E-mail/keep).
  - Where: absent (no compressPicture handler — grep = 0 hits)
  - How: Niche editor housekeeping. Real effect needs re-encoding the embedded media part at a lower DPI and (when 'delete cropped areas' is set) baking the crop into the bitmap. Could ship as a real downscale of the data-URL via a canvas. Low priority.
- **[P3 · missing] Picture Layout (convert to SmartArt)** (Picture Styles)
  - Word: Converts selected picture(s) into a SmartArt picture-layout graphic with caption placeholders.
  - Where: absent (SmartArt itself is a stub — bridge/index.ts:95 smartart is insert-exotica; xeSmartArt stub at index.ts:395)
  - How: Depends on a real SmartArt engine, which is itself a stub. Niche — defer until SmartArt exists.
- **[P3 · missing] Remove Background** (Adjust)
  - Word: Enters Background Removal mode; auto-detects foreground, Mark Areas to Keep/Remove, Keep/Discard Changes.
  - Where: absent (no removeBackground handler — grep = 0 hits)
  - How: Heavy (needs a foreground-segmentation pipeline + a contextual Background-Removal ribbon). Export bakes an alpha mask into the media. Niche; defer.
- **[P3 · missing] Selection Pane** (Arrange)
  - Word: Opens the Selection task pane: list all page objects, toggle visibility, reorder, rename.
  - Where: src/renderer/public/js/commands.js:914 (H.selectionPane = WC.Layout.selectionPane()) — and it's NOT in the picture tab; WC.Layout is undefined in src/renderer (grep = 0 defs)
  - How: Handler exists but calls undefined WC.Layout.selectionPane (would throw TypeError) AND is not wired into pictureFormatTab. Build a real task pane that enumerates image/shape nodes with show/hide/z-order. Niche for a single-picture editor.
- **[P3 · stub] Group / Ungroup** (Arrange)
  - Word: Group / Ungroup / Regroup multiple selected objects into one.
  - Where: src/renderer/public/js/commands.js:924 (H.group — both items are WC.toast no-ops); NOT in pictureFormatTab
  - How: Pure toast stub ('Grouping is approximated'), and not wired into the picture tab anyway. Needs a real grouped-shape (wpg:wgp) model — niche for an image editor. Defer.
- **[P1 · partial] Crop** (Size)
  - Word: Crop (drag handles) / Crop to Shape / Aspect Ratio / Fill / Fit.
  - Where: src/renderer/public/js/commands.js:277-302 (H.imgCrop); src/renderer/bridge/insert.ts:437-459 (setImageCrop)
  - How: Numeric L/T/R/B-% crop works (clipPath render + a:srcRect export, prefilled, Remove Crop, over-crop guard). Missing the interactive drag-handle crop mode, Crop to Shape, Aspect-Ratio presets, and Fill/Fit. The drag crop overlay is the most-expected gap. Numeric path is solid.
- **[P1 · partial] Wrap Text** (Arrange)
  - Word: In Line / Square / Tight / Through / Top and Bottom / Behind Text / In Front of Text / Edit Wrap Points / More Layout Options.
  - Where: src/renderer/public/js/commands.js:896 (H.wrapText); src/renderer/bridge/insert.ts:252-300 (setImageWrap)
  - How: 7 wrap modes all wire to setImageWrap with valid attrs + seeded anchorData (export-correct wp:anchor). Render of Tight/Through/floating is the keystone-deferred layout tier (deferrals §A) — CSS float approximation only, no real wrap-polygon outline. 'Edit Wrap Points' is missing. Mark partial: model/export correct, faithful render deferred.
- **[P2 · partial] Bring Forward** (Arrange)
  - Word: Bring Forward / Bring to Front / Bring in Front of Text.
  - Where: src/renderer/public/js/commands.js:897+1623 (split menu); src/renderer/bridge/insert.ts:313-341 (setImageZOrder)
  - How: All three items wired (forward/toFront via relativeHeight, in-front-of-text via setImageWrap('front')). Caveat documented in code: z-index only re-stacks ABSOLUTE wrap=None images; CSS-floated Square/Tight/Through images stack by document order — full float re-stacking needs the frames-overlay render (deferred). Model/export correct.
- **[P2 · partial] Color / Recolor (Adjust)** (Adjust)
  - Word: Color gallery: Saturation row, Tone (warm/cool) row, and a Recolor row with Grayscale, Sepia, Washout, Black & White and accent-tinted variants, plus Set Transparent Color and Picture Color Options.
  - Where: src/renderer/public/js/commands.js:318-323 (H.imgColor); src/renderer/bridge/insert.ts:504-516 (setImageGrayscale)
  - How: Only 'No Recolor' + 'Grayscale' are offered (grayscale is clean: CSS filter render + <a:grayscl/> export, BUG-LEDGER confirms). Saturation/Tone/Sepia/Washout/B&W/accent recolors and Set-Transparent-Color are all missing. Add CSS-filter render attrs (sepia/saturate/brightness) mapped to a:duotone / a:lum / a:biLevel on export; extend the flyout to the full Word grid.
- **[P2 · partial] Position** (Arrange)
  - Word: In Line with Text + 9 With-Text-Wrapping anchor presets (top/middle/bottom × left/center/right) + More Layout Options.
  - Where: src/renderer/public/js/commands.js:327-351 (H.imgPosition, the WIRED control) vs commands.js:895 (H.position, the 9-preset menu — NOT wired, calls undefined WC.Layout.position)
  - How: The tab wires imgPosition = a numeric Horizontal/Vertical-inches flyout (works for session-inserted floats; refuses imported anchors by design — insert.ts:528-556). Word's actual Position button is the 9 anchor-preset GRID (H.position at commands.js:895), which is NOT in the picture tab and routes to the dead WC.Layout.position (WC.Layout is never defined anywhere in src/renderer). So the preset-grid Position is effectively missing; only the numeric variant exists. Wire the 9 presets to setImagePosition with computed offsets.
- **[P2 · partial] Send Backward** (Arrange)
  - Word: Send Backward / Send to Back / Send Behind Text.
  - Where: src/renderer/public/js/commands.js:913+1624; src/renderer/bridge/insert.ts:313-341 (setImageZOrder)
  - How: Symmetric to Bring Forward — same partial caveat (float re-stacking deferred). Model/export correct.

**Top:** P1 Picture Border — add a border color/weight/dash flyout (imgBorder) + setImageBorder verb. Render = CSS border on the image wrapper; export = a:ln (w, a:solidFill, a:prstDash) in the pic's spPr. Cheapest high-impact Picture-Styles win and a prerequisite for the Styles gallery.; P1/P2 Wire the Adjust group out fully: Reset Picture (one setNodeMarkup stripping grayscale/clipPath/transformData), Change Picture (in-place src/rId swap via setNodeMarkup), and a real Color gallery (sepia/saturation/tone/B&W via CSS filter render + a:duotone/a:biLevel export). Reset+Change are near-free and very commonly used.; P2 Add Transparency (preset 0–100% → CSS opacity render + a:alphaModFix export) and Corrections (brightness/contrast/sharpen → CSS filter render + a:lumMod/lumOff + a14 sharpen export). Both are small additive attrs with faithful OOXML mappings.; P2 Add Picture Effects by mirroring the EXISTING shape-effect machinery (commands.js:799 deEffects) and text-effect menus (commands.js:567-609) onto the image node: Shadow/Glow/Soft Edges/Reflection → CSS box-shadow/filter + a:effectLst export. The pattern is already in the codebase.; P2 Fix/expose the Arrange Position+Align controls: H.align, H.position(preset grid), H.rotate, H.group, H.selectionPane all reference the never-defined WC.Layout (dead legacy global since slice-11 retirement) and several aren't even wired into the Picture Format tab. Re-implement single-object Align and the 9-preset Position grid on top of setImagePosition; delete the dead WC.Layout handlers.; P1 Interactive Crop drag-handle mode + Crop to Shape / Aspect Ratio presets — the numeric crop works but users expect to drag crop handles; add a crop overlay reusing the resize-overlay infrastructure.

_Scope verified by reading picture-tools-pm.js (the contextual-tab definition: groups = Adjust[Color only], Size[Crop/Height/Width/LockAspect], Arrange[Position/WrapText/BringForward/SendBackward/Rotate], Accessibility[AltText]), commands.js img* handlers (lines 245-351, 895-925, 1623-1628 dispatch), and bridge/insert.ts setImage* verbs (252-556). There is NO src/renderer/bridge/image-resize.ts — the prompt's hint is stale; all image verbs live in insert.ts. Dedup against the existing ledger: BUG-003 (tall image straddles seam, render-tier, deferrals §A) and the floating-image position-relative-to-page bug are ALREADY logged and NOT re-reported here; GAP-A already catalogs the Layout>Arrange controls and GAP-B the wired-but-stub pattern — my Adjust/Styles/Effects feature gaps and the concrete WC.Layout-crash finding are net-new. Grayscale is confirmed CLEAN in the ledger (not re-raised). Summary of clone state: WORKS = Alt Text, Height/Width, Lock Aspect, Rotate(R/L/Flip), Grayscale color. PARTIAL = Color(grayscale-only), Wrap Text(render deferred), Bring/Send(float re-stack deferred), Position(numeric only, preset grid dead), Crop(numeric only, no drag/shape). MISSING (real feature gaps) = Corrections, Transparency, Compress, Change Picture, Reset Picture, Picture Styles gallery, Picture Border, Picture Effects, Picture Layout, Align, Selection Pane, Size dialog, Remove Background, Artistic Effects. STUB = Group. The render-tier limitations on Wrap/float-z-order are legitimately keystone-deferred (deferrals §A) and priced accordingly; the Adjust/Styles gaps are NOT layout-gated and are the highest-leverage improvements._

---

## New bugs spotted during feature research

- (Table) MISLABEL/MISGROUP: the Layout tab's 'Header Row' button (table-tools-pm.js:55, cmd tblHeaderRow) is presented under the 'Data' group as if it were Word's 'Repeat Header Rows', but it actually toggles the header-CELL type via toggleHeaderRow (table.ts:95-99). Word's Layout/Data control is specifically 'Repeat Header Rows' (the per-page repeat flag); header-cell styling belongs to Table Design's tblLook. The two distinct Word features are conflated into one mislabeled button. (Distinct from BUG-016, which is the Insert-tab Convert-Text-to-Table dead toast.)
- (Table) 'Header Column' button (table-tools-pm.js:56, cmd tblHeaderCol) does not exist on Word's Table Layout tab at all — first-column emphasis is a Table Design tblLook checkbox. It's an out-of-place control on this tab.
- (Table) Text Direction is a one-shot button hardwired to 'tbRl' (commands.js:130) — it cannot cycle back to horizontal or to btLr, so once pressed the user cannot restore horizontal text from the ribbon. Word's button cycles horizontal -> 90 -> 270.
- (Table) Row Height applies heightRule 'atLeast' unconditionally (commands.js:236); there is no way to choose 'Exactly', so users cannot pin a fixed row height from the ribbon (Word's Table Properties offers At least / Exactly).
- (Table) [Design tab] No way to CLEAR a table style from the UI: setTableStyle('' / null) clears correctly (table.js:1624-1647) but H.tblStyles (commands.js:185-194) only lists apply items — there is no 'Clear' / 'Table Normal' entry, so once a style is applied the user cannot remove it from the Design tab.
- (Table) [Fidelity/placement] The Table Design contextual tab contains an 'Alignment' group (Align Left/Center/Right + Indent, table-tools-pm.js:71-76) that does NOT exist on Word's Table Design tab — those controls belong to Table Properties/Layout. Controls work but are mislocated vs the parity target.
- (Table) [Fidelity/semantics] The only 'Header Row' control (table-tools-pm.js:55) sits on the Table LAYOUT tab and toggles header-cell node TYPE via toggleHeaderRow, which by its own comment does NOT touch tblLook.firstRow (table.js:1346). Real Word's Design-tab 'Header Row' checkbox is a tblLook flag — so even the structural header toggle does not drive the style-options emphasis the Design checkbox would.
- (Table) [Shading palette] The Table Design Shading swatches (commands.js:198) are 5 hardcoded pastel hexes + transparent — none are theme colors and there is no 'More Colors' custom entry, so most Word shading colors are unreachable from the Design tab (distinct from the Home paragraph Shading picker).
- (Table) Naming/semantics trap (not yet logged): the Table Layout ribbon 'Header Row' control (table-tools-pm.js:55 -> tblHeaderRow -> bridge tableToggleHeaderRow, table.ts:95-99) maps to prosemirror-tables toggleHeaderRow (first-row STYLE/banding), but a user reading 'Header Row' in a Layout context expects Word's 'Repeat as header row at top of each page' (w:tblHeader). Same for 'Header Column'. These are different OOXML features; current behavior silently does the wrong one relative to the label's Word meaning.
- (Table) Indent-from-left is not gated by alignment: H.tblIndent (commands.js:241) applies a left indent regardless of justification, whereas Word disables Indent-from-left when alignment is Center/Right (and TableView.js:158-167 only honors indent when NOT center/right-justified, so a user who sets indent then centers gets a silently-ignored indent value still stored in the model — a confusing dead attribute).
- (Picture) Dead WC.Layout dependency: H.align (commands.js:915-922), H.position (895), H.rotate (925), H.group (924 toast-only is safe), H.selectionPane (914) all call window.WC.Layout.* (align/distribute/position/rotate/flip/selectionPane). WC.Layout is NEVER defined anywhere in src/renderer (legacy global, removed with the slice-11 legacy retirement). Invoking Align/Position-preset/Rotate(this variant)/Selection-Pane throws TypeError 'Cannot read properties of undefined'. They are NOT the handlers the Picture Format tab wires (the tab uses imgRotate/imgPosition/wrapText), so they're reachable only via the legacy Layout > Arrange ribbon path — but that path is live in ribbon-data and crashes. Dead-code-or-crash bug, distinct from the GAP-A catalog note.
- (Picture) Picture Format tab omits Align, Group, and Selection Pane entirely from the Arrange group (picture-tools-pm.js:46-55 lists only Position/WrapText/BringForward/SendBackward/Rotate) — real Word's Picture Format Arrange group includes Align, Group, and Selection Pane. Group/Align are genuinely absent from the contextual tab, not just stubbed.
- (Picture) Picture Format tab omits the entire Picture Styles group (gallery + Picture Border + Picture Effects + Picture Layout) — picture-tools-pm.js has no pf-styles group at all, so a selected picture exposes no styling whatsoever beyond grayscale.

## Remaining contextual tabs / sections not yet complete (round-out)

Beyond Table Layout/Design, table-move, and Picture Format (detailed above), these Word contextual tabs / feature
sections are absent or minimal in the clone. Bugs â†” improvements: each "improvement" is implementing the feature;
several already appear as stubs in `BUG-LEDGER.md` GAP-B.

### Header & Footer tab (Word: appears on double-click into a header/footer)
Clone state: **text-only.** `bridge/header-footer.ts` provides `setHeaderText/setFooterText/getHeaderText/getFooterText`
(plain one-paragraph text, exports `header1.xml`/`footer1.xml` + `sectPr` refs, round-trips â€” verified clean). Everything
else on Word's Header & Footer tab is **missing**:

| Word feature (group) | Priority | Clone state | How to implement |
|---|---|---|---|
| **Page Number** (Header & Footer) â€” gallery + Top/Bottom/Margins/Current-Position + Format Page Numbers | P1 | **blocked** (`isBlocked('pageNumber')`) | insert a `PAGE`/`NUMPAGES` field into the header/footer story; the FIELD half may ship before on-page render (mirror the header-text lesson). |
| **Date & Time** (Insert) â€” insert auto-updating date field into H/F | P2 | missing | reuse `xeDateTime` (a `DATE` field) but target the header/footer story editor. |
| **Document Info / Quick Parts** (Insert) â€” Author/FileName/Title field, Fieldâ€¦ dialog | P2 | missing | field insertion into the H/F story. |
| **Pictures / Online Pictures** into H/F (Insert) | P3 | missing | image insert targeting the H/F story (e.g. a logo). |
| **Navigation** â€” Go to Header / Go to Footer / Previous / Next / **Link to Previous** | P2 | missing | needs a live H/F editing surface + per-section linking; today H/F is a headless story write. |
| **Options** â€” **Different First Page**, **Different Odd & Even Pages**, Show Document Text | P1 | missing | `sectPr titlePg` + `evenAndOddHeaders` (settings) + distinct header parts (`default`/`first`/`even`). Export-side is achievable before render. |
| **Position** â€” Header from Top / Footer from Bottom (spinners), Insert Alignment Tab | P2 | missing | `sectPr w:headerReference`/`pgMar header`/`footer` distances; alignment tab is a `PTAB` field. |
| **Built-in Header/Footer galleries** (the design dropdowns) | P3 | partial (the Insert-tab Header/Footer dropdowns exist but are layout-gated) | building-block galleries â†’ insert formatted H/F content. |
| **On-page per-sheet render** (header/footer shown on every page) | P1 | **keystone-deferred** | the frames-overlay/paged-container render tier (`deferrals Â§A`); export works, on-screen repeat does not. |
| **Close Header and Footer** | P2 | missing | needs the live H/F edit mode to exit. |

**Top H/F improvements:** (1) Page Number field (unblock + `PAGE` field into the H/F story â€” highest user value);
(2) Different First Page / Odd-Even (`titlePg` + `evenAndOddHeaders` + the extra header parts) â€” export-achievable;
(3) a real header/footer editing surface (double-click-to-edit + the contextual tab) â€” gated on the render tier.

### Fully-stubbed feature tabs (the contextual tab never appears because the feature doesn't insert)
These are catalogued as stubs in `BUG-LEDGER.md` GAP-B; the "improvement" is implementing the feature itself.

- **Shape Format tab** â€” Shapes don't insert (`Insert.insertShape` is a toast), so the Drawing/Shape Format tab (Insert
  Shapes, Shape Styles, WordArt Styles, Text, Arrange, Size) never appears. **P1** â€” Shapes is a core Insert feature; needs
  a `wps:sp` auto-shape node + NodeView + the contextual tab.
- **SmartArt Design + Format tabs** â€” `xeSmartArt` is a no-op toast â†’ no SmartArt object, no tabs. P3 (large feature).
- **Chart Design + Format tabs** â€” `xeChart` is a no-op toast â†’ no chart, no tabs. P3 (large feature).
- **Equation tab (Equation Tools)** â€” `insertEquation` inserts Cambria-Math italic TEXT, not an OMML `m:oMath` object, so
  the Equation contextual tab + structures/symbols palette never appear. **P2** â€” needs a real OMML equation node + the tab.
- **Drawing Tools / Ink** â€” the Draw tab exists but pen-select/drawing-toggle UI state is broken (BUG-019) and Ink-to-Shape/
  Math/Replay are ML stubs; eraser point/segment deletes whole strokes (legacy re-triage). P2 polish.

_Catalogued for completeness; the table/picture contextual tabs above are the higher-value, partially-built targets._

