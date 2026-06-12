// Slice 9: references surface — TOC, footnotes/endnotes, captions, citations/
// bibliography, index, table of authorities, cross-references, and outline level
// on the PM engine. Plan: docs/superpowers/plans/2026-06-12-phase2-slice-9-references.md
// (§0 ground-truth, §1 D9.x, §3 K-risks K1/K2).
//
// EVERY verb is a thin call into the SuperDoc Document API (editor.doc.*) — the
// SAME path slice-8 comments used so the constructs EXPORT (footnotes.xml /
// customXml <b:Sources> / TOC + SEQ field codes survive Word's resave). Like
// review.ts, this module closes over the `editor` param and reads `editor.doc`
// FRESH at every call site (K2: editor.doc is a cached DocumentApi that is reset
// to null on Open/New/destroy — Editor.ts:4232,4417 — so a hoisted reference goes
// stale after replaceEditor). installBridge re-runs installReferences on every
// replaceEditor, rebinding the closures to the new editor.
//
// SELECTION → ADDRESS (the crux, K-risk #1). The inline inserts (footnote,
// endnote, citation, crossRef, index entry, authority entry, raw field) all take
// `at: TextTarget` and resolve it via resolveInlineInsertPosition → resolveTextTarget
// → findBlockById, which keys on the block's stable id. editor.doc.selection.current({})
// projects the live caret into a TextTarget, but ONLY when the caret's textblock
// carries a stable id (sdBlockId / id / blockId — selection-info-resolver.readBlockId).
// A freshly seeded/created paragraph has sdBlockId:null by default (paragraph.js:154;
// the importer mints ids, but insertContent does not), so selection.current().target
// comes back NULL. inlineTarget() handles that: if the projection is null it MINTS an
// sdBlockId on the caret's textblock (setNodeMarkup) — which both the selection resolver
// (reads sdBlockId) AND findBlockById (registers sdBlockId as an alias for paragraph/
// heading/listItem — node-address-resolver.ts:309-316) then resolve — and re-projects.
// Degrade honestly to null when there is genuinely no addressable textblock at the caret.

import { TextSelection } from '@/pm'

type AnyEditor = any

// editor.doc.* mutation wrappers return { success: boolean, ... } | throw. Normalize
// to a strict boolean and NEVER let a throw escape (degrade honestly — no toast).
function ok(result: unknown): boolean {
  return !!(result && (result as any).success === true)
}

export function installReferences(editor: AnyEditor) {
  // Restore PM focus after each verb (same invariant as commands.ts/review.ts §7.4).
  const refocus = () => editor.view?.focus()

  // Read the live DocumentApi FRESH (K2 — never hoist). editor.doc is lazily built
  // and reset on Open/New; closing over `editor` (rebound by installBridge per
  // replaceEditor) keeps this pointing at the live instance.
  const docApi = (): any => {
    try { return editor.doc } catch { return null }
  }

  // ---- selection → TextTarget for inline inserts (the K-risk #1 mapping) ----
  // Returns a valid TextTarget for the current caret/selection, minting a block id
  // on the caret's textblock when the live projection is null. null = no addressable
  // textblock (the verb must then degrade honestly).
  function inlineTarget(): any | null {
    const d = docApi()
    if (!d) return null
    // 1. The happy path: the caret block already carries a stable id.
    try {
      const t = d.selection.current({})?.target
      if (t) return t
    } catch { /* fall through to the mint path */ }
    // 2. The caret block lacks a stable id (sdBlockId:null on a seeded paragraph).
    //    Mint one on the enclosing textblock so the resolver can address it, then
    //    re-project. Climb to the textblock ancestor (the caret's immediate parent
    //    is the fork's inline `run` wrapper, not the block — review.ts precedent).
    try {
      const { from } = editor.state.selection
      const $pos = editor.state.doc.resolve(from)
      let depth = $pos.depth
      while (depth > 0 && !$pos.node(depth).isTextblock) depth--
      const node = $pos.node(depth)
      if (!node || !node.isTextblock) return null
      const attrs = (node.attrs ?? {}) as Record<string, unknown>
      const existing = attrs.sdBlockId ?? attrs.id ?? attrs.blockId
      if (!(typeof existing === 'string' && existing.length > 0)) {
        // Only paragraph-family blocks carry sdBlockId in the schema; guard anyway.
        if (!('sdBlockId' in (node.type.spec.attrs ?? {}))) return null
        const blockPos = $pos.before(depth)
        const minted = 'wc-ref-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
        const tr = editor.state.tr.setNodeMarkup(blockPos, undefined, { ...node.attrs, sdBlockId: minted })
        // Preserve the caret across the markup change (mapped through the step).
        tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(from)))
        editor.view?.dispatch(tr)
      }
    } catch { return null }
    // 3. Re-project against the now-addressable block.
    try {
      return docApi()?.selection.current({})?.target ?? null
    } catch { return null }
  }

  // BlockNodeAddress for the caret's enclosing paragraph (caption adjacentTo needs it).
  // Mints an sdBlockId when absent (same discipline as inlineTarget).
  function caretBlockAddress(): any | null {
    if (!inlineTarget()) return null // ensures the block carries an id (mint side-effect)
    try {
      const { from } = editor.state.selection
      const $pos = editor.state.doc.resolve(from)
      let depth = $pos.depth
      while (depth > 0 && !$pos.node(depth).isTextblock) depth--
      const node = $pos.node(depth)
      if (!node || !node.isTextblock) return null
      const attrs = (node.attrs ?? {}) as Record<string, unknown>
      const id = attrs.sdBlockId ?? attrs.id ?? attrs.blockId
      if (!(typeof id === 'string' && id.length > 0)) return null
      const nodeType = node.type.name === 'heading' ? 'heading' : node.type.name === 'listItem' ? 'listItem' : 'paragraph'
      return { kind: 'block', nodeType, nodeId: id }
    } catch { return null }
  }

  // ---- TOC (D9.2) -----------------------------------------------------------
  // refInsertTOC(opts): config from the Custom TOC dialog maps to the fork TOC
  // config. Default (opts {}) collects Heading 1-N via DEFAULT_TOC_CONFIG \o "1-3".
  function refInsertTOC(opts?: any): boolean {
    const d = docApi()
    if (!d) return false
    const config: any = {}
    if (opts && typeof opts === 'object') {
      const from = Number(opts.showLevelsFrom ?? 1)
      const to = Number(opts.showLevels ?? opts.showLevelsTo)
      if (Number.isFinite(to) && to >= 1) config.outlineLevels = { from: Number.isFinite(from) && from >= 1 ? from : 1, to }
      if (opts.hyperlinks != null) config.hyperlinks = !!opts.hyperlinks
      if (opts.rightAlignPageNumbers != null) config.rightAlignPageNumbers = !!opts.rightAlignPageNumbers
      if (opts.includePageNumbers != null) config.includePageNumbers = !!opts.includePageNumbers
      if (opts.tabLeader) config.tabLeader = opts.tabLeader
    }
    try {
      const input: any = {}
      if (Object.keys(config).length) input.config = config
      const r = d.create.tableOfContents(input)
      refocus()
      return ok(r)
    } catch { return false }
  }

  // refUpdateTable: rebuild EVERY TOC from headings, then rebuild ToF/Index/ToA
  // fields (legacy updateAny parity). Best-effort across each construct.
  function refUpdateTable(): boolean {
    const d = docApi()
    if (!d) return false
    let any = false
    try {
      const items = d.toc.list()?.items ?? []
      for (const it of items) {
        try {
          const target = it?.address ?? it?.handle?.address ?? it?.handle
          if (!target) continue
          if (ok(d.toc.update({ target, mode: 'all' }))) any = true
        } catch { /* skip this TOC */ }
      }
    } catch { /* no TOCs */ }
    // Rebuild generic fields (ToF / Index / ToA raw TOC fields) if any exist.
    try {
      const fields = d.fields?.list?.()?.items ?? []
      for (const f of fields) {
        try {
          const target = f?.address ?? f?.handle?.address ?? f?.handle
          if (!target) continue
          if (ok(d.fields.rebuild({ target }))) any = true
        } catch { /* skip this field */ }
      }
    } catch { /* no fields adapter / none */ }
    refocus()
    return any
  }

  function refRemoveTOC(): boolean {
    const d = docApi()
    if (!d) return false
    let any = false
    try {
      const items = d.toc.list()?.items ?? []
      for (const it of items) {
        try {
          const target = it?.address ?? it?.handle?.address ?? it?.handle
          if (!target) continue
          if (ok(d.toc.remove({ target }))) any = true
        } catch { /* skip */ }
      }
    } catch { return false }
    refocus()
    return any
  }

  // ---- Add Text → outline level (D9.8 / A4) ---------------------------------
  // refSetOutlineLevel(n): Level 1..9 → outlineLevel 0..8; n<=0 / null → clear
  // ("Do Not Show in Table of Contents").
  function refSetOutlineLevel(n: number | null): boolean {
    const d = docApi()
    if (!d) return false
    const addr = caretBlockAddress()
    if (!addr) return false
    const outlineLevel = n == null || Number(n) <= 0 ? null : Number(n) - 1
    try {
      // ParagraphTarget = BlockNodeAddress & { nodeType: paragraph|heading|listItem }.
      // The paragraph-property wrappers live under editor.doc.format.paragraph.*
      // (op id "format.paragraph.setOutlineLevel") — there is NO editor.doc.paragraphs
      // namespace on the active facade. (D9.8 bug found by the [9] coverage test.)
      const r = d.format.paragraph.setOutlineLevel({ target: addr, outlineLevel })
      refocus()
      return ok(r)
    } catch { return false }
  }

  // ---- footnotes / endnotes (D9.3) ------------------------------------------
  function insertNote(type: 'footnote' | 'endnote'): boolean {
    const d = docApi()
    if (!d) return false
    const at = inlineTarget()
    if (!at) return false
    try {
      const seed = type === 'endnote' ? 'Endnote' : 'Footnote'
      const r = d.footnotes.insert({ type, at, content: seed })
      refocus()
      return ok(r)
    } catch { return false }
  }
  const refInsertFootnote = () => insertNote('footnote')
  const refInsertEndnote = () => insertNote('endnote')

  // ---- notes-area support (task 4): list + edit a note body (plain text) -----
  function refListFootnotes(): any[] {
    const d = docApi()
    if (!d) return []
    try {
      // A3: DiscoveryItem<FootnoteDomain> spreads the domain fields at the TOP
      // level ({ id, handle, ...domain } — discovery.ts:125); there is no `.domain`
      // nesting. Read noteId/type/displayNumber/content/address directly off `it`.
      const items = d.footnotes.list()?.items ?? []
      return items.map((it: any) => ({
        noteId: String(it?.noteId ?? ''),
        type: it?.type === 'endnote' ? 'endnote' : 'footnote',
        displayNumber: String(it?.displayNumber ?? ''),
        content: String(it?.content ?? ''),
        // FootnoteAddress for refUpdateNote.
        target: it?.address ?? { kind: 'entity', entityType: 'footnote', noteId: String(it?.noteId ?? '') },
      }))
    } catch { return [] }
  }

  // refUpdateNote(target, text): edit a note body. target is a FootnoteAddress
  // (from refListFootnotes()[i].target) OR a bare noteId string.
  function refUpdateNote(target: any, text: string): boolean {
    const d = docApi()
    if (!d) return false
    if (typeof text !== 'string') return false
    const addr = typeof target === 'string'
      ? { kind: 'entity', entityType: 'footnote', noteId: target }
      : target
    if (!addr) return false
    try {
      const r = d.footnotes.update({ target: addr, patch: { content: text } })
      return ok(r)
    } catch { return false }
  }

  // ---- note navigation + show notes (D9.3) ----------------------------------
  // refNextNote(dir): caret-relative jump over footnote/endnote reference nodes
  // (legacy nextNote parity). dir = 'next' | 'prev' (default 'next').
  function refNextNote(dir: 'next' | 'prev' = 'next'): boolean {
    try {
      const positions: number[] = []
      editor.state.doc.descendants((node: any, pos: number) => {
        const n = node.type?.name
        if (n === 'footnoteReference' || n === 'endnoteReference') positions.push(pos)
      })
      if (!positions.length) return false
      positions.sort((a, b) => a - b)
      const cur = editor.state.selection.from
      let target: number | undefined
      if (dir === 'prev') target = [...positions].reverse().find((p) => p < cur) ?? positions[positions.length - 1]
      else target = positions.find((p) => p > cur) ?? positions[0]
      editor.view?.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, target)))
      refocus()
      return true
    } catch { return false }
  }

  // refShowNotes: reveal + scroll the clone-owned notes area and focus the first note
  // body (task 4, notes-area.ts owns the DOM + focus/scroll). The notes-area module
  // exposes WC.NotesArea.showNotes(); degrade honestly to false when there are no notes
  // (showNotes returns false when the region is hidden / absent).
  function refShowNotes(): boolean {
    try {
      const na = (window as any).WC?.NotesArea
      if (na && typeof na.showNotes === 'function') return na.showNotes() === true
      // Fallback (notes-area not installed — e.g. mid-replace): degrade to "any notes?".
      const el = document.getElementById('pm-notes-area')
      if (el && el.style.display !== 'none') { el.scrollIntoView?.({ block: 'nearest' }); return true }
      return refListFootnotes().length > 0
    } catch { return false }
  }

  // ---- captions + Table of Figures (D9.4) -----------------------------------
  // refInsertCaption(label): SEQ-numbered "Caption"-styled paragraph below the
  // current block. resolvedNumber is empty headless (ledger A); the SEQ field
  // instruction "SEQ <label> \* ARABIC" is what exports.
  function refInsertCaption(label: string): boolean {
    const d = docApi()
    if (!d) return false
    if (typeof label !== 'string' || !label.trim()) return false
    const adjacentTo = caretBlockAddress()
    if (!adjacentTo) return false
    try {
      const r = d.captions.insert({ label, position: 'below', adjacentTo })
      refocus()
      return ok(r)
    } catch { return false }
  }

  // refInsertTOF(label): Table of Figures = a RAW TOC field with the \c switch
  // (D9.4 / K6 — the TOC config cannot carry \c). Entries repopulate in Word on
  // F9/open (ledger C). Default label "Figure".
  function refInsertTOF(label?: string): boolean {
    const d = docApi()
    if (!d) return false
    const at = inlineTarget()
    if (!at) return false
    const lbl = (typeof label === 'string' && label.trim()) ? label : 'Figure'
    try {
      const r = d.fields.insert({ at, instruction: 'TOC \\c "' + lbl + '" \\h \\z', mode: 'raw' })
      refocus()
      return ok(r)
    } catch { return false }
  }

  // ---- index (D9.6) ---------------------------------------------------------
  // refMarkIndexEntry(info): XE field at the caret. info = { text, subEntry?, ... }
  // or a bare string (entry text).
  function refMarkIndexEntry(info: any): boolean {
    const d = docApi()
    if (!d) return false
    const at = inlineTarget()
    if (!at) return false
    const entry = typeof info === 'string' ? { text: info } : (info && typeof info === 'object' ? info : null)
    if (!entry || !entry.text) {
      // No entry text: use the selected/word text if any, else degrade.
      let txt = ''
      try { txt = docApi()?.selection.current({ includeText: true })?.text ?? '' } catch { /* none */ }
      if (!txt.trim()) return false
      try { return ok(d.index.entries.insert({ at, entry: { text: txt } })) } catch { return false }
    }
    try {
      const r = d.index.entries.insert({ at, entry })
      refocus()
      return ok(r)
    } catch { return false }
  }

  function refInsertIndex(): boolean {
    const d = docApi()
    if (!d) return false
    try {
      const r = d.index.insert({ at: { kind: 'documentEnd' } })
      refocus()
      return ok(r)
    } catch { return false }
  }

  function refUpdateIndex(): boolean {
    const d = docApi()
    if (!d) return false
    let any = false
    try {
      const items = d.index.list?.()?.items ?? []
      for (const it of items) {
        try {
          const target = it?.address ?? it?.handle?.address ?? it?.handle
          if (!target) continue
          if (ok(d.index.rebuild({ target }))) any = true
        } catch { /* skip */ }
      }
    } catch { return false }
    refocus()
    return any
  }

  // ---- table of authorities (D9.6) ------------------------------------------
  // refMarkCitation(info): TA field at the caret. info = { longCitation, shortCitation?,
  // category }; category defaults to 'cases'. A bare string = longCitation.
  function refMarkCitation(info: any): boolean {
    const d = docApi()
    if (!d) return false
    const at = inlineTarget()
    if (!at) return false
    let entry: any
    if (typeof info === 'string') entry = { longCitation: info, category: 'cases' }
    else if (info && typeof info === 'object') entry = { category: 'cases', ...info }
    else return false
    if (!entry.longCitation) {
      let txt = ''
      try { txt = docApi()?.selection.current({ includeText: true })?.text ?? '' } catch { /* none */ }
      if (!txt.trim()) return false
      entry.longCitation = txt
    }
    try {
      const r = d.authorities.entries.insert({ at, entry })
      refocus()
      return ok(r)
    } catch { return false }
  }

  function refInsertTOA(): boolean {
    const d = docApi()
    if (!d) return false
    try {
      const r = d.authorities.insert({ at: { kind: 'documentEnd' } })
      refocus()
      return ok(r)
    } catch { return false }
  }

  // ---- citations + sources + bibliography (D9.5) ----------------------------
  // A2: the fork CitationSourceType is a LOWERCASE enum (citations.types.ts):
  //   book | journalArticle | conferenceProceedings | report | website |
  //   patent | case | statute | thesis | film | interview | misc
  // The caller may pass a human/Word-style label ("Book", "Journal Article",
  // "Web site"); normalize to the enum so the source doesn't persist a bogus
  // type (e.g. "Book") that no list/get filter recognizes. Unknown values
  // lower-case their first letter (closest honest fallback).
  function normalizeSourceType(raw: unknown): string {
    if (typeof raw !== 'string' || !raw.trim()) return 'book'
    const key = raw.trim().toLowerCase().replace(/[\s_-]+/g, '')
    const MAP: Record<string, string> = {
      book: 'book',
      journalarticle: 'journalArticle', journal: 'journalArticle', article: 'journalArticle',
      conferenceproceedings: 'conferenceProceedings', conference: 'conferenceProceedings', proceedings: 'conferenceProceedings',
      report: 'report',
      website: 'website', web: 'website', websitedocument: 'website', internetsite: 'website', site: 'website',
      patent: 'patent',
      case: 'case',
      statute: 'statute',
      thesis: 'thesis',
      film: 'film',
      interview: 'interview',
      misc: 'misc', miscellaneous: 'misc',
    }
    if (MAP[key]) return MAP[key]
    // Fallback: lower-case the first letter of the original (preserve any
    // internal camelCase the caller may have supplied verbatim).
    return raw.charAt(0).toLowerCase() + raw.slice(1)
  }

  // refAddSource(src): inserts a bibliography source; the engine MINTS the
  // sourceId (source-<ts>). RETURNS the minted sourceId (string) or false. src =
  // { type, title, author, ... }; the whole object rides as `fields`.
  function refAddSource(src: any): string | false {
    const d = docApi()
    if (!d || !src || typeof src !== 'object') return false
    const type = normalizeSourceType(src.type)
    try {
      const r = d.citations.sources.insert({ type, fields: src })
      if (!ok(r)) return false
      const id = r?.source?.sourceId
      return (typeof id === 'string' && id) ? id : false
    } catch { return false }
  }

  // refInsertCitation(srcId): in-text CITATION field at the caret referencing srcId.
  function refInsertCitation(srcId: string): boolean {
    const d = docApi()
    if (!d || !srcId) return false
    const at = inlineTarget()
    if (!at) return false
    try {
      const r = d.citations.insert({ at, sourceIds: [String(srcId)] })
      refocus()
      return ok(r)
    } catch { return false }
  }

  // refListSources(): normalized array of { sourceId, type, fields } for Manage Sources.
  function refListSources(): any[] {
    const d = docApi()
    if (!d) return []
    try {
      // A3: DiscoveryItem<CitationSourceDomain> spreads sourceId/tag/type/fields
      // at the top level (discovery.ts:125 — no `.domain` nesting). Read directly.
      const items = d.citations.sources.list()?.items ?? []
      return items.map((it: any) => ({
        sourceId: String(it?.sourceId ?? it?.tag ?? ''),
        type: it?.type,
        fields: it?.fields ?? {},
      }))
    } catch { return [] }
  }

  function refUpdateSource(srcId: string, patch: any): boolean {
    const d = docApi()
    if (!d || !srcId || !patch || typeof patch !== 'object') return false
    try {
      const target = { kind: 'entity', entityType: 'citationSource', sourceId: String(srcId) }
      return ok(d.citations.sources.update({ target, patch }))
    } catch { return false }
  }

  function refRemoveSource(srcId: string): boolean {
    const d = docApi()
    if (!d || !srcId) return false
    try {
      const target = { kind: 'entity', entityType: 'citationSource', sourceId: String(srcId) }
      return ok(d.citations.sources.remove({ target }))
    } catch { return false }
  }

  // refSetCitationStyle(style): persist the bibliography style on an existing
  // bibliography (configure). style is a free string (APA/Chicago/IEEE/...). No
  // bibliography yet → degrade honestly (false). The style binds when the user
  // inserts a bibliography (refInsertBibliography carries it through).
  function refSetCitationStyle(style: string): boolean {
    const d = docApi()
    if (!d || typeof style !== 'string' || !style) return false
    try {
      // Find the first bibliography node + build its address.
      let addr: any = null
      editor.state.doc.descendants((node: any, pos: number) => {
        if (addr) return false
        if (node.type?.name === 'bibliography') {
          const id = node.attrs?.sdBlockId ?? node.attrs?.id ?? String(pos)
          addr = { kind: 'block', nodeType: 'bibliography', nodeId: String(id) }
          return false
        }
        return true
      })
      if (!addr) return false
      const r = d.citations.bibliography.configure({ target: addr, style })
      refocus()
      return ok(r)
    } catch { return false }
  }

  // refInsertBibliography(title): bibliography block at the doc end. Renders empty
  // headless (ledger A — layout gap); the BIBLIOGRAPHY field + StyleName export.
  //
  // A1: the flyout `title` (Bibliography / References / Works Cited) is COSMETIC
  // ONLY — the fork BibliographyInsertInput has no title slot, and its `style`
  // field is the CITATION-STYLE id (citation-resolver.toSelectedStylePath maps it
  // to selectedStyle="<title>.XSL" and styleName="<title>"). Threading `title`
  // through `style` would corrupt the exported StyleName (e.g. "Works Cited.XSL").
  // So we insert with { at } ONLY and never pass a title. The bibliography
  // heading has no fork model representation; all titles collapse to one
  // bibliography (ledger C deviation). The citation style is owned exclusively
  // by refSetCitationStyle (bibliography.configure / syncBibliographyStyleToConverter).
  function refInsertBibliography(_title?: string): boolean {
    const d = docApi()
    if (!d) return false
    try {
      const r = d.citations.bibliography.insert({ at: { kind: 'documentEnd' } })
      refocus()
      return ok(r)
    } catch { return false }
  }

  // ---- cross-reference (D9.7) -----------------------------------------------
  // refCrossReference(input): CrossRef field at the caret. input = { target:
  // CrossRefTarget, display? } or a CrossRefTarget directly.
  function refCrossReference(input: any): boolean {
    const d = docApi()
    if (!d || !input || typeof input !== 'object') return false
    const at = inlineTarget()
    if (!at) return false
    const target = input.target ?? input
    if (!target || typeof target !== 'object' || !target.kind) return false
    const display = (typeof input.display === 'string' && input.display) ? input.display : 'content'
    try {
      const r = d.crossRefs.insert({ at, target, display })
      refocus()
      return ok(r)
    } catch { return false }
  }

  return {
    // TOC
    refInsertTOC, refUpdateTable, refRemoveTOC,
    // Add Text outline level
    refSetOutlineLevel,
    // footnotes / endnotes + notes area
    refInsertFootnote, refInsertEndnote, refNextNote, refShowNotes,
    refListFootnotes, refUpdateNote,
    // captions + ToF
    refInsertCaption, refInsertTOF,
    // index
    refMarkIndexEntry, refInsertIndex, refUpdateIndex,
    // table of authorities
    refMarkCitation, refInsertTOA,
    // citations / sources / bibliography
    refAddSource, refInsertCitation, refListSources, refUpdateSource, refRemoveSource,
    refSetCitationStyle, refInsertBibliography,
    // cross-reference
    refCrossReference,
  }
}
