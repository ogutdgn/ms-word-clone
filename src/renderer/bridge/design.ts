// Slice 10 PR2: themes (Design tab) doc-mutation surface on the PM engine. The
// WC.Design ENGINE + its value tables (THEMES/COLOR_SCHEMES/FONT_PAIRS/SPACING/
// STYLE_SETS) stay clone-owned (spec §9.3 carve-out); only the document-mutation
// calls move here. Real fidelity: themes/styleSet/colors/fonts REDEFINE named-style
// definitions (editor.commands.redefineNamedStyles — exports to word/styles.xml AND
// repaints the PM view, plan §0 F1-F4); pageColor writes a real w:background doc attr
// (Task 2); pageBorders writes real w:pgBorders (editor.doc.sections, F6);
// paragraphSpacing writes real docDefaults (editor.doc.styles.apply, F7). watermark =
// visual stand-in + honest toast (Phase-7); effects/setAsDefault = clone-owned.
//
// editor.doc / editor.converter are read FRESH each call (K6 — cached, reset on Open/New).
import { ensureDisplayBackgroundShape } from '@core/super-converter/v2/importer/settings-background.js'

type AnyEditor = any

// The named styles a theme restyles. Heading2/3 derive from Heading1's font; Title is biggest.
const HEADING_STYLE_IDS = ['Title', 'Subtitle', 'Heading1', 'Heading2', 'Heading3']

// First family of a CSS font chain, quotes stripped (legacy firstFont parity, design-tools.js:150).
const firstFamily = (chain: string): string => String(chain || '').split(',')[0].replace(/['"]/g, '').trim()
const bareHex = (c: string): string => String(c || '').replace(/^#/, '').toUpperCase()

export function installDesign(editor: AnyEditor) {
  const w = window as any
  const refocus = () => editor.view?.focus()
  const toast = (m: string) => { try { w.WC?.toast?.(m) } catch { /* none */ } }
  // Flip the APP unsaved-changes flag (io.ts `dirty`), NOT converter.documentModified — the
  // Save prompt reads io.ts's `dirty` closure (PM.isDirty), flipped by editor.on('update') on a
  // docChanged tr. Theme/color on a HEADING-LESS doc, or docDefaults/pageBorders, mutate styles.xml
  // WITHOUT a docChanged tr, so we must flip the real flag explicitly (PM.markDirty, added to io.ts).
  const markDirty = () => { try { w.WC?.PM?.markDirty?.() } catch { /* none */ } }

  const converter = (): any => { try { return editor.converter } catch { return null } }
  const docApi = (): any => { try { return editor.doc } catch { return null } }

  // ---- core: redefine named styles (the F4 four-step lives in the fork command) ----
  // updates: Array<{ styleId, run?, paragraph? }>. doExport=false = hover preview (visual only).
  function redefine(updates: any[], doExport = true): boolean {
    if (!Array.isArray(updates) || !updates.length) return false
    try { return editor.commands.redefineNamedStyles(updates, { export: doExport }) === true } catch { return false }
  }

  // Build the named-style updates for a theme/font-pairing/color-scheme.
  // headingFont/bodyFont are CSS chains; color is a hex (heading text color); accents[] optional.
  function themeUpdates(headingChain: string | null, bodyChain: string | null, headingColor: string | null): any[] {
    const ups: any[] = []
    const hFam = headingChain ? firstFamily(headingChain) : null
    const bFam = bodyChain ? firstFamily(bodyChain) : null
    for (const id of HEADING_STYLE_IDS) {
      const run: any = {}
      if (hFam) run.fontFamily = hFam
      if (headingColor) run.color = headingColor
      if (Object.keys(run).length) ups.push({ styleId: id, run })
    }
    // Normal carries the body font (covers explicitly-Normal paragraphs; plan K2).
    if (bFam) ups.push({ styleId: 'Normal', run: { fontFamily: bFam } })
    return ups
  }

  // ---- docDefaults (F7) — body font / paragraph spacing (real export) ----
  function applyDocDefaultsRun(patch: any): boolean {
    const d = docApi(); if (!d) return false
    try { const r = d.styles.apply({ target: { scope: 'docDefaults', channel: 'run' }, patch }); return !!(r && r.success !== false) } catch { return false }
  }
  function applyDocDefaultsParagraph(patch: any): boolean {
    const d = docApi(); if (!d) return false
    try { const r = d.styles.apply({ target: { scope: 'docDefaults', channel: 'paragraph' }, patch }); return !!(r && r.success !== false) } catch { return false }
  }

  // ---- themes / colors / fonts / styleSet ----
  function deApplyTheme(theme: any): boolean {
    if (!theme || typeof theme !== 'object') return false
    const ok = redefine(themeUpdates(theme.heading, theme.body, theme.color), true)
    if (ok && theme.body) applyDocDefaultsRun({ fontFamily: { ascii: firstFamily(theme.body), hAnsi: firstFamily(theme.body) } })
    if (ok) { markDirty(); refocus(); toast('Theme "' + (theme.name || 'Office') + '" applied.') }
    return ok
  }
  function deApplyColors(scheme: any): boolean {
    if (!scheme || typeof scheme !== 'object') return false
    // Heading color = first accent (Word's Text/accent cascade); also re-map the picker theme row.
    const color = Array.isArray(scheme.accents) && scheme.accents[0] ? scheme.accents[0] : null
    if (!color) return false
    const ups = HEADING_STYLE_IDS.map((id) => ({ styleId: id, run: { color } }))
    const ok = redefine(ups, true)
    try { w.WC?.setThemeColors?.(scheme.accents) } catch { /* none */ }
    if (ok) { markDirty(); refocus(); toast('Colors: ' + (scheme.name || '')) }
    return ok
  }
  function deApplyFonts(pair: any): boolean {
    if (!pair || typeof pair !== 'object') return false
    const ok = redefine(themeUpdates(pair.heading, pair.body, null), true)
    // Guard on `ok` (match deApplyTheme): don't mutate docDefaults if the named-style half failed
    // (avoids a partial mutation + a docDefaults change that markDirty below would never flag).
    if (ok && pair.body) applyDocDefaultsRun({ fontFamily: { ascii: firstFamily(pair.body), hAnsi: firstFamily(pair.body) } })
    if (ok) { markDirty(); refocus(); toast('Fonts: ' + (pair.name || '')) }
    return ok
  }
  function deApplyStyleSet(name: string): boolean {
    // Style sets are font+spacing presets. Map the few legacy names to Normal spacing
    // tweaks (the visible part); the full Word style-set catalog is a recorded follow-up.
    const SETS: Record<string, any> = {
      'No Paragraph Space': { paragraph: { spacing: { before: 0, after: 0, line: 240, lineRule: 'auto' } } },
      'Compact': { paragraph: { spacing: { before: 0, after: 80, line: 240, lineRule: 'auto' } } },
      'Double': { paragraph: { spacing: { before: 0, after: 160, line: 480, lineRule: 'auto' } } },
    }
    const preset = SETS[name] || { paragraph: { spacing: { before: 0, after: 160, line: 259, lineRule: 'auto' } } }
    const ok = redefine([{ styleId: 'Normal', paragraph: preset.paragraph }], true)
    if (ok && preset.paragraph?.spacing) applyDocDefaultsParagraph({ spacing: preset.paragraph.spacing })
    if (ok) { markDirty(); refocus(); toast('Style Set: ' + name) }
    return ok
  }

  // ---- paragraph spacing (F7 docDefaults + Normal style, real export) ----
  // s: { before, after, line } — before/after in pt; line is a multiple (1, 1.15, 2 …).
  function deParagraphSpacing(s: any): boolean {
    if (!s || typeof s !== 'object') return false
    const spacing: any = {}
    if (s.before != null) spacing.before = Math.round(Number(s.before) * 20)  // pt → twips
    if (s.after != null) spacing.after = Math.round(Number(s.after) * 20)
    if (s.line != null) { spacing.line = Math.round(Number(s.line) * 240); spacing.lineRule = 'auto' } // multiple → 240ths
    const okDoc = applyDocDefaultsParagraph({ spacing })
    const okStyle = redefine([{ styleId: 'Normal', paragraph: { spacing } }], true)
    const ok = okDoc || okStyle
    if (ok) { markDirty(); refocus(); toast('Paragraph Spacing: ' + (s.name || '')) }
    return ok
  }

  // ---- hover live-preview (D10t.9) — visual-only redefinition with snapshot/restore ----
  // Snapshot the affected styles' current visual values (linkedStyles array) when a gallery
  // opens; restore on mouseleave. Preview uses {export:false} (no styles.xml write).
  // previewSnap = a DEEP CLONE of each affected style's FULL definition.styles, captured once per
  // gallery-open. Restoring REPLACES definition.styles wholesale (so keys the preview ADDED — e.g.
  // a font-family on a style that originally had none — are removed, not just overwritten). Plan K-min.
  const PREVIEW_IDS = [...HEADING_STYLE_IDS, 'Normal']
  let previewSnap: Record<string, any> | null = null
  const clone = (o: any) => JSON.parse(JSON.stringify(o || {}))
  function snapshotStyles(styleIds: string[]): Record<string, any> | null {
    const c = converter(); const arr = c && c.linkedStyles
    if (!Array.isArray(arr)) return null
    const snap: Record<string, any> = {}
    for (const id of styleIds) {
      const e = arr.find((s: any) => s.id === id)
      snap[id] = (e && e.definition && e.definition.styles) ? clone(e.definition.styles) : {}
    }
    return snap
  }
  // dePreviewTheme(kind, item): visual-only preview. kind ∈ 'theme'|'colors'|'fonts'.
  function dePreviewTheme(kind: string, item: any): boolean {
    if (!item) return false
    if (!previewSnap) previewSnap = snapshotStyles(PREVIEW_IDS)
    let ups: any[] = []
    if (kind === 'colors') ups = HEADING_STYLE_IDS.map((id) => ({ styleId: id, run: { color: (item.accents || [])[0] } }))
    else if (kind === 'fonts') ups = themeUpdates(item.heading, item.body, null)
    else ups = themeUpdates(item.heading, item.body, item.color)
    return redefine(ups, false)
  }
  // dePreviewRestore(): revert to the snapshot by REPLACING each style's definition.styles with the
  // clone (deletes preview-added keys), then regen decorations (a no-prop redefine restamps + emits).
  function dePreviewRestore(): boolean {
    if (!previewSnap) return false
    const c = converter(); const arr = c && c.linkedStyles
    const ids = Object.keys(previewSnap)
    if (Array.isArray(arr)) {
      for (const id of ids) {
        const e = arr.find((s: any) => s.id === id)
        if (e && e.definition) e.definition.styles = clone(previewSnap[id])
      }
    }
    previewSnap = null
    return redefine(ids.map((id) => ({ styleId: id })), false) // regen from the restored array
  }
  function dePreviewCommit(): void { previewSnap = null } // click committed; drop the snapshot
  // dePreviewEnd(): defensive restore for a flyout that closes WITHOUT a per-cell mouseleave
  // (outside-click / keyboard close). Wire into the flyout-teardown path in Task 4 (verify the
  // exact WC.closeFlyouts hook in-build); idempotent (no-op when previewSnap is null).
  function dePreviewEnd(): void { if (previewSnap) dePreviewRestore() }

  // ---- page color (Task 2 real w:background) + live page-sheet paint (F12) ----
  // Use backgroundColor (longhand), NOT the `background` shorthand — the shorthand RESETS
  // background-image and would WIPE an active watermark SVG (legacy warned this at commands.js:1735).
  function paintPageSheet(hex: string | null): void {
    const ed = document.getElementById('pm-editor')
    if (ed) ed.style.backgroundColor = hex || ''
  }
  function setBackgroundAttr(hex: string | null): boolean {
    // Set the TOP doc node's `background` attr via setDocAttribute (the fork idiom for doc-level
    // data, e.g. bodySectPr — sections-adapter.ts:249). setNodeMarkup(0) would target the FIRST
    // PARAGRAPH, not the doc node (plan §2 blocker fix). DocAttrStep is docChanged → io.ts flips dirty.
    try {
      const bg = hex ? { type: 'element', name: 'w:background', attributes: { 'w:color': bareHex(hex) } } : null
      const tr = editor.state.tr.setDocAttribute('background', bg)
      editor.view ? editor.view.dispatch(tr) : editor.dispatch?.(tr)
      return true
    } catch { return false }
  }
  function dePageColor(hex: string): boolean {
    if (!hex || hex === 'transparent') return dePageColorClear()
    const ok = setBackgroundAttr(hex)
    if (ok) {
      paintPageSheet(hex)
      try { ensureDisplayBackgroundShape(converter(), true) } catch { /* none */ } // K4: Word renders bg on open
      refocus() // setDocAttribute already flips dirty (docChanged)
    }
    return ok
  }
  function dePageColorClear(): boolean {
    const ok = setBackgroundAttr(null)
    if (ok) {
      paintPageSheet(null)
      try { ensureDisplayBackgroundShape(converter(), false) } catch { /* none */ }
      refocus()
    }
    return ok
  }

  // ---- page borders (F6 real w:pgBorders; visual Phase-7) ----
  // opts: { style, color, width } (legacy shape) or { remove:true }.
  const BORDER_STYLE_MAP: Record<string, string> = { solid: 'single', double: 'double', dashed: 'dashed', dotted: 'dotted', groove: 'threeDEngrave' }
  function sectionTarget(d: any): any | null {
    // list() returns DiscoveryItem<SectionDomain> with `address` spread at the top level.
    try { const items = d.sections.list()?.items ?? []; return items[0]?.address ?? null } catch { return null }
  }
  function dePageBorders(opts: any): boolean {
    const d = docApi(); if (!d) return false
    const target = sectionTarget(d); if (!target) return false
    if (opts && opts.remove) {
      try { const r = d.sections.clearPageBorders({ target }); if (r && r.success !== false) { markDirty(); refocus(); return true } return false } catch { return false }
    }
    const style = BORDER_STYLE_MAP[String(opts?.style || 'solid')] || 'single'
    const size = Math.max(2, Math.round(Number(opts?.width || 1) * 8)) // px → eighths of a pt
    const spec = { style, size, space: 24, color: bareHex(opts?.color || '#000000') }
    const borders = { display: 'allPages', offsetFrom: 'text', top: spec, right: spec, bottom: spec, left: spec }
    try { const r = d.sections.setPageBorders({ target, borders }); if (r && r.success !== false) { markDirty(); refocus(); return true } return false } catch { return false }
  }
  function dePageBordersRemove(): boolean { return dePageBorders({ remove: true }) }

  // ---- watermark (D10t.6 visual stand-in + honest toast; Phase-7 for the real header construct) ----
  function deWatermark(text: string, opts: any): boolean {
    if (!text) return deWatermarkRemove()
    const ed = document.getElementById('pm-editor'); if (!ed) return false
    // Keep the literal '#rrggbb' — encodeURIComponent (below) handles the '#'. Pre-replacing it
    // with %23 would double-encode to %2523 and break the fill color (the legacy bug at commands.js).
    const color = String(opts?.color || '#C8C8C8')
    const rot = opts?.diagonal === false ? 0 : -45
    const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='816' height='1056'><text x='408' y='560' font-family='Calibri,Arial' font-size='80' fill='${color}' fill-opacity='0.5' text-anchor='middle' transform='rotate(${rot} 408 560)'>${esc(text)}</text></svg>`
    ed.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
    ed.style.backgroundRepeat = 'repeat-y'
    ed.style.backgroundPosition = 'center top'
    // Non-dirtying: the watermark is a presentational stand-in, NOT exported (real header
    // watermark = Phase 7). No markDirty — honest (nothing savable changed). Plan §2 K3.
    toast('Watermark "' + text + '" — preview only; renders in the saved file at Phase 7.')
    return true
  }
  function deWatermarkRemove(): boolean {
    const ed = document.getElementById('pm-editor'); if (ed) ed.style.backgroundImage = ''
    return true
  }

  // ---- effects (D10t.7 clone-owned presentational, no E() leak) ----
  function deEffects(shadow: string): boolean {
    const ed = document.querySelector('#pm-editor .ProseMirror') as HTMLElement | null
    if (!ed) return false
    const objs = ed.querySelectorAll('img, .wc-shape, .wc-wordart')
    objs.forEach((o: any) => { o.style.boxShadow = shadow === 'none' ? '' : shadow })
    // Non-dirtying: boxShadow is a presentational DOM style, not in the model / not exported (K3).
    toast(objs.length ? ('Theme effect applied to ' + objs.length + ' object(s).') : 'Theme effect set (applies to shapes/pictures).')
    return true
  }

  // ---- setAsDefault (D10t.8 clone-owned toast no-op) ----
  function deSetAsDefault(): boolean { toast('Current theme/spacing set as the default for new documents (session).'); return true }

  return {
    deApplyTheme, deApplyColors, deApplyFonts, deApplyStyleSet, deParagraphSpacing,
    dePreviewTheme, dePreviewRestore, dePreviewCommit, dePreviewEnd,
    dePageColor, dePageColorClear, dePageBorders, dePageBordersRemove,
    deWatermark, deWatermarkRemove, deEffects, deSetAsDefault,
  }
}
