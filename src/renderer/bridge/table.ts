// Slice 6: table surface. Insertion + the legacy 9 ops mapped onto fork table commands.
//
// FORK API NOTES (verified against extensions/table/table.js):
// - addColumnBefore/After: internally call chain().run() from the fork's own command
//   context — calling editor.chain().addColumn*().run() double-wraps and misbehaves.
//   Use editor.commands.addColumnBefore/After() instead.
// - addRowBefore/After, deleteRow/Column, deleteTable, toggleHeaderRow/Column,
//   setCellAttr: safe to use via editor.commands.X() directly.
// - insertTable: safe to chain (does not internally chain).
//
// M1 (Critique-hardened): mergeCells (prosemirror-tables originalMergeCells) and
// setCellBackground BOTH require a CellSelection — they return false silently on a plain
// TextSelection. Bridge tableMerge()/tableSetCellShading() detect non-CellSelection and
// toast "Select cells first" + return false rather than silently no-op.

import { isCellSelection } from '@extensions/table/tableHelpers/isCellSelection.js'

type AnyEditor = any

export function installTable(editor: AnyEditor) {
  // Restore PM focus after each verb (same invariant as commands.ts / insert.ts).
  function refocus() { editor.view?.focus() }

  // Guard: require a CellSelection before running merge/shading commands.
  // Uses the fork's isCellSelection helper (instanceof CellSelection). prosemirror-tables
  // is deduped to a single copy by Vite, so instanceof is reliable across the bundle.
  const requireCellSel = (title: string, body: string): boolean => {
    if (isCellSelection(editor.state?.selection)) return true
    ;(window as any).WC?.toast?.(title, body)
    return false
  }

  function insertTable(opts: { rows?: number; cols?: number; withHeaderRow?: boolean } = {}): boolean {
    const rows = Math.max(1, Math.min(1000, Math.floor(opts.rows ?? 3)))
    const cols = Math.max(1, Math.min(1000, Math.floor(opts.cols ?? 3)))
    const ok = editor.chain().insertTable({ rows, cols, withHeaderRow: !!opts.withHeaderRow }).run()
    refocus()
    return ok !== false
  }

  function tableAddRow(dir: 'above' | 'below'): boolean {
    // addRowBefore/After: safe to call via commands directly (no internal chain())
    const ok = dir === 'above'
      ? editor.commands.addRowBefore()
      : editor.commands.addRowAfter()
    refocus()
    return ok !== false
  }

  function tableAddColumn(dir: 'left' | 'right'): boolean {
    // addColumnBefore/After: fork's implementation uses chain().run() internally —
    // must NOT wrap in editor.chain().X().run() (double-wrap). Use commands.X() directly.
    const ok = dir === 'left'
      ? editor.commands.addColumnBefore()
      : editor.commands.addColumnAfter()
    refocus()
    return ok !== false
  }

  function tableDeleteRow(): boolean {
    const ok = editor.commands.deleteRow()
    refocus()
    return ok !== false
  }

  function tableDeleteColumn(): boolean {
    const ok = editor.commands.deleteColumn()
    refocus()
    return ok !== false
  }

  function tableDeleteTable(): boolean {
    const ok = editor.commands.deleteTable()
    refocus()
    return ok !== false
  }

  function tableMerge(): boolean {
    // M1: mergeCells requires a CellSelection (multi-cell selection).
    // On a plain TextSelection (caret or collapsed range in one cell) it returns false
    // silently. Detect and toast so the user knows what to do.
    if (!requireCellSel('Select cells first', 'Select multiple cells to merge them — click and drag across cells in the table.')) return false
    const ok = editor.commands.mergeCells()
    refocus()
    return ok !== false
  }

  function tableSplitCell(): boolean {
    const ok = editor.commands.splitCell()
    refocus()
    return ok !== false
  }

  function tableToggleHeaderRow(): boolean {
    const ok = editor.commands.toggleHeaderRow()
    refocus()
    return ok !== false
  }

  function tableToggleHeaderColumn(): boolean {
    const ok = editor.commands.toggleHeaderColumn()
    refocus()
    return ok !== false
  }

  function tableSetCellShading(color: string): boolean {
    // M1: setCellBackground requires a CellSelection. Detect and toast.
    if (!requireCellSel('Select cells first', 'Select one or more cells to apply shading — click and drag across cells in the table.')) return false
    const ok = editor.commands.setCellBackground(color)
    refocus()
    return ok !== false
  }

  function tableSetCellVAlign(v: 'top' | 'middle' | 'bottom'): boolean {
    const ok = editor.commands.setCellAttr('verticalAlign', v)
    refocus()
    return ok !== false
  }

  // Is the selection inside a table? (drives contextual-tab show/hide + Table Tools state)
  // Walk $from ancestors for a node of type 'table'.
  function isInTable(): boolean {
    try {
      const { $from } = editor.state.selection
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'table') return true
      }
    } catch { /* selection state the resolver can't read */ }
    return false
  }

  // ---------- 6b: net-new Table Tools commands (Task 9) ----------
  // All 14 fork commands use raw PM dispatch ({ state, tr, dispatch }) and work off
  // a plain caret-in-table — no CellSelection gate needed (confirmed by Task 8 tests).
  // Use editor.commands.X() directly (same pattern as addColumnBefore/After).

  function tableSetStyle(id: string): boolean {
    const ok = editor.commands.setTableStyle(id)
    refocus()
    return ok !== false
  }

  function tableSetAlignment(a: 'left' | 'center' | 'right'): boolean {
    const ok = editor.commands.setTableAlignment(a)
    refocus()
    return ok !== false
  }

  function tableSetIndent(px: number): boolean {
    const ok = editor.commands.setTableIndent(px)
    refocus()
    return ok !== false
  }

  function tableSetCellWidth(px: number): boolean {
    const ok = editor.commands.setCellWidth(px)
    refocus()
    return ok !== false
  }

  function tableSetRowHeight(px: number, rule?: string): boolean {
    const ok = editor.commands.setRowHeight(px, rule)
    refocus()
    return ok !== false
  }

  function tableSetCellMargins(m: { top?: number; right?: number; bottom?: number; left?: number }): boolean {
    const ok = editor.commands.setCellMargins(m)
    refocus()
    return ok !== false
  }

  function tableSetCellBorders(b: Record<string, unknown>): boolean {
    const ok = editor.commands.setCellBorders(b)
    refocus()
    return ok !== false
  }

  function tableDistributeColumns(): boolean {
    const ok = editor.commands.distributeColumnsEvenly()
    refocus()
    return ok !== false
  }

  function tableDistributeRows(): boolean {
    const ok = editor.commands.distributeRowsEvenly()
    refocus()
    return ok !== false
  }

  function tableSplit(): boolean {
    const ok = editor.commands.splitTableAtRow()
    refocus()
    return ok !== false
  }

  function tableToText(d?: string): boolean {
    const ok = editor.commands.convertTableToText(d)
    refocus()
    return ok !== false
  }

  function textToTable(d?: string): boolean {
    const ok = editor.commands.convertTextToTable(d)
    refocus()
    return ok !== false
  }

  function tableSetTextDirection(dir: string): boolean {
    const ok = editor.commands.setTextDirection(dir)
    refocus()
    return ok !== false
  }

  function tableAutoFit(mode: 'fixed' | 'contents' | 'window'): boolean {
    const ok = editor.commands.autoFitTable(mode)
    refocus()
    return ok !== false
  }

  // Test helper (Task 9 / Critique B3): build a CellSelection over the first two
  // @internal — test helper (CellSelection over the first row pair); not a stable public API
  // cells of the table's first row. Used by the [6b] merge test in test-suite-pm.js.
  // Calls the fork's setCellSelection({ anchorCell, headCell }) command with the
  // absolute positions of cells [0] and [1] in the first row.
  function tableSelectFirstRowPair(): boolean {
    try {
      const { selection, doc } = editor.state
      // Walk $from ancestors to find the table node.
      const { $from } = selection
      let tablePos = -1
      let tableNode: any = null
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'table') {
          tableNode = $from.node(d)
          tablePos = $from.before(d)
          break
        }
      }
      if (!tableNode || tablePos < 0) return false

      // tableStart is 1 past the table's opening token.
      const tableStart = tablePos + 1
      // First row is the first child of the table.
      const firstRow = tableNode.child(0)
      if (!firstRow || firstRow.childCount < 2) return false

      // Cell positions are relative to tableStart (prosemirror-tables convention).
      // cell[0] offset = 0 (right after row open token).
      // cell[1] offset = cell[0].nodeSize.
      const cell0RelPos = 1 // row open token = 1 offset inside tableStart
      const cell1RelPos = cell0RelPos + firstRow.child(0).nodeSize

      // Absolute positions inside the document (setCellSelection wants doc-absolute).
      const anchorCell = tableStart + cell0RelPos
      const headCell = tableStart + cell1RelPos

      const ok = editor.commands.setCellSelection({ anchorCell, headCell })
      refocus()
      return ok !== false
    } catch {
      return false
    }
  }

  // Returns { inTable, rows, cols, styleId, alignment } for Table Tools tab state.
  // Falls back to { inTable: false } when not in a table (safe for pre-mount stubs).
  function tableInfo(): { inTable: boolean; rows?: number; cols?: number; styleId?: string | null; alignment?: string | null } {
    if (!isInTable()) return { inTable: false }
    try {
      const { $from } = editor.state.selection
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'table') {
          const node = $from.node(d)
          const rows: number = node.childCount
          // cols = number of cells in first row (header or body).
          const cols: number = rows > 0 ? node.child(0).childCount : 0
          const styleId: string | null = node.attrs?.tableStyleId ?? null
          // Fork stores alignment as 'justification' attr (or inside tableProperties).
          const alignment: string | null =
            node.attrs?.justification ??
            node.attrs?.tableProperties?.justification ??
            null
          return { inTable: true, rows, cols, styleId, alignment }
        }
      }
    } catch { /* fall through */ }
    return { inTable: false }
  }

  return {
    insertTable,
    tableAddRow,
    tableAddColumn,
    tableDeleteRow,
    tableDeleteColumn,
    tableDeleteTable,
    tableMerge,
    tableSplitCell,
    tableToggleHeaderRow,
    tableToggleHeaderColumn,
    tableSetCellShading,
    tableSetCellVAlign,
    isInTable,
    tableInfo,
    // 6b: net-new Table Tools verbs
    tableSetStyle,
    tableSetAlignment,
    tableSetIndent,
    tableSetCellWidth,
    tableSetRowHeight,
    tableSetCellMargins,
    tableSetCellBorders,
    tableDistributeColumns,
    tableDistributeRows,
    tableSplit,
    tableToText,
    textToTable,
    tableSetTextDirection,
    tableAutoFit,
    tableSelectFirstRowPair,
  }
}
