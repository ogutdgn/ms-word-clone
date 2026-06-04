import { mountEditor } from '@/core/editor-view'
import { importDocx } from '@/core/docx-import'
import { fixtureArrayBuffer } from '@/core/fixture'

const host = document.getElementById('pages') || document.body
const mountEl = document.createElement('div')
mountEl.id = 'pm-editor' // styled by the globally-loaded editor.css (looks like Word)
host.appendChild(mountEl)

const w = window as any
;(async () => {
  const { schema, doc } = await importDocx(fixtureArrayBuffer())
  const view = mountEditor(mountEl, schema, doc) // Stage B: baseKeymap typing only; Tab/indent plugins added in Stage C
  if (!w.WC) w.WC = {}        // legacy scripts already built window.WC — never reassign it or window.WC.Editor
  w.WC.view = view
  w.__WC_READY = true         // LAST statement after mount — the smoke test gates on this
})()
