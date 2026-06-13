// WC.PM — the bridge between the vanilla-JS Word chrome and the vendored
// ProseMirror engine (spec §4/§5). Grafted onto the existing WC namespace;
// NEVER reassign window.WC or window.WC.Editor (main.ts invariant).
import { legacyBoot } from './mode'
import { installCommands } from './commands'
import { installClipboard, pasteEvent } from './clipboard'
import { installSearch } from './search'
import { installInsert } from './insert'
import { installTable } from './table'
import { installReview } from './review'
import { installReferences } from './references'
import { installMailMerge } from './mail'
import { installDesign } from './design'
import { installInsertExotica } from './insert-exotica'
import { installCommentsUI } from './comments-ui'
import { installTrackChrome } from './track-chrome'
import { installNotesArea } from './notes-area'
import { installIo } from './io'
import { installStylePreview } from './style-preview'
import { installStateSync } from './state-sync'
import { installFocusGuards } from './focus'
import { getActiveFormatting } from '@core/helpers/getActiveFormatting.js'
import { toQueryState } from './state-sync'
import { parseDocx, constructPmEditor } from './create-editor'
import { blankArrayBuffer } from '@/core/fixture'
import { textToParagraphHtml, csvToTableHtml } from './file-content'

type AnyEditor = any
let current: AnyEditor = null
// Single document-level Esc listener for the format painter — attached exactly
// once (installBridge re-runs on Open/New; per-call addEventListener would stack).
let painterEscInstalled = false
// Concurrency guard: replaceEditor must not overlap itself (concurrent Open/New
// clicks must not race — second call is refused while first is in flight).
let replacing = false
// Set when the html contentErr recovery replaced the live doc with a fresh BLANK
// editor (replaceEditor returned false but the old doc is GONE). Consumers
// (files.js) must unbind path/name/format in that case — keeping the old binding
// would let Ctrl+S write a blank over the old file (spec §5.3 data loss).
let lastImportBlanked = false

// ---- D6 registry (spec §5.1/§7.1a): cmd-id → area, + the flipped-area set. ----
// Doc-touching cmd ids ONLY — app-level cmds are absent (= never blocked here).
// Keys = the §9.1 area names. Each slice's flip edits FLIPPED in source (auditable).
const FLIPPED = new Set<string>(['character', 'history', 'paragraph', 'lists', 'styles', 'clipboard', 'editing-misc', 'find-replace', 'insert-basics', 'review', 'references', 'mail-merge', 'themes', 'insert-exotica']) // slices 1-6 + 8-10
const AREA: Record<string, string> = {
  // character (slice 1)
  bold: 'character', italic: 'character', underline: 'character', strikethrough: 'character',
  subscript: 'character', superscript: 'character', clearAllFormatting: 'character',
  increaseFontSize: 'character', decreaseFontSize: 'character', font: 'character',
  fontSize: 'character', textHighlightColor: 'character', fontColor: 'character',
  changeCase: 'character',
  // no engine equivalent — revisit with design (slice 10)
  textEffectsAndTypography: 'text-effects',
  // clipboard (slice 4)
  cut: 'clipboard', copy: 'clipboard', paste: 'clipboard',
  formatPainter: 'clipboard', formatPainterLock: 'clipboard',
  // paragraph (slice 2)
  alignLeft: 'paragraph', center: 'paragraph', alignRight: 'paragraph', justify: 'paragraph',
  decreaseIndent: 'paragraph', increaseIndent: 'paragraph', sort: 'paragraph',
  lineAndParagraphSpacing: 'paragraph', shading: 'paragraph', borders: 'paragraph',
  indentLeft: 'paragraph', indentRight: 'paragraph', spacingBefore: 'paragraph', spacingAfter: 'paragraph',
  // lists (slice 2)
  bullets: 'lists', numbering: 'lists', multilevelList: 'lists',
  // styles (slice 3)
  stylesGallery: 'styles',
  // editing/find (slice 5)
  find: 'find-replace', replace: 'find-replace',
  select: 'editing-misc', // slice 4 — spec row 4; was find-replace (ribbon-group adjacency accident, slice 0a)
  // insert basics (slice 6) — these FLIP
  table: 'insert-basics', link: 'insert-basics', bookmark: 'insert-basics', pageBreak: 'insert-basics',
  blankPage: 'insert-basics', symbol: 'insert-basics', equation: 'insert-basics',
  horizontalLine: 'insert-basics', pictures: 'insert-basics',
  // Table Tools (Table Layout + Table Design contextual tabs, slice 6 Task 10) — mapped
  // to insert-basics (FLIPPED) so the dispatch audit stays honest and they un-block.
  tblInsertAbove: 'insert-basics', tblInsertBelow: 'insert-basics', tblInsertLeft: 'insert-basics',
  tblInsertRight: 'insert-basics', tblDeleteRow: 'insert-basics', tblDeleteColumn: 'insert-basics',
  tblDeleteTable: 'insert-basics', tblMerge: 'insert-basics', tblSplitCell: 'insert-basics',
  tblSplitTable: 'insert-basics', tblDistRows: 'insert-basics', tblDistCols: 'insert-basics',
  tblHeaderRow: 'insert-basics', tblHeaderCol: 'insert-basics', tblToText: 'insert-basics',
  tblVAlignTop: 'insert-basics', tblVAlignMid: 'insert-basics', tblVAlignBottom: 'insert-basics',
  tblTextDir: 'insert-basics', tblAlignLeft: 'insert-basics', tblAlignCenter: 'insert-basics',
  tblAlignRight: 'insert-basics', tblCellMargins: 'insert-basics', tblStyles: 'insert-basics',
  tblShading: 'insert-basics', tblBorders: 'insert-basics', tblAutoFit: 'insert-basics',
  // insert exotica (slice 10) — STAY blocked (carved out of insert-basics in the slice-6 flip)
  onlinePictures: 'insert-exotica', screenshot: 'insert-exotica', icons: 'insert-exotica',
  smartart: 'insert-exotica', chart: 'insert-exotica', onlineVideo: 'insert-exotica',
  dropCap: 'insert-exotica', wordart: 'insert-exotica', textBox: 'insert-exotica',
  object: 'insert-exotica', signatureLine: 'insert-exotica', dateTime: 'insert-exotica',
  coverPage: 'insert-exotica', quickParts: 'insert-exotica',
  crossReference: 'references', // slice 9 (fork has the cross-reference extension)
  // review (slice 8) — task 3 regroup (D8.1/A4): the old label-derived ids
  // delete/previous/next are GONE from the ribbon; the per-control cmd overrides
  // (deleteComment/previousComment/nextComment/previousChange/nextChange/
  // filterMarkup/spellingGrammar) are the live ids.
  newComment: 'review', comment: 'review', deleteComment: 'review',
  previousComment: 'review', nextComment: 'review',
  previousChange: 'review', nextChange: 'review',
  showComments: 'review', trackChanges: 'review', accept: 'review', reject: 'review',
  thesaurus: 'review', language: 'review',
  spellingGrammar: 'review', filterMarkup: 'review',
  // review (slice 8, A5): the rest of the tab's doc-touching cmds — unmapped they were
  // NOT D6-blocked (isBlocked returns false) and silently drove the hidden legacy editor.
  // App-level by design (never mapped): wordCount, blockAuthors, linkedNotes.
  editor: 'review', readAloud: 'review', checkAccessibility: 'review', translate: 'review',
  displayForReview: 'review', showMarkup: 'review', reviewingPane: 'review', compare: 'review',
  restrictEditing: 'review', hideInk: 'review',
  // references (slice 9)
  tableOfContents: 'references', addText: 'references', updateTable: 'references',
  insertFootnote: 'references', insertEndnote: 'references', nextFootnote: 'references',
  showNotes: 'references', insertCitation: 'references', manageSources: 'references',
  style: 'references', bibliography: 'references', insertCaption: 'references',
  insertTableOfFigures: 'references', markEntry: 'references', insertIndex: 'references',
  updateIndex: 'references', markCitation: 'references', insertTableOfAuthorities: 'references',
  // mail merge (slice 10)
  envelopes: 'mail-merge', labels: 'mail-merge', startMailMerge: 'mail-merge',
  selectRecipients: 'mail-merge', editRecipientList: 'mail-merge', highlightMergeFields: 'mail-merge',
  addressBlock: 'mail-merge', greetingLine: 'mail-merge', insertMergeField: 'mail-merge',
  rules: 'mail-merge', matchFields: 'mail-merge', updateLabels: 'mail-merge',
  finishMerge: 'mail-merge',
  // draw (slice 10)
  drawing: 'draw', eraser: 'draw', pensGallery: 'draw', addPen: 'draw',
  drawingCanvas: 'draw', inkReplay: 'draw', selectObjects: 'draw', lassoSelect: 'draw',
  // design/themes (slice 10)
  themes: 'themes', styleSet: 'themes', colors: 'themes', fonts: 'themes',
  paragraphSpacing: 'themes', effects: 'themes', setAsDefault: 'themes',
  watermark: 'themes', pageColor: 'themes', pageColor2: 'themes', pageBorders: 'themes',
  // layout page-setup (pagination-gated, Phase 7) + arrange (slice 10)
  margins: 'layout-page', orientation: 'layout-page', size: 'layout-page', columns: 'layout-page',
  breaks: 'layout-page', lineNumbers: 'layout-page', hyphenation: 'layout-page',
  position: 'layout-arrange', wrapText: 'layout-arrange', bringForward: 'layout-arrange',
  sendBackward: 'layout-arrange', selectionPane: 'layout-arrange', align: 'layout-arrange',
  group: 'layout-arrange', rotate: 'layout-arrange',
  // header/footer (pagination-gated, Phase 7)
  header: 'header-footer', footer: 'header-footer', pageNumber: 'header-footer',
  goToHeader: 'header-footer', goToFooter: 'header-footer', closeHeaderFooter: 'header-footer',
  docInfo: 'header-footer', differentFirstPage: 'header-footer', differentOddEven: 'header-footer',
  showDocText: 'header-footer', dateAndTime: 'header-footer', linkToPrevious: 'header-footer',
}
function isFlipped(area: string) { return FLIPPED.has(area) }
function isBlocked(cmd: string) { const a = AREA[cmd]; return !!a && !FLIPPED.has(a) }

// Replace the live editor with one loaded from `source` (Open / New).
// SAFETY: validate + PARSE before any teardown — a corrupt file must leave the
// live editor untouched (spec §5.3 invariant).
//
// VARIANT SHIPPED: parse-once (not staging-reparent).
// Rationale: ProseMirror EditorView binds event listeners directly to the DOM
// node it mounts into. Moving those DOM children to a new parent via
// appendChild breaks the view's internal reference to its own container — typing
// and selection become dead. To keep the invariant (failed import = live editor
// untouched) without reparenting, we use a true two-phase approach:
//   Phase 1 (before any teardown): ZIP-magic check + full loadXmlData parse.
//             A parse failure aborts here — old editor is UNTOUCHED.
//             Failure class: corrupt/invalid input; live editor remains live.
//   Phase 2 (after parse succeeds): destroy old, clear mount, construct new
//             from the ALREADY-PARSED data (no re-parse).
//             Failure class: constructor error on valid parsed data (rare).
//             The mount may already be empty at this point; call failBridge to
//             un-flip to the legacy world + toast, then return false.
// slice 7: `extra.html` rides the docx constructor leg — the converter context
// comes from the parsed (blank-template) docx while the doc body initializes from
// HTML via createDocFromHTML, so non-docx imports stay fully docx-exportable.
async function replaceEditor(source: ArrayBuffer, extra?: { html?: string }): Promise<boolean> {
  // Concurrency guard: refuse a second concurrent call (e.g. double-click Open).
  if (replacing) return false
  replacing = true
  // Reset AFTER the mutex check: a refused concurrent call must not clobber the
  // flag a consumer is about to read.
  lastImportBlanked = false
  const w = window as any
  // Wire a freshly-constructed editor into the chrome — shared by the normal and
  // the contentError-recovery paths so both get the identical seam.
  const wire = (next: AnyEditor) => {
    // Transaction-seam attach: references w.WC.pm only — safe before WC.view/WC.editor assignment.
    next.on?.('transaction', () => { ;(w.WC.pm ??= {}).lastTxn = Date.now() }) // logger seam survives reopen
    // installBridge sets current = editor first; assign WC.view/WC.editor AFTER
    // so current and WC.editor never disagree.
    installBridge(next)
    w.WC.view = next.view
    w.WC.editor = next
    w.WC.PM.setClean()
  }
  try {
    // Phase 1 — validate + PARSE before any teardown: a corrupt file must leave
    // the live editor untouched (spec §5.3 invariant).
    // Failure class: corrupt/invalid input → live editor untouched, return false.
    // Cheap guard (slice 7): an html import with no markup at all is refused here,
    // before any teardown.
    if (extra && (!extra.html || !extra.html.trim())) return false
    const bytes = new Uint8Array(source)
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false
    const mountEl = document.getElementById('pm-editor') as HTMLElement | null
    if (!mountEl) return false
    const parsed = await parseDocx(source) // throws on corrupt input → caught → false, old editor intact
    // Phase 2 — teardown + construct from the ALREADY-PARSED data (no re-parse).
    // Failure class: constructor error on valid parsed data (genuinely rare).
    // At this point the old editor may have been destroyed and the mount cleared;
    // call failBridge so the legacy world becomes visible rather than a blank page.
    try {
      try { current?.destroy?.() } catch { /* old view teardown is best-effort */ }
      mountEl.innerHTML = ''
      let contentErr = false
      const next = constructPmEditor(
        mountEl,
        parsed,
        // CONSTRAINT: the plain-docx leg must NOT get an onContentError override —
        // it relies on the fork's default RETHROW reaching the phase-2 catch →
        // failBridge; overriding it would let a docx contentError degrade to a
        // blank doc and return true (a §5.3 path-binding violation).
        extra ? { html: extra.html, onContentError: () => { contentErr = true } } : undefined,
      )
      if (extra?.html && contentErr) {
        // CONSTRAINT: a garbage html import degrades to BLANK only because our
        // onContentError override swallows the error — Editor#generatePmData
        // catches the createDocFromHTML failure and emits 'contentError', whose
        // fork-DEFAULT handler rethrows (Editor.ts:750-752); the override turns
        // that into a silent blank + flag. Without this detection the caller
        // (files.js) would bind a path to a doc the file does not represent
        // (§5.3 data loss). Recover by constructing a plain blank editor from the
        // already-parsed template (keeps PM mode alive instead of failBridge) and
        // return false so the caller never binds a path to the degraded blank.
        try { next?.destroy?.() } catch { /* degraded editor teardown is best-effort */ }
        mountEl.innerHTML = ''
        lastImportBlanked = true // the old doc is gone — caller must unbind its file state
        wire(constructPmEditor(mountEl, parsed))
        return false
      }
      wire(next)
      return true
    } catch (e) {
      // Phase-2 failure: mount may be empty, old editor already destroyed.
      // Recover via failBridge (un-flips to legacy world + toasts).
      console.error('[WC.PM] replaceEditor phase-2 failed', e)
      failBridge(e)
      return false
    }
  } catch (e) {
    // Phase-1 failure: parse/validation error — live editor is untouched.
    console.error('[WC.PM] replaceEditor phase-1 failed', e)
    return false
  } finally {
    replacing = false
  }
}

let lastToast = -Infinity
function notifyBlocked(what: string) {
  const now = performance.now()
  if (now - lastToast < 1500) return // throttle: leaf-closure paths can fire bursts
  lastToast = now
  const w = window as any
  w.WC?.toast?.("This action isn't on the new engine yet", what + ' — run with --legacy for the classic editor')
}

// Synchronous, pre-mount (spec §4.2): the D6 guards consult WC.PM.active before
// the async mount resolves, and the page must flip before first paint.
export function preinstallBridge() {
  const w = window as any
  w.WC = w.WC || {}
  w.WC.PM = {
    active: !legacyBoot,
    ready: false,
    notifyBlocked,
    isBlocked,   // D6 §7.1a — consulted by the WC.Commands dispatch heads (Task 4B)
    isFlipped,
    AREA, FLIPPED, // exposed for tests/audit
    cmd: () => false,
    chain: () => false,
    getState: () => null,
    isDirty: () => false,
    setClean: () => {},
    markDirty: () => {},
    counts: () => ({ words: 0, chars: 0, charsNoSpace: 0, paras: 0, lines: 1, pages: 1, selWords: 0 }),
    getHTML: () => '', // slice 7 pre-mount stub (replaced by installIo on mount)
    getText: () => '', // slice 7 pre-mount stub (replaced by installIo on mount)
    captureSelection: () => {},
    withSelection: (fn: () => void) => fn(),
    openDocx: async () => false, // pre-mount stub — replaced by installBridge
    newBlank: async () => false, // pre-mount stub — replaced by installBridge
    // slice 7: file-io pre-mount stubs (replaced by installBridge on mount)
    openHtml: async () => false,
    openText: async () => false,
    openCsv: async () => false,
    lastImportBlanked: () => false,
    pasteHTMLString: () => false,
    stylePreviewEnter: () => false,
    stylePreviewLeave: () => {},
    stylePreviewCommitRestore: () => {},
    cutSelection: async () => false,
    copySelection: async () => false,
    pasteDefault: async () => false,
    pasteTextOnly: async () => false,
    pasteHTML: async () => false,
    pastePicture: async () => false,
    clipboardFlavors: async () => null,
    selectAll: () => false,
    selectSimilarFormatting: () => false,
    armFormatPainter: () => false,
    cancelFormatPainter: () => false,
    painterArmed: () => false,
    // slice 5: find/replace pre-mount stubs (replaced by installSearch on mount)
    findSession: () => ({ total: 0, activeMatchIndex: -1 }),
    findNext: () => -1,
    findPrev: () => -1,
    replaceOne: () => ({ total: 0, activeMatchIndex: -1 }),
    replaceAll: () => ({ replacedCount: 0 }),
    clearFind: () => false,
    findCount: () => ({ total: 0, activeMatchIndex: -1 }),
    goTo: () => false,
    // slice 6: insert-primitive pre-mount stubs (replaced by installInsert on mount)
    insertLink: () => false, removeLink: () => false, insertImage: () => false,
    insertBookmark: () => false, listBookmarks: () => [], goToBookmark: () => false,
    removeBookmark: () => false, renameBookmark: () => false,
    insertSymbol: () => false, insertEquation: () => false,
    insertPageBreak: () => false, insertBlankPage: () => false, insertHr: () => false,
    // slice 6: table pre-mount stubs (replaced by installTable on mount)
    insertTable: () => false, tableAddRow: () => false, tableAddColumn: () => false,
    tableDeleteRow: () => false, tableDeleteColumn: () => false, tableDeleteTable: () => false,
    tableMerge: () => false, tableSplitCell: () => false,
    tableToggleHeaderRow: () => false, tableToggleHeaderColumn: () => false,
    tableSetCellShading: () => false, tableSetCellVAlign: () => false,
    isInTable: () => false, tableInfo: () => ({ inTable: false }),
    // slice 6b: net-new Table Tools verbs (replaced by installTable on mount)
    tableSetStyle: () => false, getTableStyles: () => [], tableSetAlignment: () => false, tableSetIndent: () => false,
    tableSetCellWidth: () => false, tableSetRowHeight: () => false,
    tableSetCellMargins: () => false, tableSetCellBorders: () => false,
    tableDistributeColumns: () => false, tableDistributeRows: () => false,
    tableSplit: () => false, tableToText: () => false, textToTable: () => false,
    tableSetTextDirection: () => false, tableAutoFit: () => false,
    tableSelectFirstRowPair: () => false,
    // slice 8: review pre-mount stubs (replaced by installReview on mount)
    reviewState: () => ({ tracking: false, view: 'all', engineFlags: { onlyOriginalShown: false, onlyModifiedShown: false }, activeCommentId: null }),
    getRevisions: () => [],
    getComments: () => [],
    getChangeRanges: () => [], // slice 8 task 5: bars/balloons chrome provider
    runCompare: async () => false, // slice 8 task 6: Compare engine (replaced by installBridge)
    // slice 9: references pre-mount stubs (replaced by installReferences on mount)
    refInsertTOC: () => false, refUpdateTable: () => false, refRemoveTOC: () => false,
    refSetOutlineLevel: () => false,
    refInsertFootnote: () => false, refInsertEndnote: () => false,
    refNextNote: () => false, refShowNotes: () => false,
    refListFootnotes: () => [], refUpdateNote: () => false,
    refInsertCaption: () => false, refInsertTOF: () => false,
    refMarkIndexEntry: () => false, refInsertIndex: () => false, refUpdateIndex: () => false,
    refMarkCitation: () => false, refInsertTOA: () => false,
    refAddSource: () => false, refInsertCitation: () => false, refListSources: () => [],
    refUpdateSource: () => false, refRemoveSource: () => false,
    refSetCitationStyle: () => false, refInsertBibliography: () => false,
    refCrossReference: () => false,
    // slice 10: mail-merge pre-mount stubs (replaced by installMailMerge on mount)
    mmInsertField: () => false, mmAddressBlock: () => false, mmGreetingLine: () => false,
    mmInsertRule: () => false, mmHighlight: () => false, mmPreview: () => false,
    mmBuildMerge: () => '', mmFinishToNewDoc: async () => false,
    // slice 10 PR2: design/themes pre-mount stubs (replaced by installDesign on mount)
    deApplyTheme: () => false, deApplyColors: () => false, deApplyFonts: () => false,
    deApplyStyleSet: () => false, deParagraphSpacing: () => false,
    dePreviewTheme: () => false, dePreviewRestore: () => false, dePreviewCommit: () => {}, dePreviewEnd: () => {},
    dePageColor: () => false, dePageColorClear: () => false,
    dePageBorders: () => false, dePageBordersRemove: () => false,
    deWatermark: () => false, deWatermarkRemove: () => false,
    deEffects: () => false, deSetAsDefault: () => false,
    // slice 10 PR3: insert-exotica pre-mount stubs (replaced by installInsertExotica on mount)
    xeDropCap: () => false, xeCoverPage: () => false, xeRemoveCoverPage: () => false, xeDateTime: () => false, xeQuickPart: () => false,
    xeScreenshot: async () => false, xeIcon: () => false, xeOnlinePicture: async () => false,
    xeTextBox: () => false, xeWordArt: () => false, xeOnlineVideo: () => false,
    xeChart: () => false, xeSmartArt: () => false, xeObject: () => false, xeSignatureLine: () => false,
  }
  if (!legacyBoot) document.body.classList.add('pm-active')
}

// Re-entrant by design: replaceEditor (slice 0b) re-runs this on Open/New —
// closures rebind to the new instance; install* fns must stay idempotent.
export function installBridge(editor: AnyEditor) {
  const w = window as any
  current = editor
  const PM = w.WC.PM
  if (legacyBoot) { PM.ready = true; return PM } // §4.3-3: passive under --legacy — zero listeners
  if (!painterEscInstalled) {
    painterEscInstalled = true
    // slice 4: Esc cancels an armed format painter (Word). Capture-phase so the PM
    // keymap can't swallow it; defers to any open flyout/dialog (their own Esc
    // handling closes those first — the painter survives until a bare-Esc press).
    // The handler reads the LIVE WC.PM, so a single document-level listener is
    // correct across replaceEditor re-mounts (never re-add — would stack).
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('.flyout, .modal-backdrop')) return
      const pm = (window as any).WC?.PM
      if (pm?.painterArmed?.()) {
        // Word disarms the painter and does nothing else — stop the press here so it
        // can't ALSO exit focus-mode / close backstage via app.js's bubble handler.
        e.preventDefault(); e.stopPropagation()
        pm.cancelFormatPainter()
      }
    }, true)
  }
  // installReview goes LAST: its cmd head SHADOWS the raw fork command names it owns
  // (addComment/resolveComment/setActiveComment — A2 Document API path must win) and
  // falls through to installCommands' cmd for everything else.
  const commands = installCommands(editor)
  Object.assign(PM, commands, installIo(editor), installStylePreview(editor), installClipboard(editor), installSearch(editor), installInsert(editor), installTable(editor), installReview(editor, commands.cmd), installReferences(editor), installMailMerge(editor), installDesign(editor), installInsertExotica(editor))
  PM.getState = () => toQueryState(editor)
  PM.debugFormatting = () => getActiveFormatting(editor) // raw entries (probe/verifier aid)
  PM.getEditor = () => current
  PM.openDocx = (bytes: Uint8Array | ArrayBuffer) => {
    const buf = bytes instanceof Uint8Array
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      : bytes
    return replaceEditor(buf as ArrayBuffer)
  }
  PM.newBlank = () => replaceEditor(blankArrayBuffer())
  // slice 7: non-docx imports ride the blank-template + html constructor leg
  // (see replaceEditor) — the result stays docx-exportable.
  PM.openHtml = (html: string) => replaceEditor(blankArrayBuffer(), { html })
  PM.openText = (text: string) => replaceEditor(blankArrayBuffer(), { html: textToParagraphHtml(text) })
  PM.openCsv = (text: string) => {
    const table = csvToTableHtml(text)
    return table ? replaceEditor(blankArrayBuffer(), { html: table }) : Promise.resolve(false)
  }
  // CONSTRAINT: consumers (files.js) must unbind path/name/format when a failed import replaced the doc with a blank.
  PM.lastImportBlanked = () => lastImportBlanked
  // [4] pin + paste-path probes drive the REAL paste route (view.pasteHTML).
  PM.pasteHTMLString = (html: string) => {
    const ed = current
    if (!ed?.view) return false
    return !!ed.view.pasteHTML(html, pasteEvent({ 'text/html': html, 'text/plain': '' }))
  }
  // slice 8 task 6 (D8.6/X2): Compare Documents — opens the ORIGINAL text as the
  // doc, then applies the original→revised diff as dispatched transactions with
  // tracking ON, so the fork rewrite mints REAL trackInsert/trackDelete marks
  // (exports as w:ins/w:del — never a presentational diff). Word opens the result
  // as a new document; the clone is single-doc, so the result REPLACES the
  // current doc (recorded deviation, D8.6). Returns false (doc untouched) on
  // oversize input or a failed import.
  PM.runCompare = async (originalText: string, revisedText: string, opts?: { granularity?: 'word' | 'character'; label?: string }) => {
    const oLines = String(originalText ?? '').replace(/\r\n?/g, '\n').split('\n')
    const rLines = String(revisedText ?? '').replace(/\r\n?/g, '\n').split('\n')
    if (oLines.length * rLines.length > 4_000_000) return false
    if (!(await PM.openText(oLines.join('\n')))) return false
    const ed: any = current
    if (!ed?.view) return false
    const prevUser = ed.options?.user
    if (opts?.label) { try { ed.setOptions?.({ user: { name: opts.label, email: '' } }) } catch { /* label is cosmetic */ } }
    PM.cmd('enableTrackChanges')
    try {
      const tokenize = (s: string) =>
        opts?.granularity === 'character' ? Array.from(s) : s.split(/(\s+)/).filter((t) => t.length > 0)
      const v = () => ed.view
      // openText = line-per-paragraph, so ORIGINAL line i ↔ textblock i. All edits
      // are applied RIGHT→LEFT against original coordinates with a FRESH
      // offset→position map per op: tracked deletes keep their text (offsets
      // stable) and inserts always land to the right of everything still pending —
      // so no shift arithmetic can drift. The naive paraPos+1+offset mapping is
      // WRONG here: the fork wraps inline content in run nodes, whose boundary
      // tokens make text-offset→PM-position piecewise (probe-proven off-by-N).
      const blocks = () => {
        const out: Array<{ pos: number; node: any }> = []
        v().state.doc.descendants((n: any, p: number) => {
          if (n.isTextblock) { out.push({ pos: p, node: n }); return false }
          return true
        })
        return out
      }
      const off2pm = (bi: number, off: number): number | null => {
        const b = blocks()[bi]
        if (!b) return null
        let pm: number | null = null
        let seen = 0
        v().state.doc.nodesBetween(b.pos + 1, b.pos + b.node.nodeSize - 1, (n: any, p: number) => {
          if (pm != null) return false
          if (n.isText && n.text) {
            if (off <= seen + n.text.length) { pm = p + (off - seen); return false }
            seen += n.text.length
          }
          return true
        })
        return pm != null ? pm : b.pos + b.node.nodeSize - 1 // past content → block end
      }
      const dispatchDelete = (a: number | null, b: number | null) => {
        if (a != null && b != null && b > a) v().dispatch(v().state.tr.delete(a, b))
      }
      const dispatchInsert = (at: number | null, text: string) => {
        if (at != null && text) v().dispatch(v().state.tr.insertText(text, at))
      }
      // Intra-line diff: forward pass computes original offsets (an insert after a
      // del anchors at the del's END — Word renders the new run after the struck
      // original); the apply pass walks the steps right→left.
      const diffWithin = (bi: number, oldLine: string, newLine: string) => {
        const ops = lcsOps(tokenize(oldLine), tokenize(newLine))
        const steps: Array<{ type: 'del' | 'ins'; start: number; len: number; text: string }> = []
        let c = 0
        for (const op of ops) {
          const text = op.tokens.join('')
          if (op.type === 'eq') { c += text.length; continue }
          if (op.type === 'del') { steps.push({ type: 'del', start: c, len: text.length, text }); c += text.length; continue }
          steps.push({ type: 'ins', start: c, len: text.length, text }) // c sits past any preceding del ✓
        }
        for (let s = steps.length - 1; s >= 0; s--) {
          const st = steps[s]
          if (st.type === 'del') dispatchDelete(off2pm(bi, st.start), off2pm(bi, st.start + st.len))
          else dispatchInsert(off2pm(bi, st.start), st.text)
        }
      }
      const deleteWholeLine = (bi: number) => {
        const b = blocks()[bi]
        if (!b) return
        dispatchDelete(off2pm(bi, 0), off2pm(bi, b.node.textContent.length))
      }
      const insertLinesAfter = (anchorIdx: number, lines: string[]) => {
        if (anchorIdx >= 0) {
          const b = blocks()[anchorIdx]
          if (!b) return
          let at = b.pos + b.node.nodeSize - 1
          for (const line of lines) {
            ed.commands.setTextSelection({ from: at, to: at })
            try { ed.commands.splitBlock() } catch { v().dispatch(v().state.tr.split(at)) }
            dispatchInsert(at + 2, line)
            at = at + 2 + line.length
          }
        } else {
          // prepend before the first line: reverse order, each split at content start
          for (const line of [...lines].reverse()) {
            const first = blocks()[0]
            if (!first) return
            const at = first.pos + 1
            ed.commands.setTextSelection({ from: at, to: at })
            try { ed.commands.splitBlock() } catch { v().dispatch(v().state.tr.split(at)) }
            dispatchInsert(at, line)
          }
        }
      }
      // Line-level grouping (adjacent del-run + ins-run = modified lines), then
      // apply the groups right→left.
      const lineOps = lcsOps(oLines, rLines)
      const groups: Array<{ oiStart: number; dels: string[]; inss: string[] }> = []
      let oi = 0
      for (let i = 0; i < lineOps.length; i++) {
        const op = lineOps[i]
        if (op.type === 'eq') { oi += op.tokens.length; continue }
        const dels = op.type === 'del' ? op.tokens : []
        let inss: string[] = op.type === 'ins' ? op.tokens : []
        if (op.type === 'del' && i + 1 < lineOps.length && lineOps[i + 1].type === 'ins') { inss = lineOps[i + 1].tokens; i++ }
        groups.push({ oiStart: oi, dels, inss })
        oi += dels.length
      }
      for (const g of [...groups].reverse()) {
        const pairs = Math.min(g.dels.length, g.inss.length)
        if (g.inss.length > pairs) {
          const anchorIdx = g.dels.length ? g.oiStart + g.dels.length - 1 : g.oiStart - 1
          insertLinesAfter(anchorIdx, g.inss.slice(pairs))
        }
        for (let d = g.dels.length - 1; d >= pairs; d--) deleteWholeLine(g.oiStart + d)
        for (let p = pairs - 1; p >= 0; p--) diffWithin(g.oiStart + p, g.dels[p], g.inss[p])
      }
      return true
    } catch (e) {
      console.error('[WC.PM] runCompare failed', e)
      return false
    } finally {
      PM.cmd('disableTrackChanges')
      try { if (opts?.label) ed.setOptions?.({ user: prevUser ?? { name: 'Word User', email: '' } }) } catch { /* restore is best-effort */ }
    }
  }
  installStateSync(editor)
  // slice 8 task 4: comments cards/composer/pane chrome. AFTER the legacyBoot
  // early-return above, so the UI module never runs (and its DOM never exists)
  // under --legacy (D8.3 PM-only constraint).
  installCommentsUI(editor)
  // slice 8 task 5: tracked-changes chrome (changed-line bars, format balloons,
  // Revisions pane). Same PM-only-by-construction placement as comments-ui.
  installTrackChrome(editor)
  // slice 9 task 4 (D9.1): footnote/endnote notes region (continuous flow below the
  // page sheet). Same PM-only-by-construction placement — its DOM never exists under
  // --legacy (this runs AFTER the legacyBoot early-return above).
  installNotesArea(editor)
  installFocusGuards()
  PM.ready = true
  editor.view?.focus() // PM page owns the caret from boot (replaces legacy boot focus)
  return PM
}

// Classic LCS diff over token sequences → merged eq/del/ins runs (Compare engine).
// Throws on oversize input — runCompare catches and returns false, doc untouched.
function lcsOps(a: string[], b: string[]): Array<{ type: 'eq' | 'del' | 'ins'; tokens: string[] }> {
  const n = a.length
  const m = b.length
  if ((n + 1) * (m + 1) > 16_000_000) throw new Error('compare input too large')
  const W = m + 1
  const dp = new Uint32Array((n + 1) * W)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * W + j] = a[i] === b[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1])
    }
  }
  const ops: Array<{ type: 'eq' | 'del' | 'ins'; tokens: string[] }> = []
  const push = (type: 'eq' | 'del' | 'ins', tok: string) => {
    const last = ops[ops.length - 1]
    if (last && last.type === type) last.tokens.push(tok)
    else ops.push({ type, tokens: [tok] })
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { push('eq', a[i]); i++; j++ }
    else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) { push('del', a[i]); i++ }
    else { push('ins', b[j]); j++ }
  }
  while (i < n) { push('del', a[i]); i++ }
  while (j < m) { push('ins', b[j]); j++ }
  return ops
}

// Mount failure (spec §7.2): un-flip BEFORE toasting — never a blank page.
export function failBridge(err: unknown) {
  const w = window as any
  document.body.classList.remove('pm-active')
  if (w.WC?.PM) w.WC.PM.active = false
  w.WC?.toast?.('New engine failed to start — using the classic editor', String((err as any)?.message || err))
  // May run pre-DOMContentLoaded (sync mount failure): WC.Editor.node is null
  // until init() — never let the fallback itself throw and kill __WC_READY.
  try { if (w.WC?.Editor?.node) w.WC.Editor.focus() } catch { /* fallback must never throw */ }
}
