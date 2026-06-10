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

  // Returns { inTable } for Table Tools tab show/hide.
  // TODO(Stage E/F): add cell pos/rect for context-menu anchoring.
  function tableInfo(): { inTable: boolean } {
    return { inTable: isInTable() }
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
  }
}
