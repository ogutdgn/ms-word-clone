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

  type LnOpts = { mode: Mode; countBy?: number; start?: number; distance?: number; replace?: boolean }

  // Apply line numbering to section 0. mode:'none' ⇒ enabled:false (drops w:lnNumType, no section
  // corruption); any other mode ⇒ enabled:true + restart + optional countBy/start/distance(inches).
  // NO_OP counts as success. Idempotent.
  //
  // `start` is USER-FACING (the displayed StartingNumber == what Word shows / the user typed). Word reads
  // raw `w:start` off-by-one (P1 discovery: raw w:start=3 → Word StartingNumber=4), so we write raw =
  // userStart − 1 and OMIT it for userStart ≤ 1 (Word defaults StartingNumber to 1; avoids an odd w:start=0).
  // Encapsulating the −1 here keeps BOTH the Options dialog AND the overlay in user-facing numbers (SC-003).
  // `distance` is INCHES, written by the adapter only when provided (the dialog sends it only when set).
  //
  // `replace` ⇒ a FULL-SET apply (the Options dialog): drop any existing lnNumType FIRST so OMITTED attrs are
  // CLEARED (a start lowered to ≤1, or distance returned to Auto). setLineNumbering is a PARTIAL update that
  // only WRITES, never clears — so without this a stale w:start/w:distance from a prior apply would linger and
  // Word would read the OLD value. A plain mode switch (the dropdown) omits `replace` and stays partial
  // (preserves count-by/start/distance across a restart-mode change, exactly as Word does).
  function setLineNumbers(opts: LnOpts): boolean {
    try {
      const sx = sectionsApi()
      const addr = firstSectionAddress()
      if (!sx?.setLineNumbering || !addr) return false
      const mode = normMode(opts?.mode)
      if (mode === 'none') {
        if (!mutationOk(sx.setLineNumbering({ enabled: false, target: addr }))) return false
        markDirty()
        return true
      }
      if (opts?.replace === true) { try { sx.setLineNumbering({ enabled: false, target: addr }) } catch { /* best-effort clear of the stale lnNumType */ } }
      const input: any = { enabled: true, target: addr, restart: mode }
      const cb = Math.round(Number(opts?.countBy)); if (Number.isFinite(cb) && cb >= 1) input.countBy = cb
      const st = Math.round(Number(opts?.start)); if (Number.isFinite(st) && st >= 2) input.start = st - 1 // off-by-one; ≤1 ⇒ omit (fresh node after replace ⇒ Word default StartingNumber=1)
      const d = Number(opts?.distance); if (Number.isFinite(d) && d >= 0) input.distance = d
      if (!mutationOk(sx.setLineNumbering(input))) return false
      markDirty()
      return true
    } catch { return false }
  }

  // { active, mode, countBy, start, distance, distanceExplicit } from section 0's projection
  // (sections.get → SectionDomain.lineNumbering). Drives the dropdown's active preset + Options defaults.
  // An enabled lnNumType with no explicit restart is Continuous (Word's default), so map absent ⇒ continuous.
  // `start` is inverted to USER-FACING (rawStart + 1; default 1). `distanceExplicit` is true only when the
  // section actually carries a w:distance — the Options dialog uses it to seed "Auto" vs a number, so it never
  // replays the synthesized 0.25 default back as an explicit w:distance Word never had.
  function getLineNumbers(): { active: boolean; mode: Mode; countBy: number; start: number; distance: number; distanceExplicit: boolean } {
    const def = { active: false, mode: 'none' as Mode, countBy: 1, start: 1, distance: 0.25, distanceExplicit: false }
    try {
      const sx = sectionsApi()
      const addr = firstSectionAddress()
      if (!sx?.get || !addr) return def
      const ln = sx.get({ address: addr })?.lineNumbering
      if (!ln || ln.enabled !== true) return def
      const m = normMode(ln.restart)
      const rawStart = (typeof ln.start === 'number' && ln.start >= 1) ? ln.start : 0
      const distExplicit = Number.isFinite(ln.distance) && (ln.distance as number) >= 0
      return {
        active: true,
        mode: m === 'none' ? 'continuous' : m,
        countBy: typeof ln.countBy === 'number' && ln.countBy >= 1 ? ln.countBy : 1,
        start: rawStart + 1, // raw ⇒ user-facing (Word's StartingNumber)
        distance: distExplicit ? (ln.distance as number) : 0.25,
        distanceExplicit: distExplicit,
      }
    } catch { return def }
  }

  // The current paragraph node from the live selection (walk depth → the enclosing paragraph). v1: the caret's
  // paragraph; a multi-paragraph selection still has $from in its first paragraph for the read.
  function currentParagraphNode(): any {
    try {
      const $from = editor?.state?.selection?.$from
      if (!$from) return null
      for (let d = $from.depth; d >= 0; d--) { const n = $from.node(d); if (n?.type?.name === 'paragraph') return n }
    } catch { /* none */ }
    return null
  }

  // Is the current paragraph flagged w:suppressLineNumbers? (drives the dropdown's ✓ + the toggle.)
  function currentParagraphSuppressed(): boolean {
    return currentParagraphNode()?.attrs?.paragraphProperties?.suppressLineNumbers === true
  }

  // Set / clear / toggle pPr/w:suppressLineNumbers on the CURRENT paragraph(s) via the fork's existing
  // updateAttributes command + dot-notation merge into the rendered:false paragraphProperties bag (the V3 pPr
  // exporter emits <w:suppressLineNumbers/>). NO fork edit — the same no-fork paragraph-pPr write the repo uses
  // for shading/borders/spacing. `true` ⇒ set; `null` ⇒ CLEAN-REMOVE the element (vs false ⇒ explicit w:val="0").
  // on omitted ⇒ toggle off the current paragraph's state.
  function suppressLineNumbers(on?: boolean): boolean {
    try {
      const cmd = editor?.commands
      if (typeof cmd?.updateAttributes !== 'function') return false
      const next = (on === undefined) ? !currentParagraphSuppressed() : (on === true)
      const ok = cmd.updateAttributes('paragraph', { 'paragraphProperties.suppressLineNumbers': next ? true : null })
      if (ok) markDirty()
      return ok === true
    } catch { return false }
  }

  return { setLineNumbers, getLineNumbers, suppressLineNumbers, currentParagraphSuppressed }
}
