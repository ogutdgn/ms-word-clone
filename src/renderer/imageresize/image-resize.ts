// Phase 4b — live image resize. An OWNED layer over the vendored fork (same philosophy
// as the pagination engine: rides the plugin pipeline as an Extension, stays OUT of the
// fork, never replaces the image's renderDOM). When a single image node is selected
// (a PM NodeSelection — the same state the old DECORATIVE handles keyed on), a handle
// overlay is painted over it; dragging a handle previews the new size live and, on
// pointer-up, dispatches ONE setNodeMarkup writing the image's `size` attr in px. The
// fork's exporter already turns `size` into `wp:extent` + `a:ext` (EMU), so a resize
// round-trips to .docx with no exporter change.
//
// COORDINATE TRICK: the overlay mounts inside `#pages`, which carries the zoom
// `transform: scale()`. A CSS transform makes its element a containing block for
// absolutely-positioned descendants, so the overlay positions relative to #pages's box
// and is scaled by the SAME transform as the image. Positioned at the image's UNSCALED
// offset within #pages (`(rect - pagesRect) / zoom`), it stays aligned across zoom AND
// scroll with no per-frame repositioning — only re-placed when the selection/layout
// changes. Pointer-drag deltas are screen px, divided by zoom to get content px.
//
// SCOPE (4b): aspect-locked resize (width-driven; height = width / aspect), which is
// Word's default for pictures (`a:picLocks/@noChangeAspect`, the `lockAspectRatio` attr).
// All 8 handles resize proportionally. Free one-axis stretch (lockAspectRatio off, which
// needs the fork's size renderDOM to honor an explicit height instead of `height: auto`)
// is deferred — see deferrals.md.

import { Plugin, PluginKey, NodeSelection } from '@/pm'
// @ts-ignore - vendored fork JS module (no types)
import { Extension } from '@core/Extension.js'

export const imageResizeKey = new PluginKey('wcImageResize')

const MIN_W = 16 // px — never let an image collapse to nothing (export guards >0 too)
const MAX_DIM = 4000 // px — upper bound on a free-stretch axis (a runaway drag can't blow out layout)

// 8 handles. `gx`/`gy` = fractional placement on the box (0=left/top … 1=right/bottom).
// `dx`/`dy` = which way the handle grows the box (+1 right/down, -1 left/up, 0 fixed axis).
interface HandleSpec { id: string; gx: number; gy: number; dx: number; dy: number }
const HANDLES: HandleSpec[] = [
  { id: 'nw', gx: 0, gy: 0, dx: -1, dy: -1 },
  { id: 'n', gx: 0.5, gy: 0, dx: 0, dy: -1 },
  { id: 'ne', gx: 1, gy: 0, dx: 1, dy: -1 },
  { id: 'e', gx: 1, gy: 0.5, dx: 1, dy: 0 },
  { id: 'se', gx: 1, gy: 1, dx: 1, dy: 1 },
  { id: 's', gx: 0.5, gy: 1, dx: 0, dy: 1 },
  { id: 'sw', gx: 0, gy: 1, dx: -1, dy: 1 },
  { id: 'w', gx: 0, gy: 0.5, dx: -1, dy: 0 },
]

interface Box { left: number; top: number; width: number; height: number }

// M4b.1: write a live preview size onto an image element (and its inner <img> if it's a wrapper).
// Used during a resize drag for BOTH the editable node DOM and (paged) the PAINTED image element, so the
// image itself — not just the handle outline — resizes while dragging. (overlay: paintedDom is null → no-op.)
function applyPreviewSize(el: HTMLElement | null, width: number, height: number): void {
  if (!el || !el.style) return
  el.style.width = width + 'px'
  el.style.height = height + 'px'
  const img = el.tagName === 'IMG' ? el : el.querySelector('img')
  if (img && img !== el) { (img as HTMLElement).style.width = width + 'px'; (img as HTMLElement).style.height = height + 'px' }
}

class ImageResizeView {
  view: any
  overlay: HTMLElement | null = null
  handleEls: HTMLElement[] = []
  moveRegion: HTMLElement | null = null // 4c.2 drag-to-reposition body (floating images only)
  pagesEl: HTMLElement | null = null
  // Active RESIZE drag state (null when idle).
  drag: {
    pos: number
    nodeDOM: HTMLElement
    paintedDom: HTMLElement | null // M4b.1: the PAINTED image element (paged) — for the live drag preview
    startW: number
    startH: number
    aspect: number
    lockAspect: boolean // image's lockAspectRatio attr (default true = Word's noChangeAspect)
    spec: HandleSpec
    startClientX: number
    startClientY: number
    width: number
    height: number
  } | null = null
  // Active MOVE drag state (null when idle) — 4c.2 drag-to-reposition for a floating picture.
  moveDrag: {
    pos: number
    nodeDOM: HTMLElement
    startClientX: number
    startClientY: number
    startH: number // marginOffset.horizontal at drag start (px)
    startT: number // marginOffset.top at drag start (px)
    baseTransform: string // the node's existing CSS transform (rotate/scale) — preserved, not clobbered
    boxLeft: number
    boxTop: number
    h: number
    t: number
  } | null = null
  onMove: ((e: PointerEvent) => void) | null = null
  onUp: ((e: PointerEvent) => void) | null = null
  destroyed = false

  onWinResize: (() => void) | null = null

  constructor(view: any) {
    this.view = view
    // The overlay is positioned from the image's measured rect; a window/column reflow
    // moves the image WITHOUT a PM transaction (so update() wouldn't fire). Re-place on
    // resize (rAF-coalesced) so the handles don't drift off a selected image.
    this.onWinResize = () => { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.update() }) }
    window.addEventListener('resize', this.onWinResize)
    // M4b: in paged mode PE re-paginates without a transaction (zoom/reflow), so update() wouldn't fire.
    // Reposition the handles on the shared wc:paged-relayout event (same rAF-coalesced handler). Removed in destroy().
    window.addEventListener('wc:paged-relayout', this.onWinResize)
    this.update()
  }

  raf = 0

  zoom(): number {
    // M4b: the rendered #pages scale via the seam — ONE scale source for handle positioning AND the drag
    // deltas (so they can't diverge). = WC.PM.zoom in overlay (byte-identical); painted-correct in paged.
    return ((window as any).WC?.PM?.coords?.overlayScale?.()) ?? ((window as any).WC?.PM?.zoom || 1)
  }

  // The currently selected single image: { pos, node } or null.
  selectedImage(): { pos: number; node: any } | null {
    const sel = this.view?.state?.selection
    if (sel instanceof NodeSelection && sel.node?.type?.name === 'image') {
      return { pos: sel.from, node: sel.node }
    }
    return null
  }

  ensureOverlay(): boolean {
    if (this.overlay) return true
    const pages = document.getElementById('pages')
    if (!pages) return false
    this.pagesEl = pages
    const ov = document.createElement('div')
    ov.className = 'wc-img-resize'
    ov.setAttribute('contenteditable', 'false')
    ov.style.position = 'absolute'
    ov.style.pointerEvents = 'none' // only the handles are interactive
    ov.style.zIndex = '40'
    ov.style.display = 'none'
    // 4c.2 — drag-to-reposition body. FIRST child so the 8 resize handles paint ON TOP and win
    // at the edges; `inset` keeps it inside the handle ring so it only grabs the center. Enabled
    // (pointerEvents:'auto') ONLY for a floating (isAnchor) image — see place().
    const mv = document.createElement('div')
    mv.className = 'wc-img-move-region'
    mv.style.position = 'absolute'
    mv.style.inset = '8px'
    mv.style.pointerEvents = 'none'
    mv.style.cursor = 'move'
    mv.addEventListener('pointerdown', (e) => this.onMoveDown(e as PointerEvent))
    ov.appendChild(mv)
    this.moveRegion = mv
    for (const spec of HANDLES) {
      const h = document.createElement('div')
      h.className = 'wc-img-handle wc-img-handle-' + spec.id
      h.style.position = 'absolute'
      h.style.pointerEvents = 'auto'
      h.addEventListener('pointerdown', (e) => this.onHandleDown(e as PointerEvent, spec))
      ov.appendChild(h)
      this.handleEls.push(h)
    }
    pages.appendChild(ov)
    this.overlay = ov
    return true
  }

  // Image box in #pages UNSCALED coordinates (zoom-/scroll-invariant once placed).
  // M4b: via the WC.PM.coords seam — painted-page-correct in paged mode, byte-identical in overlay (the seam's
  // nodeBoxFor uses view.nodeDOM in overlay, the legacy path). Keep the pagesEl guard (overlay must be mounted).
  boxFor(pos: number): Box | null {
    if (!this.pagesEl) return null
    return ((window as any).WC?.PM?.coords?.nodeBoxFor?.(pos)) ?? null
  }

  place(box: Box, floating: boolean) {
    const ov = this.overlay!
    ov.style.left = box.left + 'px'
    ov.style.top = box.top + 'px'
    ov.style.width = box.width + 'px'
    ov.style.height = box.height + 'px'
    ov.style.display = 'block'
    for (let i = 0; i < HANDLES.length; i++) {
      const s = HANDLES[i]
      const el = this.handleEls[i]
      el.style.left = `calc(${s.gx * 100}% - 4px)`
      el.style.top = `calc(${s.gy * 100}% - 4px)`
      el.style.cursor = handleCursor(s)
    }
    // Drag-to-reposition is only meaningful for a FLOATING picture (an inline picture flows with
    // the text and has no marginOffset). Enable the move-region's hit area only then.
    if (this.moveRegion) this.moveRegion.style.pointerEvents = floating ? 'auto' : 'none'
  }

  hide() {
    if (this.overlay) this.overlay.style.display = 'none'
  }

  update() {
    if (this.destroyed) return
    if (this.drag || this.moveDrag) return // don't fight an in-progress drag
    const sel = this.selectedImage()
    if (!sel) { this.hide(); return }
    if (!this.ensureOverlay()) return
    const box = this.boxFor(sel.pos)
    if (!box) { this.hide(); return }
    this.place(box, !!sel.node?.attrs?.isAnchor)
  }

  onHandleDown(e: PointerEvent, spec: HandleSpec) {
    const sel = this.selectedImage()
    if (!sel) return
    e.preventDefault()
    e.stopPropagation()
    // Clear any prior drag's window listeners before re-arming, so a re-entrant
    // pointerdown (missed pointerup, multi-pointer) can never leak a live listener.
    this.teardownDragListeners()
    this.moveDrag = null // abandon any stranded MOVE drag (shared listener slots, separate state)
    let dom: any = null
    try { dom = this.view.nodeDOM(sel.pos) } catch { dom = null }
    if (!dom) return
    // M4b.1: in paged mode `this.view` is the HIDDEN inner editor, so `dom` (view.nodeDOM) is the
    // off-screen image — a live preview written to it is invisible. Also grab the PAINTED image element
    // (PE's getElementAtPos) so onDragMove resizes the image the user actually sees. Null in overlay.
    let paintedDom: HTMLElement | null = null
    try { const ed = (window as any).WC?.editor; if (ed?.presentationEditor && typeof ed.getElementAtPos === 'function') paintedDom = ed.getElementAtPos(sel.pos) } catch { paintedDom = null }
    const box = this.boxFor(sel.pos)
    if (!box) return
    const startW = box.width
    const startH = box.height
    this.drag = {
      pos: sel.pos,
      nodeDOM: dom as HTMLElement,
      paintedDom,
      startW,
      startH,
      aspect: startH > 0 ? startW / startH : 1,
      // Word default = aspect LOCKED (a:picLocks/@noChangeAspect). Only an explicit `false`
      // (e.g. an imported picture with the lock unchecked) enables free one-axis stretch.
      lockAspect: sel.node?.attrs?.lockAspectRatio !== false,
      spec,
      startClientX: e.clientX,
      startClientY: e.clientY,
      width: startW,
      height: startH,
    }
    this.onMove = (ev: PointerEvent) => this.onDragMove(ev)
    this.onUp = (ev: PointerEvent) => this.onDragUp(ev)
    window.addEventListener('pointermove', this.onMove, true)
    window.addEventListener('pointerup', this.onUp, true)
  }

  onDragMove(e: PointerEvent) {
    const d = this.drag
    if (!d) return
    const z = this.zoom()
    const dxc = (e.clientX - d.startClientX) / z
    const dyc = (e.clientY - d.startClientY) / z
    const maxW = this.maxWidth()
    let width: number
    let height: number
    if (!d.lockAspect) {
      // FREE stretch: each handle drives only the axes it touches — an edge handle moves one
      // axis (the other fixed), a corner handle distorts both independently.
      width = d.spec.dx !== 0 ? d.startW + d.spec.dx * dxc : d.startW
      height = d.spec.dy !== 0 ? d.startH + d.spec.dy * dyc : d.startH
      width = Math.max(MIN_W, Math.min(maxW, width))
      height = Math.max(MIN_W, Math.min(MAX_DIM, height))
    } else {
      // Aspect-locked (Word default): width is the master dimension. Corner + E/W handles drive
      // from the horizontal delta; pure N/S handles drive from the vertical delta scaled by aspect.
      let widthDelta: number
      if (d.spec.dx !== 0) widthDelta = d.spec.dx * dxc
      else widthDelta = d.spec.dy * dyc * d.aspect
      width = Math.max(MIN_W, Math.min(maxW, d.startW + widthDelta))
      height = width / d.aspect
    }
    d.width = width
    d.height = height
    // Live preview (cheap DOM; the real model write happens once on pointer-up). Set BOTH axes — the image
    // renderDOM now honors an explicit height, so a free-stretch previews correctly. Apply to the editable
    // node DOM AND (paged) the PAINTED image, so the image — not just the handle outline — resizes live.
    // (No PE repaint happens mid-drag — no doc change — so the painted inline style persists; the commit's
    // repaint on pointer-up replaces it with the final size.)
    applyPreviewSize(d.nodeDOM, width, height)
    applyPreviewSize(d.paintedDom, width, height)
    // Keep the overlay box tracking the preview.
    if (this.overlay) {
      this.overlay.style.width = width + 'px'
      this.overlay.style.height = height + 'px'
    }
  }

  onDragUp(_e: PointerEvent) {
    const d = this.drag
    this.teardownDragListeners()
    this.drag = null
    if (!d) return
    const width = Math.round(d.width)
    const height = Math.round(d.height)
    const node = this.view.state.doc.nodeAt(d.pos)
    if (!node || node.type?.name !== 'image') { this.update(); return }
    const tr = this.view.state.tr.setNodeMarkup(d.pos, undefined, {
      ...node.attrs,
      size: { ...(node.attrs.size || {}), width, height },
    })
    // Re-assert the NodeSelection so the overlay stays up after the markup change.
    try { tr.setSelection(NodeSelection.create(tr.doc, d.pos)) } catch { /* selection re-assert best-effort */ }
    this.view.dispatch(tr)
    this.update()
  }

  // 4c.2 — drag-to-reposition a FLOATING picture. Mirrors the resize drag (screen-delta / zoom =
  // content-px) but TRANSLATES instead of resizing, then writes marginOffset on pointer-up via the
  // guarded WC.PM.setImagePosition (the same path the numeric dialog + arrow-nudge already use, which
  // the exporter turns into wp:positionH/V → wp:posOffset EMU, Word-COM-validated as Shapes.Left/Top).
  onMoveDown(e: PointerEvent) {
    const sel = this.selectedImage()
    if (!sel || !sel.node?.attrs?.isAnchor) return // inline pictures flow with text — no reposition
    // Imported floating pictures keep verbatim originalDrawingChildren — a new offset would be DROPPED
    // on save (setImagePosition refuses them). Don't start a misleading drag.
    const odc = sel.node.attrs.originalDrawingChildren
    if (Array.isArray(odc) && odc.length) return
    e.preventDefault()
    e.stopPropagation()
    this.teardownDragListeners()
    this.drag = null // abandon any stranded RESIZE drag (shared listener slots, separate state)
    let dom: any = null
    try { dom = this.view.nodeDOM(sel.pos) } catch { dom = null }
    if (!dom) return
    const box = this.boxFor(sel.pos)
    if (!box) return
    const mo = sel.node.attrs.marginOffset || {}
    const startH = Number(mo.horizontal) || 0
    const startT = Number(mo.top) || 0
    this.moveDrag = {
      pos: sel.pos,
      nodeDOM: dom as HTMLElement,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startH,
      startT,
      baseTransform: (dom as HTMLElement).style.transform || '',
      boxLeft: box.left,
      boxTop: box.top,
      h: startH,
      t: startT,
    }
    this.onMove = (ev: PointerEvent) => this.onMoveDragMove(ev)
    this.onUp = (ev: PointerEvent) => this.onMoveDragUp(ev)
    window.addEventListener('pointermove', this.onMove, true)
    window.addEventListener('pointerup', this.onUp, true)
  }

  onMoveDragMove(e: PointerEvent) {
    const d = this.moveDrag
    if (!d) return
    const z = this.zoom()
    const dxc = (e.clientX - d.startClientX) / z
    const dyc = (e.clientY - d.startClientY) / z
    d.h = d.startH + dxc
    d.t = d.startT + dyc
    // Live preview: APPEND a translate to the node's existing transform (preserve any rotate/scale —
    // never clobber it). The real model write happens once on pointer-up.
    d.nodeDOM.style.transform = (d.baseTransform ? d.baseTransform + ' ' : '') + `translate(${dxc}px, ${dyc}px)`
    if (this.overlay) {
      this.overlay.style.left = d.boxLeft + dxc + 'px'
      this.overlay.style.top = d.boxTop + dyc + 'px'
    }
  }

  onMoveDragUp(_e: PointerEvent) {
    const d = this.moveDrag
    this.teardownDragListeners()
    this.moveDrag = null
    if (!d) return
    // Clear the preview transform before the model write re-renders (avoid a flash of double offset).
    try { d.nodeDOM.style.transform = d.baseTransform } catch { /* node may be gone */ }
    // Absolute marginOffset = start + drag delta. The guarded bridge verb writes marginOffset →
    // wp:posOffset, refuses imported anchors, and re-asserts the NodeSelection + refocus.
    ;(window as any).WC?.PM?.setImagePosition?.({ horizontal: Math.round(d.h), top: Math.round(d.t) })
    this.update()
  }

  // Upper bound: the editable content width (an image can't usefully exceed the page text
  // column in this single-column engine; floating/over-margin is 4c).
  maxWidth(): number {
    const dom = this.view?.dom as HTMLElement
    const w = dom ? dom.clientWidth : 0
    return w > MIN_W ? w : 4000
  }

  teardownDragListeners() {
    if (this.onMove) window.removeEventListener('pointermove', this.onMove, true)
    if (this.onUp) window.removeEventListener('pointerup', this.onUp, true)
    this.onMove = null
    this.onUp = null
  }

  destroy() {
    this.destroyed = true
    this.teardownDragListeners()
    if (this.onWinResize) { window.removeEventListener('resize', this.onWinResize); window.removeEventListener('wc:paged-relayout', this.onWinResize) }
    this.onWinResize = null
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    if (this.overlay && this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay)
    this.overlay = null
    this.handleEls = []
  }
}

function handleCursor(s: HandleSpec): string {
  if (s.dx !== 0 && s.dy !== 0) return s.dx === s.dy ? 'nwse-resize' : 'nesw-resize'
  if (s.dx !== 0) return 'ew-resize'
  return 'ns-resize'
}

// Phase 4c.2 — arrow-key NUDGE for a selected FLOATING picture (Word nudges a selected object with
// the arrow keys). Reuses the guarded WC.PM.setImagePosition({...,relative:true}) so the move writes
// marginOffset → wp:posOffset and round-trips (and an imported picture is refused there, not here).
// Plain arrow = 8px step; Shift+arrow = 1px fine nudge. Only fires for an image NodeSelection that is
// floating (isAnchor) — otherwise it returns false and the arrow does its normal caret navigation.
const NUDGE_STEP = 8
function handleNudgeKeyDown(view: any, event: KeyboardEvent): boolean {
  const sel = view.state.selection
  if (!(sel instanceof NodeSelection) || sel.node?.type?.name !== 'image' || !sel.node.attrs?.isAnchor) return false
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  const step = event.shiftKey ? 1 : NUDGE_STEP
  let dx = 0
  let dy = 0
  if (event.key === 'ArrowLeft') dx = -step
  else if (event.key === 'ArrowRight') dx = step
  else if (event.key === 'ArrowUp') dy = -step
  else if (event.key === 'ArrowDown') dy = step
  else return false
  ;(window as any).WC?.PM?.setImagePosition?.({ horizontal: dx, top: dy, relative: true })
  // Consume the arrow regardless (the picture is selected, not text — the caret must not move/escape).
  return true
}

function createImageResizePlugin(): Plugin {
  return new Plugin({
    key: imageResizeKey,
    view(view: any) {
      return new ImageResizeView(view)
    },
    props: {
      handleKeyDown(view: any, event: KeyboardEvent) {
        return handleNudgeKeyDown(view, event)
      },
    },
  })
}

export const ImageResize = Extension.create({
  name: 'wcImageResize',
  // priority 200 (> the base Keymap's 100) so this plugin's handleKeyDown runs FIRST — the arrow
  // nudge then wins for a floating-image NodeSelection regardless of what the keymap binds, rather
  // than relying on the keymap's arrow handlers happening to bail on a NodeSelection. handleNudgeKeyDown
  // returns false for everything except an arrow on a floating image, so normal navigation is untouched.
  priority: 200,
  addPmPlugins() {
    return [createImageResizePlugin()]
  },
})
