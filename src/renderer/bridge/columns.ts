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

  // Apply an N-column layout to section 0. count:1 normalizes to a single column. gap in inches
  // (default left to Word/the adapter when omitted). equalWidth defaults true (the One/Two/Three case).
  // A NO_OP (already in that state) counts as success — idempotent.
  function setColumns(opts: { count: number; gap?: number; equalWidth?: boolean }): boolean {
    try {
      const sx = sectionsApi()
      const addr = firstSectionAddress()
      if (!sx?.setColumns || !addr) return false
      const input: any = { count: normCount(opts?.count), target: addr }
      const g = Number(opts?.gap)
      if (Number.isFinite(g) && g >= 0) input.gap = g
      input.equalWidth = typeof opts?.equalWidth === 'boolean' ? opts.equalWidth : true
      const ok = mutationOk(sx.setColumns(input))
      if (ok) markDirty()
      return ok
    } catch { return false }
  }

  // { count, gap (inches), equalWidth } from section 0's projection (sections.get → the SectionInfo
  // domain carries `columns`). Drives the dropdown's active preset + the More Columns dialog defaults.
  function getColumns(): { count: number; gap: number; equalWidth: boolean } {
    const def = { count: 1, gap: 0.5, equalWidth: true }
    try {
      const sx = sectionsApi()
      const addr = firstSectionAddress()
      if (!sx?.get || !addr) return def
      const info = sx.get({ address: addr })
      const cols = info?.columns
      // An imported <w:cols w:space=".."/> can carry gap/equalWidth with NO w:num (count null) — a
      // count-less w:cols is semantically a single column, but still surface its gap/equalWidth so the
      // More Columns dialog seeds correctly (reviewed 003 P1). Treat null count as 1, don't drop the rest.
      if (cols && (typeof cols.count === 'number' || typeof cols.gap === 'number' || typeof cols.equalWidth === 'boolean')) {
        const count = typeof cols.count === 'number' && cols.count >= 1 ? cols.count : 1
        return { count, gap: typeof cols.gap === 'number' ? cols.gap : 0.5, equalWidth: cols.equalWidth !== false }
      }
      return def
    } catch { return def }
  }

  return { setColumns, getColumns }
}
