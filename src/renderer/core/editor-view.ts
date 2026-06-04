import { EditorState, EditorView, keymap, baseKeymap } from '@/pm'
import type { Schema, Plugin } from '@/pm'

export function mountEditor(mountEl: HTMLElement, schema: Schema, docJson: unknown, plugins: Plugin[] = []): EditorView {
  const doc = (schema as any).nodeFromJSON(docJson)
  const state = EditorState.create({ schema, doc, plugins: [...plugins, keymap(baseKeymap)] })
  const view = new EditorView(mountEl, {
    state,
    dispatchTransaction(tr) {
      const next = view.state.apply(tr)
      view.updateState(next)
      // Logger seam (Phase 3 wraps/replaces this). EVERY tr flows through here:
      ;((window as any).WC.pm ??= {}).lastTr = { docChanged: tr.docChanged, steps: tr.steps.length }
    },
  })
  return view
}
