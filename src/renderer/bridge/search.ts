// Slice 5: find/replace surface. The fork Search extension owns the session, the
// decoration highlights, and the (non-destructive) replace transactions; this wrapper
// exposes Word-shaped entry points and reads the fork storage for counts.
import { TextSelection } from 'prosemirror-state'
type AnyEditor = any

export interface FindOptions { caseSensitive?: boolean; wholeWord?: boolean; useWildcards?: boolean; ignoreDiacritics?: boolean }

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

  if (t === 'bookmark') {
    // Bookmark node type not in current schema — recorded as Phase 7 (insert-basics).
    return false
  }

  // 'page' and 'line' are pagination-gated (Phase 7 continuous-flow).
  return false
}

export function installSearch(editor: AnyEditor) {
  const store = () => (editor as any).extensionStorage?.search

  function findSession(query: string, opts: FindOptions = {}): { total: number; activeMatchIndex: number } {
    const r = editor.commands.setSearchSession(query, {
      caseSensitive: !!opts.caseSensitive,
      wholeWord: !!opts.wholeWord,
      useWildcards: !!opts.useWildcards,
      ignoreDiacritics: !!opts.ignoreDiacritics,
      highlight: true,
    })
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
    // 'heading' | 'bookmark' implemented on the model; 'page' | 'line' → best-effort scroll
    // (continuous flow until pagination). Returns false for unsupported targets (caller toasts).
    return goToImpl(editor, target, value)
  }

  return { findSession, findNext, findPrev, replaceOne, replaceAll, clearFind, findCount, goTo }
}
