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
  const refocus = () => { try { editor.view?.focus() } catch { /* no view */ } }
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

  return { setHeaderText, setFooterText, getHeaderText, getFooterText }
}
