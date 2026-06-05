// Path B: construct the VENDORED SuperDoc Editor, which owns the ProseMirror view.
// The Editor (with `element` + a real DOM) auto-mounts in its constructor and exposes
// a plain PM EditorView at `editor.view`. We seed it with the fixture .docx via the
// static loadXmlData helper. Telemetry is routed to a no-op (see _vendor common barrel),
// so no network traffic occurs (the smoke gates on window.__NET_LOG being empty).
import { Editor } from '@core/Editor.js'
import { getStarterExtensions } from '@extensions/index.js'
import { TextSelection } from '@/pm'
import { fixtureArrayBuffer } from '@/core/fixture'

const w = window as any
w.__PM_TextSelection = TextSelection

const host = document.getElementById('pages') || document.body
const mountEl = document.createElement('div')
mountEl.id = 'pm-editor' // styled by the globally-loaded editor.css (looks like Word)
host.appendChild(mountEl)

;(async () => {
  try {
    // loadXmlData returns [docx, media, mediaFiles, fonts, decrypted]; seed content + media + fonts.
    const [docx, , mediaFiles, fonts] = await (Editor as any).loadXmlData(fixtureArrayBuffer())

    // Real DOM + `element` provided + not headless => the constructor mounts the view itself.
    // In legacy (content-seeded) mode the Editor does NOT auto-load starter extensions
    // (that fallback only runs in deferDocumentLoad mode), so we must pass them — without
    // them the schema has no 'doc' top node.
    const editor = new (Editor as any)({
      element: mountEl,
      mode: 'docx',
      content: docx,
      mediaFiles,
      fonts,
      extensions: getStarterExtensions(),
      user: { name: 'local', email: '' },
      isDebug: false,
      telemetry: { enabled: false },
    })

    if (!w.WC) w.WC = {} // legacy scripts already built window.WC — never reassign it or window.WC.Editor
    w.WC.view = editor.view // plain PM EditorView — smoke checks .dispatch + .dom.isContentEditable
    w.WC.editor = editor

    // Logger seam (Phase 3 wraps/replaces this). The Editor re-emits every PM transaction.
    editor.on?.('transaction', () => {
      ;(w.WC.pm ??= {}).lastTxn = Date.now()
    })

    w.__WC_READY = true // LAST statement after mount — the smoke test gates on this
  } catch (e: any) {
    w.__WC_ERROR = (e && (e.stack || e.message)) || String(e)
    console.error('[main] editor init failed:', e)
  }
})()
