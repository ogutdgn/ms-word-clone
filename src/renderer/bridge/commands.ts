// Command side of the WC.PM bridge (spec §5.1). The ONLY caller of
// editor.commands/chain in the app. editor.commands is a GETTER capturing a
// fresh tr per access — resolve at call time, never cache (CommandService.js:57-81).
import { STYLE_NAME_TO_ID } from './style-names'
import { calculateResolvedParagraphProperties } from '@extensions/paragraph/resolvedPropertiesCache.js'
import { headParagraph } from './state-sync'
import { PREVIEW_META } from './style-preview'
type AnyEditor = any

export function installCommands(editor: AnyEditor) {
  function cmd(name: string, ...args: unknown[]): boolean {
    const c = editor.commands
    const fn = c && c[name]
    if (typeof fn !== 'function') { console.debug('[WC.PM] unknown command:', name); return false }
    const ok = fn(...args)
    editor.view?.focus() // primary focus invariant (spec §7.4)
    return ok !== false
  }

  // steps: Array<[commandName, ...args]> — ONE transaction = ONE undo step (Word fidelity).
  function chain(steps: Array<[string, ...unknown[]]>): boolean {
    let ch = editor.chain()
    for (const [name, ...args] of steps) {
      if (typeof ch[name] !== 'function') { console.debug('[WC.PM] unknown chain step:', name); return false }
      ch = ch[name](...args)
    }
    const ok = ch.run()
    editor.view?.focus()
    return ok !== false
  }

  // Dialog/combo selection round-trip. Keeps its OWN copy — the engine nulls
  // options.lastSelection on undo/redo (history.js:9-39).
  let savedSel: { from: number; to: number } | null = null
  function captureSelection() {
    const { from, to } = editor.state.selection
    savedSel = { from, to }
  }
  // setTextSelection takes { from, to } object (verified: core/commands/setTextSelection.js:13-14).
  function withSelection(fn: () => void) {
    if (savedSel) {
      const size = editor.state.doc.content.size
      editor.commands.setTextSelection({ from: Math.min(savedSel.from, size), to: Math.min(savedSel.to, size) })
    }
    fn()
    savedSel = null
    editor.view?.focus()
  }

  // Length-preserving case transform as ONE PM transaction (no engine command
  // for this; text-transform ext has no addCommands). insertText inherits the
  // replaced range's marks; mapping keeps later positions valid.
  function changeCase(mode: string): boolean {
    const xform = (t: string) => {
      if (mode === 'lower') return t.toLowerCase()
      if (mode === 'upper') return t.toUpperCase()
      if (mode === 'caps') return t.replace(/\b\w/g, (m) => m.toUpperCase())
      // Word's wdTitleSentence (COM-verified, RB-047): capitalize the first letter of each
      // sentence (string start, or after .!? + WHITESPACE) and leave the rest AS-IS — it does
      // NOT lowercase the rest, and a terminator with NO following space ("end.New") is NOT a
      // boundary. (The prior t.toLowerCase() flattened mixed case — wrong vs Word.)
      if (mode === 'sentence') return t.replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase())
      if (mode === 'toggle') return t.replace(/./g, (ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()))
      return t
    }
    const { state } = editor
    const { from, to, empty } = state.selection
    if (empty) return false
    let tr = state.tr
    state.doc.nodesBetween(from, to, (node: any, pos: number) => {
      if (!node.isText || !node.text) return
      const s = Math.max(from, pos)
      const e = Math.min(to, pos + node.nodeSize)
      const slice = node.text.slice(s - pos, e - pos)
      const next = xform(slice)
      if (next !== slice) tr = tr.insertText(next, tr.mapping.map(s), tr.mapping.map(e))
    })
    if (tr.docChanged) editor.view?.dispatch(tr)
    editor.view?.focus()
    return true
  }

  // RB-010: Shading respects selection granularity like Word's Borders & Shading
  // "Apply to" dropdown. A PARTIAL (sub-paragraph) selection → run-level CHARACTER
  // shading (rPr/w:shd) on just the run — Word-COM-verified (validate-charshd-win.ps1:
  // Range("beta").Shading=FFE599 while Paragraph.Shading=automatic). An empty caret, a
  // whole-paragraph selection, or a multi-paragraph selection → paragraph shading
  // (pPr/w:shd). Previously every shade flooded the paragraph (pPr/w:shd) regardless of
  // selection. The fork models a run background as the `highlight` mark, whose exporter
  // emits w:shd for non-keyword colours (and w:highlight for the ~16 Word highlight
  // keyword colours — a visually identical run background; a documented v1 edge).
  function shadingScope(): 'run' | 'paragraph' {
    const { selection, doc } = editor.state
    const { from, to, empty } = selection
    if (empty) return 'paragraph'
    const $from = doc.resolve(from)
    const $to = doc.resolve(to)
    if (!$from.sameParent($to)) return 'paragraph' // spans >1 block
    // whole-block content selected (start..end of the paragraph's text) → paragraph
    if (from <= $from.start() && to >= $from.end()) return 'paragraph'
    return 'run'
  }
  function setShading(color: string): boolean {
    if (!color || color === 'transparent') return clearShading()
    const fill = String(color).replace(/^#/, '').toUpperCase()
    if (shadingScope() === 'run') {
      // run-level character shading via the highlight mark (exports rPr/w:shd for a
      // non-keyword colour; a keyword colour serialises as w:highlight — same visual).
      return cmd('setHighlight', '#' + fill)
    }
    return cmd('updateAttributes', 'paragraph', { 'paragraphProperties.shading': { val: 'clear', color: 'auto', fill } })
  }
  function clearShading(): boolean {
    // "No Color" clears BOTH paragraph shading and any run-level character shading in
    // the selection (the highlight mark is the run-background carrier).
    cmd('resetAttributes', 'paragraph', 'paragraphProperties.shading')
    cmd('unsetHighlight')
    return true
  }

  // RB-009/048: apply font size via the run-level textStyle.fontSize mark directly so the
  // full Word range (1–1638pt) is honoured. The fork's setFontSize command hard-clamps to
  // 8–96 (font-size.js minMax) — a silent data-loss for typed combo values >96 / <8 and a
  // ceiling on grow-font. We clamp to Word's documented 1–1638 instead (validation, not loss).
  function setFontSizePt(pt: number | string): boolean {
    const n = parseFloat(String(pt))
    if (!Number.isFinite(n)) return false
    const v = Math.min(1638, Math.max(1, n))
    return cmd('setMark', 'textStyle', { fontSize: v + 'pt' })
  }

  // Paragraph sort as ONE PM transaction (no engine command — legacy sortDialog
  // reordered DOM siblings). Restricted to contiguous siblings of the first selected
  // paragraph's parent, mirroring legacy sortSelection's same-parent guard.
  function sortParagraphs(opts: { ascending?: boolean; numeric?: boolean; date?: boolean; header?: boolean } = {}): boolean {
    const { state } = editor
    const { from, to } = state.selection
    const paras: Array<{ node: any; pos: number }> = []
    state.doc.nodesBetween(from, to, (node: any, pos: number) => {
      if (node.type.name === 'paragraph') { paras.push({ node, pos }); return false }
      return true
    })
    if (paras.length < 2) return false
    const parent0 = state.doc.resolve(paras[0].pos).parent
    const blocks = paras.filter((p) => state.doc.resolve(p.pos).parent === parent0)
    if (blocks.length < 2) return false
    // Contiguity guard: replaceWith below rebuilds [start,end) — bail if other nodes interleave.
    const start = blocks[0].pos
    const end = blocks[blocks.length - 1].pos + blocks[blocks.length - 1].node.nodeSize
    if (blocks.reduce((s, b) => s + b.node.nodeSize, 0) !== end - start) return false
    const head = opts.header ? blocks.slice(0, 1) : []
    const toSort = opts.header ? blocks.slice(1) : blocks
    // Date sorts CHRONOLOGICALLY (Word's "Date" type), not by leading number (the old bug:
    // Date reused the numeric parseFloat path). Unparseable dates sort as 0 (epoch) — last-ish,
    // matching Word's lenient ordering of non-dates.
    const asDate = (s: string) => { const t = Date.parse(String(s).trim()); return Number.isNaN(t) ? 0 : t }
    const cmp = (a: any, b: any) => {
      let r: number
      if (opts.date) r = asDate(a.node.textContent) - asDate(b.node.textContent)
      else if (opts.numeric) r = (parseFloat(a.node.textContent) || 0) - (parseFloat(b.node.textContent) || 0)
      else r = a.node.textContent.localeCompare(b.node.textContent, undefined, { numeric: true, sensitivity: 'base' })
      return opts.ascending === false ? -r : r
    }
    const sorted = head.concat(toSort.slice().sort(cmp))
    editor.view?.dispatch(state.tr.replaceWith(start, end, sorted.map((p: any) => p.node)))
    editor.view?.focus()
    return true
  }

  // Resolved (style-cascade-included) head-paragraph properties — the bridge read
  // the slice-2 changeListLevelMenu DEVIATION comment stipulated for slice 3.
  // Mirrors state-sync's resolved block (same fallback semantics).
  function getResolvedParaProps(): any {
    const head = headParagraph(editor)
    if (!head) return null
    try { return calculateResolvedParagraphProperties(editor, head.node, editor.state.doc.resolve(head.pos)) }
    catch { return head.node.attrs?.paragraphProperties || null }
  }

  const styleIdForName = (name: string): string | null => STYLE_NAME_TO_ID[name] || null

  // Named-style apply: display name → styleId → setStyleById (ONE transaction; the
  // full plugin-state style object, so the partial-selection linked-character-style
  // branch works — never pass bare {id}). Returns false for unknown names AND for
  // styles absent from the doc's catalog (foreign docs missing built-ins beyond the
  // import defaults — recorded deviation: Word mints from its built-in library).
  function applyStyleByName(name: string): boolean {
    const id = styleIdForName(name)
    if (!id) return false
    return cmd('setStyleById', id)
  }

  // slice 4: editing-misc
  function selectAll(): boolean { return cmd('selectAll') }

  // Legacy-parity similar-formatting: ONE TextSelection spanning the first→last
  // text run whose mark signature matches the reference run's. Recorded deviation:
  // real Word multi-selects discontiguous ranges; PM TextSelection is single-range.
  function selectSimilarFormatting(): boolean {
    const { state } = editor
    const { $from, from, to, empty } = state.selection
    const sig = (marks: readonly any[]) =>
      JSON.stringify(marks.map((m: any) => [m.type.name, m.attrs]).sort())
    // Reference marks: at a run's START boundary $from.marks() returns the PRECEDING
    // run's marks. For a non-empty selection take the FIRST text run the selection
    // actually covers; the empty-caret case stays storedMarks ?? $from.marks().
    let refMarks: readonly any[] | null = null
    if (!empty) {
      state.doc.nodesBetween(from, to, (node: any) => {
        if (refMarks === null && node.isText) refMarks = node.marks
        return refMarks === null
      })
    }
    if (refMarks === null) refMarks = state.storedMarks ?? $from.marks()
    const ref = sig(refMarks!)
    let first = -1, last = -1
    state.doc.descendants((node: any, pos: number) => {
      if (!node.isText) return
      if (sig(node.marks) === ref) {
        if (first < 0) first = pos
        last = pos + node.nodeSize
      }
    })
    if (first < 0) return false
    return cmd('setTextSelection', { from: first, to: last })
  }

  // slice 4: format painter (fork FormatCommands storage is the state of record)
  const painterStorage = () => (editor as any).extensionStorage?.formatCommands
  // Nudge a no-op meta transaction so state-sync's rAF tick fires immediately after
  // arm/cancel — copyFormat/cancelFormatPainter only mutate storage (no dispatch).
  // A step-less tr has docChanged=false → 'update' never fires → dirty untouched.
  // PREVIEW_META is also set so io.ts's guard covers any future docChanged edge case.
  function nudgePainterChrome(): void {
    try {
      const tr = editor.state.tr
        .setMeta('addToHistory', false)
        .setMeta(PREVIEW_META, true)
        .setMeta('wcPainterChrome', true)
      editor.view?.dispatch(tr)
    } catch { /* view gone */ }
  }
  function armFormatPainter(sticky: boolean): boolean {
    const ok = cmd('copyFormat', { persistent: sticky })
    nudgePainterChrome()
    return ok
  }
  function cancelFormatPainter(): boolean {
    const ok = cmd('cancelFormatPainter')
    nudgePainterChrome()
    return ok
  }
  function painterArmed(): boolean {
    const s = painterStorage()
    return !!(s && (s.storedStyle || s.storedParaProps))
  }

  return { cmd, chain, captureSelection, withSelection, changeCase, sortParagraphs,
    setShading, clearShading, setFontSizePt,
    getResolvedParaProps, styleIdForName, applyStyleByName,
    selectAll, selectSimilarFormatting, armFormatPainter, cancelFormatPainter, painterArmed }
}
