// Home Styles › "Create a Style" — mint a NEW named (custom) paragraph style from the current selection's
// formatting. NO-FORK: build a translated style definition in the fork's own shape (probe-confirmed: {type, styleId,
// customStyle, name, basedOn, next, uiPriority, qFormat, runProperties}), register it in
// editor.converter.translatedLinkedStyles.styles (the registry setStyleById resolves from), sync it into
// word/styles.xml via the fork helper syncStylesDiffToConvertedXml (so Word reads the style), register the
// display name in STYLE_NAME_TO_ID (so it's selectable via Apply Styles / applyStyleByName), then apply it.
//
// The runProperties are derived from the selection's marks with the fork's own decodeRPrFromMarks (the same
// export path), so the captured rPr matches what a direct-formatted run would export. v1 = paragraph styles
// based on Normal; character styles + the full New-Style options dialog are deferred.
// @ts-nocheck
import { decodeRPrFromMarks } from '@core/super-converter/styles.js'
import { syncStylesDiffToConvertedXml } from '@core/helpers/styles-xml-helpers.js'
import { STYLE_NAME_TO_ID, STYLE_ID_TO_NAME } from './style-names'

// Derive the live in-app CSS (the converter.linkedStyles `definition.styles` shape) from the OOXML runProperties,
// so the new style RENDERS in-app + is applicable by name (setStyleById resolves from converter.linkedStyles).
function cssFromRunProps(rp: any): Record<string, string> {
  const css: Record<string, string> = {}
  if (!rp) return css
  if (rp.bold) css['font-weight'] = 'bold'
  if (rp.italic) css['font-style'] = 'italic'
  if (rp.underline) css['text-decoration'] = 'underline'
  if (rp.strike) css['text-decoration'] = (css['text-decoration'] ? css['text-decoration'] + ' ' : '') + 'line-through'
  if (rp.color && rp.color.val) css.color = '#' + String(rp.color.val).replace(/^#/, '')
  if (rp.fontSize) css['font-size'] = (Number(rp.fontSize) / 2) + 'pt' // half-points → pt
  if (rp.fontFamily && (rp.fontFamily.ascii || typeof rp.fontFamily === 'string')) css['font-family'] = rp.fontFamily.ascii || rp.fontFamily
  return css
}

type AnyEditor = any

export function installStyles(editor: AnyEditor) {
  const w = window as any

  // The marks carrying the selection's character formatting (first selected char, else the caret/stored marks).
  function selectionMarks(): any[] {
    try {
      const { state } = editor
      const sel = state.selection
      if (!sel.empty) {
        const node = state.doc.nodeAt(sel.from)
        if (node && node.marks && node.marks.length) return node.marks
      }
      return state.storedMarks || sel.$from.marks() || []
    } catch { return [] }
  }

  function createNamedStyle(name: string): { ok: boolean; styleId?: string; name?: string } {
    try {
      const converter = editor.converter
      const tls = converter && converter.translatedLinkedStyles
      if (!tls || !tls.styles) return { ok: false }
      // Unique DISPLAY name first — so we never clobber a built-in's STYLE_NAME_TO_ID mapping (e.g. naming a style
      // "Heading 1" must not repoint the gallery's "Heading 1" at the custom style).
      let display = String(name || '').trim() || 'Style 1'
      const dispBase = display
      let dn = 1
      while (STYLE_NAME_TO_ID[display]) { display = dispBase + ' ' + dn; dn++ }
      // Mint a unique styleId (alnum) — auto-suffix on collision with an existing style.
      const base = display.replace(/[^A-Za-z0-9]/g, '') || 'Style'
      let id = base
      let n = 1
      while (tls.styles[id]) { id = base + n; n++ }
      const runProperties = decodeRPrFromMarks(selectionMarks()) || {}
      // A captured hyperlink contributes runProperties.styleId='Hyperlink' (an rStyle ref) — strip it so the new
      // PARAGRAPH style doesn't carry a character-style reference in its rPr.
      if (runProperties.styleId) delete runProperties.styleId
      tls.styles[id] = {
        type: 'paragraph',
        styleId: id,
        customStyle: true,
        name: display,
        basedOn: 'Normal',
        next: 'Normal',
        uiPriority: 1,
        qFormat: true,
        runProperties,
      }
      // Splice the new <w:style> into word/styles.xml so the export carries it (Word reads the definition).
      try { syncStylesDiffToConvertedXml(converter, { addedStyles: { [id]: {} }, modifiedStyles: {}, removedStyles: {} }) } catch { /* export-sync is best-effort */ }
      // Register in the LIVE in-app registry (converter.linkedStyles — the ARRAY setStyleById + the render plugin
      // resolve from) so the style applies by name AND renders even after direct marks are cleared.
      try {
        if (Array.isArray(converter.linkedStyles)) {
          converter.linkedStyles.push({ id, type: 'paragraph', definition: { attrs: { name: display, qFormat: true, basedOn: 'Normal' }, styles: cssFromRunProps(runProperties) }, attributes: {} })
        }
      } catch { /* live-registry add is best-effort */ }
      // Make the style selectable by name (Apply Styles dialog / applyStyleByName / allStyleNames + the active-style
      // display in the gallery/status bar, which reads STYLE_ID_TO_NAME).
      STYLE_NAME_TO_ID[display] = id
      STYLE_ID_TO_NAME[id] = display
      // Link the caret paragraph(s) to the new style (w:pStyle); the selection's direct marks keep it rendering.
      try { editor.commands.updateAttributes('paragraph', { 'paragraphProperties.styleId': id }) } catch { /* apply best-effort */ }
      try { w.WC?.PM?.markDirty?.() } catch { /* none */ }
      return { ok: true, styleId: id, name: display }
    } catch { return { ok: false } }
  }

  return { createNamedStyle }
}
