// Command side of the WC.PM bridge (spec §5.1). The ONLY caller of
// editor.commands/chain in the app. editor.commands is a GETTER capturing a
// fresh tr per access — resolve at call time, never cache (CommandService.js:57-81).
import { STYLE_NAME_TO_ID } from './style-names'
import { calculateResolvedParagraphProperties } from '@extensions/paragraph/resolvedPropertiesCache.js'
import { headParagraph } from './state-sync'
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
      if (mode === 'sentence') return t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase())
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

  // Paragraph sort as ONE PM transaction (no engine command — legacy sortDialog
  // reordered DOM siblings). Restricted to contiguous siblings of the first selected
  // paragraph's parent, mirroring legacy sortSelection's same-parent guard.
  function sortParagraphs(opts: { ascending?: boolean; numeric?: boolean; header?: boolean } = {}): boolean {
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
    const cmp = (a: any, b: any) => {
      let r: number
      if (opts.numeric) r = (parseFloat(a.node.textContent) || 0) - (parseFloat(b.node.textContent) || 0)
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

  return { cmd, chain, captureSelection, withSelection, changeCase, sortParagraphs, getResolvedParaProps, styleIdForName, applyStyleByName }
}
