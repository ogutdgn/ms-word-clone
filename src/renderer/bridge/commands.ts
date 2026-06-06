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

  return { cmd, chain, captureSelection, withSelection }
}
