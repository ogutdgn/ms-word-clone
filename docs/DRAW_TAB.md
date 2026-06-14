# Draw Tab — Feature Status

_Implemented as a real freehand-ink layer (SVG overlay inside #editor, Pointer Events, Catmull-Rom smoothing). Verified by 8 automated pointer-event tests in scripts/test-suite.js (97/97 total pass) + visual confirmation._

## Tools
- ✅ **Eraser** — stroke eraser with Small/Medium/Large hit radius (split dropdown) + Clear All Ink
- ✅ **Select Objects** — click a stroke to select (drop-shadow highlight), Delete removes
- 🟡 **Lasso Select** — maps to select (freeform-loop multi-select is approximated)

## Pens
- ✅ **Pens Gallery** — Pen (black/blue/red), Pencil, Highlighter (yellow/green) presets
- ✅ **Add Pen** — custom pen with color picker + thickness slider
- ✅ **Drawing** toggle — turns ink mode on/off (disables text editing while drawing)
- 🟡 **Draw with Trackpad/Mouse** — mouse/pointer input is used

Pen = round opaque stroke; Pencil = thin; Highlighter = wide, translucent (opacity 0.4), round-cap.

## Convert
- ❌ **Ink to Shape** — handwriting/shape recognition (ML) — documented stub
- ❌ **Ink to Math** — handwritten equation recognition — documented stub

## Insert
- ✅ **Drawing Canvas** — inserts a bounded, framed region to draw inside

## Replay
- ❌ **Ink Replay** — stroke-timeline animation — documented stub

## Notes
- **Persistence (PM mode, slice-10 PR4 — the active engine):** strokes are now **real DrawingML freeform shapes** in the
  document. The Draw tab is flipped onto the PM engine: each stroke persists as a `vectorShape` carrying a real
  `a:custGeom`/`a:pathLst` (+ `a:ln` pen stroke, `wp:anchor` floats-where-drawn) that **EXPORTS to .docx and round-trips Word**
  (oracle Leg A+B PASS — `notes/2026-06-13-slice10-draw-oracle.json`). The Drawing Canvas is a real bounded `prstGeom` rect.
  A PM-only `.wc-ink-layer` overlay captures live strokes + renders the persisted ink (fresh `inkPoints` AND reopened
  importer `customGeometry.paths`). Real InkML `w14:contentPart` + real `wpc:wpc` canvas are deferred (see `docs/plan/deferrals.md`).
- **Persistence (legacy `--legacy` mode only):** strokes are an `<svg class="ink-layer" contenteditable="false">` inside `#editor`, saved with `.html`; `.docx` export via html-to-docx drops the inline SVG ink (a library limitation — the reason PR4's PM-mode real export is a strict upgrade).
## Real-Word validation (`draw_probe.ps1`)

What was actually checked against the user's real Word via COM:
- ✅ **Drawing Canvas — validated.** `Shapes.AddCanvas(50,50,300,200)` in real Word creates a canvas (shape type 20 = `msoCanvas`). Our Drawing Canvas matches this concept.
- ✅ **Ink model exists.** Word's `Document` exposes `InkShapes`, `Inks`, and `InkComments` collections — so our SVG ink layer is the right analog (Word *does* model ink).
- ❌ **Freehand stroke injection is not practically scriptable.** Word can *read* ink, but there is no simple COM method to *inject* freehand pen strokes (that requires hand-crafted InkML binary). So the actual drawing/erasing/selecting was validated with **8 automated Pointer-Event tests** + visual confirmation, not the COM oracle.

_(Correction of an earlier overstatement: Word does expose ink collections; what's missing is a stroke-injection API, which is why differential testing of freehand drawing isn't practical.)_
