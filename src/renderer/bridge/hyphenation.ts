// 005 (Hyphenation) — document-level hyphenation on the PM/paged engine.
//
// Hyphenation lives in word/settings.xml (w:autoHyphenation / w:hyphenationZone / w:consecutiveHyphenLimit /
// w:doNotHyphenateCaps). The fork has NO hyphenation translator, so — like 003 columns' owned bodySectPr write
// — we write directly to the converter's settings part: editor.converter.convertedXml['word/settings.xml'].
// Spike-proven (2026-06-22, 14/14): an owned upsert of these elements into the w:settings root survives
// editor.exportDocx() and round-trips. NO fork edit; the WC.PM bridge is the only doc-write path; the model
// stays page-free (these are document settings, not page nodes). The converter is swapped on open/newBlank, so
// every call resolves the LIVE settings tree. `zone` is in INCHES (converted to twips on write).
type AnyEditor = any
type XmlEl = { type?: string; name?: string; attributes?: Record<string, any>; elements?: XmlEl[] }

const SETTINGS_PART = 'word/settings.xml'

export function installHyphenation(editor: AnyEditor) {
  const w = window as any
  const markDirty = () => { try { w.WC?.PM?.markDirty?.() } catch { /* none */ } }

  // The live settings part from the current converter (swapped on open/newBlank). create:true mints the part +
  // the w:settings root if absent (mirror document-api-adapters/document-settings.ts findSettingsRoot).
  function settingsRoot(create: boolean): XmlEl | null {
    try {
      const conv = (editor as any)?.converter
      if (!conv) return null
      let cx = conv.convertedXml
      if (!cx && create) { cx = {}; conv.convertedXml = cx }
      if (!cx) return null
      let part: XmlEl | undefined = cx[SETTINGS_PART]
      if (!part) { if (!create) return null; part = { type: 'element', name: 'w:settings', elements: [] }; cx[SETTINGS_PART] = part }
      if (part.name === 'w:settings') return part
      if (Array.isArray(part.elements)) {
        let root = part.elements.find((e) => e && e.name === 'w:settings') || null
        if (!root && create) { root = { type: 'element', name: 'w:settings', elements: [] }; part.elements.push(root) }
        return root
      }
      return null
    } catch { return null }
  }

  const findEl = (root: XmlEl, name: string): XmlEl | null => (root.elements || []).find((e) => e && e.name === name) || null
  function upsert(root: XmlEl, name: string, attrs: Record<string, any>): void {
    if (!Array.isArray(root.elements)) root.elements = []
    const idx = root.elements.findIndex((e) => e && e.name === name)
    const el: XmlEl = { type: 'element', name, attributes: attrs, elements: [] }
    if (idx !== -1) root.elements[idx] = el; else root.elements.push(el)
  }
  function removeEl(root: XmlEl, name: string): void {
    if (Array.isArray(root.elements)) root.elements = root.elements.filter((e) => !(e && e.name === name))
  }
  // CT_Settings (ECMA-376 §17.15.1.78) requires a strict child order. The hyphenation block is
  // autoHyphenation → consecutiveHyphenLimit → hyphenationZone → doNotHyphenateCaps, positioned immediately
  // AFTER w:defaultTabStop. Word's import is sequential: a block at the WRONG position (our generic upsert pushes
  // new elements to the END, after compat/rsids/etc.) makes Word SKIP the measurement element — w:hyphenationZone
  // read back as 9999999/undefined. So after upserting, RELOCATE the whole hyphenation block (internally ordered)
  // to its correct schema position. Non-hyphenation siblings keep their relative order.
  const HYPH_ORDER = ['w:autoHyphenation', 'w:consecutiveHyphenLimit', 'w:hyphenationZone', 'w:doNotHyphenateCaps']
  // CT_Settings elements that the schema places AFTER the hyphenation block (the fallback anchor when
  // w:defaultTabStop is absent — insert the block BEFORE the first of these).
  const AFTER_HYPH = new Set<string>(['w:characterSpacingControl', 'w:showEnvelope', 'w:summaryLength', 'w:clickAndTypeStyle', 'w:defaultTableStyle', 'w:evenAndOddHeaders', 'w:noPunctuationKerning', 'w:printTwoOnOne', 'w:savePreviewPicture', 'w:updateFields', 'w:hdrShapeDefaults', 'w:footnotePr', 'w:endnotePr', 'w:compat', 'w:compatSetting', 'w:docVars', 'w:rsids', 'w:themeFontLang', 'w:clrSchemeMapping', 'w:decimalSymbol', 'w:listSeparator'])
  function placeHyphenation(root: XmlEl): void {
    if (!Array.isArray(root.elements)) return
    const isHyph = (e: XmlEl) => !!e && HYPH_ORDER.indexOf(e.name || '') !== -1
    const block = root.elements.filter(isHyph).sort((a, b) => HYPH_ORDER.indexOf(a.name || '') - HYPH_ORDER.indexOf(b.name || ''))
    if (!block.length) return
    const rest = root.elements.filter((e) => !isHyph(e))
    // Insert immediately after w:defaultTabStop (the hyphenation block's schema predecessor); else before the
    // first element the schema places after the block; else at the end.
    const dt = rest.findIndex((e) => e && e.name === 'w:defaultTabStop')
    let idx: number
    if (dt !== -1) idx = dt + 1
    else { const a = rest.findIndex((e) => e && AFTER_HYPH.has(e.name || '')); idx = a !== -1 ? a : rest.length }
    root.elements = rest.slice(0, idx).concat(block, rest.slice(idx))
  }
  const truthy = (v: any): boolean => v === 'true' || v === '1' || v === true || v === 1 || v == null /* bare element ⇒ on */

  type HyphOpts = { mode?: 'none' | 'auto'; zone?: number | null; consecutiveLimit?: number | null; hyphenateCaps?: boolean }

  // Write the hyphenation settings (idempotent; each field written only when provided). `mode:'none'` writes an
  // EXPLICIT w:autoHyphenation w:val="false" (not just omit) so a prior "on" can't linger (the 004 clean-clear
  // lesson). `hyphenateCaps` is the INVERSE of w:doNotHyphenateCaps (checkbox OFF ⇒ element present).
  function setHyphenation(opts: HyphOpts): boolean {
    try {
      const root = settingsRoot(true)
      if (!root) return false
      const mode = opts?.mode
      if (mode === 'auto') upsert(root, 'w:autoHyphenation', { 'w:val': 'true' })
      else if (mode === 'none') upsert(root, 'w:autoHyphenation', { 'w:val': 'false' })
      // zone/consecutiveLimit are FULL-SET per field: present-and-valid ⇒ upsert; present-but-null/blank ⇒ CLEAR
      // (the Options dialog's "Auto"/"No limit"); ABSENT ⇒ preserve (a plain mode switch keeps the options). This
      // avoids the 004 partial-update carryover (a value cleared to Auto on a re-edit would otherwise linger).
      const has = (k: string) => !!opts && Object.prototype.hasOwnProperty.call(opts, k)
      // NB: check null/undefined BEFORE Number() — Number(null) === 0 (would wrongly write a 0 value, not clear).
      if (has('zone')) { const zv = opts!.zone; if (zv == null) removeEl(root, 'w:hyphenationZone'); else { const z = Number(zv); if (Number.isFinite(z) && z >= 0) upsert(root, 'w:hyphenationZone', { 'w:val': String(Math.round(z * 1440)) }); else removeEl(root, 'w:hyphenationZone') } }
      if (has('consecutiveLimit')) { const lv = opts!.consecutiveLimit; if (lv == null) removeEl(root, 'w:consecutiveHyphenLimit'); else { const cl = Math.round(Number(lv)); if (Number.isFinite(cl) && cl >= 0) upsert(root, 'w:consecutiveHyphenLimit', { 'w:val': String(cl) }); else removeEl(root, 'w:consecutiveHyphenLimit') } }
      if (typeof opts?.hyphenateCaps === 'boolean') { if (opts.hyphenateCaps) removeEl(root, 'w:doNotHyphenateCaps'); else upsert(root, 'w:doNotHyphenateCaps', {}) }
      placeHyphenation(root) // relocate the block to its CT_Settings position — Word skips a misplaced hyphenationZone
      markDirty()
      return true
    } catch { return false }
  }

  // { auto, zone (inches), consecutiveLimit, hyphenateCaps, zoneExplicit, limitExplicit } from the settings tree.
  // Drives the dropdown checked-state + the Options dialog defaults (the *Explicit flags = "Auto/unset" vs a real
  // value, so the dialog never replays a synthesized default — the 004 lesson). hyphenateCaps default = true
  // (Word's default: words in CAPS ARE hyphenated unless w:doNotHyphenateCaps is present).
  function getHyphenation(): { auto: boolean; zone: number; consecutiveLimit: number; hyphenateCaps: boolean; zoneExplicit: boolean; limitExplicit: boolean } {
    const def = { auto: false, zone: 0.25, consecutiveLimit: 0, hyphenateCaps: true, zoneExplicit: false, limitExplicit: false }
    try {
      const root = settingsRoot(false)
      if (!root) return def
      const autoEl = findEl(root, 'w:autoHyphenation')
      const auto = !!autoEl && truthy(autoEl.attributes?.['w:val'])
      const zEl = findEl(root, 'w:hyphenationZone'); const zTw = Number(zEl?.attributes?.['w:val'])
      const clEl = findEl(root, 'w:consecutiveHyphenLimit'); const cl = Number(clEl?.attributes?.['w:val'])
      const zoneExplicit = !!zEl && Number.isFinite(zTw) && zTw >= 0
      const limitExplicit = !!clEl && Number.isFinite(cl) && cl >= 0
      return {
        auto,
        zone: zoneExplicit ? zTw / 1440 : 0.25,
        consecutiveLimit: limitExplicit ? Math.round(cl) : 0,
        hyphenateCaps: !findEl(root, 'w:doNotHyphenateCaps'),
        zoneExplicit,
        limitExplicit,
      }
    } catch { return def }
  }

  // P3 — Manual: insert optional hyphens (U+00AD) into long body words so they may break at line ends. Best-effort
  // (Word's interactive walkthrough is out of v1); the markers survive export as literal U+00AD (spike-confirmed).
  // Returns the number of words marked, or false on failure.
  function applyManualHyphenation(): number | false {
    try {
      const ed = editor as any
      const state = ed?.state
      if (!state) return false
      const SOFT = '­'
      const tr = state.tr
      let marked = 0
      // Walk text nodes; insert a soft hyphen every ~4 chars inside words ≥ 8 letters that don't already carry one.
      state.doc.descendants((node: any, pos: number) => {
        if (!node.isText || typeof node.text !== 'string') return true
        const text: string = node.text
        if (!/[A-Za-z]{8,}/.test(text) || text.indexOf(SOFT) >= 0) return true
        const next = text.replace(/([A-Za-z]{8,})/g, (word: string) => { marked++; return word.replace(/(.{4})(?=.{3})/g, '$1' + SOFT) })
        if (next !== text) tr.insertText(next, pos, pos + text.length)
        return true
      })
      if (marked > 0 && ed.view) { ed.view.dispatch(tr); markDirty() }
      return marked
    } catch { return false }
  }

  return { setHyphenation, getHyphenation, applyManualHyphenation }
}
