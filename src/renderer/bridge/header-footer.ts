// Phase 4 (item 3) — header/footer TEXT set/read on the PM engine.
//
// WHY a bespoke module (not editor.doc.headerFooters.*): the public Document API
// exposes headerFooters.{list,get,resolve,refs,parts} but NO content-edit verb. The
// only way to mutate header/footer BODY text is the internal STORY RUNTIME:
// resolveHeaderFooterSlotRuntime returns a headless "story" Editor over the
// header/footer OOXML part; we edit that editor, then runtime.commit(host) writes
// word/headerN.xml + materializes the sectPr w:headerReference (+ rel + content-type
// auto-register). Word reads it back as Sections(1).Headers(1).Range.Text — the
// on-page visual band is the only keystone-gated part and is OUT of this slice.
//
// VERIFIED FORK FACTS (do NOT swap to the obvious-looking call):
//  - There is NO `commands.setContent` in this fork. Replace content via selectAll +
//    insertContent(text, {contentType:'text'}) (one auto-escaped <p>; empty => clear).
//  - There is NO `editor.getText()`. Reads walk state.doc.textBetween(...).
//  - The story editor is a full Editor (createStoryEditor) — has .commands/.state/.destroy.
//  - runtime.commit takes the HOST editor as its arg (buildSlotCommit signature).
//  - runtime.dispose?.() destroys the headless editor (owned runtimes only; live
//    sub-editors have no dispose — the ?.() guard handles both).
//  - editor.doc / editor.converter are read FRESH each call (reset on Open/New).
// @ts-ignore — vendored fork barrel; the '@' app alias = src/renderer (matches only
// when followed by '/', so it never shadows '@core'). document-api-adapters is a
// sibling of core/ under superdoc-fork, so '@core' cannot reach it.
import { resolveHeaderFooterSlotRuntime } from '@/core/superdoc-fork/document-api-adapters/story-runtime/index.js'

type AnyEditor = any
type AnyRuntime = any
type HFKind = 'header' | 'footer'

export function installHeaderFooter(editor: AnyEditor) {
  const w = window as any
  // Refocus the body after a programmatic/modal set — but NOT when an on-page header/footer
  // session is active: setSlotText then targets the live band sub-editor, and focusing the body
  // here would yank focus out of the band the user is editing (002 P1 review #3).
  const refocus = () => {
    try { if (w.WC?.presentation?.getActiveStoryLocator?.()?.storyType === 'headerFooterPart') return } catch { /* fall through to body focus */ }
    try { editor.view?.focus() } catch { /* no view */ }
  }
  const markDirty = () => { try { w.WC?.PM?.markDirty?.() } catch { /* none */ } }
  const converter = (): any => { try { return editor.converter } catch { return null } }
  const docApi = (): any => { try { return editor.doc } catch { return null } }

  // Section N's address ({ kind:'section', sectionId }) for the slot locator — from
  // the public sections discovery (items[].address IS a SectionAddress). v1 is
  // single-section so callers pass 0; the index param keeps the seam multi-section
  // ready without a later signature churn.
  function sectionAddressAt(index: number): { kind: 'section'; sectionId: string } | null {
    try {
      const items = docApi()?.sections?.list?.()?.items
      // Out-of-bounds index ⇒ undefined ⇒ null (fail-safe): a missing section must surface as
      // ''/false, NOT a silent read/write of section 0. (No items[0] fallback — that would mask
      // a bad section index as a wrong-section hit; reviewed 002 P2.)
      const item = Array.isArray(items) ? items[index] : null
      const addr = item?.address
      if (addr && typeof addr.sectionId === 'string' && addr.sectionId.length > 0) return addr
    } catch { /* fall through */ }
    return null
  }
  const firstSectionAddress = () => sectionAddressAt(0)

  // P2 (002): a header/footer slot is (kind, variant, section). variant ∈ default|first|even
  // = Word's Primary/FirstPage/EvenPages (default ≈ primary/odd); section defaults to 0
  // (single-section v1). No `opts` ⇒ {variant:'default', section:0} = exact P1 behaviour.
  type HFVariant = 'default' | 'first' | 'even'
  interface HFOpts { variant?: HFVariant; section?: number }
  const VARIANTS: readonly HFVariant[] = ['default', 'first', 'even']
  const normVariant = (v: unknown): HFVariant => (VARIANTS.indexOf(v as HFVariant) >= 0 ? (v as HFVariant) : 'default')
  const normSection = (s: unknown): number => { const n = Number(s); return Number.isInteger(n) && n >= 0 ? n : 0 }

  // HeaderFooterSlotStoryLocator (story-types.ts): kind:'story' + storyType + section +
  // headerFooterKind + variant + resolution/onWrite. WRITE resolves 'effective' then
  // materializeIfInherited (creates the variant's LOCAL part). READ uses 'explicit' for
  // first/even so a variant read returns ONLY that variant's part (no inheritance bleed to
  // the primary) — 'default' keeps 'effective' (P1 back-compat: the primary IS the base).
  function slotLocator(kind: HFKind, variant: HFVariant, sectionIndex: number, intent: 'read' | 'write'): any {
    const section = sectionAddressAt(sectionIndex)
    if (!section) return null
    const resolution = intent === 'read' && variant !== 'default' ? 'explicit' : 'effective'
    return { kind: 'story', storyType: 'headerFooterSlot', section, headerFooterKind: kind, variant, resolution, onWrite: 'materializeIfInherited' }
  }

  // Resolve the slot for WRITE (materializes a local part if inherited/missing),
  // replace the story editor's content with one paragraph of `text` (empty =>
  // cleared), commit the OOXML part + sectPr ref, then dispose. Returns true on commit.
  function setSlotText(kind: HFKind, text: string, opts?: HFOpts): boolean {
    const locator = slotLocator(kind, normVariant(opts?.variant), normSection(opts?.section), 'write')
    if (!locator) return false
    const value = typeof text === 'string' ? text : String(text ?? '')
    let runtime: AnyRuntime = null
    try {
      runtime = resolveHeaderFooterSlotRuntime(editor, locator, { intent: 'write' })
      const story = runtime?.editor
      if (!story) return false
      // NB: do NOT setEditable(true) here — programmatic command dispatch updates state
      // regardless of editability (no filterTransaction gates plain text), and on the LIVE
      // sub-editor branch (a mounted on-screen band) flipping editable would leak a
      // read-only band into user-editable with no restore. Headless writes need nothing.
      story.commands.selectAll()
      const ok = story.commands.insertContent(value, { contentType: 'text' })
      if (ok === false) return false
      runtime.commit(editor) // HOST editor is the commit arg (buildSlotCommit)
      const conv = converter()
      if (conv) conv.headerFooterModified = true
      markDirty()
      refocus()
      return true
    } catch {
      return false
    } finally {
      try { runtime?.dispose?.() } catch { /* already destroyed / live editor */ }
    }
  }

  // Resolve the slot for READ and extract plain text. Returns '' when no
  // header/footer exists (the runtime throws STORY_NOT_FOUND — caught here).
  function getSlotText(kind: HFKind, opts?: HFOpts): string {
    const locator = slotLocator(kind, normVariant(opts?.variant), normSection(opts?.section), 'read')
    if (!locator) return ''
    let runtime: AnyRuntime = null
    try {
      runtime = resolveHeaderFooterSlotRuntime(editor, locator, { intent: 'read' })
      const doc = runtime?.editor?.state?.doc
      if (!doc) return ''
      const out = doc.textBetween(0, doc.content.size, '\n', '\n')
      return typeof out === 'string' ? out : ''
    } catch {
      return ''
    } finally {
      try { runtime?.dispose?.() } catch { /* already destroyed / live editor */ }
    }
  }

  const setHeaderText = (text: string, opts?: HFOpts): boolean => setSlotText('header', text, opts)
  const setFooterText = (text: string, opts?: HFOpts): boolean => setSlotText('footer', text, opts)
  const getHeaderText = (opts?: HFOpts): string => getSlotText('header', opts)
  const getFooterText = (opts?: HFOpts): string => getSlotText('footer', opts)

  // ─── P2 (002): section header/footer structure options ───────────────────────────────────
  // Different First Page = sectPr/titlePg (sections.setTitlePage); Different Odd & Even =
  // settings/evenAndOddHeaders (sections.setOddEvenHeadersFooters). Both are public Document-API
  // adapters (no fork edit); the variant CONTENT itself is materialized by setHeaderText/-Footer
  // with opts.variant 'first'/'even'. A NO_OP result (already in the requested state) counts as
  // success — these are idempotent toggles. setTitlePage requires `target` (a SectionAddress);
  // setOddEvenHeadersFooters is a document-settings mutation (no target).
  const sectionsApi = (): any => { try { return docApi()?.sections } catch { return null } }
  const mutationOk = (res: any): boolean => res?.success === true || res?.failure?.code === 'NO_OP'

  function setDifferentFirstPage(on: boolean): boolean {
    try {
      const sx = sectionsApi()
      const addr = firstSectionAddress()
      if (!sx?.setTitlePage || !addr) return false
      const ok = mutationOk(sx.setTitlePage({ enabled: !!on, target: addr }))
      if (ok) markDirty()
      return ok
    } catch { return false }
  }

  function setDifferentOddEven(on: boolean): boolean {
    try {
      const sx = sectionsApi()
      if (!sx?.setOddEvenHeadersFooters) return false
      const ok = mutationOk(sx.setOddEvenHeadersFooters({ enabled: !!on }))
      if (ok) markDirty()
      return ok
    } catch { return false }
  }

  // { differentFirstPage, differentOddEven } from section 0's projection — sections.get returns
  // the SectionInfo domain (carries titlePage + oddEvenHeadersFooters; odd/even is a
  // document-level setting projected onto every section). Drives the contextual-tab toggles.
  function getHeaderFooterOptions(): { differentFirstPage: boolean; differentOddEven: boolean } {
    const off = { differentFirstPage: false, differentOddEven: false }
    try {
      const sx = sectionsApi()
      const addr = firstSectionAddress()
      if (!sx?.get || !addr) return off
      const info = sx.get({ address: addr })
      return { differentFirstPage: !!info?.titlePage, differentOddEven: !!info?.oddEvenHeadersFooters }
    } catch { return off }
  }

  // ─── P3 (002): real OOXML PAGE field in a header/footer ──────────────────────────────────
  // `story.doc.fields.insert({ at, instruction:'PAGE', mode:'raw' })` emits a REAL Word field
  // (fldChar/instrText), NOT static text — the same Document-API verb insert-exotica.ts uses for
  // DATE/PAGE on the body, run here on the SLOT STORY editor so the field lands in
  // word/headerN.xml / footerN.xml. The story editor is created with `isHeaderOrFooter:true`
  // (story-editor-factory.ts) which enables per-page PAGE-field resolution → each painted page
  // shows its own number. No fork edit.
  type PageNumPos = 'top' | 'bottom' | 'current'
  function regionForPosition(position: PageNumPos): HFKind {
    if (position === 'top') return 'header'
    if (position === 'bottom') return 'footer'
    return lastMode === 'header' ? 'header' : 'footer' // 'current' = active region, else footer (Word's default)
  }

  // Resolve a fields.insert target on a STORY editor; if the selection's textblock lacks a stable
  // sdBlockId (the K-risk-1 hazard — a freshly-materialized empty part's paragraph defaults to
  // sdBlockId:null → selection.current().target is null), mint one and retry. Mirrors insert-exotica.ts
  // / references.ts, but HEADLESS-SAFE: the story editor has no view, so dispatch through the command
  // (not editor.view.dispatch). setNodeMarkup keeps the node size, so the collapsed selection stays valid.
  function ensureInlineTarget(story: AnyEditor): any {
    const read = (): any => { try { return story.doc?.selection?.current?.({})?.target ?? null } catch { return null } }
    const at = read()
    if (at) return at
    try {
      story.commands?.command?.(({ tr, state, dispatch }: any) => {
        const { from } = state.selection
        const $pos = state.doc.resolve(from)
        let depth = $pos.depth
        while (depth > 0 && !$pos.node(depth).isTextblock) depth--
        const node = $pos.node(depth)
        if (!node || !node.isTextblock) return false
        const a = (node.attrs ?? {}) as Record<string, unknown>
        if (a.sdBlockId || a.id || a.blockId) return false
        if (!('sdBlockId' in (node.type.spec.attrs ?? {}))) return false
        const minted = 'wc-pn-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
        if (dispatch) dispatch(tr.setNodeMarkup($pos.before(depth), undefined, { ...node.attrs, sdBlockId: minted }))
        return true
      })
    } catch { /* mint best-effort */ }
    return read()
  }

  function insertPageNumber(opts?: { position?: PageNumPos; variant?: HFVariant; section?: number }): boolean {
    const pos = opts?.position
    const position: PageNumPos = (pos === 'top' || pos === 'bottom' || pos === 'current') ? pos : 'bottom'
    const locator = slotLocator(regionForPosition(position), normVariant(opts?.variant), normSection(opts?.section), 'write')
    if (!locator) return false
    let runtime: AnyRuntime = null
    try {
      runtime = resolveHeaderFooterSlotRuntime(editor, locator, { intent: 'write' })
      const story = runtime?.editor
      if (!story?.doc?.fields?.insert) return false
      // Word's gallery replaces the band content with the page-number field — clear then insert.
      story.commands.selectAll()
      if (story.commands.deleteSelection) story.commands.deleteSelection()
      const at = ensureInlineTarget(story) // mint an sdBlockId if the cleared para has none (K-risk-1)
      if (!at) return false
      const r = story.doc.fields.insert({ at, instruction: 'PAGE', mode: 'raw' })
      if (r && r.success === false) return false
      runtime.commit(editor)
      const conv = converter(); if (conv) conv.headerFooterModified = true
      markDirty(); refocus()
      return true
    } catch {
      return false
    } finally {
      try { runtime?.dispose?.() } catch { /* already destroyed / live editor */ }
    }
  }

  // True iff the slot currently holds a PAGE field node (instruction contains PAGE). Lets
  // removePageNumbers clear ONLY page-number bands — it never wipes an unrelated header title.
  function slotHasPageField(kind: HFKind, variant: HFVariant, section: number): boolean {
    const locator = slotLocator(kind, variant, section, 'read')
    if (!locator) return false
    let runtime: AnyRuntime = null
    try {
      runtime = resolveHeaderFooterSlotRuntime(editor, locator, { intent: 'read' })
      const doc = runtime?.editor?.state?.doc
      if (!doc) return false
      let found = false
      doc.descendants((node: any) => {
        if (found) return false
        const instr = node?.attrs?.instruction
        if (typeof instr === 'string' && /\bPAGE\b/i.test(instr)) { found = true; return false }
        return true
      })
      return found
    } catch {
      return false
    } finally {
      try { runtime?.dispose?.() } catch { /* already destroyed / live editor */ }
    }
  }

  // Remove page numbers by clearing the band(s) that hold a PAGE field. v1 page-number slots hold
  // just the field, so a clear == "remove the PAGE field"; the slotHasPageField guard keeps a band
  // with other content (e.g. a header title) untouched. `position` narrows to one band; default both.
  function removePageNumbers(opts?: { position?: PageNumPos; variant?: HFVariant; section?: number }): boolean {
    const pos = opts?.position
    const kinds: HFKind[] = pos === 'top' ? ['header'] : pos === 'bottom' ? ['footer']
      : pos === 'current' ? [regionForPosition('current')] : ['header', 'footer']
    const variant = normVariant(opts?.variant)
    const section = normSection(opts?.section)
    let any = false
    for (const kind of kinds) {
      if (slotHasPageField(kind, variant, section) && setSlotText(kind, '', { variant, section })) any = true
    }
    return any
  }

  // ─── P1 (002): on-page enter/exit/state for the "Header & Footer Tools" tab ──────────────
  // The paged PresentationEditor already PAINTS per-page header/footer bands (.superdoc-page-
  // header / -footer) and supports double-click-to-edit; entry/exit/state are driven through
  // its PUBLIC surface (no fork edit — spike-verified, specs/002-headers-footers/research.md):
  //  - enter  = materialize the part if the band isn't painted yet (so there's something to
  //             click), then synthesize the double-click the PE already handles on that band;
  //  - close  = presentation.exitActiveStorySurface();
  //  - state  = presentation.getActiveStoryLocator() (storyType 'headerFooterPart' ⇒ active) +
  //             the 'headerFooterModeChanged' event ('header'/'footer'/'body') for the region.
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
  const presentation = (): any => { try { return w.WC?.presentation } catch { return null } }

  // Track the active region from the PE event (drives the region + the contextual-tab signal).
  let lastMode: 'header' | 'footer' | 'body' = 'body'
  try {
    const pres = presentation()
    if (pres?.on && !pres.__wcHfModeWired) {
      pres.__wcHfModeWired = true
      pres.on('headerFooterModeChanged', (e: any) => {
        const m = (e && (e.mode ?? e.region)) as string
        if (m === 'header' || m === 'footer' || m === 'body') {
          lastMode = m
          try { window.dispatchEvent(new CustomEvent('wc:hf-mode', { detail: { mode: m } })) } catch { /* signal best-effort */ }
        }
      })
    }
  } catch { /* event wiring best-effort */ }

  const bandEl = (kind: HFKind): HTMLElement | null =>
    document.querySelector<HTMLElement>('.superdoc-page-' + kind)

  // Replay the exact pointer sequence the PE's input manager treats as a header/footer double-
  // click (two click cycles + dblclick; the second cycle carries detail:2). Spike-verified.
  function synthDoubleClick(el: HTMLElement): void {
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + Math.max(2, Math.min(r.height / 2, 8))
    const base = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, view: window, button: 0 }
    const fire = (type: string, Ctor: any, extra: any) => { try { el.dispatchEvent(new Ctor(type, { ...base, ...extra })) } catch { /* event ctor guard */ } }
    const pd = { pointerId: 1, pointerType: 'mouse', isPrimary: true }
    fire('pointerdown', PointerEvent, pd); fire('mousedown', MouseEvent, { detail: 1 })
    fire('pointerup', PointerEvent, pd); fire('mouseup', MouseEvent, { detail: 1 }); fire('click', MouseEvent, { detail: 1 })
    fire('pointerdown', PointerEvent, pd); fire('mousedown', MouseEvent, { detail: 2 })
    fire('pointerup', PointerEvent, pd); fire('mouseup', MouseEvent, { detail: 2 }); fire('click', MouseEvent, { detail: 2 }); fire('dblclick', MouseEvent, { detail: 2 })
  }

  const isActiveHF = (): boolean => {
    try { const loc = presentation()?.getActiveStoryLocator?.(); return !!(loc && loc.storyType === 'headerFooterPart') } catch { return false }
  }

  // Enter on-page editing of the header/footer region (the PE paints the bands).
  async function enterHeaderFooter(kind: HFKind): Promise<boolean> {
    const pres = presentation()
    if (!pres) return false
    if (kind !== 'header' && kind !== 'footer') return false
    try {
      if (isActiveHF() && lastMode === kind) return true // already editing this region
      if (!bandEl(kind)) {
        // The band isn't painted. Two cases: (a) no part exists anywhere → materialize an EMPTY part
        // so a band paints; (b) a part EXISTS with content but hasn't repainted yet (e.g. the rAF gap
        // right after a paged Open) → must NOT write, that would clobber it — just wait for the paint.
        // getSlotText is a non-destructive read; '' ⟹ nothing to lose, so the materialize only runs
        // when there is genuinely no content to clobber (002 P1 review #2, fixes the open-race wipe).
        if (!getSlotText(kind)) setSlotText(kind, '')
        for (let i = 0; i < 25 && !bandEl(kind); i++) await sleep(40)
      }
      let el = bandEl(kind)
      if (!el) return false
      // The synthesized double-click derives its coords from the band's on-screen rect, so the band
      // MUST be in the viewport or the PE's coordinate hit-test misses (off-screen → no page detected
      // → un-centered X → region null → entry fails, or — switching region with a session already
      // active — falls through to exitMode and kicks the user out). Scroll it in first (review #1).
      try { el.scrollIntoView({ block: 'center', inline: 'nearest' }) } catch { /* best-effort */ }
      await sleep(60)
      el = bandEl(kind) || el
      synthDoubleClick(el)
      for (let i = 0; i < 25; i++) { if (isActiveHF() && lastMode === kind) return true; await sleep(40) }
      return false
    } catch { return false }
  }

  // Exit any active header/footer (or other story) editing surface → back to the body.
  function closeHeaderFooter(): boolean {
    try { presentation()?.exitActiveStorySurface?.(); return true } catch { return false }
  }

  // For the contextual-tab activation signal: { active, region? }.
  function headerFooterState(): { active: boolean; region?: HFKind } {
    if (!isActiveHF()) return { active: false }
    return { active: true, region: lastMode === 'footer' ? 'footer' : 'header' }
  }

  return {
    setHeaderText, setFooterText, getHeaderText, getFooterText,
    enterHeaderFooter, closeHeaderFooter, headerFooterState,
    setDifferentFirstPage, setDifferentOddEven, getHeaderFooterOptions,
    insertPageNumber, removePageNumbers,
  }
}
