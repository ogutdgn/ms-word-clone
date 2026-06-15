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
// Scope so far: top/bottom page margins (the fork sets paddingTop/Bottom=0 for the
// docx editor), block-level page seams on overflow, full-height last sheet, live
// page count, and MANUAL page breaks (hardBreak[pageBreakType='page']) incl. blank
// pages (two consecutive breaks → a skipped sheet). Line-level intra-paragraph
// splitting (PAGINATION.md §7 binary search) is the remaining 4a item.

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
  marginSide: number // left/right page margin = #pm-editor L/R padding; the spacer bleed
  contentH: number
  pitch: number
}

interface Break {
  pos: number // PM position the spacer sits before
  height: number // spacer height in layout px
  bands: number[] // gray gap-band offsets within the spacer (1 per sheet boundary it spans;
  // a blank page = a forced break that skips a sheet → 2 bands)
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
  const marginSide = (ps.pageMargins?.left ?? 1) * PX_PER_IN
  const contentH = Math.max(PX_PER_IN, pageH - marginTop - marginBottom)
  return { pageH, marginTop, marginBottom, marginSide, contentH, pitch: pageH + GAP }
}

// A full-bleed transparent spacer (the white sheet shows through as page margins).
// `bands` = the offsets (px from the spacer top) at which to paint a gray inter-sheet
// gap + the two sheet-edge shadows; [] = no band (top-margin + tail spacers). A
// normal seam has one band; a blank page (a forced break skipping a sheet) has two.
function makeSpacer(height: number, bands: number[], bleed: number): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pm-page-spacer'
  el.setAttribute('contenteditable', 'false')
  el.style.height = `${Math.max(0, height)}px`
  // Bleed past #pm-editor's L/R padding so the gray gap band spans the full sheet
  // width (edge-to-edge), not just the centered text column.
  el.style.width = `calc(100% + ${2 * bleed}px)`
  el.style.marginLeft = `${-bleed}px`
  el.style.marginRight = `${-bleed}px`
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
    const self = r.height / zoom
    let pos: number
    try {
      pos = Math.max(0, view.posAtDOM(el, 0) - 1)
    } catch {
      precSpacer = 0
      continue // a child we can't address is skipped from break anchoring
    }
    blocks.push({
      pos,
      natTop: cum,
      natBottom: cum + self,
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
    cum += self + Math.max(0, gap)
  }
  return blocks
}

// The solver. WHICH block starts each page is decided from natural coords (stable);
// each spacer's HEIGHT is then a measure-and-nudge: `newHeight = target - actualTop
// + currentSpacerHeight` drives the block's rendered border-top to its page's
// content-top. Because moving a spacer by Δ moves the block below it by Δ, this is a
// unit-gain controller that converges in a couple of rAF passes and is stable at
// the fixed point (newHeight == currentSpacerHeight). Margin collapsing is handled
// automatically — we never model it, we measure the result.
//
// `forced` = positions of `hardBreak[pageBreakType='page']` nodes (manual page
// breaks). A forced break in block X pushes the NEXT block onto a new page
// regardless of fill; two consecutive forced breaks = a blank page (skip a sheet).
// Because a forced break leaves the prior page partly empty, overflow is measured
// against a PAGE-RELATIVE baseline `pageStartNat` (the natural top where the current
// page's content began) rather than an absolute contentH grid.
function solve(blocks: BlockMeasure[], g: Geometry, forced: number[]): Layout {
  const breaks: Break[] = []
  let pagesDone = 0 // pages completed (boundaries placed); current page = pagesDone+1
  let pageStartNat = 0 // natural top where the current page's content begins
  let prevPos = -1
  // Place a seam before block b that skips `skip` sheets (1 = normal/single break,
  // 2 = blank page). Nudges b's border-top to the content-top of its new page and
  // paints one gap band per skipped sheet boundary.
  const placeSeam = (b: BlockMeasure, skip: number) => {
    pagesDone += skip
    const target = pagesDone * g.pitch + g.marginTop
    const h = target - b.actualTop + b.precSpacer
    if (h > 1) {
      const bands: number[] = []
      // bottom band at the sheet boundary just above b; each earlier (skipped) sheet
      // boundary is one pitch higher up the spacer.
      for (let j = 0; j < skip; j++) bands.push(h - GAP - g.marginTop - j * g.pitch)
      breaks.push({ pos: b.pos, height: h, bands })
    }
    pageStartNat = b.natTop
  }
  for (const b of blocks) {
    // Manual page break(s) in the PREVIOUS block force b onto a new page.
    const forcedCount = b === blocks[0] ? 0 : forced.filter((P) => P > prevPos && P < b.pos).length
    if (forcedCount > 0) {
      placeSeam(b, forcedCount)
    } else {
      let guard = 0
      while (b.natBottom - pageStartNat > g.contentH + EPS && guard++ < PAGE_GUARD) {
        if (b.natTop - pageStartNat > EPS) {
          placeSeam(b, 1)
          break // tall-block line-splitting is a later iteration
        } else {
          pagesDone++ // taller than a page; advance the baseline without an empty-page seam
          pageStartNat += g.contentH
        }
      }
    }
    prevPos = b.pos
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
  const desiredBottom = (pageCount - 1) * g.pitch + g.pageH
  const tail = last ? Math.max(g.marginBottom, desiredBottom - last.actualBottom - last.marginBottom) : g.pageH
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
  const bleed = g.marginSide
  // Top page margin (the fork renders the docx editor with paddingTop:0).
  // NOTE: the dynamic height MUST be in the key — ProseMirror reuses a widget's
  // DOM (skipping the render fn) when the key is unchanged, so a constant key
  // would freeze the spacer at its first-rendered height.
  decos.push(
    Decoration.widget(0, () => makeSpacer(layout.topMargin, [], bleed), {
      side: -1,
      key: `pm-top-${Math.round(layout.topMargin)}`,
      ignoreSelection: true,
    }),
  )
  for (const b of layout.breaks) {
    const pos = Math.min(Math.max(0, b.pos), docSize)
    const bands = b.bands
    decos.push(
      Decoration.widget(pos, () => makeSpacer(b.height, bands, bleed), {
        side: -1,
        key: `pm-seam-${pos}-${Math.round(b.height)}-${bands.length}`,
        ignoreSelection: true,
      }),
    )
  }
  // Tail: full-height last sheet + bottom margin.
  decos.push(
    Decoration.widget(docSize, () => makeSpacer(layout.tail, [], bleed), {
      side: 1,
      key: `pm-tail-${Math.round(layout.tail)}`,
      ignoreSelection: true,
    }),
  )
  return DecorationSet.create(view.state.doc, decos)
}

class PaginationView {
  view: any
  editor: any
  raf = 0
  lastSignature = ''
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
        this.publish(DecorationSet.empty, null)
      }
      return
    }

    const g = readGeometry(this.editor)
    const blocks = measureBlocks(view)
    // Manual page breaks: hardBreak nodes flagged pageBreakType='page' (Insert →
    // Page Break / Ctrl+Enter). insertBlankPage inserts two consecutive ones.
    const forced: number[] = []
    view.state.doc.descendants((n: any, p: number) => {
      if (n.type?.name === 'hardBreak' && n.attrs?.pageBreakType === 'page') forced.push(p)
    })
    const layout = solve(blocks, g, forced)
    if (layout.signature === this.lastSignature) return
    this.lastSignature = layout.signature
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
