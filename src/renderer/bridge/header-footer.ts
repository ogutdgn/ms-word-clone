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

  // Section 0's address ({ kind:'section', sectionId }) for the slot locator —
  // from the public sections discovery (items[].address IS a SectionAddress).
  function firstSectionAddress(): { kind: 'section'; sectionId: string } | null {
    try {
      const d = docApi()
      const first = d?.sections?.list?.()?.items?.[0]
      const addr = first?.address
      if (addr && typeof addr.sectionId === 'string' && addr.sectionId.length > 0) return addr
    } catch { /* fall through */ }
    return null
  }

  // HeaderFooterSlotStoryLocator (story.types.ts): kind:'story' + storyType +
  // section + headerFooterKind + variant (+ resolution/onWrite defaults).
  function slotLocator(kind: HFKind): any {
    const section = firstSectionAddress()
    if (!section) return null
    return {
      kind: 'story',
      storyType: 'headerFooterSlot',
      section,
      headerFooterKind: kind,
      variant: 'default',
      resolution: 'effective',
      onWrite: 'materializeIfInherited',
    }
  }

  // Resolve the slot for WRITE (materializes a local part if inherited/missing),
  // replace the story editor's content with one paragraph of `text` (empty =>
  // cleared), commit the OOXML part + sectPr ref, then dispose. Returns true on commit.
  function setSlotText(kind: HFKind, text: string): boolean {
    const locator = slotLocator(kind)
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
  function getSlotText(kind: HFKind): string {
    const locator = slotLocator(kind)
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

  const setHeaderText = (text: string): boolean => setSlotText('header', text)
  const setFooterText = (text: string): boolean => setSlotText('footer', text)
  const getHeaderText = (): string => getSlotText('header')
  const getFooterText = (): string => getSlotText('footer')

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

  // Enter on-page editing of the header/footer region. Paged-only (the PE paints the bands);
  // returns false in overlay so the caller can keep the plain-text modal fallback.
  async function enterHeaderFooter(kind: HFKind): Promise<boolean> {
    const pres = presentation()
    if (!pres || w.__WC_LAYOUT_MODE !== 'paged') return false
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

  return { setHeaderText, setFooterText, getHeaderText, getFooterText, enterHeaderFooter, closeHeaderFooter, headerFooterState }
}
