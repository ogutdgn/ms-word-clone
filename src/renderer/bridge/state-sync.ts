// Engine → ribbon state sync (spec §5.1/§6.B). Maps getActiveFormatting()'s
// ActiveFormattingEntry[] + paragraph attrs onto the legacy queryState() shape
// that WC.Ribbon.syncToggles/TOGGLE_MAP consume (ribbon.js:46-51, 327-333).
// Negation-attr-safe: Word marks explicit-off as e.g. bold {value:'0'}.
import { getActiveFormatting } from '@core/helpers/getActiveFormatting.js'
import { calculateResolvedParagraphProperties } from '@extensions/paragraph/resolvedPropertiesCache.js'
import { STYLE_ID_TO_NAME } from './style-names'

type AnyEditor = any

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
  st.computedFontFamily = st.fontName
  const sizeNum = parseFloat(st.fontSize)
  st.computedFontSizePt = isNaN(sizeNum) ? null : sizeNum
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
    // Fidelity WIN over legacy: combos now track the caret (real Word does this).
    // Deliberate spec deviation (recorded): setColorBar is NOT caret-driven — the
    // split-button color bars show the LAST-USED color (applyColor writes them),
    // matching real Word; syncing them to the caret would be wrong.
    w.WC?.Ribbon?.setComboValue?.('font', st.fontName || '')
    w.WC?.Ribbon?.setComboValue?.('fontSize', st.fontSize || '')
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
    // slice 4: format-painter chrome — button latches + the page shows a copy
    // cursor while armed (fork FormatCommands storage is the state of record;
    // arm/cancel don't dispatch a transaction, so the bridge wrappers nudge sync).
    const fpStorage = (editor as any).extensionStorage?.formatCommands
    const fpArmed = !!(fpStorage && (fpStorage.storedStyle || fpStorage.storedParaProps))
    const fpBtn = w.WC?.Ribbon?.controlIndex?.formatPainter?.node
    if (fpBtn) fpBtn.classList.toggle('toggled', fpArmed)
    const pmPage = document.getElementById('pm-editor')
    if (pmPage) pmPage.style.cursor = fpArmed ? 'copy' : ''
    w.WC?.StatusBar?.update?.()
    // Real-Word fidelity: QAT undo/redo grey out when the stacks are empty.
    const can = (w.WC?.editor as any)?.can?.()
    document.querySelectorAll('.qat .qat-btn').forEach((b: any) => {
      if (/^Undo/.test(b.title)) b.style.opacity = can?.undo?.() ? '' : '0.4'
      if (/^Redo/.test(b.title)) b.style.opacity = can?.redo?.() ? '' : '0.4'
    })
  }
  // Coalesce 'transaction' + 'selectionUpdate' (both fire per keystroke) into one
  // rAF tick — mirrors the legacy 80ms debounce intent (editor.js:26-27).
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(sync) } }
  editor.on('transaction', schedule)
  editor.on('selectionUpdate', schedule)
  schedule()
}
