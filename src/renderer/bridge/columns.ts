// 003 (Columns) — multi-column page layout on the PM/paged engine.
//
// Columns live in the section's sectPr/w:cols. The fork's PUBLIC Document API
// editor.doc.sections.setColumns({ count, gap, equalWidth, target }) writes w:cols AND the paged
// PresentationEditor re-flows the painted body text into the columns (feasibility-probed 2026-06-21:
// setColumns({count:2}) → lines paint at 2 distinct x-bands + export <w:cols w:num="2" w:space="720"
// w:equalWidth="1"/>). No fork edit; the WC.PM bridge is the only doc-write path; the model stays
// page-free (w:cols is a sectPr property). `gap` is in INCHES (the adapter converts to twips; 0.5 → 720).
type AnyEditor = any

export function installColumns(editor: AnyEditor) {
  const w = window as any
  const markDirty = () => { try { w.WC?.PM?.markDirty?.() } catch { /* none */ } }
  const docApi = (): any => { try { return editor.doc } catch { return null } }
  const sectionsApi = (): any => { try { return docApi()?.sections } catch { return null } }
  const mutationOk = (res: any): boolean => res?.success === true || res?.failure?.code === 'NO_OP'

  // Section 0's address (single primary section, v1) — from the public sections discovery.
  function firstSectionAddress(): { kind: 'section'; sectionId: string } | null {
    try {
      const items = sectionsApi()?.list?.()?.items
      const addr = (Array.isArray(items) ? items[0] : null)?.address
      if (addr && typeof addr.sectionId === 'string' && addr.sectionId.length > 0) return addr
    } catch { /* fall through */ }
    return null
  }

  const normCount = (n: unknown): number => { const v = Math.round(Number(n)); return Number.isFinite(v) && v >= 1 ? Math.min(v, 12) : 1 }

  // ── P2 owned-write helpers (the public sections.setColumns input is only {count,gap,equalWidth};
  // line-between (w:cols/@w:sep) + unequal Left/Right (<w:col> children) are written onto the SAME
  // body sectPr w:cols the adapter touches — an owned converter write, NOT a fork-source edit, and
  // spike-proven to persist across a later setColumns). xml-js node shape: {name, attributes, elements}.
  // The DIRECT-CHILD w:cols of converter.bodySectPr (the element the exporter reads) — never a w:cols
  // nested in a w:sectPrChange revision record (mirrors the fork's direct-child findChild; reviewed 003 P2).
  function bodyColsEl(): any {
    try { return ((editor as any).converter?.bodySectPr?.elements || []).find((e: any) => e && e.name === 'w:cols') || null } catch { return null }
  }
  // Page text-column width in twips (page width − L/R margins), for the unequal column widths.
  function pageTextWidthTwips(): number {
    try {
      const ps = (editor as any).getPageStyles?.() || {}
      const wIn = ps?.pageSize?.width ?? 8.5
      const lIn = ps?.pageMargins?.left ?? 1
      const rIn = ps?.pageMargins?.right ?? 1
      return Math.max(1440, Math.round((wIn - lIn - rIn) * 1440))
    } catch { return Math.round(6.5 * 1440) }
  }

  type ColsOpts = { count: number; gap?: number; equalWidth?: boolean; lineBetween?: boolean; unequal?: 'left' | 'right' }

  // Apply a column layout to section 0. count:1 normalizes to a single column; NO_OP counts as success.
  // `unequal` ('left'/'right') forces 2 columns with asymmetric widths (Word's Left/Right presets);
  // `lineBetween` draws a separator. The equal count/gap/equalWidth go through the PUBLIC adapter; the
  // owned bodySectPr post-write then normalizes the <w:col> children + the w:sep attr (export-correct;
  // real Word renders both — the in-app paint of the separator/unequal split is best-effort).
  // NB: the owned bodySectPr write (w:sep + <w:col>) lives only on converter.bodySectPr, OUTSIDE the PM
  // transaction the public adapter records — so it is not on the undo stack and a later body-section op
  // (page setup / margins) that re-clones bodySectPr can reset it (003 P2 review #6, a v1 limitation;
  // the export + real Word are correct for the column op itself).
  function setColumns(opts: ColsOpts): boolean {
    try {
      const sx = sectionsApi()
      const addr = firstSectionAddress()
      if (!sx?.setColumns || !addr) return false
      const unequal = opts?.unequal === 'left' || opts?.unequal === 'right' ? opts.unequal : null
      const hasCount = typeof opts?.count === 'number'
      const hasEqual = typeof opts?.equalWidth === 'boolean'
      const hasLine = !!opts && Object.prototype.hasOwnProperty.call(opts, 'lineBetween')
      const g = Number(opts?.gap)
      // A "structural" call sets the column STRUCTURE (count/equalWidth/unequal); a lineBetween-ONLY call
      // toggles just the separator and PRESERVES the structure (+ <w:col>/equalWidth). This makes
      // setColumns a safe PARTIAL update — a preset click no longer wipes a prior line-between, and
      // toggling the separator no longer resets count/equalWidth (003 P2 review #1/#3/#5).
      const structural = hasCount || hasEqual || !!unequal
      if (structural) {
        const input: any = { count: unequal ? 2 : normCount(opts?.count), target: addr }
        if (Number.isFinite(g) && g >= 0) input.gap = g
        if (unequal) input.equalWidth = false
        else if (hasEqual) input.equalWidth = opts!.equalWidth // only set when explicit — don't clobber on a partial call
        else input.equalWidth = true // a plain count change ⇒ equal columns
        if (!mutationOk(sx.setColumns(input))) return false
      }
      // Owned post-write on the body w:cols. If the owned bits were requested but it isn't reachable
      // (paragraph-target / imported / not a single body section), fail honestly — never a silent success
      // (003 P2 review #2).
      const cols = bodyColsEl()
      if (!cols) {
        if (hasLine || unequal) return false
        markDirty(); return true
      }
      cols.attributes = cols.attributes || {}
      if (hasLine) { if (opts!.lineBetween) cols.attributes['w:sep'] = '1'; else delete cols.attributes['w:sep'] }
      if (unequal) {
        const space = Math.round((Number.isFinite(g) && g >= 0 ? g : 0.5) * 1440)
        const usable = Math.max(720, pageTextWidthTwips() - space)
        const narrow = Math.round(usable * 0.305) // Word's Left ≈ 1.83":4.17" of a 6.5" text column
        const wide = usable - narrow
        const w1 = unequal === 'left' ? narrow : wide
        const w2 = unequal === 'left' ? wide : narrow
        cols.attributes['w:num'] = '2'
        cols.attributes['w:equalWidth'] = '0'
        delete cols.attributes['w:space'] // per-column spaces govern instead
        cols.elements = [
          { type: 'element', name: 'w:col', attributes: { 'w:w': String(w1), 'w:space': String(space) } },
          { type: 'element', name: 'w:col', attributes: { 'w:w': String(w2) } },
        ]
      } else if (structural) {
        cols.elements = [] // a structural EQUAL change clears any stale <w:col>; a lineBetween-only toggle preserves them
      }
      markDirty()
      return true
    } catch { return false }
  }

  // { count, gap (inches), equalWidth } from section 0's projection (sections.get → the SectionInfo
  // domain carries `columns`). Drives the dropdown's active preset + the More Columns dialog defaults.
  function getColumns(): { count: number; gap: number; equalWidth: boolean; lineBetween: boolean } {
    const def = { count: 1, gap: 0.5, equalWidth: true, lineBetween: false }
    // line-between is the owned w:sep attr on the body w:cols (not in the public projection).
    const lineBetween = (() => { try { const a = bodyColsEl()?.attributes; return !!(a && (a['w:sep'] === '1' || a['w:sep'] === 'true' || a['w:sep'] === true)) } catch { return false } })()
    try {
      const sx = sectionsApi()
      const addr = firstSectionAddress()
      if (!sx?.get || !addr) return { ...def, lineBetween }
      const info = sx.get({ address: addr })
      const cols = info?.columns
      // An imported <w:cols w:space=".."/> can carry gap/equalWidth with NO w:num (count null) — a
      // count-less w:cols is semantically a single column, but still surface its gap/equalWidth so the
      // More Columns dialog seeds correctly (reviewed 003 P1). Treat null count as 1, don't drop the rest.
      if (cols && (typeof cols.count === 'number' || typeof cols.gap === 'number' || typeof cols.equalWidth === 'boolean')) {
        const count = typeof cols.count === 'number' && cols.count >= 1 ? cols.count : 1
        return { count, gap: typeof cols.gap === 'number' ? cols.gap : 0.5, equalWidth: cols.equalWidth !== false, lineBetween }
      }
      return { ...def, lineBetween }
    } catch { return def }
  }

  return { setColumns, getColumns }
}
