// WC.PM — the bridge between the vanilla-JS Word chrome and the vendored
// ProseMirror engine (spec §4/§5). Grafted onto the existing WC namespace;
// NEVER reassign window.WC or window.WC.Editor (main.ts invariant).
import { legacyBoot } from './mode'
import { installCommands } from './commands'
import { installIo } from './io'
import { installStateSync } from './state-sync'
import { installFocusGuards } from './focus'
import { getActiveFormatting } from '@core/helpers/getActiveFormatting.js'
import { toQueryState } from './state-sync'

type AnyEditor = any
let current: AnyEditor = null

// ---- D6 registry (spec §5.1/§7.1a): cmd-id → area, + the flipped-area set. ----
// Doc-touching cmd ids ONLY — app-level cmds are absent (= never blocked here).
// Keys = the §9.1 area names. Each slice's flip edits FLIPPED in source (auditable).
const FLIPPED = new Set<string>([]) // slice 1 makes this ['character', 'history']
const AREA: Record<string, string> = {
  // character (slice 1)
  bold: 'character', italic: 'character', underline: 'character', strikethrough: 'character',
  subscript: 'character', superscript: 'character', clearAllFormatting: 'character',
  increaseFontSize: 'character', decreaseFontSize: 'character', font: 'character',
  fontSize: 'character', textHighlightColor: 'character', fontColor: 'character',
  changeCase: 'character', textEffectsAndTypography: 'character',
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
  find: 'find-replace', replace: 'find-replace', select: 'find-replace',
  // insert basics (slice 6)
  table: 'insert-basics', link: 'insert-basics', bookmark: 'insert-basics', pageBreak: 'insert-basics',
  blankPage: 'insert-basics', symbol: 'insert-basics', equation: 'insert-basics',
  horizontalLine: 'insert-basics', pictures: 'insert-basics', onlinePictures: 'insert-basics',
  screenshot: 'insert-basics', icons: 'insert-basics', smartart: 'insert-basics', chart: 'insert-basics',
  onlineVideo: 'insert-basics', dropCap: 'insert-basics', wordart: 'insert-basics', textBox: 'insert-basics',
  object: 'insert-basics', signatureLine: 'insert-basics', dateTime: 'insert-basics',
  coverPage: 'insert-basics', quickParts: 'insert-basics', crossReference: 'insert-basics',
  // review (slice 8)
  newComment: 'review', comment: 'review', delete: 'review', previous: 'review', next: 'review',
  showComments: 'review', trackChanges: 'review', accept: 'review', reject: 'review',
  thesaurus: 'review', language: 'review',
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
    counts: () => ({ words: 0, chars: 0, charsNoSpace: 0, paras: 0, lines: 1, pages: 1, selWords: 0 }),
    captureSelection: () => {},
    withSelection: (fn: () => void) => fn(),
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
  Object.assign(PM, installCommands(editor), installIo(editor))
  PM.getState = () => toQueryState(editor)
  PM.debugFormatting = () => getActiveFormatting(editor) // raw entries (probe/verifier aid)
  PM.getEditor = () => current
  installStateSync(editor)
  installFocusGuards()
  PM.ready = true
  editor.view?.focus() // PM page owns the caret from boot (replaces legacy boot focus)
  return PM
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
