// Command side of the WC.PM bridge (spec §5.1). The ONLY caller of
// editor.commands/chain in the app. editor.commands is a GETTER capturing a
// fresh tr per access — resolve at call time, never cache (CommandService.js:57-81).
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

  return { cmd, chain, captureSelection, withSelection, changeCase }
}
