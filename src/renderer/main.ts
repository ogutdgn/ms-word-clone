// Path B: construct the VENDORED SuperDoc Editor, which owns the ProseMirror view.
// Phase 2: the PM core is the ACTIVE editor by default (spec D1); --legacy boots
// the classic app. The WC.PM bridge (src/renderer/bridge/) is the only code that
// talks to the engine.
import { TextSelection, NodeSelection } from '@/pm'
import { fixtureArrayBuffer, negationArrayBuffer } from '@/core/fixture'
import { preinstallBridge, installBridge, failBridge } from '@/bridge/index'
import { createPmEditor, createPagedEditor } from '@/bridge/create-editor'
import { installProofing } from '@/proofing/proofing'
// Fork element styles (markers/tabs): the bridge imports @core/Editor.js directly, so
// superdoc-fork/index.js → style.css never enters the build. Without the .sd-editor-tab
// inline-block rule, list-marker separators and typed tabs render zero-width.
import './core/superdoc-fork/assets/styles/elements/prosemirror.css'

// Build-time default for the WC_LAYOUT toggle, injected by electron.vite.config.ts `define`
// (= process.env.WC_LAYOUT at build, else ''). Erased at runtime by esbuild's define replace.
declare const __WC_LAYOUT_DEFAULT__: string

const w = window as any
w.__PM_TextSelection = TextSelection
w.__PM_NodeSelection = NodeSelection
// Debug global for the PM suite: the Word-authored negation-run fixture (spec §7.5).
// The suite runs from the BUILT app and has no stable absolute repo path — inlining
// the fixture (gen-fixture) keeps the test hermetic.
w.__WC_FIXTURE_NEGATION = negationArrayBuffer

// WC_LAYOUT toggle (strangler-fig): 'overlay' = the shipping decoration engine (DEFAULT);
// 'paged' = the Option-B PresentationEditor standup. Renderer can't read process.env
// (contextIsolation), so use a runtime localStorage override, else the build-time default.
const layoutMode =
  (() => { try { return localStorage.getItem('WC_LAYOUT') } catch { return null } })() ||
  (typeof __WC_LAYOUT_DEFAULT__ !== 'undefined' ? __WC_LAYOUT_DEFAULT__ : '') ||
  'overlay'
w.__WC_LAYOUT_MODE = layoutMode

// SYNCHRONOUS (before the async mount): mode flag + page flip + D6 stub.
preinstallBridge()
// Offline proofing engine for the Editor pane (lazy dictionary build on first use).
installProofing(w)

const host = document.getElementById('pages') || document.body
const mountEl = document.createElement('div')
mountEl.id = 'pm-editor' // page look: vendored print-layout inline styles + editor.css pm-active rules
host.appendChild(mountEl)

;(async () => {
  try {
    // WC_LAYOUT branch. paged: PresentationEditor paints real pages; the WC bridge binds to its
    // INNER editor (which has .view). overlay: the plain Editor + decoration pagination (verbatim).
    let editor: any
    if (layoutMode === 'paged') {
      const m = await createPagedEditor(mountEl, fixtureArrayBuffer())
      editor = m.editor
      w.WC.presentation = m.presentation // the paint owner; bridge binds to .editor, NOT this
    } else {
      editor = await createPmEditor(mountEl, fixtureArrayBuffer())
    }

    // legacy scripts already built window.WC — never reassign it or window.WC.Editor
    w.WC.view = editor.view // plain PM EditorView — smoke checks .dispatch + .dom.isContentEditable
    w.WC.editor = editor

    // Logger seam (Phase 3 wraps/replaces this). The Editor re-emits every PM transaction.
    editor.on?.('transaction', () => {
      ;(w.WC.pm ??= {}).lastTxn = Date.now()
    })

    // Overlay path: install verbatim. Paged standup: a bridge sub-installer may query
    // #pm-editor/.pages (wiped/absent under PresentationEditor) and throw — don't let one throw
    // mask the engine-paint proof; record it for the probe (full-B retargets these) and continue.
    if (layoutMode === 'paged') {
      try { installBridge(editor) } catch (be: any) { w.__WC_BRIDGE_ERROR = (be && (be.stack || be.message)) || String(be) }
    } else {
      installBridge(editor)
    }
    w.WC.PM.setClean?.() // load-time transactions must never count as user edits

    w.__WC_READY = true // LAST statement after mount — the probe suites gate on this
  } catch (e: any) {
    w.__WC_ERROR = (e && (e.stack || e.message)) || String(e)
    console.error('[main] editor init failed:', e)
    failBridge(e)
    w.__WC_READY = true // suites still gate on readiness; [0a] tests then fail loudly
  }
})()
