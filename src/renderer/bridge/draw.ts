// Slice 10 PR4: draw (Draw tab) doc-mutation + tool-state surface on the PM engine.
// dInsertInk persists one freehand stroke as a REAL anchored DrawingML freeform shape
// (a:custGeom replayed by translateVectorShape → round-trips Word AND the fork — the
// net-new insertInkShape command; the oracle-validated default ink mode is 'anchor').
// dInsertCanvas inserts a real bounded rect "Drawing Canvas" frame (a:prstGeom rect +
// a:ln border, no custGeom, no text). dClearInk removes all ink shapes in one tr. The
// tool-state verbs (dSetDrawing/dSetEraser/dSetSelect/dSetLasso/dSetPen/dReplay) are
// NON-dirtying — they only mutate the shared drawState and late-bind to the PM-only ink
// overlay (PM.__inkOverlay) if it is mounted; they NEVER dispatch a doc transaction (K6).
// inkToShape/inkToMath degrade honestly. editor.commands/state read fresh each call (K5).
import { TextSelection } from '@/pm'
type AnyEditor = any

// Shared tool state — the ink overlay (installed later) reads the SAME object via dGetState().
const drawState = { on: false, tool: 'pen', pen: { color: '#000000', width: 2, opacity: 1 }, eraseRadius: 10, eraseMode: 'stroke' }

// Oracle-validated default ink mode: 'anchor' opens in Word without repair (ink floats where drawn).
const INK_MODE = 'anchor'

// Per-call unique-ish positive int for the canvas-frame wp:docPr id (avoids a duplicate-id Word repair).
let _canvasSeq = 5000

// Late-bound accessor for the PM-only ink overlay (it registers itself as PM.__inkOverlay on mount;
// this module installs BEFORE the overlay, so resolve it fresh each call).
const overlay = () => { try { const w = window as any; return (w.WC && w.WC.PM && w.WC.PM.__inkOverlay) || null } catch { return null } }

export function installDraw(editor: AnyEditor) {
  const w = window as any
  const refocus = () => editor.view?.focus()
  const toast = (m: string, d?: string) => { try { w.WC?.toast?.(m, d) } catch { /* none */ } }

  // ---- dInsertInk — the canonical persist verb (overlay calls it on stroke-up; also directly callable) ----
  // pos is optional (the direct [10dr] test path calls dInsertInk(points, pen) with no pos) → defaults to origin.
  // insertPos (M4c, paged re-anchor) is optional: when given, the ink node is inserted at that doc position (a
  // paragraph on the PAGE THE USER DREW ON) instead of the stale caret, so its wp:anchor anchor — and thus its
  // EXPORTED page — is the draw page. `pos` must then be PAGE-LOCAL px (relativeFrom='page' posOffset). Overlay
  // callers omit insertPos → the node anchors at the current selection with #pm-editor-local pos (unchanged).
  function dInsertInk(points: any[], pen?: any, pos?: any, insertPos?: number): boolean {
    try {
      if (typeof insertPos === 'number' && editor.view) {
        try {
          const d = editor.state.doc
          const clamped = Math.max(0, Math.min(insertPos, d.content.size))
          // TextSelection.near (NOT .create): snaps to the nearest valid TEXT position. .create THROWS when `clamped`
          // lands on an atom / non-text node (e.g. the user drew over an existing image or ink stroke), which the
          // catch would swallow → the re-anchor silently drops → the ink exports on the stale-caret page.
          editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(d.resolve(clamped))))
        } catch { /* re-anchor best-effort; fall back to the current selection */ }
      }
      return editor.commands.insertInkShape({
        points,
        pen: pen || drawState.pen,
        pos: pos || { x: 0, y: 0 },
        mode: INK_MODE,
      }) === true
    } catch { return false }
  }

  // ---- dInsertCanvas — a real bounded rect frame (the "Drawing Canvas" region) ----
  // Mirrors synthesizeInkDrawing's wp:inline wrapper but spPr = xfrm + prstGeom rect + noFill + a:ln border
  // (NO custGeom, NO text). The kind:'rect' attr makes VectorShapeView render it in-app; the drawingContent
  // makes the export carry prst="rect".
  function dInsertCanvas(): boolean {
    try {
      const EMU = 9525
      const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
      const wPx = 480, hPx = 240
      const wEmu = wPx * EMU, hEmu = hPx * EMU
      const id = ++_canvasSeq
      const stroke = '888888'
      const drawingContent = { elements: [{
        name: 'wp:inline', attributes: { distT: '0', distB: '0', distL: '0', distR: '0' }, elements: [
          { name: 'wp:extent', attributes: { cx: String(wEmu), cy: String(hEmu) } },
          { name: 'wp:effectExtent', attributes: { l: '0', t: '0', r: '0', b: '0' } },
          { name: 'wp:docPr', attributes: { id: String(id), name: 'Canvas ' + id } },
          { name: 'wp:cNvGraphicFramePr' },
          { name: 'a:graphic', attributes: { 'xmlns:a': A }, elements: [
            { name: 'a:graphicData', attributes: { uri: 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape' }, elements: [
              { name: 'wps:wsp', elements: [
                { name: 'wps:cNvSpPr' },
                { name: 'wps:spPr', elements: [
                  { name: 'a:xfrm', elements: [
                    { name: 'a:off', attributes: { x: '0', y: '0' } },
                    { name: 'a:ext', attributes: { cx: String(wEmu), cy: String(hEmu) } },
                  ] },
                  { name: 'a:prstGeom', attributes: { prst: 'rect' }, elements: [{ name: 'a:avLst' }] },
                  { name: 'a:noFill' },
                  { name: 'a:ln', attributes: { w: '12700' }, elements: [
                    { name: 'a:solidFill', elements: [{ name: 'a:srgbClr', attributes: { val: stroke } }] },
                  ] },
                ] },
                { name: 'wps:bodyPr' },
              ] },
            ] },
          ] },
        ],
      }] }
      const ok = editor.commands.insertContent({
        type: 'vectorShape',
        attrs: { kind: 'rect', width: wPx, height: hPx, fillColor: null, strokeColor: '#888888', drawingContent },
      }) === true
      if (ok) { refocus(); toast('Drawing canvas inserted.') }
      return ok
    } catch { return false }
  }

  // ---- tool-state (NON-dirtying — NO doc transaction; only drawState + overlay late-bind) ----
  function dSetDrawing(on: any): boolean { drawState.on = !!on; overlay()?.sync?.(); return true }
  function dIsDrawing(): boolean { return drawState.on }
  function dSetEraser(radius?: any, mode?: any): boolean {
    drawState.tool = 'eraser'
    if (radius != null) drawState.eraseRadius = radius
    if (mode != null) drawState.eraseMode = mode
    drawState.on = true
    overlay()?.sync?.()
    return true
  }
  function dSetSelect(): boolean { drawState.tool = 'select'; drawState.on = true; overlay()?.sync?.(); return true }
  function dSetLasso(): boolean { drawState.tool = 'lasso'; drawState.on = true; overlay()?.sync?.(); return true }
  function dSetPen(pen?: any): boolean {
    drawState.pen = { ...drawState.pen, ...(pen || {}) }
    drawState.tool = /highlighter/.test((pen && pen.id) || '') ? 'highlighter' : 'pen'
    overlay()?.sync?.()
    return true
  }
  function dReplay(): boolean { overlay()?.replay?.(); return true }

  // ---- dClearInk — remove ALL ink vectorShape nodes in ONE transaction (this DOES dirty) ----
  function dClearInk(): boolean {
    try {
      const ranges: Array<{ from: number; to: number }> = []
      editor.state.doc.descendants((n: any, p: number) => {
        if (n.type.name !== 'vectorShape') return
        const a = n.attrs || {}
        const cg = a.customGeometry
        if (a.isInk || (cg && cg.inkPoints)) ranges.push({ from: p, to: p + n.nodeSize })
      })
      if (ranges.length) {
        let tr = editor.state.tr
        // delete right→left so earlier positions stay valid
        for (let i = ranges.length - 1; i >= 0; i--) tr = tr.delete(ranges[i].from, ranges[i].to)
        editor.view?.dispatch(tr)
      }
      overlay()?.clear?.()
      return true
    } catch { return false }
  }

  // ---- honest degrades (no real ML construct; no doc mutation) ----
  function dInkToShape(): boolean { toast('Ink to Shape needs shape recognition — available in a future update.'); return true }
  function dInkToMath(): boolean { toast('Ink to Math needs an equation recognizer — available in a future update.'); return true }

  // ---- the overlay reads the shared tool state ----
  function dGetState() { return drawState }

  return {
    dInsertInk, dInsertCanvas,
    dSetDrawing, dIsDrawing, dSetEraser, dSetSelect, dSetLasso, dSetPen, dReplay,
    dClearInk, dInkToShape, dInkToMath, dGetState,
  }
}
