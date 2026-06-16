// Phase 4a — pagination core. A model-driven, owned layer over the vendored PM
// engine that turns the single continuous `#pm-editor` sheet into real multi-page
// sheets. It is a faithful port of the RETIRED contenteditable engine's IDEAS
// (docs/PAGINATION.md) onto ProseMirror decorations:
//
//   - geometry comes from the MODEL (`editor.getPageStyles()` → page size +
//     margins, in inches), not hard-wired CSS;
//   - page seams + page margins are WIDGET DECORATIONS (never model nodes), so the
//     document stays clean, exports are untouched, and the caret is never yanked
//     (the legacy spacer-injection's whole bug class is gone);
//   - a PluginView MEASURES rendered line/block boxes after each render (rAF
//     debounced) and recomputes boundaries; `props.decorations` paints them.
//
// Built as an Extension so it rides the normal plugin pipeline (survives every
// internal state rebuild + Open/New) and stays OUT of the fork. Wired in
// bridge/create-editor.ts via `getStarterExtensions().concat(Pagination)`.
//
// Scope: top/bottom page margins (the fork sets paddingTop/Bottom=0 for the docx
// editor), block-level page seams on overflow, line-level intra-paragraph splitting
// (widow/orphan), full-height last sheet, live page count, MANUAL page breaks
// (hardBreak[pageBreakType='page']) — a seam placed AT the break position handles
// mid-paragraph, end-of-paragraph and trailing breaks uniformly, and two adjacent
// breaks (insertBlankPage) make a blank sheet — and the page BOUNDARY of next-page
// SECTION breaks (w:sectPr; see sectionBoundaries). Per-section geometry (different
// margins/orientation/size), even/odd parity blank pages, and table row-split across
// pages remain later sub-phases (4f / 4d); see deferrals.md §A.1b.

import { Plugin, PluginKey, Decoration, DecorationSet } from '@/pm'
// @ts-ignore - vendored fork JS module (no types)
import { Extension } from '@core/Extension.js'

const PX_PER_IN = 96
const GAP = 14 // gray inter-sheet band, matches --page-gap (base.css)
const EPS = 1 // sub-pixel slack so a line that just fits isn't bumped
const PAGE_GUARD = 600 // hard cap on pages (runaway guard, mirrors legacy)

export const paginationKey = new PluginKey('wcPagination')

interface Geometry {
  pageH: number
  marginTop: number
  marginBottom: number
  marginLeft: number // left page margin = #pm-editor padding-left; the spacer's left bleed
  marginRight: number // right page margin = #pm-editor padding-right; the spacer's right bleed
  contentH: number
  pitch: number
}

interface Break {
  pos: number // PM position the spacer sits before
  height: number // spacer height in layout px
  bands: number[] // gray gap-band offsets within the spacer (one per sheet boundary it spans;
  // every seam in the unified model spans exactly one boundary → a single band)
}

interface Layout {
  geometry: Geometry
  topMargin: number
  breaks: Break[]
  tail: number // bottom spacer height (fills last sheet + bottom margin)
  pageCount: number
  signature: string
}

function readGeometry(editor: any): Geometry {
  const ps = (editor?.getPageStyles?.() as any) || {}
  const pageH = (ps.pageSize?.height ?? 11) * PX_PER_IN
  const marginTop = (ps.pageMargins?.top ?? 1) * PX_PER_IN
  const marginBottom = (ps.pageMargins?.bottom ?? 1) * PX_PER_IN
  // L and R margins are independent (gutter/mirror margins); the fork pads #pm-editor
  // paddingLeft=left, paddingRight=right, so the spacer must bleed each side by its
  // own margin or the gray gap band misaligns on a doc with asymmetric margins.
  const marginLeft = (ps.pageMargins?.left ?? 1) * PX_PER_IN
  const marginRight = (ps.pageMargins?.right ?? 1) * PX_PER_IN
  const contentH = Math.max(PX_PER_IN, pageH - marginTop - marginBottom)
  return { pageH, marginTop, marginBottom, marginLeft, marginRight, contentH, pitch: pageH + GAP }
}

// A full-bleed transparent spacer (the white sheet shows through as page margins).
// `bands` = the offsets (px from the spacer top) at which to paint a gray inter-sheet
// gap + the two sheet-edge shadows; [] = no band (top-margin + tail spacers). Every
// seam spans one boundary → one band (a blank page is two adjacent one-band seams).
function makeSpacer(height: number, bands: number[], leftBleed: number, rightBleed: number): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pm-page-spacer'
  el.setAttribute('contenteditable', 'false')
  el.style.height = `${Math.max(0, height)}px`
  // Bleed past #pm-editor's L/R padding (each side by ITS OWN margin) so the gray
  // gap band spans the full sheet width edge-to-edge even with asymmetric margins.
  el.style.width = `calc(100% + ${leftBleed + rightBleed}px)`
  el.style.marginLeft = `${-leftBleed}px`
  el.style.marginRight = `${-rightBleed}px`
  for (const bandTop of bands) {
    if (bandTop < 0) continue
    const band = document.createElement('div')
    band.className = 'pm-gap-band'
    band.style.top = `${bandTop}px`
    band.style.height = `${GAP}px`
    el.appendChild(band)
  }
  return el
}

interface BlockMeasure {
  pos: number // PM position before the block (decoration anchor)
  el: HTMLElement // the block's DOM node (for line-box measurement when it straddles a page)
  natTop: number // natural (spacer-free) cumulative top, for the break DECISION
  natBottom: number
  actualTop: number // current rendered border-top (px from box top), for spacer SIZING
  actualBottom: number
  marginBottom: number // own bottom margin (renders below the border box, before the next sibling)
  precSpacer: number // height of the spacer(s) immediately before this block (0 if none)
}

// Measure top-level block geometry from the live DOM, twice over:
//   - NATURAL coords (`natTop`/`natBottom`): cumulative own-height + inter-block
//     gap, never reading spacer heights → stable across passes → used to DECIDE
//     which block starts each page.
//   - ACTUAL coords (`actualTop`/`actualBottom`) + the preceding spacer height →
//     used to SIZE each spacer by nudging the block to its target (margin-collapse
//     proof: we measure reality and correct, instead of modelling CSS margins).
function measureBlocks(view: any): BlockMeasure[] {
  const zoom = (window as any).WC?.PM?.zoom || 1
  const dom: HTMLElement = view.dom
  const boxTop = dom.getBoundingClientRect().top
  const kids = Array.from(dom.children) as HTMLElement[]
  const blocks: BlockMeasure[] = []
  let cum = 0
  let precSpacer = 0
  for (let i = 0; i < kids.length; i++) {
    const el = kids[i]
    if (el.classList.contains('pm-page-spacer')) {
      precSpacer += el.getBoundingClientRect().height / zoom
      continue
    }
    const r = el.getBoundingClientRect()
    // A line-split seam lives INSIDE its paragraph, so the block's own rect height
    // includes it — subtract intra-block spacer heights to recover the stable
    // NATURAL block height (the split DECISION must not see its own seam, else the
    // straddle test flip-flops and pagination oscillates). actualTop/Bottom stay
    // actual (the nudge needs the real, seam-inclusive positions).
    const innerSpacers = Array.from(el.querySelectorAll('.pm-page-spacer')).reduce(
      (a, s) => a + s.getBoundingClientRect().height / zoom,
      0,
    )
    const naturalSelf = Math.max(0, r.height / zoom - innerSpacers)
    let pos: number
    try {
      pos = Math.max(0, view.posAtDOM(el, 0) - 1)
    } catch {
      precSpacer = 0
      continue // a child we can't address is skipped from break anchoring
    }
    blocks.push({
      pos,
      el,
      natTop: cum,
      natBottom: cum + naturalSelf,
      actualTop: (r.top - boxTop) / zoom,
      actualBottom: (r.bottom - boxTop) / zoom,
      marginBottom: parseFloat(getComputedStyle(el).marginBottom) || 0,
      precSpacer,
    })
    precSpacer = 0
    // Natural gap to the next CONTENT sibling (margin-collapse-correct when adjacent).
    let j = i + 1
    while (j < kids.length && kids[j].classList.contains('pm-page-spacer')) j++
    let gap = 0
    if (j < kids.length) {
      gap =
        j === i + 1
          ? (kids[j].getBoundingClientRect().top - r.bottom) / zoom
          : blocks[blocks.length - 1].marginBottom // seam between → own bottom margin
    }
    cum += naturalSelf + Math.max(0, gap)
  }
  return blocks
}

// Measure a block's LINE boxes for intra-paragraph splitting. Returns, per line:
//   - `top`/`bottom`: NATURAL (spacer-free) coords relative to the block top — the
//     split DECISION uses these so it's stable across passes (a split seam injected
//     INTO the paragraph shifts the lines below it; we subtract our own spacer
//     heights to recover the stable natural layout, exactly as measureBlocks does).
//   - `screenTop`: the line's CURRENT screen top — the nudge uses this for the seam
//     height (it converges via the unit-gain controller).
// Lines are grouped from Range.getClientRects() (one rect per line fragment), with
// our own .pm-page-spacer rects skipped.
function lineRectsOf(el: HTMLElement, zoom: number): Array<{ top: number; bottom: number; screenTop: number; above: number }> {
  const elTop = el.getBoundingClientRect().top
  const spacers = Array.from(el.querySelectorAll('.pm-page-spacer')).map((s) => {
    const r = s.getBoundingClientRect()
    return { top: (r.top - elTop) / zoom, bottom: (r.bottom - elTop) / zoom, h: r.height / zoom }
  })
  const range = document.createRange()
  range.selectNodeContents(el)
  const lines: Array<{ top: number; bottom: number; screenTop: number; above: number }> = []
  for (const r of Array.from(range.getClientRects())) {
    if (r.width <= 0 || r.height <= 0) continue
    const aTop = (r.top - elTop) / zoom
    const aBottom = (r.bottom - elTop) / zoom
    // Skip a rect that IS one of our spacers (matches its geometry).
    if (spacers.some((sp) => Math.abs(sp.top - aTop) < 2 && Math.abs(sp.h - (aBottom - aTop)) < 2)) continue
    const above = spacers.filter((sp) => sp.bottom <= aTop + 1).reduce((a, sp) => a + sp.h, 0)
    const top = aTop - above // natural (seam-subtracted) — stable split decision
    const bottom = aBottom - above
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.top - top) < 2) last.bottom = Math.max(last.bottom, bottom)
    // `above` = intra-block seam height above this line = the line's precSpacer (the
    // nudge adds it back so the seam is stable at the fixed point, not collapsed to 0).
    else lines.push({ top, bottom, screenTop: r.top, above })
  }
  return lines
}

// Find a line-level split inside block `b` at `localBoundary` (the natural distance
// from b's top to the current page's content bottom). Returns the PM position to
// seam at + the split line's natural local top + its current actual top, or null
// (split impossible — caller moves the block wholesale). Honors widow/orphan: at
// least 2 lines stay on each side (Word's default), so it never splits a paragraph
// with fewer than 4 lines.
function findLineSplit(b: BlockMeasure, localBoundary: number, zoom: number, boxTop: number, view: any) {
  const lines = lineRectsOf(b.el, zoom)
  if (lines.length < 4) return null
  let L = -1
  for (let i = 0; i < lines.length; i++) if (lines[i].bottom <= localBoundary + EPS) L = i
  let splitIdx = L + 1
  if (splitIdx < 2) return null // orphan: fewer than 2 lines fit on the current page
  if (lines.length - splitIdx < 2) {
    splitIdx = lines.length - 2 // widow: pull back so >=2 lines move to the next page
    if (splitIdx < 2) return null
  }
  const line = lines[splitIdx]
  const left = b.el.getBoundingClientRect().left + 6
  let pos: number | null = null
  try {
    const r = view.posAtCoords({ left, top: line.screenTop + 2 })
    pos = r ? r.pos : null
  } catch {
    pos = null
  }
  if (pos == null || pos <= b.pos) return null
  return { pos, localTop: line.top, actualTop: (line.screenTop - boxTop) / zoom, precSpacer: line.above }
}

// The solver. WHICH block starts each page is decided from natural coords (stable);
// each spacer's HEIGHT is then a measure-and-nudge: `newHeight = target - actualTop
// + currentSpacerHeight` drives the block's rendered border-top to its page's
// content-top. Because moving a spacer by Δ moves the block below it by Δ, this is a
// unit-gain controller that converges in a couple of rAF passes and is stable at
// the fixed point (newHeight == currentSpacerHeight). Margin collapsing is handled
// automatically — we never model it, we measure the result.
//
// `forced` = absolute positions of inline page-break nodes (hardBreak with
// pageBreakType/lineBreakType = 'page'). Each places a seam AT its position (pushing
// the content after it to a new page) — see placeForcedSeam below. Because a forced
// break leaves the prior page partly empty, auto-overflow is measured against a
// PAGE-RELATIVE baseline `pageStartNat` (the natural top where the current page's
// content began) rather than an absolute contentH grid.
// Only true text blocks (paragraphs, headings, list items, quotes) are split at the
// line. Tables/figures/other block widgets are NOT — their getClientRects are
// cell/row boxes, not text lines, so line-splitting would inject a seam mid-cell and
// mangle the render. They are moved wholesale (table row-split across pages is 4d).
function isLineSplittable(el: HTMLElement): boolean {
  return /^(P|H[1-6]|LI|BLOCKQUOTE|PRE)$/.test(el.tagName)
}

// `w:type` of a sectPr, defaulting to OOXML's 'nextPage' when absent.
function sectPrType(sectPr: any): string {
  const t = sectPr?.elements?.find((el: any) => el?.name === 'w:type')
  return (t?.attributes?.['w:val'] as string) || 'nextPage'
}

// SECTION BREAKS. A `w:sectPr` lives on the LAST paragraph of its section
// (`attrs.paragraphProperties.sectPr` + `pageBreakSource: 'sectPr'`); the LAST section's
// sectPr is the document-level body sectPr (`doc.attrs.bodySectPr`). ECMA-376 §17.6.17:
// a sectPr defines the section ENDING at its paragraph, and its `w:type` describes how
// THAT section BEGINS relative to the previous one — i.e. it governs the break BEFORE its
// own section, NOT after it. So the page break AFTER a section-ending paragraph is
// governed by the NEXT section's type (the next section-ending paragraph's sectPr, or the
// body sectPr for the final section). VALIDATED vs Word for Windows 16.0: an explicit
// `continuous` type ON the section-ending paragraph does NOT suppress the break — all of
// {no type, continuous, nextPage} on the ender render as a page break when the next
// (body) section defaults to nextPage. (This is the exact semantic the earlier 4f spike
// got backwards.) Returns the set of top-level block positions that must START a new page.
// Per-section geometry (different margins/orientation/size) and even/odd parity blank
// pages are NOT applied here — those stay Phase 4f; see deferrals.md §A.1b.
function sectionBoundaries(view: any): Set<number> {
  const out = new Set<number>()
  const doc = view?.state?.doc
  if (!doc) return out
  // Ordered top-level section-ending paragraphs, each paired with the position of the
  // block immediately AFTER it (the block a page break would push to a new page).
  const enders: Array<{ nextPos: number; type: string }> = []
  const children: Array<{ pos: number; node: any }> = []
  doc.forEach((node: any, offset: number) => children.push({ pos: offset, node }))
  for (let i = 0; i < children.length; i++) {
    const node = children[i].node
    const sectPr = node?.attrs?.paragraphProperties?.sectPr
    if (node?.attrs?.pageBreakSource === 'sectPr' && sectPr && i + 1 < children.length) {
      enders.push({ nextPos: children[i + 1].pos, type: sectPrType(sectPr) })
    }
  }
  const bodyType = sectPrType(doc.attrs?.bodySectPr)
  for (let k = 0; k < enders.length; k++) {
    // The break after ender k is governed by the NEXT section's type.
    const nextSectionType = k + 1 < enders.length ? enders[k + 1].type : bodyType
    if (nextSectionType !== 'continuous') out.add(enders[k].nextPos)
  }
  return out
}

function solve(blocks: BlockMeasure[], g: Geometry, forced: number[], sectionForced: Set<number>, view: any): Layout {
  const breaks: Break[] = []
  let pagesDone = 0 // pages completed (boundaries placed); current page = pagesDone+1
  let pageStartNat = 0 // natural top where the current page's content begins
  const boxTop = view?.dom ? view.dom.getBoundingClientRect().top : 0
  const zoom = (window as any).WC?.PM?.zoom || 1
  // The ONE seam-emit primitive, shared by all three seam sites (wholesale-move,
  // forced-break, line-split). Advances to the next page and emits a one-band seam at
  // `pos`. The height is the measure-and-nudge `target - actualTop + precSpacer`: it
  // drives the line currently at `actualTop` down to the new page's content-top, and
  // adding back `precSpacer` (the seam height already above that line) keeps it stable
  // at the fixed point, where the seam's own height equals h. Callers set pageStartNat.
  const emitSeam = (pos: number, actualTop: number, precSpacer: number) => {
    pagesDone += 1
    const target = pagesDone * g.pitch + g.marginTop
    const h = target - actualTop + precSpacer
    if (h > 1) breaks.push({ pos, height: h, bands: [h - GAP - g.marginTop] })
  }
  // Move a SHORT straddling block wholesale to the next page (a seam BEFORE b).
  const placeSeamBefore = (b: BlockMeasure) => {
    emitSeam(b.pos, b.actualTop, b.precSpacer)
    pageStartNat = b.natTop
  }
  // Place a forced seam AT an inline page-break position P inside block b: pushes the
  // content AFTER P to the next page's content-top. This single mechanism covers
  // mid-paragraph, end-of-paragraph AND trailing (doc-final) breaks — and two adjacent
  // breaks (insertBlankPage) naturally make a blank page (two seams). pageStartNat
  // advances to P's natural Y so the auto-overflow below measures b's remainder from the
  // right baseline. `precSpacer` = the intra-block seam height already above P's line.
  const placeForcedSeam = (b: BlockMeasure, P: number) => {
    let c: any = null
    try { c = view.coordsAtPos(P) } catch { c = null }
    if (!c) { pagesDone += 1; pageStartNat += g.contentH; return } // unaddressable → still advance a page
    const lineScreenTop = c.top
    const innerAbove = Array.from(b.el.querySelectorAll('.pm-page-spacer')).reduce((a: number, s: Element) => {
      const r = (s as HTMLElement).getBoundingClientRect()
      return r.top < lineScreenTop - 1 ? a + r.height / zoom : a
    }, 0)
    emitSeam(P, (lineScreenTop - boxTop) / zoom, innerAbove)
    const naturalLocalTop = (lineScreenTop - b.el.getBoundingClientRect().top) / zoom - innerAbove
    pageStartNat = b.natTop + Math.max(0, naturalLocalTop)
  }
  for (const b of blocks) {
    // 0. A page-type section break ends the prior block → b starts a fresh page.
    if (b !== blocks[0] && sectionForced.has(b.pos)) placeSeamBefore(b)
    // 1. Manual page breaks INSIDE b → a forced seam AT each one (in document order).
    const node = view?.state?.doc?.nodeAt ? view.state.doc.nodeAt(b.pos) : null
    const bEnd = b.pos + (node ? node.nodeSize : 1)
    const fb = forced.filter((P) => P >= b.pos && P < bEnd).sort((x, y) => x - y)
    for (const P of fb) {
      if (b === blocks[0] && P <= b.pos + 1) continue // a break at the very document start has no content before it
      placeForcedSeam(b, P)
    }
    // 2. Auto overflow for b's content (after any forced break), relative to pageStartNat.
    let guard = 0
    while (b.natBottom - pageStartNat > g.contentH + EPS && guard++ < PAGE_GUARD) {
      // Split b at the line where it crosses the page boundary (Word keeps >=2 lines each
      // side). Only true text blocks are splittable — a table is moved wholesale (4d).
      const localBoundary = pageStartNat + g.contentH - b.natTop
      const split =
        isLineSplittable(b.el) && localBoundary > 0 && localBoundary < b.natBottom - b.natTop
          ? findLineSplit(b, localBoundary, zoom, boxTop, view)
          : null
      if (split) {
        emitSeam(split.pos, split.actualTop, split.precSpacer)
        pageStartNat = b.natTop + split.localTop
        continue
      }
      if (b.natTop - pageStartNat > EPS) {
        placeSeamBefore(b) // short block / orphan: move it wholesale to the next page
        break
      }
      // Starts at the page top, overflows, can't be split → advance to avoid an infinite loop.
      pagesDone++
      pageStartNat += g.contentH
    }
  }
  const pageCount = Math.min(PAGE_GUARD, pagesDone + 1)
  // Top margin: nudge the first block's border-top to the margin line (Word renders
  // the first line of each page at the top margin; this also removes the first
  // paragraph's space-before from the very top).
  const first = blocks[0]
  const topMargin = first ? Math.max(0, g.marginTop - first.actualTop + first.precSpacer) : g.marginTop
  // Tail: fill from where the content region ends (last block's MARGIN-box bottom —
  // its bottom margin renders below the border box, before the tail) to the bottom
  // of the last sheet, so the box is exactly `pageCount` sheets tall.
  const last = blocks[blocks.length - 1]
  const contentVisualBottom = last ? last.actualBottom + last.marginBottom : 0
  const desiredBottom = (pageCount - 1) * g.pitch + g.pageH
  const tail = last ? Math.max(g.marginBottom, desiredBottom - contentVisualBottom) : g.pageH
  const signature =
    `${g.pageH}|${Math.round(g.marginTop)}|${Math.round(g.marginBottom)}|top${Math.round(topMargin)}|` +
    breaks.map((b) => `${b.pos}:${Math.round(b.height)}:${b.bands.length}`).join(',') +
    `|tail${Math.round(tail)}|n${pageCount}`
  return { geometry: g, topMargin, breaks, tail, pageCount, signature }
}

function buildDecorations(view: any, layout: Layout): DecorationSet {
  const g = layout.geometry
  const decos: any[] = []
  const docSize = view.state.doc.content.size
  const lb = g.marginLeft
  const rb = g.marginRight
  // Top page margin (the fork renders the docx editor with paddingTop:0).
  // NOTE: the dynamic height MUST be in the key — ProseMirror reuses a widget's
  // DOM (skipping the render fn) when the key is unchanged, so a constant key
  // would freeze the spacer at its first-rendered height.
  decos.push(
    Decoration.widget(0, () => makeSpacer(layout.topMargin, [], lb, rb), {
      side: -1,
      key: `pm-top-${Math.round(layout.topMargin)}`,
      ignoreSelection: true,
    }),
  )
  for (const b of layout.breaks) {
    const pos = Math.min(Math.max(0, b.pos), docSize)
    const bands = b.bands
    decos.push(
      Decoration.widget(pos, () => makeSpacer(b.height, bands, lb, rb), {
        side: -1,
        key: `pm-seam-${pos}-${Math.round(b.height)}-${bands.length}`,
        ignoreSelection: true,
      }),
    )
  }
  // Tail: full-height last sheet + bottom margin (no bands — the last sheet's bottom).
  decos.push(
    Decoration.widget(docSize, () => makeSpacer(layout.tail, [], lb, rb), {
      side: 1,
      key: `pm-tail-${Math.round(layout.tail)}`,
      ignoreSelection: true,
    }),
  )
  return DecorationSet.create(view.state.doc, decos)
}

// Two layouts are "the same" if the page count, break positions and band counts
// match and the spacer heights agree within ~one line. A deadband (vs an exact
// signature) absorbs the sub-line measurement jitter inherent to line-split
// geometry (getClientRects / posAtCoords rounding), so the engine settles instead
// of re-dispatching a near-identical layout every frame (busy-loop + flicker).
function layoutsClose(a: Layout, b: Layout): boolean {
  const TOL = 24
  if (a.pageCount !== b.pageCount) return false
  if (Math.abs(a.topMargin - b.topMargin) > 4) return false
  if (Math.abs(a.tail - b.tail) > TOL) return false
  if (a.breaks.length !== b.breaks.length) return false
  for (let i = 0; i < a.breaks.length; i++) {
    // A line-split anchor can jitter by a char or two (posAtCoords rounding) while
    // staying on the same visual line; a real line change moves it by a whole line's
    // worth of characters, so a tiny tolerance absorbs jitter without masking it.
    if (Math.abs(a.breaks[i].pos - b.breaks[i].pos) > 4) return false
    if (a.breaks[i].bands.length !== b.breaks[i].bands.length) return false
    if (Math.abs(a.breaks[i].height - b.breaks[i].height) > TOL) return false
  }
  return true
}

class PaginationView {
  view: any
  editor: any
  raf = 0
  lastSignature = ''
  lastLayout: Layout | null = null
  destroyed = false

  constructor(view: any, editor: any) {
    this.view = view
    this.editor = editor
    // Force a re-measure on demand. View-mode + zoom changes (WC.PM.setView/setZoom)
    // re-layout WITHOUT dispatching a transaction, so update() never fires — without
    // this hook a switch to Web view would leave the print seams on screen.
    const PM = (window as any).WC?.PM
    if (PM) PM.__repaginate = () => this.schedule()
    this.schedule()
  }

  update() {
    this.schedule()
  }

  schedule() {
    if (this.raf || this.destroyed) return
    this.raf = requestAnimationFrame(() => {
      this.raf = 0
      this.measure()
    })
  }

  printView(): boolean {
    return ((window as any).WC?.PM?.view || 'print') === 'print'
  }

  measure() {
    if (this.destroyed) return
    const view = this.view
    if (!view || !view.dom || !view.dom.isConnected) return

    // Continuous views (Web/Draft/Outline/Read): no sheets → clear seams.
    if (!this.printView()) {
      if (this.lastSignature !== 'empty') {
        this.lastSignature = 'empty'
        this.lastLayout = null
        this.publish(DecorationSet.empty, null)
      }
      return
    }

    const g = readGeometry(this.editor)
    const blocks = measureBlocks(view)
    // Inline page breaks (absolute positions): our own hardBreak[pageBreakType='page']
    // (Insert → Page Break / Ctrl+Enter) AND the run-level hardBreak[lineBreakType='page']
    // the importer produces from a real Word <w:br w:type="page"/>.
    const forced: number[] = []
    view.state.doc.descendants((node: any, pos: number) => {
      // Never descend into a TABLE at any depth (incl. a table nested in a content-control
      // container): a break in a cell paginates within that region, not push the next
      // top-level block; table row-split is Phase 4d. Other containers ARE descended (their
      // paragraphs may carry a break).
      if (node.type?.name === 'table') return false
      if (node.type?.name === 'hardBreak' && (node.attrs?.pageBreakType === 'page' || node.attrs?.lineBreakType === 'page')) {
        forced.push(pos)
      }
      return undefined
    })
    // Section breaks (w:sectPr): top-level block positions that must start a new page.
    const sectionForced = sectionBoundaries(view)
    const layout = solve(blocks, g, forced, sectionForced, view)
    // Exact match → done. Else, a deadband check absorbs sub-line jitter (line-split
    // geometry) so we settle rather than re-dispatch a near-identical layout forever.
    if (layout.signature === this.lastSignature) return
    if (this.lastLayout && layoutsClose(this.lastLayout, layout)) return
    this.lastSignature = layout.signature
    this.lastLayout = layout
    this.publish(buildDecorations(view, layout), layout)
  }

  publish(decoSet: DecorationSet, layout: Layout | null) {
    const view = this.view
    if (!view) return
    const tr = view.state.tr.setMeta(paginationKey, { decoSet })
    tr.setMeta('addToHistory', false)
    tr.setMeta('pmPagination', true) // a decoration-only tick — never a user edit
    view.dispatch(tr)
    // Expose for probes/tests/status-bar (page count) + the COM-oracle comparison.
    const PM = (window as any).WC?.PM
    if (PM) {
      PM.__pagination = layout
        ? {
            pageCount: layout.pageCount,
            // Every seam advances exactly one sheet (a blank page = two adjacent seams),
            // so the status bar counts seams above the caret rather than weighting them.
            breaks: layout.breaks.map((b) => ({ pos: b.pos, height: Math.round(b.height) })),
            geometry: layout.geometry,
          }
        : { pageCount: 1, breaks: [], geometry: readGeometry(this.editor) }
    }
  }

  destroy() {
    this.destroyed = true
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }
}

function createPaginationPlugin(editor: any): Plugin {
  return new Plugin({
    key: paginationKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr: any, old: DecorationSet) {
        const meta = tr.getMeta(paginationKey)
        if (meta) return meta.decoSet as DecorationSet
        return old.map(tr.mapping, tr.doc)
      },
    },
    props: {
      decorations(state: any) {
        return paginationKey.getState(state)
      },
    },
    view(view: any) {
      return new PaginationView(view, editor)
    },
  })
}

export const Pagination = Extension.create({
  name: 'wcPagination',
  priority: 1,
  addPmPlugins() {
    // `this.editor` is bound by the ExtensionService context (matches the
    // linked-styles / borderCarry extension idiom).
    // @ts-ignore - fork extension `this` context
    return [createPaginationPlugin(this.editor)]
  },
})
