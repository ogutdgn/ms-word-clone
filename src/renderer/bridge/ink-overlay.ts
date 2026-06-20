// Slice 10 PR4: the PM-only LIVE INK overlay — the in-app renderer + capture surface for
// freehand ink. The PM document is the source of truth: each committed stroke is a real
// `vectorShape` node (isInk) that EXPORTS as DrawingML `a:custGeom` (draw.ts → insertInkShape).
// This module renders those nodes (so undo/redo/open just reflect the doc) and captures live
// strokes, persisting ONE shape per stroke on pointerup (K7/K8 — never a tr per pointermove).
//
// MOUNT (track-chrome.ts pattern): an `<svg class="wc-ink-layer">` mounted as a SIBLING over
// the page sheet — a child of #pages (NOT inside the PM-reconciled #pm-editor content, which PM
// would remove/reorder on every transaction). It is sized/positioned over #pm-editor and uses
// the #pages zoom-scale correction (scale = rect.width / pages.offsetWidth) to map pointer px →
// page px (track-chrome.ts:98-99; legacy draw-tools.js:103-104 divides by zoom too).
//
// RENDER-FROM-DOC (K3 — the load-bearing render-loss bug): renderInk() redraws EVERY ink
// vectorShape on every transaction + on document load, from BOTH sources —
//   • FRESH draw: attrs.isInk === true → attrs.customGeometry.{inkPoints,inkPen,inkPos}
//   • REOPENED (export→openDocx / Word resave): the importer OVERWRITES customGeometry with
//     { paths:[{ d, w, h }] } (EMU-space SVG `d`) and DROPS isInk — render each paths[].d,
//     scaled EMU→px and offset by the anchored inkPos (recovered from attrs).
//
// Tool ops (eraser/select/lasso) operate over the PERSISTED ink: hit-test the rendered paths
// (ported pathNear/pointInPoly) and remove the underlying nodes via a PM transaction.
//
// PM-ONLY by construction: installInkOverlay is called from installBridge AFTER its legacyBoot
// early-return, so this DOM never exists under --legacy (the legacy WC.Draw .ink-layer is
// untouched). Registers window.WC.PM.__inkOverlay so draw.ts's overlay() late-binds to it.

type AnyEditor = any
type Pt = { x: number; y: number }
type Pen = { color?: string; width?: number; opacity?: number }

const SVGNS = 'http://www.w3.org/2000/svg'
const EMU = 9525 // px → EMU (1px = 9525 EMU at 96dpi)

const w = () => window as any
// Live-bridge accessor (NOT a captured closure): probes/tests may swap PM impls.
const PM = () => { const pm = w().WC?.PM; return pm && pm.active && pm.ready ? pm : null }
// M4c — paged vs overlay discriminator. EVERY paged-specific branch gates on this so overlay is byte-identical.
const isPaged = () => w().__WC_LAYOUT_MODE === 'paged'

// ---- module singletons (installInkOverlay re-runs on Open/New) ----
let editor: AnyEditor = null
let layer: SVGSVGElement | null = null
let bound = false
let drawing = false
let curPath: SVGPathElement | null = null
let curPts: Pt[] = []
let lasso = false
let lassoPath: SVGPathElement | null = null
let lassoPts: Pt[] = []
// M4c — paged draw-page clamp: resolved ONCE at onDown (the page the stroke started on, its #pages-local
// origin, and the doc position to re-anchor the node to so its EXPORTED page is the draw page). null in
// overlay / between strokes.
let pageClamp: { pageIndex: number; origin: { left: number; top: number }; docPos: number | null } | null = null
let relayoutHandler: (() => void) | null = null // M4c — re-render committed ink after a PE relayout (settle the page)
let relayoutTimer: ReturnType<typeof setTimeout> | null = null // M4c — coalesce relayout bursts (zoom/scroll) into one render

// ---- ported geometry (legacy draw-tools.js:201-233) ----
// Catmull-Rom-ish smoother: midpoint quad béziers (1:1 with synthesizeInkDrawing's moveTo/quadBezTo).
function smooth(pts: Pt[]): string {
  if (!pts.length) return ''
  if (pts.length < 2) return `M ${pts[0].x} ${pts[0].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i]
    const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2
    d += ` Q ${p0.x} ${p0.y} ${mx} ${my}`
  }
  const last = pts[pts.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}
// Ray-casting point-in-polygon (polygon = array of {x,y}).
function pointInPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y
    if (((yi > p.y) !== (yj > p.y)) && (p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi)) inside = !inside
  }
  return inside
}
// Approximate point-near-path by sampling the path length (legacy pathNear).
function pathNear(path: SVGPathElement, p: Pt, radius: number): boolean {
  let box: DOMRect
  try { box = path.getBBox() } catch { return false }
  if (p.x < box.x - radius || p.x > box.x + box.width + radius || p.y < box.y - radius || p.y > box.y + box.height + radius) return false
  let len = 0
  try { len = path.getTotalLength() } catch { return false }
  const step = Math.max(2, len / 80)
  for (let l = 0; l <= len; l += step) {
    const pt = path.getPointAtLength(l)
    if ((pt.x - p.x) ** 2 + (pt.y - p.y) ** 2 <= radius * radius) return true
  }
  return false
}

// ---- DOM helpers ----
function pagesEl(): HTMLElement | null { return document.getElementById('pages') }
function pmEditorEl(): HTMLElement | null { return document.getElementById('pm-editor') }
function svgPath(cls: string): SVGPathElement {
  const p = document.createElementNS(SVGNS, 'path') as SVGPathElement
  p.setAttribute('class', cls)
  return p
}

// drawState lives in draw.ts; read it fresh each call (the shared tool state).
function state(): { on: boolean; tool: string; pen: Pen; eraseRadius: number; eraseMode: string } | null {
  const pm = PM()
  return (pm && typeof pm.dGetState === 'function' && pm.dGetState()) || null
}

// ---- mount / position (track-chrome.ts mount + zoom-scale pattern) ----
// The layer is a child of #pages (the same parent track-chrome uses) sized/positioned over
// #pm-editor. #pages carries the zoom scale() transform, so children share its scaled space —
// we size the layer to #pm-editor's offset box WITHIN #pages (offsetLeft/Top/Width/Height).
function ensureLayer(): SVGSVGElement | null {
  const pages = pagesEl()
  const pm = pmEditorEl()
  if (!pages || !pm) return null
  if (!layer || !layer.isConnected || layer.parentElement !== pages) {
    layer = document.querySelector('#pages > svg.wc-ink-layer') as SVGSVGElement | null
    if (!layer) {
      layer = document.createElementNS(SVGNS, 'svg') as SVGSVGElement
      layer.setAttribute('class', 'wc-ink-layer')
    }
    pages.appendChild(layer) // append LAST so the sibling-combinator Hide-Ink rule + z-order hold
  }
  sizeLayer()
  return layer
}
function sizeLayer() {
  const pages = pagesEl()
  const pm = pmEditorEl()
  if (!layer || !pages || !pm) return
  // #pm-editor's box within #pages (the same un-scaled coordinate space the SVG draws in).
  const lft = pm.offsetLeft
  const top = pm.offsetTop
  const wd = pm.offsetWidth
  const ht = pm.offsetHeight
  layer.style.left = lft + 'px'
  layer.style.top = top + 'px'
  layer.style.width = wd + 'px'
  layer.style.height = ht + 'px'
  layer.setAttribute('width', String(wd))
  layer.setAttribute('height', String(ht))
  layer.setAttribute('viewBox', `0 0 ${wd} ${ht}`)
}

// Map a pointer event → #pm-editor-local px (zoom-scale divided out, track-chrome.ts:98-99).
function localPt(e: PointerEvent): Pt {
  const pm = pmEditorEl()
  const pages = pagesEl()
  if (!pm) return { x: 0, y: 0 }
  const r = pm.getBoundingClientRect()
  const scale = pages && pages.offsetWidth ? pages.getBoundingClientRect().width / pages.offsetWidth : 1
  const s = scale || 1
  return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }
}

// M4c (paged) — the #pages-local origin of the painted page a committed ink node is anchored to. The node's OWN
// position has no layout rect (it's a relativeFrom='page' float), but a NEARBY in-flow position does, so scan a few
// offsets for a finite pageIndex (PE.computeCaretLayoutRect) → WC.PM.coords.overlayPageBox(pageIndex). renderInk adds
// this to a page-local inkPos to place the stroke at #pages-local on its page. null pre-layout / overlay / page-0.
function pageOriginForNode(nodePos: number): { left: number; top: number } | null {
  const C = w().WC?.PM?.coords
  const pe = w().WC?.presentation
  if (!C || typeof C.overlayPageBox !== 'function' || !pe || typeof pe.computeCaretLayoutRect !== 'function') return null
  let pi: number | null = null
  // FORWARD-FIRST: an ink float is an inline atom anchored in a paragraph; positions AFTER it (nodePos+1…) are the
  // rest of that paragraph, on the ANCHOR's page. For a stroke anchored at a page TOP, nodePos−1 is the END of the
  // PREVIOUS page → it would resolve the wrong page. So prefer forward neighbours (which stay on the anchor page),
  // then fall back to backward and the node's own pos. (Skip negative positions.)
  for (const d of [1, 2, 3, -1, -2, -3, 0]) {
    const p = nodePos + d
    if (p < 0) continue
    try { const r = pe.computeCaretLayoutRect(p); if (r && Number.isFinite(r.pageIndex)) { pi = r.pageIndex; break } } catch { /* keep scanning */ }
  }
  if (pi == null) return null
  try { const ob = C.overlayPageBox(pi); if (ob) return { left: ob.left, top: ob.top } } catch { /* none */ }
  return null
}

// ---- capture binding (only while a draw/erase/select/lasso tool is active) ----
function activeCapture(): boolean {
  const st = state()
  return !!(st && st.on && (st.tool === 'pen' || st.tool === 'highlighter' || st.tool === 'pencil' || st.tool === 'eraser' || st.tool === 'select' || st.tool === 'lasso'))
}

function onDown(e: PointerEvent) {
  const st = state()
  if (!st || !st.on || !layer) return
  e.preventDefault()
  const p = localPt(e)
  if (st.tool === 'eraser') { drawing = true; eraseAt(p, st.eraseRadius); return }
  if (st.tool === 'select') { selectAt(p); return }
  if (st.tool === 'lasso') {
    layer.querySelectorAll('.pm-ink-stroke.sel').forEach((s) => s.classList.remove('sel'))
    drawing = true; lasso = true; lassoPts = [p]
    lassoPath = svgPath('pm-ink-lasso')
    lassoPath.setAttribute('d', `M ${p.x} ${p.y}`)
    layer.appendChild(lassoPath)
    return
  }
  // pen / pencil / highlighter — start a temp in-progress stroke
  if (isPaged()) {
    // M4c: resolve the draw page ONCE (clamp the stroke to it) + the #pages-local page origin + the doc position
    // to re-anchor the node to — so a page-2+ stroke EXPORTS on its page (page-local posOffset). + pointer capture
    // so a stroke that crosses an inter-page gap keeps delivering move/up.
    const C = w().WC?.PM?.coords
    let pi = 0, origin = { left: 0, top: 0 }, docPos: number | null = null
    try { const lp = C?.clientToOverlayLocalPt?.(e.clientX, e.clientY); if (lp && Number.isFinite(lp.pageIndex)) pi = lp.pageIndex } catch { /* page 0 */ }
    try { const ob = C?.overlayPageBox?.(pi); if (ob) origin = { left: ob.left, top: ob.top } } catch { /* origin 0,0 */ }
    try { const h = C?.clientToPos?.(e.clientX, e.clientY); if (h && typeof h.pos === 'number') docPos = h.pos } catch { /* anchor at caret */ }
    pageClamp = { pageIndex: pi, origin, docPos }
    try { layer.setPointerCapture(e.pointerId) } catch { /* capture best-effort */ }
  } else {
    pageClamp = null
  }
  drawing = true; curPts = [p]
  curPath = svgPath('pm-ink-stroke in-progress')
  applyPen(curPath, st.pen)
  curPath.setAttribute('d', `M ${p.x} ${p.y}`)
  layer.appendChild(curPath)
}
function onMove(e: PointerEvent) {
  if (!drawing || !layer) return
  const st = state()
  const p = localPt(e)
  if (st && st.tool === 'eraser') { eraseAt(p, st.eraseRadius); return }
  if (lasso && lassoPath) {
    lassoPts.push(p)
    lassoPath.setAttribute('d', 'M ' + lassoPts.map((q) => q.x + ' ' + q.y).join(' L ') + ' Z')
    return
  }
  if (curPath) { curPts.push(p); curPath.setAttribute('d', smooth(curPts)) }
}
function onUp() {
  if (!drawing) return
  drawing = false
  if (lasso) { finishLasso(); lasso = false; lassoPts = []; if (lassoPath) { lassoPath.remove(); lassoPath = null }; return }
  if (!curPath) return
  const st = state()
  const pts = curPts.slice()
  // remove the temp path — the persisted node renders via renderInk()
  curPath.remove(); curPath = null; curPts = []
  if (!pts.length) return
  // dot = a single point: pin a tiny stroke so it still exports/renders
  const strokePts = pts.length >= 2 ? pts : [pts[0], { x: pts[0].x + 0.1, y: pts[0].y + 0.1 }]
  // PAGE-px position = the stroke's tight bbox top-left in #pm-editor-local px (anchored where
  // drawn). The fork blob localizes points to a (0,0)-origin bbox, so pos carries the offset.
  const minX = Math.min(...strokePts.map((q) => q.x))
  const minY = Math.min(...strokePts.map((q) => q.y))
  // overlay: pos = the stroke bbox top-left in #pm-editor-local px (anchored where drawn).
  // M4c (paged): the captured points are #pages-local; subtract the clamped page origin → PAGE-LOCAL px so the
  // wp:anchor posOffset (relativeFrom='page') is correct, and re-anchor the node to a doc position ON the draw page
  // (insertPos) so its EXPORTED page is the draw page. The raw #pages-local points stay in inkPoints; renderInk
  // re-adds the page origin (pageOriginForNode) to place them back at #pages-local. (pointerup implicitly releases
  // the pointer capture set at onDown.)
  let pos = { x: Math.max(0, Math.round(minX)), y: Math.max(0, Math.round(minY)) }
  let insertPos: number | undefined
  const clamp = pageClamp
  pageClamp = null
  if (isPaged() && clamp) {
    pos = { x: Math.max(0, Math.round(minX - clamp.origin.left)), y: Math.max(0, Math.round(minY - clamp.origin.top)) }
    insertPos = clamp.docPos != null ? clamp.docPos : undefined
  }
  const pen = (st && st.pen) || { color: '#000000', width: 2, opacity: 1 }
  const pm = PM()
  // ONE persist per stroke, on pointerup only (K7/K8).
  if (pm && typeof pm.dInsertInk === 'function') pm.dInsertInk(strokePts, pen, pos, insertPos)
  // renderInk() runs off the resulting transaction; force it in case the tr listener is async.
  renderInk()
}

function applyPen(path: SVGPathElement, pen?: Pen) {
  const p = pen || {}
  path.setAttribute('stroke', String(p.color || '#000000'))
  path.setAttribute('stroke-width', String(p.width == null ? 2 : p.width))
  path.setAttribute('stroke-opacity', String(p.opacity == null ? 1 : p.opacity))
}

// ---- eraser / select / lasso over the PERSISTED ink ----
// Each rendered .pm-ink-stroke carries data-ink-pos (its node start position) — delete the node.
function nodePosOf(path: Element): number | null {
  const v = path.getAttribute('data-ink-pos')
  if (v == null) return null
  const n = parseInt(v, 10)
  return isFinite(n) ? n : null
}
function deleteNodesAt(positions: number[]) {
  const pm = PM()
  if (!pm || !editor?.state || !editor.view) return
  const uniq = Array.from(new Set(positions.filter((p) => p != null))).sort((a, b) => b - a) // right→left
  if (!uniq.length) return
  try {
    let tr = editor.state.tr
    for (const pos of uniq) {
      const node = editor.state.doc.nodeAt(pos)
      if (node) tr = tr.delete(pos, pos + node.nodeSize)
    }
    editor.view.dispatch(tr)
  } catch { /* stale positions mid-edit — next render reconciles */ }
  renderInk()
}
function eraseAt(p: Pt, radius?: number) {
  if (!layer) return
  const r = radius || 10
  const hits: number[] = []
  layer.querySelectorAll('.pm-ink-stroke').forEach((s) => {
    if (pathNear(s as SVGPathElement, p, r)) { const pos = nodePosOf(s); if (pos != null) hits.push(pos) }
  })
  if (hits.length) deleteNodesAt(hits)
}
function selectAt(p: Pt) {
  if (!layer) return
  layer.querySelectorAll('.pm-ink-stroke.sel').forEach((s) => s.classList.remove('sel'))
  const strokes = Array.from(layer.querySelectorAll('.pm-ink-stroke')).reverse()
  const hit = strokes.find((s) => pathNear(s as SVGPathElement, p, 8))
  if (hit) hit.classList.add('sel')
}
function finishLasso() {
  if (!layer || lassoPts.length < 3) return
  let n = 0
  layer.querySelectorAll('.pm-ink-stroke').forEach((s) => {
    const path = s as SVGPathElement
    let len = 0
    try { len = path.getTotalLength() } catch { return }
    let inside = 0, total = 0
    for (let l = 0; l <= len; l += Math.max(2, len / 12)) {
      const pt = path.getPointAtLength(l); total++
      if (pointInPoly({ x: pt.x, y: pt.y }, lassoPts)) inside++
    }
    if (total && inside / total > 0.6) { s.classList.add('sel'); n++ }
  })
  try { w().WC?.toast?.(n ? `Lassoed ${n} stroke(s).` : 'No strokes inside the loop.') } catch { /* none */ }
}
function deleteSelected() {
  if (!layer) return
  const hits: number[] = []
  layer.querySelectorAll('.pm-ink-stroke.sel').forEach((s) => { const pos = nodePosOf(s); if (pos != null) hits.push(pos) })
  if (hits.length) deleteNodesAt(hits)
}

// ---- render every ink vectorShape from the doc (K3: fresh inkPoints AND reopened paths) ----
function renderInk() {
  const lyr = ensureLayer()
  if (!lyr || !editor?.state) return
  // wipe everything except an in-progress temp stroke / lasso (they belong to the live gesture)
  Array.from(lyr.childNodes).forEach((c) => {
    const cls = (c as Element).getAttribute?.('class') || ''
    if (/\bin-progress\b/.test(cls) || /\bpm-ink-lasso\b/.test(cls)) return
    lyr.removeChild(c)
  })
  // M4c: the per-stroke page-origin re-add only matters in paged with >1 page (single-page/overlay → page-0 origin
  // (0,0), a no-op). Compute the gate ONCE per render so single-page docs skip the per-node computeCaretLayoutRect.
  const pagedMulti = isPaged() && (() => { try { const n = w().WC?.PM?.coords?.getPageCount?.(); return typeof n === 'number' ? n > 1 : true } catch { return true } })()
  editor.state.doc.descendants((node: any, pos: number) => {
    if (node.type?.name !== 'vectorShape') return
    const a = node.attrs || {}
    const cg = a.customGeometry
    if (a.isInk && cg && Array.isArray(cg.inkPoints)) {
      // FRESH: re-smooth the raw px points at the anchored position.
      let ip = cg.inkPos || { x: 0, y: 0 }
      if (pagedMulti) {
        // inkPos is PAGE-LOCAL in paged (M4c) — add the node's painted-page #pages-local origin so the stroke
        // renders on its page. Page 0 origin = (0,0) → no change. Pre-layout/unresolved → render as-is (settles on
        // the next wc:paged-relayout). Overlay/single-page never enter this branch.
        const origin = pageOriginForNode(pos)
        if (origin) ip = { x: (ip.x || 0) + origin.left, y: (ip.y || 0) + origin.top }
      }
      const offset = (ip.x || 0) - Math.min(...cg.inkPoints.map((q: Pt) => q.x))
      const offY = (ip.y || 0) - Math.min(...cg.inkPoints.map((q: Pt) => q.y))
      const placed = cg.inkPoints.map((q: Pt) => ({ x: q.x + offset, y: q.y + offY }))
      const path = svgPath('pm-ink-stroke')
      applyPen(path, cg.inkPen)
      path.setAttribute('d', smooth(placed))
      path.setAttribute('data-ink-pos', String(pos))
      lyr.appendChild(path)
    } else if (cg && Array.isArray(cg.paths) && cg.paths.length) {
      // REOPENED: the importer's ready-made SVG `d` strings are in EMU space (a:pt = px*EMU).
      // Scale back to px and offset by the recovered anchor position. (PE does NOT paint reopened ink — the overlay
      // is the sole renderer in both modes — so no double-draw to suppress in paged.) NOTE: the multi-page
      // positioning of REOPENED ink depends on the importer recovering customGeometry.inkPos (page-local), which it
      // does not currently populate — a pre-existing gap (both modes), separate from M4c's export fix.
      const ip = cg.inkPos || { x: 0, y: 0 }
      const stroke = a.strokeColor || penColorFromDrawing(a) || '#000000'
      const sw = a.strokeWidth || 2
      for (const seg of cg.paths) {
        if (!seg || !seg.d) continue
        const path = svgPath('pm-ink-stroke')
        path.setAttribute('stroke', String(stroke))
        path.setAttribute('stroke-width', String(sw))
        path.setAttribute('stroke-opacity', '1')
        path.setAttribute('d', scaleEmuPath(seg.d, ip.x || 0, ip.y || 0))
        path.setAttribute('data-ink-pos', String(pos))
        lyr.appendChild(path)
      }
    }
  })
}
// Recover a stroke color from the replayed a:ln/a:srgbClr in the drawingContent blob, if present.
function penColorFromDrawing(attrs: any): string | null {
  try {
    const json = JSON.stringify(attrs.drawingContent || {})
    const m = json.match(/"srgbClr"[\s\S]*?"val"\s*:\s*"([0-9A-Fa-f]{6})"/)
    return m ? '#' + m[1] : null
  } catch { return null }
}
// Scale an EMU-space SVG `d` (numbers are px*EMU) → px, then translate by the anchor (px).
function scaleEmuPath(d: string, dx: number, dy: number): string {
  let coordIdx = 0
  return d.replace(/-?\d+(\.\d+)?/g, (numStr) => {
    const v = parseFloat(numStr) / EMU
    const placed = (coordIdx % 2 === 0 ? v + dx : v + dy)
    coordIdx++
    return String(Math.round(placed * 100) / 100)
  })
}

// ---- replay (legacy replay(): stroke-dashoffset animation) ----
function replay() {
  if (!layer) return
  const strokes = Array.from(layer.querySelectorAll('.pm-ink-stroke')) as SVGPathElement[]
  if (!strokes.length) { try { w().WC?.toast?.('No ink to replay.') } catch { /* none */ } return }
  strokes.forEach((s) => {
    let len = 1
    try { len = s.getTotalLength() || 1 } catch { /* unrendered */ }
    s.style.transition = 'none'
    s.style.strokeDasharray = String(len)
    s.style.strokeDashoffset = String(len)
  })
  let i = 0
  const drawNext = () => {
    if (i >= strokes.length) {
      strokes.forEach((s) => { s.style.transition = ''; s.style.strokeDasharray = ''; s.style.strokeDashoffset = '' })
      return
    }
    const s = strokes[i++]
    s.style.transition = 'stroke-dashoffset .4s linear'
    if (window.requestAnimationFrame) requestAnimationFrame(() => { s.style.strokeDashoffset = '0' })
    else s.style.strokeDashoffset = '0'
    setTimeout(drawNext, 420)
  }
  try { w().WC?.toast?.('Replaying ink…') } catch { /* none */ }
  drawNext()
}

// ---- sync: read drawState → toggle capture binding + cursor + pointer-events ----
function sync() {
  const lyr = ensureLayer()
  if (!lyr) return
  const st = state()
  const on = activeCapture()
  lyr.classList.toggle('pm-ink-active', on)
  // cursor per tool
  let cursor = 'crosshair'
  if (st && st.tool === 'eraser') cursor = 'cell'
  else if (st && (st.tool === 'select' || st.tool === 'lasso')) cursor = 'default'
  lyr.style.cursor = cursor
  if (on) bind()
  else unbind()
}

function onKey(e: KeyboardEvent) {
  if ((e.key === 'Delete' || e.key === 'Backspace') && layer && layer.querySelector('.pm-ink-stroke.sel')) {
    e.preventDefault()
    deleteSelected()
  }
}
function bind() {
  if (bound || !layer) return
  layer.addEventListener('pointerdown', onDown as EventListener)
  window.addEventListener('pointermove', onMove as EventListener)
  window.addEventListener('pointerup', onUp as EventListener)
  document.addEventListener('keydown', onKey as EventListener)
  bound = true
}
function unbind() {
  if (!bound) return
  if (layer) layer.removeEventListener('pointerdown', onDown as EventListener)
  window.removeEventListener('pointermove', onMove as EventListener)
  window.removeEventListener('pointerup', onUp as EventListener)
  document.removeEventListener('keydown', onKey as EventListener)
  bound = false
}

// clear() — remove temp/in-progress paths (the doc-level clear is dClearInk in draw.ts).
function clearTemp() {
  if (!layer) return
  layer.querySelectorAll('.in-progress, .pm-ink-lasso').forEach((s) => s.remove())
  curPath = null; curPts = []; lassoPath = null; lassoPts = []; drawing = false; lasso = false
}

// relink() — re-attach the layer after a PM document load + re-render the new doc's ink.
function relink() {
  layer = null
  bound = false
  ensureLayer()
  renderInk()
  sync()
}

// ---- install (re-entrant: replaceEditor re-runs installBridge on Open/New; old listeners die
// with the swap. We rebuild the layer against the new editor + re-render on its first tr) ----
export function installInkOverlay(ed: AnyEditor) {
  // tear down any prior binding from a previous editor instance
  unbind()
  editor = ed
  layer = null
  drawing = false; lasso = false
  curPath = null; curPts = []; lassoPath = null; lassoPts = []
  const handle = {
    sync,
    replay,
    clear: clearTemp,
    relink,
    renderInk,
  }
  // re-render ink on every transaction AND on document load (track-chrome/notes-area mechanism)
  ed.on?.('transaction', () => { try { renderInk() } catch (e) { console.error('[WC.InkOverlay] render failed', e) } })
  // M4c (paged) — a pure PE relayout fires NO PM transaction, so re-render committed ink on wc:paged-relayout too;
  // this settles a freshly-drawn page-2+ stroke onto its correct painted page once PE has laid the node out
  // (pageOriginForNode then resolves). Window-scoped, so remove any prior handler (re-install on Open/New).
  if (relayoutHandler) { try { window.removeEventListener('wc:paged-relayout', relayoutHandler) } catch { /* none */ } }
  // DEBOUNCED (coalesce a relayout burst — zoom/scroll/reflow — into one render per 80ms, matching the M4a
  // track-chrome/comments-ui schedule() pattern) so renderInk's per-stroke page resolution isn't run per-fire.
  relayoutHandler = () => { if (relayoutTimer) return; relayoutTimer = setTimeout(() => { relayoutTimer = null; try { renderInk() } catch (e) { /* best-effort settle */ } }, 80) }
  window.addEventListener('wc:paged-relayout', relayoutHandler)
  ensureLayer()
  renderInk()
  sync()
  return { __inkOverlay: handle }
}
