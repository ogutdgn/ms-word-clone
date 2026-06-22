// 004 (Line Numbers) — section line numbering on the PM/paged engine.
//
// Line numbering lives in the section's sectPr/w:lnNumType. The fork's PUBLIC Document API
// editor.doc.sections.setLineNumbering({ enabled, countBy, start, distance, restart, target }) writes it
// (feasibility-probed 2026-06-22: setLineNumbering({enabled:true,countBy:1,restart:'continuous'}) →
// export <w:lnNumType w:countBy="1" w:restart="continuous"/> + sections.get().lineNumbering reads it
// back). The paged PresentationEditor does NOT paint the margin numbers — the in-app render is an owned
// overlay (P2). No fork edit; the WC.PM bridge is the only doc-write path; the model stays page-free
// (w:lnNumType is a sectPr property). `distance` is in INCHES (the adapter converts to twips).
type AnyEditor = any

type Mode = 'none' | 'continuous' | 'newPage' | 'newSection'

export function installLineNumbers(editor: AnyEditor) {
  const w = window as any
  const markDirty = () => { try { w.WC?.PM?.markDirty?.() } catch { /* none */ } }
  const sectionsApi = (): any => { try { return editor.doc?.sections } catch { return null } }
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

  // restart ∈ {continuous, newPage, newSection} (LINE_NUMBER_RESTART_VALUES); anything else ⇒ off.
  const normMode = (m: unknown): Mode => (m === 'continuous' || m === 'newPage' || m === 'newSection' || m === 'none') ? m : 'none'

  type LnOpts = { mode: Mode; countBy?: number; start?: number; distance?: number }

  // Apply line numbering to section 0. mode:'none' ⇒ enabled:false (drops w:lnNumType, no section
  // corruption); any other mode ⇒ enabled:true + restart + optional countBy/start/distance(inches).
  // NO_OP counts as success. Idempotent.
  function setLineNumbers(opts: LnOpts): boolean {
    try {
      const sx = sectionsApi()
      const addr = firstSectionAddress()
      if (!sx?.setLineNumbering || !addr) return false
      const mode = normMode(opts?.mode)
      const input: any = { enabled: mode !== 'none', target: addr }
      if (mode !== 'none') {
        input.restart = mode
        const cb = Math.round(Number(opts?.countBy)); if (Number.isFinite(cb) && cb >= 1) input.countBy = cb
        const st = Math.round(Number(opts?.start)); if (Number.isFinite(st) && st >= 1) input.start = st
        const d = Number(opts?.distance); if (Number.isFinite(d) && d >= 0) input.distance = d
      }
      if (!mutationOk(sx.setLineNumbering(input))) return false
      markDirty()
      return true
    } catch { return false }
  }

  // { active, mode, countBy, start, distance } from section 0's projection
  // (sections.get → SectionDomain.lineNumbering). Drives the dropdown's active preset + Options defaults.
  // An enabled lnNumType with no explicit restart is Continuous (Word's default), so map absent ⇒ continuous.
  function getLineNumbers(): { active: boolean; mode: Mode; countBy: number; start: number; distance: number } {
    const def = { active: false, mode: 'none' as Mode, countBy: 1, start: 1, distance: 0.25 }
    try {
      const sx = sectionsApi()
      const addr = firstSectionAddress()
      if (!sx?.get || !addr) return def
      const ln = sx.get({ address: addr })?.lineNumbering
      if (!ln || ln.enabled !== true) return def
      const m = normMode(ln.restart)
      return {
        active: true,
        mode: m === 'none' ? 'continuous' : m,
        countBy: typeof ln.countBy === 'number' && ln.countBy >= 1 ? ln.countBy : 1,
        start: typeof ln.start === 'number' && ln.start >= 1 ? ln.start : 1,
        distance: typeof ln.distance === 'number' && ln.distance >= 0 ? ln.distance : 0.25,
      }
    } catch { return def }
  }

  return { setLineNumbers, getLineNumbers }
}
