// Engine → ribbon state sync (spec §5.1/§6.B). Maps getActiveFormatting()'s
// ActiveFormattingEntry[] + paragraph attrs onto the legacy queryState() shape
// that WC.Ribbon.syncToggles/TOGGLE_MAP consume (ribbon.js:46-51, 327-333).
// Negation-attr-safe: Word marks explicit-off as e.g. bold {value:'0'}.
import { getActiveFormatting } from '@core/helpers/getActiveFormatting.js'
import { calculateResolvedParagraphProperties } from '@extensions/paragraph/resolvedPropertiesCache.js'
import { STYLE_ID_TO_NAME } from './style-names'
import { clipboardHasContent } from './clipboard'

// One-time guard for window-level listeners (installStateSync re-runs per editor
// mount; editor.on listeners die with the editor, window listeners do not).
let externalListenersInstalled = false

type AnyEditor = any

// slice 8: bridge review-view name → the Word-faithful Display for Review combo label.
const REVIEW_VIEW_LABELS: Record<string, string> = {
  all: 'All Markup', simple: 'Simple Markup', none: 'No Markup', original: 'Original',
}

export function headParagraph(editor: AnyEditor): { node: any; pos: number } | null {
  try {
    const $from = editor.state.selection.$from
    for (let d = $from.depth; d >= 0; d--) {
      const node = $from.node(d)
      if (node?.type?.name === 'paragraph') return { node, pos: d > 0 ? $from.before(d) : 0 }
    }
    // AllSelection ($from is doc root, depth 0) — take the FIRST paragraph as the head.
    // NOTE: returning false from descendants() only skips that node's CHILDREN; sibling
    // iteration continues (guarded by `if (result)`) — fine at document scale.
    const doc = editor.state.doc
    let result: { node: any; pos: number } | null = null
    doc.descendants((node: any, pos: number) => {
      if (result) return false
      if (node.type?.name === 'paragraph') { result = { node, pos }; return false }
      return true
    })
    return result
  } catch { /* selection states the resolver can't read */ }
  return null
}

// The EFFECTIVE font name + size (pt) at the caret, for when no inline marks
// supply them (empty doc / empty paragraph / after Clear Formatting). Word never
// blanks a collapsed cursor — it shows the resolved style/default. We read the
// computed style of the caret's rendered node (style-aware AND Heading-aware: a
// Heading paragraph computes its heading font), falling back to the document
// default styles, so the combos always reflect what the user would actually type.
function effectiveFont(editor: AnyEditor): { name: string; size: string } {
  let name = ''
  let size = ''
  try {
    const view = editor.view
    const at = view.domAtPos(editor.state.selection.from)
    const el: any = at?.node?.nodeType === 3 ? at.node.parentElement : at?.node
    if (el && typeof getComputedStyle === 'function') {
      const cs = getComputedStyle(el)
      name = String(cs.fontFamily || '').split(',')[0].replace(/['"]/g, '').trim()
      const px = parseFloat(String(cs.fontSize || ''))
      if (isFinite(px) && px > 0) size = String(Math.round((px * 72) / 96)) // CSS px → pt
    }
  } catch { /* no live view */ }
  if (!name || !size) {
    try {
      const d = (editor as any).converter?.getDocumentDefaultStyles?.() || {}
      if (!name) name = d.typeface || (d.fontFamilyCss ? String(d.fontFamilyCss).split(',')[0].replace(/['"]/g, '').trim() : '')
      if (!size && d.fontSizePt != null) size = String(Math.round(d.fontSizePt))
    } catch { /* no converter */ }
  }
  return { name, size }
}

export function toQueryState(editor: AnyEditor): Record<string, any> {
  const st: Record<string, any> = {
    bold: false, italic: false, underline: false, strikethrough: false,
    subscript: false, superscript: false,
    justifyLeft: false, justifyCenter: false, justifyRight: false, justifyFull: false,
    insertUnorderedList: false, insertOrderedList: false,
    fontName: '', fontSize: '', block: '', // block = display name of the head paragraph's resolved style (slice 3)
    computedFontFamily: '', computedFontSizePt: null, // Font-dialog aliases (dialogs.js:347-349)
  }
  let entries: Array<{ name: string; attrs: any }> = []
  try { entries = getActiveFormatting(editor) || [] } catch { /* selection the helper can't read */ }
  // Negation-attr truth (mirrors the fork's renderDOM semantics, e.g. bold.js:41-45):
  // value == null → mark is ON (in-editor toggles set no value); value === '0' (run-level
  // OOXML import / cascade-toggle negationAttrs) or BOOLEAN false (style-cascade import —
  // observed on Word-authored negation runs, see tests/fixtures/negation-run.docx) → OFF.
  const markOn = (val: any) => val == null || (val !== '0' && !!val)
  for (const e of entries) {
    const a = e.attrs || {}
    switch (e.name) {
      case 'bold': st.bold = markOn(a.value); break
      case 'italic': st.italic = markOn(a.value); break
      case 'underline': st.underline = a.underlineType !== 'none' && markOn(a.value); break
      case 'strike': st.strikethrough = markOn(a.value); break
      // fontFamily/fontSize are textStyle-unwrapped entries (text-style.js attrs):
      // attrs shape: { fontFamily: "Aptos, Arial, sans-serif" } / { fontSize: "12pt" }
      case 'fontFamily': st.fontName = String(a.fontFamily || '').split(',')[0].replace(/['"]/g, '').trim(); break
      case 'fontSize': st.fontSize = String(a.fontSize || '').replace(/pt$/, '').trim(); break
      // vertAlign rides on textStyle (text-style.js:85-103) — unwrapped to { vertAlign: 'subscript'|'superscript' }
      case 'vertAlign':
        st.subscript = a.vertAlign === 'subscript'
        st.superscript = a.vertAlign === 'superscript'
        break
    }
  }
  // Head-paragraph only — getNodeAttributes returns the selection-start paragraph;
  // no cross-paragraph intersection (matches legacy caret-based queryCommandState).
  // Revisit if a later slice needs Word's mixed-alignment (all-buttons-off) behavior.
  // Alignment + list state live on the paragraph node, not in the mark entries
  // (spec §7.5: paragraphProperties.justification, NOT a flat textAlign).
  const para = (editor.getAttributes('paragraph') || {}) as any
  const just = para?.paragraphProperties?.justification ?? para?.textAlign ?? null
  if (just === 'center') st.justifyCenter = true
  else if (just === 'right') st.justifyRight = true
  else if (just === 'both' || just === 'justify') st.justifyFull = true
  else st.justifyLeft = true // explicit 'left' AND the unset default — real Word presses Align Left on a fresh paragraph (oracle-confirm in Task 13)
  // List membership: use listRendering.numberingType (probe-confirmed: "bullet" or "decimal").
  // numberingProperties.numId presence also indicates a list paragraph.
  const listRendering = para?.listRendering
  if (listRendering) {
    if (listRendering.numberingType === 'bullet') st.insertUnorderedList = true
    else if (listRendering.numberingType) st.insertOrderedList = true // decimal, lowerLetter, upperRoman…; undefined = custom marker, no toggle
  }
  // Resolved (style-cascade-included) paragraph values for the Layout spinners and the
  // Paragraph dialog seeds. Inline attrs alone miss style-derived indents/spacing
  // (getActiveFormatting is inline-only — recorded engine constraint).
  const head = headParagraph(editor)
  if (head) {
    let resolved: any = null
    try { resolved = calculateResolvedParagraphProperties(editor, head.node, editor.state.doc.resolve(head.pos)) } catch { resolved = head.node.attrs?.paragraphProperties || null }
    const ind = resolved?.indent || {}
    const sp = resolved?.spacing || {}
    // undefined (NOT 0) when unresolved — so downstream `?? 0`/`?? 8` defaults engage
    // instead of pushing a wrong hard 0 (legacy UI + Word show 8pt spacing-after default).
    st.indentLeftIn = ind.left != null ? Math.round((ind.left / 1440) * 100) / 100 : undefined
    st.indentRightIn = ind.right != null ? Math.round((ind.right / 1440) * 100) / 100 : undefined
    st.spacingBeforePt = sp.before != null ? Math.round(sp.before / 20) : undefined
    st.spacingAfterPt = sp.after != null ? Math.round(sp.after / 20) : undefined
    // Multiplier only when the rule is 'auto' (or unset); exact/atLeast rules are
    // pt-based and have no multiplier representation — report null (dialog shows default).
    st.lineSpacing = sp.line != null && (sp.lineRule === 'auto' || sp.lineRule == null)
      ? Math.round((sp.line / 240) * 100) / 100 : null
    // slice 3: resolved styleId → display name for the gallery highlight + pane.
    // Unstyled paragraphs read as 'Normal' (real Word highlights Normal by default —
    // oracle probe pending, Task 13.3). Unknown/foreign styleIds → '' (no highlight).
    st.block = resolved?.styleId ? (STYLE_ID_TO_NAME[resolved.styleId] ?? '') : 'Normal'
  }
  // Phase 3 font combos (Word parity): the name/size combos must show the
  // EFFECTIVE value for a collapsed cursor or a uniform selection (never blank —
  // the reported bug), and blank ONLY for a selection that spans mixed values.
  // The entries loop above set st.fontName/fontSize from the caret/first run's
  // explicit marks; refine here.
  {
    const sel = editor.state.selection
    let famMixed = false
    let sizeMixed = false
    if (!sel.empty) {
      const fams = new Set<string>()
      const sizes = new Set<string>()
      try {
        editor.state.doc.nodesBetween(sel.from, sel.to, (node: any) => {
          if (!node.isText) return
          const ts = node.marks.find((m: any) => m.type?.name === 'textStyle')
          fams.add(ts?.attrs?.fontFamily ? String(ts.attrs.fontFamily).split(',')[0].replace(/['"]/g, '').trim() : '')
          sizes.add(ts?.attrs?.fontSize ? String(ts.attrs.fontSize).replace(/pt$/, '').trim() : '')
        })
      } catch { /* selection the iterator can't read */ }
      famMixed = fams.size > 1
      sizeMixed = sizes.size > 1
    }
    const eff = (!st.fontName || !st.fontSize) ? effectiveFont(editor) : null
    st.fontName = famMixed ? '' : (st.fontName || eff?.name || '')
    st.fontSize = sizeMixed ? '' : (st.fontSize || eff?.size || '')
  }
  st.computedFontFamily = st.fontName
  const sizeNum = parseFloat(st.fontSize)
  st.computedFontSizePt = isNaN(sizeNum) ? null : sizeNum
  // Phase 3 ribbon state machine: control-state facts that enablement/latch rules
  // (registered via WC.Ribbon.registerStateRule) read. Kept on the same queryState
  // object so a single evaluator pass (sync → applyStateRules) sees everything.
  try { st.hasSelection = !editor.state.selection.empty } catch { st.hasSelection = false }
  try { const can = editor.can?.(); st.canUndo = !!can?.undo?.(); st.canRedo = !!can?.redo?.() }
  catch { st.canUndo = false; st.canRedo = false }
  const fpStore = (editor as any).extensionStorage?.formatCommands
  st.painterArmed = !!(fpStore && (fpStore.storedStyle || fpStore.storedParaProps))
  st.clipboardHasContent = clipboardHasContent()
  return st
}

// Assumes the caller destroys the previous editor (listeners die with it) before
// re-running on a new instance — see installBridge's re-entrancy note.
export function installStateSync(editor: AnyEditor) {
  const w = window as any
  let scheduled = false
  const sync = () => {
    scheduled = false
    const st = toQueryState(editor)
    w.WC?.Ribbon?.syncToggles?.(st)
    // Phase 3: the declarative ribbon state machine — one evaluator pass over the
    // registered enablement/latch/value rules (WC.Ribbon.registerStateRule). Each
    // section registers its own rules; this single call applies them all.
    w.WC?.Ribbon?.applyStateRules?.(st)
    // Fidelity WIN over legacy: combos now track the caret (real Word does this).
    // Deliberate spec deviation (recorded): setColorBar is NOT caret-driven — the
    // split-button color bars show the LAST-USED color (applyColor writes them),
    // matching real Word; syncing them to the caret would be wrong.
    // Phase 3: guard the push so a sync tick never clobbers a value the user is
    // typing into the combo (mirrors the spinner pushSpin guard below).
    const pushCombo = (cmd: string, val: string) => {
      const ent = w.WC?.Ribbon?.controlIndex?.[cmd]
      if (ent?.input && document.activeElement === ent.input) return
      w.WC?.Ribbon?.setComboValue?.(cmd, val)
    }
    pushCombo('font', st.fontName || '')
    pushCombo('fontSize', st.fontSize || '')
    // Caret-tracking Layout spinners (real Word does this; legacy never did).
    // controlIndex entries exist from boot (Ribbon.renderBody renders every tab's
    // panel at init — ribbon.js:97-104); skip the push while the user is typing in
    // the input so sync() can't clobber a mid-edit value.
    const pushSpin = (cmd: string, val: string) => {
      const ent = w.WC?.Ribbon?.controlIndex?.[cmd]
      if (ent?.input && document.activeElement !== ent.input) ent.input.value = val
    }
    pushSpin('indentLeft', String(st.indentLeftIn ?? 0))
    pushSpin('indentRight', String(st.indentRightIn ?? 0))
    pushSpin('spacingBefore', String(st.spacingBeforePt ?? 0))
    pushSpin('spacingAfter', String(st.spacingAfterPt ?? 8))
    // Caret-driven styles-gallery highlight (real Word; legacy was apply-driven only).
    // renderStylesGallery registers nothing in controlIndex — query the cells directly.
    document.querySelectorAll('.style-cell').forEach((c: any) => {
      c.classList.toggle('active', !!st.block && c.dataset.style === st.block)
    })
    // slice 4 / Phase 3: the format-painter BUTTON latch is now a state-machine
    // rule (formatPainter → latched: st.painterArmed, registered in
    // home-features.js). The page copy-cursor stays here — it's a document-surface
    // affordance, not a ribbon-control state.
    const pmPage = document.getElementById('pm-editor')
    if (pmPage) pmPage.style.cursor = st.painterArmed ? 'copy' : ''
    // slice 8 (A6): Track Changes latch + Display-for-Review combo via the format-painter
    // DIRECT-POKE pattern — PM-only by construction. NEVER the shared TOGGLE_MAP: under
    // --legacy, syncToggles would read !!undefined and clobber the legacy latch
    // (review-tools.js:24-25). The combo seed also lives here: ribbon.js renders non-font
    // combos with an EMPTY input, and the first sync tick (installStateSync's trailing
    // schedule()) seeds Word's default "All Markup".
    const rev = w.WC?.PM?.reviewState?.()
    if (rev) {
      const tcBtn = w.WC?.Ribbon?.controlIndex?.trackChanges?.node
      if (tcBtn) tcBtn.classList.toggle('toggled', rev.tracking === true)
      const dfr = w.WC?.Ribbon?.controlIndex?.displayForReview
      if (dfr?.input && document.activeElement !== dfr.input) {
        dfr.input.value = REVIEW_VIEW_LABELS[rev.view] || 'All Markup'
      }
      // D8.8 chrome pill (T1): tracking ON flips Editing→Reviewing; a read-only
      // view (Restrict Editing enforcement / pill Viewing) shows Viewing.
      const pillLabel = document.querySelector('#wc-mode-pill .mode-pill-label')
      if (pillLabel) {
        const viewing = (w.WC?.PM?.getEditor?.() as any)?.view?.editable === false
        const mode = viewing ? 'Viewing' : (rev.tracking ? 'Reviewing' : 'Editing')
        if (pillLabel.textContent !== mode) pillLabel.textContent = mode
      }
      // R2/R3 enablement (Word greys, never toasts): Comments Delete/Prev/Next
      // disable with no comments; No Markup/Original disable the markup controls.
      const toggleDisabled = (cmd: string, off: boolean) => {
        const n = w.WC?.Ribbon?.controlIndex?.[cmd]?.node
        if (n) n.classList.toggle('wc-disabled', off)
      }
      const noComments = (w.WC?.PM?.getComments?.() || []).length === 0
      for (const c of ['deleteComment', 'previousComment', 'nextComment']) toggleDisabled(c, noComments)
      const markupHidden = rev.view === 'none' || rev.view === 'original'
      for (const c of ['showComments', 'filterMarkup', 'showMarkup']) toggleDisabled(c, markupHidden)
    }
    // slice 6: track whether the caret is inside a table (drives Table Tools contextual tabs).
    // isInTable() is installed by installTable — optional-chain so pre-mount sync is safe.
    const inTable = !!(w.WC?.PM?.isInTable?.())
    st.inTable = inTable
    // No-op until Stage F (table-tools-pm.js) ships syncContextualTabs — must not throw.
    ;(window as any).WC?.TableToolsPM?.syncContextualTabs?.(inTable)
    w.WC?.StatusBar?.update?.()
    // Real-Word fidelity: QAT undo/redo grey out when the stacks are empty
    // (st.canUndo/canRedo computed once in toQueryState).
    document.querySelectorAll('.qat .qat-btn').forEach((b: any) => {
      if (/^Undo/.test(b.title)) b.style.opacity = st.canUndo ? '' : '0.4'
      if (/^Redo/.test(b.title)) b.style.opacity = st.canRedo ? '' : '0.4'
    })
  }
  // Coalesce 'transaction' + 'selectionUpdate' (both fire per keystroke) into one
  // rAF tick — mirrors the legacy 80ms debounce intent (editor.js:26-27).
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(sync) } }
  editor.on('transaction', schedule)
  editor.on('selectionUpdate', schedule)
  // Phase 3: let non-transaction state changes nudge a ribbon re-eval. A clipboard
  // copy fires no editor transaction, and the OS clipboard can change in another
  // app — clipboard.ts calls this after cut/copy and on the focus re-probe below.
  const PM = (window as any).WC?.PM
  if (PM) PM._scheduleRibbonSync = schedule
  if (!externalListenersInstalled) {
    externalListenersInstalled = true
    // Window regained focus → the OS clipboard may have changed elsewhere; re-probe
    // so Paste's enablement reflects reality (refreshClipboardState nudges sync).
    window.addEventListener('focus', () => { (window as any).WC?.PM?.refreshClipboardState?.() })
  }
  // Initial probe so Paste reflects a pre-existing clipboard at boot.
  ;(window as any).WC?.PM?.refreshClipboardState?.()
  schedule()
}
