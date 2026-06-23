// 004 (Line Numbers) P2 — the in-app OWNED margin-number overlay.
//
// The paged PresentationEditor paints `.superdoc-line` elements but draws NO line numbers (feasibility-probed:
// 0 number elements). So this owned overlay draws a small number in the LEFT MARGIN beside each counted painted
// body line, counting per the section's line-numbering config (WC.PM.getLineNumbers()) — continuous / restart-
// each-page / count-by — and recomputing on relayout. It is READ-ONLY w.r.t. the document (paints from the DOM +
// the projection; never writes), PAGED-ONLY (a true no-op in overlay mode), and leak-hardened (listeners bound
// once). No fork edit. Mirrors the comments/ink/notes owned-overlay pattern (an installX side-effect call from
// installBridge, after the PE mount). Selector contract with the probe: #wc-linenum-overlay / .wc-line-number /
// data-line-number.
type AnyEditor = any

const GUTTER_PX = Math.round(0.25 * 96) // ≈18px @96dpi — Word's "Auto" w:distance default gutter (number→text gap)

const w = (): any => window as any
const PMref = (): any => { try { return w().WC?.PM || null } catch { return null } }

let editor: AnyEditor = null
let box: HTMLDivElement | null = null
let timer: any = null
let bound = false // bind the window listeners EXACTLY ONCE across remounts (leak-hardening)

// #pages-local geometry: the overlay is a child of #pages, which carries the only zoom transform — so children
// placed at #pages-local (unscaled) coords scale for free. getBoundingClientRect is SCALED, so divide by scale.
function pagesGeom(): { r: DOMRect; scale: number } | null {
  const pages = document.getElementById('pages')
  if (!pages) return null
  const r = pages.getBoundingClientRect()
  let scale = 1
  try { const s = PMref()?.coords?.overlayScale?.(); if (typeof s === 'number' && s > 0) scale = s } catch { /* fall through */ }
  if (scale === 1 && (pages as HTMLElement).offsetWidth) { const ratio = r.width / (pages as HTMLElement).offsetWidth; if (ratio > 0) scale = ratio }
  return { r, scale: scale || 1 }
}
function toLocal(c: DOMRect, g: { r: DOMRect; scale: number }) {
  return { left: (c.left - g.r.left) / g.scale, top: (c.top - g.r.top) / g.scale, right: (c.right - g.r.left) / g.scale, width: c.width / g.scale, height: c.height / g.scale }
}

function ensureBox(): HTMLDivElement | null {
  const pages = document.getElementById('pages')
  if (!pages) return null
  if (!box || !box.isConnected || box.parentElement !== pages) {
    box = (document.getElementById('wc-linenum-overlay') as HTMLDivElement) || Object.assign(document.createElement('div'), { id: 'wc-linenum-overlay' })
    pages.appendChild(box) // sibling of the painted .superdoc-page sheets; append last for a stable z-order
  }
  return box
}

// Word numbers BODY lines only — not header/footer, footnote/endnote, or (v1) table-cell lines; empty body
// paragraphs ARE numbered (they paint a real-height line). The exclusion selectors are runtime-confirmed
// (2026-06-22 paged DOM spike): footnote body/separator fragments carry data-block-id ^= "footnote-"; headers/
// footers live under .superdoc-page-header/.superdoc-page-footer; table cells under .superdoc-table-fragment.
function isCountableBodyLine(line: HTMLElement): boolean {
  if (line.closest('.superdoc-page-header, .superdoc-page-footer')) return false
  if (line.closest('.superdoc-table-fragment')) return false // v1: skip table-cell lines (known limitation)
  const frag = line.closest('.superdoc-fragment, .superdoc-table-fragment') as HTMLElement | null
  if (frag) {
    const bid = frag.getAttribute('data-block-id') || ''
    if (/footnote|endnote/i.test(bid)) return false // footnote/endnote body, separator, or semantic-flow heading ids
    if (frag.getAttribute('contenteditable') === 'false') return false // belt-and-suspenders for non-editable regions
  }
  if (line.getBoundingClientRect().height === 0) return false // degenerate/virtualized line
  return true
}

function render() {
  const ov = ensureBox()
  if (!ov) return
  ov.replaceChildren() // clear the last paint
  const ln = PMref()?.getLineNumbers?.()
  if (!ln || ln.active !== true || ln.mode === 'none') return

  const countBy = Number(ln.countBy) >= 1 ? Math.round(Number(ln.countBy)) : 1
  const start = Number(ln.start) >= 1 ? Math.round(Number(ln.start)) : 1
  const perPageReset = ln.mode === 'newPage' // continuous & newSection(v1 single-section) run across pages

  const g = pagesGeom()
  if (!g) return
  let leftMarginPx = 96 // 1in default
  try { const m = editor?.getPageStyles?.()?.pageMargins?.left; if (Number.isFinite(m)) leftMarginPx = (m as number) * 96 } catch { /* keep default */ }

  // Order pages by data-page-index when it's a valid integer, else fall back to DOM (reading) order — mirrors the
  // engine's own page collector. A `Number(...) || 0` would collapse a transiently-unattributed page (it can lack
  // data-page-index for a tick during a virtualization/relayout — exactly when this overlay re-renders) AND a real
  // index 0 to the same key, hoisting it out of reading order and perturbing the continuous count.
  const pages = Array.from(ov.parentElement!.querySelectorAll<HTMLElement>('.superdoc-page'))
    .map((el, domIdx) => { const p = Number((el as HTMLElement).dataset.pageIndex); return { el: el as HTMLElement, key: Number.isInteger(p) ? p : domIdx } })
    .sort((a, b) => a.key - b.key)
    .map((x) => x.el)

  // P3: paragraphs flagged pPr/w:suppressLineNumbers are EXCLUDED from the count entirely (Word skips them —
  // no number, no increment). Collect their position ranges from the source doc once; a painted line is
  // suppressed when its data-pm-start (a PM position inside its source paragraph) falls in one of them.
  const suppressedRanges: Array<[number, number]> = []
  try {
    const doc = editor?.state?.doc
    if (doc) doc.descendants((node: any, pos: number) => {
      if (node?.type?.name === 'paragraph' && node?.attrs?.paragraphProperties?.suppressLineNumbers === true) suppressedRanges.push([pos, pos + node.nodeSize])
      return true
    })
  } catch { /* best-effort — no suppression info ⇒ count every body line */ }
  const isSuppressedLine = (line: HTMLElement): boolean => {
    if (!suppressedRanges.length) return false
    const s = Number(line.dataset.pmStart)
    if (!Number.isFinite(s)) return false
    return suppressedRanges.some(([a, b]) => s >= a && s < b)
  }

  let n = start - 1 // the first COUNTED body line becomes `start`
  for (const pg of pages) {
    if (perPageReset) n = start - 1
    const pBox = toLocal(pg.getBoundingClientRect(), g)
    const textColLeft = pBox.left + leftMarginPx
    const numberRight = Math.max(0, textColLeft - GUTTER_PX)

    const lines = Array.from(pg.querySelectorAll<HTMLElement>('.superdoc-line'))
      .filter(isCountableBodyLine)
      // DOCUMENT (reading) order — Word numbers lines in reading order. data-pm-start is the PM position,
      // monotonic with reading order, so it orders MULTI-COLUMN body lines correctly (a client-top-primary sort
      // would wrongly interleave side-by-side columns row-by-row). client-top is only the tiebreak.
      .sort((a, b) => { const d = (Number(a.dataset.pmStart) || 0) - (Number(b.dataset.pmStart) || 0); return d !== 0 ? d : a.getBoundingClientRect().top - b.getBoundingClientRect().top })

    for (const line of lines) {
      if (isSuppressedLine(line)) continue // suppressed paragraph: excluded from the count (no increment, no number)
      n += 1 // EVERY counted body line increments the running number
      if (n % countBy !== 0) continue // DISPLAY only multiples of countBy (Word's predicate)
      const lBox = toLocal(line.getBoundingClientRect(), g)
      const el = document.createElement('span')
      el.className = 'wc-line-number'
      el.dataset.lineNumber = String(n) // stable value contract for the probe
      el.textContent = String(n)
      el.style.position = 'absolute'
      el.style.top = Math.max(0, lBox.top) + 'px'
      el.style.height = Math.max(1, lBox.height) + 'px'
      el.style.lineHeight = Math.max(1, lBox.height) + 'px' // center the number within the line box (a 9pt glyph top-pinned in a tall heading line floats above the text)
      el.style.left = '0px'
      // right-aligned column whose right edge sits GUTTER_PX left of the text; clamp to a legible min width so a
      // very narrow page margin can't collapse the box to 0 and hide the number.
      el.style.width = Math.max(numberRight, 18) + 'px'
      el.style.textAlign = 'right'
      ov.appendChild(el)
    }
  }
}

function schedule() { if (timer) return; timer = setTimeout(() => { timer = null; try { render() } catch { /* render best-effort */ } }, 80) }

function destroy() {
  window.removeEventListener('wc:paged-relayout', schedule)
  window.removeEventListener('wc:linenumbers-changed', schedule)
  window.removeEventListener('resize', schedule)
  const canvas = document.getElementById('canvas'); if (canvas) canvas.removeEventListener('scroll', schedule)
  bound = false
  if (box) { box.remove(); box = null }
}

// Called from installBridge AFTER the PE mount (so #pages + WC.PM are live). Paged-only; overlay mode = a true
// no-op (no listeners, no DOM). Idempotent across remounts (bound flag keeps the live-reading listeners singleton).
export function installLineNumbersOverlay(ed: AnyEditor) {
  editor = ed
  if (!bound) {
    bound = true
    window.addEventListener('wc:paged-relayout', schedule) // zoom / scroll / edit / page-reflow
    window.addEventListener('wc:linenumbers-changed', schedule) // the sectPr toggle (no relayout of its own)
    window.addEventListener('resize', schedule)
    const canvas = document.getElementById('canvas'); if (canvas) canvas.addEventListener('scroll', schedule, { passive: true })
  }
  w().WC = w().WC || {}
  w().WC.LineNumbers = { refresh: render, destroy } // facade for probes/tests
  schedule() // first paint for the boot doc
}
