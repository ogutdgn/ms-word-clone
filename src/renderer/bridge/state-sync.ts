// Engine → ribbon state sync (spec §5.1/§6.B). Maps getActiveFormatting()'s
// ActiveFormattingEntry[] + paragraph attrs onto the legacy queryState() shape
// that WC.Ribbon.syncToggles/TOGGLE_MAP consume (ribbon.js:46-51, 327-333).
// Negation-attr-safe: Word marks explicit-off as e.g. bold {value:'0'}.
import { getActiveFormatting } from '@core/helpers/getActiveFormatting.js'

type AnyEditor = any

export function toQueryState(editor: AnyEditor): Record<string, any> {
  const st: Record<string, any> = {
    bold: false, italic: false, underline: false, strikethrough: false,
    subscript: false, superscript: false,
    justifyLeft: false, justifyCenter: false, justifyRight: false, justifyFull: false,
    insertUnorderedList: false, insertOrderedList: false,
    fontName: '', fontSize: '', block: '', // populated when the styles area flips (slice 3)
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
  if (just === 'left') st.justifyLeft = true
  else if (just === 'center') st.justifyCenter = true
  else if (just === 'right') st.justifyRight = true
  else if (just === 'both' || just === 'justify') st.justifyFull = true
  // List membership: use listRendering.numberingType (probe-confirmed: "bullet" or "decimal").
  // numberingProperties.numId presence also indicates a list paragraph.
  const listRendering = para?.listRendering
  if (listRendering) {
    if (listRendering.numberingType === 'bullet') st.insertUnorderedList = true
    else if (listRendering.numberingType) st.insertOrderedList = true // decimal, lowerLetter, upperRoman…; undefined = custom marker, no toggle
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
