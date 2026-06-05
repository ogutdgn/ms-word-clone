// Path B: construct the VENDORED SuperDoc Editor, which owns the ProseMirror view.
// Phase 2: the PM core is the ACTIVE editor by default (spec D1); --legacy boots
// the classic app. The WC.PM bridge (src/renderer/bridge/) is the only code that
// talks to the engine.
import { Editor } from '@core/Editor.js'
import { getStarterExtensions } from '@extensions/index.js'
import { TextSelection } from '@/pm'
import { fixtureArrayBuffer } from '@/core/fixture'
import { preinstallBridge, installBridge, failBridge } from '@/bridge/index'

const w = window as any
w.__PM_TextSelection = TextSelection

// SYNCHRONOUS (before the async mount): mode flag + page flip + D6 stub.
preinstallBridge()

const host = document.getElementById('pages') || document.body
const mountEl = document.createElement('div')
mountEl.id = 'pm-editor' // page look: vendored print-layout inline styles + editor.css pm-active rules
host.appendChild(mountEl)

;(async () => {
  try {
    // loadXmlData returns [docx, media, mediaFiles, fonts, decrypted]; seed content + media + fonts.
    const [docx, , mediaFiles, fonts] = await (Editor as any).loadXmlData(fixtureArrayBuffer())

    // Legacy (content-seeded) mode does NOT auto-load starter extensions — pass them
    // explicitly or the schema has no 'doc' top node.
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

    installBridge(editor)
    w.WC.PM.setClean?.() // load-time transactions must never count as user edits

    w.__WC_READY = true // LAST statement after mount — the probe suites gate on this
  } catch (e: any) {
    w.__WC_ERROR = (e && (e.stack || e.message)) || String(e)
    console.error('[main] editor init failed:', e)
    failBridge(e)
    w.__WC_READY = true // suites still gate on readiness; [0a] tests then fail loudly
  }
})()
