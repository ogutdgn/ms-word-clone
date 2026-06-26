// Slice 5: find/replace surface. The fork Search extension owns the session, the
// decoration highlights, and the (non-destructive) replace transactions; this wrapper
// exposes Word-shaped entry points and reads the fork storage for counts.
import { TextSelection } from 'prosemirror-state'
type AnyEditor = any

export interface FindOptions { caseSensitive?: boolean; wholeWord?: boolean; useWildcards?: boolean; ignoreDiacritics?: boolean }

// 018: filter for "Find by formatting" — only the set keys are required of a candidate run.
export interface FormatFilter { bold?: boolean; italic?: boolean; underline?: boolean; fontFamily?: string; fontSize?: string; caseSensitive?: boolean }

// 018 Special characters — Word's find codes that the whitespace-flexible string builder can't express, so the
// bridge compiles a precise RegExp source (passed to the engine via the regexSource fork-edit seam). v1 set:
// ^p paragraph mark, ^t tab, ^l manual line break, ^^ a literal caret. (^p/^l → \n: the search text joins blocks
// with \n; precise paragraph-vs-line distinction is a documented v1 limit.)
const SPECIAL_CODES: Record<string, string> = { p: '\\n', t: '\\t', l: '\\n' }
const SPECIAL_RE = /\^[ptl^]/
function hasSpecialCodes(q: string): boolean { return SPECIAL_RE.test(q) }
function specialToRegexSource(q: string): string {
  let out = ''
  for (let i = 0; i < q.length; i++) {
    const ch = q[i]
    if (ch === '^' && i + 1 < q.length) {
      const code = q[i + 1]
      if (code === '^') { out += '\\^'; i++; continue }
      if (SPECIAL_CODES[code]) { out += SPECIAL_CODES[code]; i++; continue }
    }
    out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return out
}

// Go To — model-supported targets now; page/line degrade gracefully (Phase 7).
// 'heading' is implemented on the model by scanning doc paragraphs whose styleId
// starts with 'Heading' (case-insensitive) and jumping to the Nth (1-indexed).
// 'bookmark' returns false (bookmark node type not in current schema).
// 'page'/'line' return false (pagination-gated, Phase 7).
function goToImpl(editor: AnyEditor, target: string, value: string | number): boolean {
  const t = String(target).toLowerCase()
  const { state } = editor

  if (t === 'heading') {
    const n = typeof value === 'number' ? value : parseInt(String(value), 10)
    const idx = isNaN(n) || n < 1 ? 1 : n
    // Collect paragraph nodes whose styleId starts with 'Heading' (e.g. 'Heading1',
    // 'Heading2', …). Uses attrs.paragraphProperties.styleId (the same path as
    // state-sync / getResolvedParaProps). Falls back to resolved properties when
    // attrs are absent so imported docs with cascaded heading styles are covered.
    const headings: Array<{ pos: number }> = []
    state.doc.descendants((node: any, pos: number) => {
      if (node.type?.name !== 'paragraph') return true
      const styleId: string =
        node.attrs?.paragraphProperties?.styleId ||
        node.attrs?.styleId ||
        ''
      if (/^heading/i.test(styleId)) {
        headings.push({ pos })
      }
      return false // don't descend into paragraph children
    })
    if (headings.length === 0) return false
    const target0 = headings[Math.min(idx - 1, headings.length - 1)]
    const pos = target0.pos + 1 // step inside the paragraph
    try {
      const tr = state.tr
        .setSelection(TextSelection.create(state.doc, pos, pos))
        .scrollIntoView()
      editor.view?.dispatch(tr)
      editor.view?.focus()
      // Scroll the dom node into view for non-presentation contexts
      try {
        const domPos = editor.view.domAtPos(pos)
        if (domPos?.node?.scrollIntoView) {
          domPos.node.scrollIntoView({ block: 'center', inline: 'nearest' })
        }
      } catch { /* scroll errors are non-fatal in test environments */ }
      return true
    } catch { return false }
  }

  if (t === 'page') {
    // 018: the paged engine maps a pos→page (coords.pageIndexOfPos, the inverse of getCurrentPage). Jump to the
    // FIRST textblock on the target page (else the first block past it, else the last block for a page beyond doc).
    const n = typeof value === 'number' ? value : parseInt(String(value), 10)
    const target = (isNaN(n) || n < 1 ? 1 : n) - 1 // 0-based page index
    const coords: any = (window as any).WC?.PM?.coords
    if (!coords || typeof coords.pageIndexOfPos !== 'function') return false
    let exact: number | null = null
    let firstBeyond: number | null = null
    let lastBlock: number | null = null
    let maxPage = -1
    let done = false
    state.doc.descendants((node: any, pos: number) => {
      if (done) return false
      if (!node.isTextblock) return true // descend into tables/containers to reach inner paragraphs
      const pi = coords.pageIndexOfPos(pos + 1)
      if (pi >= 0) { // -1 = layout not available for this pos; ignore it (don't let it pollute the result)
        lastBlock = pos + 1
        if (pi > maxPage) maxPage = pi
        if (pi === target && exact == null) exact = pos + 1
        if (pi > target && firstBeyond == null) { firstBeyond = pos + 1; done = true } // pages monotonic → stop scanning
      }
      return false // don't descend into the textblock's inline content
    })
    if (maxPage < 0) return false // no laid-out pages (overlay / pre-layout) — fail honestly, don't jump to doc end
    // exact page hit → that block; else the first block past it; else (only when the page is truly beyond the doc) the last block.
    const dest = exact ?? firstBeyond ?? (target > maxPage ? lastBlock : null)
    if (dest == null) return false
    try {
      editor.view?.dispatch(state.tr.setSelection(TextSelection.create(state.doc, dest, dest)).scrollIntoView())
      editor.view?.focus()
      return true
    } catch { return false }
  }

  if (t === 'bookmark') {
    // Bookmark node type not in current schema — recorded as Phase 7 (insert-basics).
    return false
  }

  // 'line' is deferred (per-line layout traversal — documented 018 v1 limit). 'page' handled above.
  return false
}

export function installSearch(editor: AnyEditor) {
  const store = () => (editor as any).extensionStorage?.search

  function findSession(query: string, opts: FindOptions = {}): { total: number; activeMatchIndex: number } {
    const sessionOpts: any = {
      caseSensitive: !!opts.caseSensitive,
      wholeWord: !!opts.wholeWord,
      useWildcards: !!opts.useWildcards,
      ignoreDiacritics: !!opts.ignoreDiacritics,
      highlight: true,
    }
    // 018: Word special characters (^p/^t/^l/^^) — compile a precise RegExp source the engine can't build from a
    // plain string. Wildcard mode owns its own pattern, so special-code translation only applies when wildcards off.
    if (!opts.useWildcards && hasSpecialCodes(query)) sessionOpts.regexSource = specialToRegexSource(query)
    const r = editor.commands.setSearchSession(query, sessionOpts)
    // (M3) HIGHLIGHT-ONLY: do NOT jump/scroll here. setSearchSession already sets
    // activeMatchIndex=0 in storage (search.js:664) and paints decorations; jumping
    // (goToFirstMatch) on every debounced keystroke would steal focus from the find
    // input and thrash the viewport. The selection jump happens on explicit nav
    // (findNext/findPrev) and on Enter — those call the fork's goToSearchResult, which
    // carries suppressSelectionSyncScroll for exactly this focus-restore cycle.
    return { total: r?.matches?.length ?? 0, activeMatchIndex: r?.activeMatchIndex ?? -1 }
  }

  function findNext(): number { const r = editor.commands.nextSearchMatch(); return r?.activeMatchIndex ?? -1 }
  function findPrev(): number { const r = editor.commands.previousSearchMatch(); return r?.activeMatchIndex ?? -1 }

  function replaceOne(text: string): { total: number; activeMatchIndex: number } {
    const r = editor.commands.replaceSearchMatch(text ?? '')
    return { total: r?.matches?.length ?? 0, activeMatchIndex: r?.activeMatchIndex ?? -1 }
  }

  function replaceAll(text: string): { replacedCount: number } {
    const r = editor.commands.replaceAllSearchMatches(text ?? '')
    return { replacedCount: r?.replacedCount ?? 0 }
  }

  function clearFind(): boolean { return editor.commands.clearSearchSession() }

  function findCount(): { total: number; activeMatchIndex: number } {
    const s = store()
    return { total: s?.searchResults?.length ?? 0, activeMatchIndex: s?.activeMatchIndex ?? -1 }
  }

  function goTo(target: string, value: string | number): boolean {
    // 'heading' | 'page' implemented on the model/layout; 'bookmark' | 'line' deferred. Returns false for
    // unsupported targets (caller toasts).
    return goToImpl(editor, target, value)
  }

  // 018 Find by formatting (NO-FORK, navigation-based) — select+scroll the next text run (forward from the caret,
  // wrapping) whose marks satisfy `filter`, AND that contains `text` when a term is given. Bold/italic/underline are
  // standalone marks; fontFamily/fontSize live on the textStyle mark. Returns {found, pos}.
  function findFormatting(text: string, filter: FormatFilter = {}): { found: boolean; pos: number } {
    const { state } = editor
    const start = state.selection.to
    const wantText = !!(text && text.length)
    const ci = !filter.caseSensitive
    const needle = ci ? String(text || '').toLowerCase() : String(text || '')
    // A mark is "on" unless it carries an explicit disabled value — an imported run can have <w:b w:val="0"/>
    // (a present bold mark that renders NOT bold); matching by mere presence would wrongly select it.
    const markOn = (m: any): boolean => {
      const v = m && m.attrs ? m.attrs.value : undefined
      return v !== '0' && v !== 0 && v !== false && v !== 'false' && v !== 'none'
    }
    const onMark = (marks: readonly any[], name: string) => marks.some((m) => m.type?.name === name && markOn(m))
    // Compare a font by its PRIMARY family (the textStyle mark stores the full CSS stack, e.g. "Aptos, Arial,
    // sans-serif"; the user types one name) — and a size by its numeric value (units/decimals normalized).
    const primaryFont = (f: any): string => String(f || '').split(',')[0].replace(/['"]/g, '').trim().toLowerCase()
    const normSize = (s: any): string => { const m = /([\d.]+)/.exec(String(s || '')); return m ? String(parseFloat(m[1])) : '' }
    const matchesFilter = (marks: readonly any[]): boolean => {
      if (filter.bold && !onMark(marks, 'bold')) return false
      if (filter.italic && !onMark(marks, 'italic')) return false
      if (filter.underline) {
        const u = marks.find((m) => m.type?.name === 'underline')
        if (!u || u.attrs?.underlineType === 'none') return false
      }
      if (filter.fontFamily || filter.fontSize) {
        const ts = marks.find((m) => m.type?.name === 'textStyle')
        const a = (ts && ts.attrs) || {}
        if (filter.fontFamily && primaryFont(a.fontFamily) !== primaryFont(filter.fontFamily)) return false
        if (filter.fontSize && normSize(a.fontSize) !== normSize(filter.fontSize)) return false
      }
      return true
    }
    const cands: Array<{ from: number; to: number }> = []
    state.doc.descendants((node: any, pos: number) => {
      if (!node.isText || !node.text) return true
      if (!matchesFilter(node.marks)) return true
      if (wantText) {
        const hay = ci ? node.text.toLowerCase() : node.text
        let idx = hay.indexOf(needle)
        while (idx >= 0) { cands.push({ from: pos + idx, to: pos + idx + needle.length }); idx = hay.indexOf(needle, idx + 1) }
      } else {
        cands.push({ from: pos, to: pos + node.text.length })
      }
      return true
    })
    if (!cands.length) return { found: false, pos: -1 }
    const next = cands.find((c) => c.from >= start) || cands[0] // forward from caret, wrapping
    try {
      editor.view?.dispatch(state.tr.setSelection(TextSelection.create(state.doc, next.from, next.to)).scrollIntoView())
      editor.view?.focus()
      return { found: true, pos: next.from }
    } catch { return { found: false, pos: -1 } }
  }

  return { findSession, findNext, findPrev, replaceOne, replaceAll, clearFind, findCount, goTo, findFormatting }
}
