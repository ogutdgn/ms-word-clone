// IO side of the bridge (spec §5.1 io.ts): export wrapper that un-swallows the
// engine's error contract, the dirty flag, and PM-doc counts for the chrome.
type AnyEditor = any

export function installIo(editor: AnyEditor) {
  const w = window as any
  let dirty = false
  editor.on('update', () => { dirty = true; w.WC?.Files?.updateTitle?.() }) // 'update' fires only on docChanged

  async function exportDocxBytes(): Promise<Uint8Array> {
    const blob = await editor.exportDocx()
    // Editor.ts:4049-4053 catches everything and resolves undefined — re-throw.
    if (!blob) throw new Error('Export failed — the engine reported an exception')
    return new Uint8Array(await blob.arrayBuffer())
  }

  function counts() {
    const dom = editor.view?.dom as HTMLElement | undefined
    const text: string = dom?.innerText || ''
    const words = (text.match(/\S+/g) || []).length
    const chars = text.replace(/\n/g, '').length
    const charsNoSpace = text.replace(/\s/g, '').length
    // PM engine does not inject ZWS — no strip needed (cf. legacy editor.js counts)
    const paras = dom ? dom.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote').length : 0
    const lines = (text.match(/\n/g) || []).length + 1
    const pages = 1 // continuous flow until Phase 7 (spec §7.8)
    const sel = editor.state.selection
    const selWords = sel.empty
      ? 0
      : ((editor.state.doc.textBetween(sel.from, sel.to, ' ') as string).match(/\S+/g) || []).length
    return { words, chars, charsNoSpace, paras, lines, pages, selWords }
  }

  return {
    isDirty: () => dirty,
    setClean: () => { dirty = false; w.WC?.Files?.updateTitle?.() },
    exportDocxBytes,
    counts,
  }
}
