// Feature 013 — importer inline-page-break normalization (NO-FORK).
//
// THE GAP: a Word page break authored as an INLINE <w:br w:type="page"/> imports as an inline
// hardBreak{lineBreakType:'page'} that lives *inside* a run, inside a paragraph, and never ends
// that paragraph (paragraph → run → hardBreak{page}). The paged PresentationEditor only paints a
// line — and a caret/click target — where a real paragraph fragment exists, so the page *after*
// such a break owns no paragraph → no painted line → no visible/clickable caret → it is pruned.
// (Full analysis: docs/PAGE_BREAK_ROOT_CAUSE.md.)
//
// THE FIX (Path A, no-fork): at IMPORT time, re-model every inline page-break hardBreak into the
// SAME model the shipped insertPageBreak already produces — a real paragraph carrying
// paragraphProperties.pageBreakBefore on the new page (bridge/insert.ts appendPageBreakParagraph).
// A real paragraph paints a caret-bearing .superdoc-line natively, so the imported page becomes
// visible / clickable / editable. Round-trip: <w:br w:type="page"/> re-saves as <w:pageBreakBefore/>
// — both are valid Word page breaks; this is the same trade-off the insert-fix already accepts.
//
// Scope (v1): TOP-LEVEL paragraphs only. A page break inside a table cell stays as-is (a documented
// v1 gap, consistent with the other table-cell layout gaps). Idempotent: a doc with no inline page
// breaks (or one already using pageBreakBefore) is left untouched (returns false).

import { TextSelection } from '@/pm'
// @ts-ignore - vendored fork JS module (no types). Computes the attrs that carry across a paragraph
// split, dropping keepOnSplit:false identifiers (paraId/textId/sdBlockId/sdBlockRev/listRendering) so a
// continuation paragraph gets FRESH ids — exactly what splitBlockPatch (split-run.js) does for Enter.
import { Attribute } from '@core/Attribute.js'

type AnyNode = any
type AnyEditor = any

// An inline page-break hardBreak — imported breaks carry lineBreakType:'page' (the <w:br w:type>
// encode), programmatic ones carry pageBreakType:'page'. Match both so the normalizer is robust.
function isInlinePageBreak(node: AnyNode, hardBreakType: AnyNode): boolean {
  return (
    node.type === hardBreakType &&
    (node.attrs?.pageBreakType === 'page' || node.attrs?.lineBreakType === 'page')
  )
}

function paragraphHasInlinePageBreak(para: AnyNode, hardBreakType: AnyNode): boolean {
  let found = false
  para.descendants((n: AnyNode) => {
    if (found) return false
    if (isInlinePageBreak(n, hardBreakType)) { found = true; return false }
    return true
  })
  return found
}

// Split ONE paragraph's inline content at each inline page break, preserving run structure
// (attrs + marks) and the run-wrapper. Returns an array of paragraph nodes (>= 2 when a break was
// present): piece[0] keeps the ORIGINAL attrs (it IS the original paragraph's start, so it retains its
// paraId/identity); piece[1..] use the split-carry attrs (fresh ids, keepOnSplit:false dropped) PLUS
// pageBreakBefore — i.e. each continuation behaves exactly like a manual Enter-split of this paragraph.
// (v1 trade-off: a page break MID a styled/numbered paragraph therefore yields a continuation in the
// SAME style/list, just as Enter would — Word models the inline break as one paragraph across pages.)
function splitParagraphAtPageBreaks(para: AnyNode, schema: AnyNode, extensionAttrs: AnyNode): AnyNode[] {
  const paraType = schema.nodes.paragraph
  const runType = schema.nodes.run
  const hardBreakType = schema.nodes.hardBreak

  // segments[i] = the array of paragraph-level children (runs / inline nodes) for output paragraph i.
  const segments: AnyNode[][] = [[]]
  const pushChild = (n: AnyNode) => segments[segments.length - 1].push(n)
  const startSegment = () => segments.push([])

  para.content.forEach((child: AnyNode) => {
    if (runType && child.type === runType && paragraphHasInlinePageBreak(child, hardBreakType)) {
      // A run that contains one or more page breaks: rebuild it, splitting at each break.
      let runChildren: AnyNode[] = []
      const flushRun = () => {
        if (runChildren.length) pushChild(runType.create(child.attrs, runChildren, child.marks))
        runChildren = []
      }
      child.content.forEach((inlineNode: AnyNode) => {
        if (isInlinePageBreak(inlineNode, hardBreakType)) {
          flushRun()        // close the run + the current paragraph segment
          startSegment()    // the content after the break starts a new paragraph
        } else {
          runChildren.push(inlineNode)
        }
      })
      flushRun()
    } else if (isInlinePageBreak(child, hardBreakType)) {
      // A page break sitting directly in the paragraph (no run wrapper) — defensive.
      startSegment()
    } else {
      pushChild(child)
    }
  })

  // Continuation attrs: the split-carry set (drops paraId/textId/sdBlockId/… so continuations get fresh
  // ids on export, never duplicating the original's) + pageBreakBefore. Keeps paragraphProperties (style).
  let contAttrs: AnyNode
  try { contAttrs = Attribute.getSplittedAttributes(extensionAttrs, 'paragraph', para.attrs) } catch { contAttrs = para.attrs }
  const contWithBreak = { ...contAttrs, paragraphProperties: { ...(contAttrs?.paragraphProperties || {}), pageBreakBefore: true } }
  return segments.map((seg, idx) => (idx === 0 ? paraType.create(para.attrs, seg) : paraType.create(contWithBreak, seg)))
}

// Set paragraphProperties.pageBreakBefore = true on a paragraph node (returns a NEW node).
function withPageBreakBefore(para: AnyNode, schema: AnyNode): AnyNode {
  const attrs = para.attrs || {}
  const pp = { ...(attrs.paragraphProperties || {}), pageBreakBefore: true }
  return schema.nodes.paragraph.create({ ...attrs, paragraphProperties: pp }, para.content, para.marks)
}

function isEmptyPageBreakPara(node: AnyNode, paraType: AnyNode): boolean {
  return node.type === paraType && node.content.size === 0 && node.attrs?.paragraphProperties?.pageBreakBefore === true
}

// Collapse a spurious empty pageBreakBefore paragraph that is immediately followed by a real
// paragraph (the "break at paragraph end" case): move the break onto the following paragraph and
// drop the empty one, so an imported [text, <w:br>] [next] yields [text] [next]{pageBreakBefore}
// (one page boundary, no extra blank) — matching how Word renders it. A trailing empty break para
// (nothing after it) is KEPT (Word shows a final blank page for a doc-ending page break).
function collapseEmptyBreaks(blocks: AnyNode[], schema: AnyNode): AnyNode[] {
  const paraType = schema.nodes.paragraph
  const out: AnyNode[] = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    const next = blocks[i + 1]
    if (
      isEmptyPageBreakPara(b, paraType) &&
      next && next.type === paraType &&
      next.attrs?.paragraphProperties?.pageBreakBefore !== true
    ) {
      blocks[i + 1] = withPageBreakBefore(next, schema)
      continue // drop the empty break paragraph
    }
    out.push(b)
  }
  return out
}

/**
 * Re-model every TOP-LEVEL inline page break in the editor's document into a real
 * pageBreakBefore paragraph (the shipped, caret-hostable model). Returns true if the document was
 * changed, false if there was nothing to normalize (idempotent / safe to call on any import).
 */
export function normalizeImportedPageBreaks(editor: AnyEditor): boolean {
  try {
    const view = editor?.view
    const state = editor?.state
    if (!view || !state) return false
    const { doc, schema } = state
    const hardBreakType = schema.nodes.hardBreak
    const paraType = schema.nodes.paragraph
    if (!hardBreakType || !paraType) return false
    const extensionAttrs = editor?.extensionService?.attributes ?? []

    let changed = false
    const newTop: AnyNode[] = []
    doc.forEach((block: AnyNode) => {
      if (block.type === paraType && paragraphHasInlinePageBreak(block, hardBreakType)) {
        changed = true
        // pieces[1..] already carry pageBreakBefore + fresh split-attrs (see splitParagraphAtPageBreaks).
        splitParagraphAtPageBreaks(block, schema, extensionAttrs).forEach((p) => newTop.push(p))
      } else {
        newTop.push(block)
      }
    })
    if (!changed) return false

    const collapsed = collapseEmptyBreaks(newTop, schema)
    const tr = state.tr
    tr.replaceWith(0, doc.content.size, collapsed) // preserves doc.attrs (sectPr / page setup)
    // The import is atomic from the user's view — don't make the normalization its own undo step.
    tr.setMeta('addToHistory', false)
    // Keep the caret valid after the structural rebuild (import puts it at the doc start).
    try { tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(1, tr.doc.content.size)))) } catch { /* clamp left to PM */ }
    view.dispatch(tr)
    return true
  } catch {
    // Defensive: a normalization failure must never break Open — leave the imported doc as-is.
    return false
  }
}
