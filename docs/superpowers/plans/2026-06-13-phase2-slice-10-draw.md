# Phase-2 Slice 10 — PR 4: draw (Draw tab) on the PM engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Flip the ribbon area `draw` (the Draw tab's freehand pen/ink tools) onto the PM engine at maximal real-MS-Word
fidelity — freehand strokes become **real, exportable DrawingML freeform shapes** (`a:custGeom`) that round-trip Word AND
the fork (today's legacy ink is an SVG overlay that does NOT export to .docx at all, so this is a strict upgrade), with a
PM-only live-drawing overlay for the interactive tools (drawing/eraser/select/lasso/replay) and honest degrades for the
genuinely-infeasible pieces (real InkML `w14:contentPart`, real `wpc:wpc` canvas, inkToShape/inkToMath).

**Architecture:** The **PM document is the source of truth** for ink. A net-new NOTICE'd fork command `insertInkShape(points, pen)`
mints a real **anchored** `vectorShape` carrying a synthesized `drawingContent` blob (`wp:anchor → a:graphic → wps:wsp` whose
`spPr` holds `a:custGeom`/`a:pathLst` built `moveTo`+`quadBezTo` from the stroke's smoothed points + an `a:ln` stroke styled by
the pen) — the EXISTING `translateVectorShape` replay exporter re-emits it verbatim (zero new exporter code; the WordArt
mechanism). A new PM-only chrome module `bridge/ink-overlay.ts` captures live strokes over `#pm-editor` (in-progress stroke =
a temporary SVG path) and RENDERS the committed ink by reading the ink `vectorShape` nodes from the PM doc and drawing them at
their anchored positions (so undo/redo/open just reflect the doc). New `bridge/draw.ts` (`installDraw`) holds the `d*`/`ink*`
verbs. THE FLIP adds `'draw'` to `FLIPPED`; legacy `WC.Draw`/`commands.js`/`ribbon.js` pen tiles re-point via the PM-guard
pattern (legacy ELSE byte-identical, frozen 257 gate).

**Tech Stack:** Electron + vanilla-JS chrome (`WC` namespace) → `WC.PM` bridge (TS/ESM) → vendored fork
(`src/renderer/core/superdoc-fork/`). Tests: `scripts/test-suite-pm.js` (`[10dr]` label). Oracle:
`scripts/oracle/word-oracle-win.ps1` vs Word for Windows 16.0.

---

## §0. Pre-verified facts (4-agent deep pre-verification + synthesis; file:line)

**F1 — The area is 8 cmds, currently blocked (verified).** `bridge/index.ts:121-123` maps `drawing, eraser, pensGallery,
addPen, drawingCanvas, inkReplay, selectObjects, lassoSelect` → `'draw'`, ABSENT from `FLIPPED` (index.ts:45). Legacy =
`window.WC.Draw` (`draw-tools.js`), an SVG `.ink-layer` overlay appended INTO the hidden legacy `#editor`. Non-area Draw-tab
commands that already toast (leave alone): `drawWithTrackpad` (commands.js:509), `inkToShape`/`inkToMath` (toast stubs,
commands.js:514-515).

**F2 — Real DrawingML freeform (`a:custGeom`) is achievable TODAY with ZERO new exporter code (the key enabler).**
The fork's `vectorShape` node carries a `drawingContent` replay blob; `translateVectorShape`
([decode-image-node-helpers.js:605-626](../../../src/renderer/core/superdoc-fork/core/super-converter/v3/handlers/wp/helpers/decode-image-node-helpers.js)) re-emits `node.attrs.drawingContent.elements`
VERBATIM inside `w:drawing > mc:Choice Requires="wps"` (exporter map `vectorShape`, exporter.js:236). This is the shipped
WordArt mechanism (`synthesizeWordArtDrawing`, vector-shape.js:13-67). IMPORT round-trips: `extractCustomGeometry`
([vector-shape-helpers.js:462-540](../../../src/renderer/core/superdoc-fork/core/super-converter/v3/handlers/wp/helpers/vector-shape-helpers.js)) parses `a:custGeom > a:pathLst > a:path[w,h] >
(a:moveTo|a:lnTo|a:cubicBezTo|a:quadBezTo|a:close) > a:pt[x,y]` into an SVG `d` (`moveTo→M, lnTo→L, cubicBezTo→C, quadBezTo→Q,
close→Z`; `arcTo` silently dropped). The legacy smoother already emits `M`/`Q` (quadratic) [draw-tools.js:201-209] — a 1:1 map
to `moveTo`/`quadBezTo`. A `custGeom` `wps:wsp` import routes to `vectorShape` [encode-image-node-helpers.js:610-613].

**F3 — Net-new / out of pragmatic scope (grep-confirmed over the whole super-converter).** Real **InkML** (`w14:contentPart` →
`/word/ink/inkN.xml`): ZERO import AND export precedent (the only `contentPart` hit is an unrelated comment var,
replay-comments.ts:256); it is run-level (not `w:drawing`) + needs OPC part plumbing the fork has never done; no COM
stroke-injection oracle. Real **Drawing Canvas** (`wpc:wpc`): no import (the graphicData URI switch handles only
wordprocessingShape/Group/chart/pic, encode-image-node-helpers.js:286-319) and no export node; `wpc` appears only as xmlns
boilerplate. **Both DEFERRED** (Class A/B, like chart/smartart in PR3).

**F4 — In-app render: lift the existing custGeom renderer (verified gap).** A standalone `vectorShape` with
`attrs.customGeometry` does NOT render — `VectorShapeView.createSVGElement`'s switch only handles rect/roundRect/ellipse/
circle/line (VectorShapeView.js:342-414), NO customGeometry branch. The custGeom SVG renderer EXISTS but only inside
`ShapeGroupView` (ShapeGroupView.js:300-355). **However**, in this plan the PM ink overlay renders ink itself (reading the
nodes), so the NodeView render gap is sidestepped for ink — we flag ink shapes and the overlay draws them. (We do NOT need to
patch VectorShapeView for ink; if a non-overlay render is later wanted, lift the ShapeGroupView renderer.)

**F5 — Anchored floating drawings round-trip via the replay blob (verified mechanism).** `vectorShape` already has
`wrap`/`anchorData`/`isAnchor` attrs (vector-shape.js addAttributes). Because `translateVectorShape` replays
`drawingContent.elements` VERBATIM, a `wp:anchor`-rooted blob (positionH/positionV offsets + the custGeom wps:wsp) is emitted
as a real floating drawing; the importer handles anchored drawings (real docx have them). So ink persisted as anchored shapes
floats WHERE DRAWN in Word — the correct fidelity (inline shapes would pile up at the caret/end, wrong).

**F6 — The legacy ink does NOT export to .docx today (fidelity baseline).** The `.ink-layer` SVG + `.wc-draw-canvas` div are
`.html`-only and are dropped on `.docx` save (DRAW_TAB.md:29, FEATURES.md:99-100). So PR4's real-export ink is a strict
upgrade, not a regression risk.

**F7 — Dispatch + leak surface (verified, the COMPLETE list).** Two dispatch paths + one BYPASS:
- `commands.js` H.* (one per cmd): `drawing`=WC.Draw.toggle (:497), `pensGallery`=pensMenu (:498,518-531),
  `addPen` flyout+dialog (:499-508,532-540), `eraser`=setEnabled+setTool (:510), `selectObjects` (:511), `lassoSelect` (:512),
  `drawingCanvas`=insertCanvas (:513), `inkReplay`=replay (:516); eraser arrow flyout (:1421-1431).
- `commands.js` Layout select-menu already PM-branches with a "arrives with the Draw engine re-host (slice 10)" toast for
  Select Objects / Selection Pane (:1884,1887); legacy ELSE at :1893 calls WC.Draw — update the PM branch to the real verb.
- **BYPASS:** `ribbon.js` renderPensGallery TILES call `draw.toggle()`/`draw.setPen()` DIRECTLY (ribbon.js:194-220, esp.
  207-211), NOT through `Commands.run`/`isBlocked` — the one entry point not gated; must be PM-guarded/re-pointed.
- `draw-tools.js:31-99,124-197` mutates `E()`=hidden #editor in PM mode (ensureLayer appendChild :37; setEnabled
  contenteditable+#app.ink-on :54-56; E().dirty=true :151,182,190,191; insertCanvas E().insertHTML :195; onDocLoad :94-99) —
  these must NOT run in PM mode.
- `editor.js:626,671` hard-calls `WC.Draw.onDocLoad()` on legacy load/undo (legacy-only path; the PM overlay needs its OWN
  re-link hook on the PM load/transaction path).
- `commands.js:1218-1223` H.hideInk PM branch ALREADY latches `#pm-editor.pm-hide-ink`, and **`track-chrome-pm.css:91-92`
  ALREADY ships the consumer** `body.pm-active #pm-editor.pm-hide-ink .wc-ink-layer { display:none }` (comment: "the slice-10
  Draw layer mounts as `.wc-ink-layer` inside `#pm-editor`"). So the overlay layer class MUST be **`.wc-ink-layer`** (NOT
  `.pm-ink-layer`) or Hide Ink silently no-ops. (My earlier "NO CSS consumer" note was wrong — verified by the critique.)
- `editor.css:202-207` `.ink-layer`/`.ink-stroke`/`.wc-draw-canvas` CSS is scoped to `#editor` — the PM overlay needs new
  `body.pm-active`-scoped CSS for the STROKE styling (`.wc-ink-layer .pm-ink-stroke { … }`); the Hide-Ink toggle rule already exists.

**F8 — Bridge wiring (verified).** `FLIPPED` (index.ts:45, `'draw'` ABSENT); `installInsertExotica` template
(insert-exotica.ts:10-191) — `installDraw(editor)` mirrors it; `Object.assign(PM, …, installDesign(editor),
installInsertExotica(editor))` (index.ts:402, append `installDraw(editor)`); pre-mount stubs block (index.ts:363-367, add the
`d*`/`ink*` family); `PMA()` re-point precedent (`H.themes`, commands.js:544); `PM.markDirty()` (io.ts:62) for non-docChanged
overlay writes; `PREVIEW_META` exemption (io.ts:11-12).

**F9 — PM test harness (verified).** `t(name,fn)` passes iff `fn` returns neither `false` nor a string; `exportDocumentXml()`,
`doc()`, `setDoc`/`caretAfter`/`PM`/`sleep` helpers in scope; append the `[10dr]` block before the final `const pass =`
(test-suite-pm.js ~:4234); doc-replacing tests LAST with `await sleep(300)`.

---

## §1. Scope decisions (D10dr.x — locked with the user 2026-06-13)

- **D10dr.1 — ink = real DrawingML freeform per stroke** (F2): net-new fork `insertInkShape(points, pen)` + `synthesizeInkDrawing`.
  Real `a:custGeom`, round-trips Word + fork, oracle-validatable. A real freeform AutoShape (NOT Word's literal `w14:contentPart`
  ink object) — chart/smartart-tier "real construct, honest about which construct."
- **D10dr.2 — full live ink chrome** (F7): net-new PM-only overlay `bridge/ink-overlay.ts` (pointer capture over `#pm-editor`).
  Strokes persist as real anchored shapes on stroke-up. drawing/eraser/select/lasso/replay all interactive in PM mode.
- **D10dr.3 — Drawing Canvas = real bounded shape frame** (F3): `dInsertCanvas()` inserts a real bounded `vectorShape` rect
  (a `prstGeom` rect with a visible `a:ln` border, no fill) as the "canvas" region. Honest that it's not a literal `wpc:wpc`.
- **D10dr.4 — ink anchored (floats where drawn), oracle-gated, with an inline fallback** (F5, K2): the fidelity goal is a
  `wp:anchor` drawingContent blob with page-relative positionH/positionV offsets matching the draw position (so ink floats WHERE
  drawn). BUT `wp:anchor` + a custGeom `spPr` are NEW schema surfaces the proven WordArt (`wp:inline`, no custGeom) never
  exercised — and the PR3 cover-id lesson proves only the COM oracle catches a schema-fatal construct. So `synthesizeInkDrawing`
  is parameterized (`mode: 'anchor' | 'inline'`) and **Task 1 has an EARLY oracle acceptance gate** (a 1-stroke Word-open probe,
  BEFORE the overlay/flip are built): prove `wp:inline` custGeom opens clean first, then prove `wp:anchor`; **default to `anchor`
  if its Leg A is green, else fall back to `inline` + record an "exact ink position" deferral**. Position is computed in PAGE
  coordinates (overlay px → the stroke's page sheet, accounting for the sheet offset + margin + zoom — NOT the caret paragraph;
  inserting at the caret would float the anchored drawing on the CARET's page, R3), clamped to `[0, pageDim − extent]`, integer
  `wp:posOffset`. The overlay renders ink in-app (handling both freshly-drawn `inkPoints` AND reopened `customGeometry.paths`).
- **D10dr.5 — honest-degrade + recorded follow-ups**: real InkML `w14:contentPart` (F3), real `wpc:wpc` canvas (F3),
  `inkToShape`/`inkToMath` (already toasts), `arcTo` in custGeom (parser drops it — the smoother never emits arcs anyway).
- **D10dr.6 — pen state stays in the UI layer**: `pensGallery`/`addPen` color/width/opacity tables stay clone-owned UI (like
  WC.Design value tables); the bridge reads only the ACTIVE pen for `insertInkShape`. The pen-gallery tiles + addPen are
  PM-guarded only where they would mutate the legacy doc (they don't mutate — they set pen state — so they pass through, but
  the tile's `draw.toggle()` must route to the PM overlay toggle).

---

## §2. Risks + binding amendments (K-x)

- **K1 — custGeom blob correctness (load-bearing).** The synthesized `drawingContent` must (a) replay through the exporter and
  (b) open in Word without repair AND survive Word's resave. **Amendment:** mirror `synthesizeWordArtDrawing` exactly, swapping
  `a:prstGeom rect` → `a:custGeom/a:pathLst` (built from points) and `a:noFill` → `a:noFill` + `a:ln` (pen stroke). The `[10dr]`
  test greps `<a:custGeom>`/`<a:pathLst>`; the oracle Leg A (Word resave, no repair) is the real gate. **Coordinate space:** the
  `a:path` `w`/`h` = the shape extent in EMU (`px*9525`); each `a:pt` `x`/`y` = `point_px*9525` (offset to the stroke's local
  bbox origin so coords are ≥0). Declare any net-new attrs (`isInk`) on `vectorShape` or `nodeFromJSON` drops them.
- **K2 — anchored positioning + docPr id uniqueness (F5, the PR3 cover-id class).** A `wp:anchor` blob needs `wp:positionH`/
  `wp:positionV` (relativeFrom=page, `wp:posOffset` as a TEXT child in EMU) + `wp:extent` + `wp:wrapNone` + `wp:docPr` +
  `wp:cNvGraphicFramePr`. **Amendments:** (a) position = the stroke bbox top-left in PAGE coordinates — overlay px mapped to the
  stroke's page sheet (sheet offset + margin + zoom divided out), NOT the caret paragraph (inserting an anchored run at the caret
  floats the drawing on the CARET's page — R3); clamp to `[0, pageDim − extent]`, round to integer. (b) The `wp:docPr` id MUST be a
  process-unique POSITIVE INTEGER — a per-session `let _inkSeq = 2000` RESETS each session and collides with a reopened doc's
  existing "Ink 2001" → duplicate docPr id → Word repair (fails Leg A's no-repair gate, exactly the PR3 cover-id failure class).
  Mint via `Math.max(1, parseInt(generateDocxRandomId(), 16))` (the `translateImageNode` pattern, decode-image-node-helpers.js:355)
  OR scan the live doc for the max existing docPr id at insert time. (c) If anchored repairs in Word, fall back to `wp:inline` +
  record an "exact ink position" deferral — gate on the Task-1 oracle probe.
- **K3 — overlay/doc reconciliation + REOPENED ink must stay visible (the load-bearing render-loss bug).** The overlay is the
  in-app RENDERER for ink + the live capture surface. **Critical fork fact (verified):** on import the fork's `getVectorShape`
  OVERWRITES `attrs.customGeometry` with the importer's shape `{ paths: [{ d, w, h }] }` and returns attrs with **NO `isInk`**
  (encode-image-node-helpers.js:1338-1345, :1382-1408). So after export→openDocx (or a Word resave→reopen), a freshly-drawn ink
  node's `customGeometry.inkPoints` is GONE (replaced by `paths`) and `isInk` is false. If the overlay only renders from
  `inkPoints`, **reopened ink is invisible** (and `VectorShapeView` returns null for custGeom — getPresetShapeSvg is stubbed). The
  weak "node exists" round-trip test would pass GREEN while the ink vanished. **Amendment:** `renderInk()` MUST render from BOTH
  sources — `attrs.customGeometry.inkPoints` (fresh draw) AND `attrs.customGeometry.paths[].d` (the importer's ready-made SVG
  `d`-strings, reopened) — and treat a node as ink if `attrs.isInk === true` OR `attrs.customGeometry?.paths` exists from a
  custom-geometry shape we authored (key off the `wp:docPr name` prefix `"Ink "` if needed, or just render any custGeom shape's
  paths via the overlay). The `[10dr]` round-trip test asserts ink is **RENDERABLE after reopen** (`customGeometry.paths` present
  / a visible overlay path), not merely that a node exists. The ink `vectorShape` `createElement` returns a zero-size span for
  `isInk` (the overlay draws it); the overlay re-renders on every transaction + on PM document load (the `onDocLoad` analog).
- **K4 — legacy byte-identity (K5-class).** Every `WC.Draw`/`commands.js`/`ribbon.js` legacy branch stays byte-identical;
  guards are PM-branch-then-return BEFORE the unchanged legacy line. The `ribbon.js` pen-tile bypass is the trickiest — guard the
  tile click.
- **K5 — `editor.doc`/`editor.commands`/`editor.state` freshness.** Read fresh each call (references.ts discipline); never hoist.
- **K6 — dirty flag.** `insertInkShape`/`dInsertCanvas` are real PM transactions → dirty automatically. Tool-state toggles
  (drawing on/off, eraser/select/lasso, pen change) are NON-dirtying (nothing savable changed) — they must NOT flip dirty.
- **K7 — performance.** Dense ink = many `vectorShape` nodes. **Amendment:** persist ONE shape per stroke (pointerdown→up), not
  per-point; the overlay shows the in-progress stroke without a transaction until pointerup. Acceptable node counts for a clone.
- **K8 — no live-draw into PM per pointermove.** Never dispatch a PM transaction on pointermove (too heavy / history spam). Only
  on pointerup. `addToHistory` stays true (one undo per stroke).

---

## §3. File structure

| File | Action | Responsibility |
|---|---|---|
| `scripts/test-suite-pm.js` | Modify (append `[10dr]` block) | Red→green engine-observable tests: FLIP, `insertInkShape`→`a:custGeom`, anchored, canvas-frame shape, honest-degrade no-ops, round-trip. |
| `src/renderer/core/superdoc-fork/extensions/vector-shape/vector-shape.js` | Modify (NOTICE'd) | Declare `isInk` attr + net-new `insertInkShape` command + `synthesizeInkDrawing` helper. |
| `src/renderer/core/superdoc-fork/extensions/vector-shape/VectorShapeView.js` | Modify (NOTICE'd) | Render EMPTY for `isInk` nodes (the overlay draws them) — avoid a stray atom box. |
| `src/renderer/core/superdoc-fork/NOTICE.md` | Modify | Record the fork edits. |
| `src/renderer/bridge/draw.ts` | Create | `installDraw(editor)` — `d*`/`ink*` verbs (insert ink shape, canvas frame, tool-state passthrough, honest degrades). |
| `src/renderer/bridge/ink-overlay.ts` | Create | PM-only ink overlay: pointer capture over `#pm-editor`, in-progress stroke render, persist-on-up, re-render ink nodes on tr/load, eraser/select/lasso/replay over persisted shapes. |
| `src/renderer/bridge/index.ts` | Modify | Import `installDraw`/`installInkOverlay`; add `d*`/`ink*` pre-mount stubs; append to `Object.assign`; add `'draw'` to `FLIPPED` (THE FLIP); wire the overlay re-link on PM load. |
| `src/renderer/public/css/editor.css` | Modify | New `body.pm-active`-scoped `.wc-ink-layer`/`.pm-ink-stroke`/`.pm-ink-canvas` STROKE CSS (the Hide-Ink toggle rule already exists in `track-chrome-pm.css:91-92`). |
| `src/renderer/public/js/commands.js` | Modify | Re-point the 8 draw H.* + eraser flyout + Layout select-menu + hideInk wiring via `PMA()` (legacy ELSE byte-identical). |
| `src/renderer/public/js/ribbon.js` | Modify | PM-guard the pen-gallery TILE clicks (the dispatch bypass). |
| `docs/plan/*`, `docs/superpowers/plans/notes/*`, `docs/DRAW_TAB.md` | Modify (Task 7) | Checkpoint + oracle verdict + deferrals. |

---

## §4. Tasks

### Task 0: Red `[10dr]` tests (engine-observable, written FIRST)

**Files:** Modify `scripts/test-suite-pm.js` (insert the `[10dr]` block immediately BEFORE the final
`const pass = results.filter((r) => r.pass).length;` line; doc-replacing tests LAST).

- [ ] **Step 1: Write the failing `[10dr]` block** (uses existing helpers `setDoc`/`caretAfter`/`PM`/`exportDocumentXml`/`doc`/`sleep`):

```js
  // ===== [10dr] draw / Draw tab (slice 10 PR4) — doc-replacing tests LAST =====
  await t('[10dr] D6 flip: draw is FLIPPED', () => PM().isFlipped('draw') === true || 'draw not in FLIPPED');

  await t('[10dr] EXPORT: dInsertInk → <a:custGeom>/<a:pathLst> freeform in document.xml', async () => {
    setDoc('canvas'); caretAfter('canvas');
    if (typeof PM().dInsertInk !== 'function') return 'PM.dInsertInk missing (red — bridge not installed)';
    // a simple 3-point stroke (overlay-space px); pen = black width 2
    const ok = PM().dInsertInk([{ x: 10, y: 10 }, { x: 40, y: 30 }, { x: 70, y: 12 }], { color: '#000000', width: 2, opacity: 1 });
    if (ok !== true) return 'dInsertInk refused (red)';
    await sleep(80);
    const xml = await exportDocumentXml();
    if (!/<a:custGeom\b/.test(xml)) return 'no <a:custGeom> in document.xml: ' + xml.slice(0, 300);
    if (!/<a:pathLst\b/.test(xml)) return 'no <a:pathLst> (freeform path)';
    // child-order guard (import is order-independent so it can't catch a regression; oracle Leg A is the real gate)
    if (!/<a:custGeom\b[\s\S]*?<a:noFill\b[\s\S]*?<a:ln\b/.test(xml)) return 'spPr child order wrong (want custGeom→noFill→ln)';
    return /<a:moveTo\b[\s\S]*?<a:quadBezTo\b/.test(xml) || 'no moveTo/quadBezTo ink path commands';
  });

  await t('[10dr] dInsertInk inserts a real vectorShape node (isInk)', async () => {
    setDoc('x'); caretAfter('x');
    if (typeof PM().dInsertInk !== 'function') return 'PM.dInsertInk missing (red)';
    if (PM().dInsertInk([{ x: 0, y: 0 }, { x: 20, y: 20 }], { color: '#C00000', width: 3, opacity: 1 }) !== true) return 'refused';
    await sleep(60);
    let ink = false; doc().descendants((n) => { if (n.type.name === 'vectorShape' && n.attrs && n.attrs.isInk) ink = true; });
    return ink || 'no isInk vectorShape node from dInsertInk';
  });

  await t('[10dr] EXPORT: dInsertCanvas → a real bounded rect shape (a:prstGeom rect + a:ln)', async () => {
    setDoc('y'); caretAfter('y');
    if (typeof PM().dInsertCanvas !== 'function') return 'PM.dInsertCanvas missing (red)';
    if (PM().dInsertCanvas() !== true) return 'dInsertCanvas refused (red)';
    await sleep(80);
    let hasShape = false; doc().descendants((n) => { if (n.type.name === 'vectorShape') hasShape = true; });
    if (!hasShape) return 'no vectorShape (canvas frame) inserted';
    const xml = await exportDocumentXml();
    return /prst="rect"/.test(xml) || 'no <a:prstGeom prst=rect> canvas frame in export';
  });

  await t('[10dr] reserve-degrade verbs (dInkToShape/dInkToMath) are no-op toasts', () => {
    // dInkToShape/dInkToMath are NOT in the draw AREA (the FLIP never routes them; the real buttons keep
    // toasting via H.inkToShape/H.inkToMath). They exist only so this test can confirm they never mutate the doc.
    setDoc('keepme');
    for (const v of ['dInkToShape', 'dInkToMath']) {
      if (typeof PM()[v] !== 'function') return 'PM.' + v + ' missing (red)';
      PM()[v]();
    }
    let shapes = 0; doc().descendants((n) => { if (n.type.name === 'vectorShape') shapes++; });
    return (shapes === 0 && doc().textContent.includes('keepme')) || 'a degrade verb mutated the doc (should be a no-op toast)';
  });

  await t('[10dr] tool-state toggles do NOT dirty the doc (drawingMode/eraser/select/lasso)', () => {
    setDoc('clean');
    for (const v of ['dSetDrawing', 'dSetEraser', 'dSetSelect', 'dSetLasso', 'dIsDrawing']) {
      if (typeof PM()[v] !== 'function') return 'PM.' + v + ' missing (red)';
    }
    PM().setClean();   // io.ts ships setClean()/isDirty() — there is NO markClean()
    PM().dSetDrawing(true); PM().dSetEraser(); PM().dSetSelect(); PM().dSetLasso(); PM().dSetDrawing(false);
    let shapes = 0; doc().descendants((n) => { if (n.type.name === 'vectorShape') shapes++; });
    if (shapes !== 0) return 'a tool toggle mutated the doc';
    return PM().isDirty() === false || 'a pure tool toggle dirtied the doc (K6)';
  });

  // ---- doc-replacing tests LAST (openDocx remounts; 300ms threshold) ----
  await t('[10dr] IMPORT round-trip: ink freeform survives export→openDocx', async () => {
    setDoc('z'); caretAfter('z');
    if (typeof PM().dInsertInk !== 'function') return 'PM.dInsertInk missing (red)';
    if (PM().dInsertInk([{ x: 5, y: 5 }, { x: 25, y: 35 }, { x: 50, y: 8 }], { color: '#2B579A', width: 2, opacity: 1 }) !== true) return 'refused';
    const bytes = await PM().exportDocxBytes();
    if (!(bytes && bytes.length > 500 && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'not a zip';
    if (await PM().openDocx(bytes) !== true) return 'reimport failed';
    await sleep(300);
    // After reopen the importer DROPS isInk + replaces customGeometry with { paths:[{d}] } (K3). Assert the ink
    // is RENDERABLE (a custGeom node the overlay can draw), not merely that a vectorShape node exists.
    let renderable = false;
    doc().descendants((n) => {
      if (n.type.name !== 'vectorShape') return;
      const cg = n.attrs && n.attrs.customGeometry;
      if ((n.attrs && n.attrs.isInk) || (cg && Array.isArray(cg.paths) && cg.paths.length && cg.paths[0].d)) renderable = true;
    });
    if (renderable) return true;
    const xml2 = await exportDocumentXml(); // fallback: at least the custom geometry still round-trips to OOXML
    return /<a:custGeom\b/.test(xml2) || 'ink lost on round-trip (no renderable custGeom + none on re-export)';
  });
```

- [ ] **Step 2: Run + verify RED.** `npm run build && npm run test:pm` — the `[10dr]` tests fail (`draw not in FLIPPED`, `PM.d* missing`); prior 310 stay green.

- [ ] **Step 3: Commit.**
```bash
git add scripts/test-suite-pm.js
git commit -m "test(draw): slice-10 PR4 red [10dr] tests (a:custGeom ink freeform, isInk vectorShape, canvas-frame rect, degrade no-leak, tool-toggle non-dirty, round-trip, FLIP)"
```

---

### Task 1: Fork — `synthesizeInkDrawing` + `insertInkShape` command + `isInk` attr (real DrawingML freeform)

**Files:** Modify `vector-shape/vector-shape.js` (NOTICE'd); Modify `NOTICE.md`.

- [ ] **Step 1: Declare the `isInk` attr** — inside `addAttributes()` return (after the existing `isWordArt`), add:
```js
      isInk: {
        default: false,
        rendered: false,
      },
```

- [ ] **Step 2: Add the module-level `synthesizeInkDrawing` helper** (top-level, after the imports / `_wordArtSeq`, before `export const VectorShape`):
```js
// NET-NEW (slice 10 PR4 draw, NOTICE'd). Import the fork's docx id minter at the top of the file:
//   import { generateDocxRandomId } from '@converter/helpers' (the SAME util translateImageNode uses
//   for wp:docPr ids — decode-image-node-helpers.js:355; verify the exact import path while implementing).
// Build a real DrawingML freeform-ink blob to stash on vectorShape.attrs.drawingContent — translateVectorShape
// replays it verbatim (round-trips Word AND the fork). Mirrors synthesizeWordArtDrawing but emits
// a:custGeom/a:pathLst (moveTo + quadBezTo from the stroke points) + an a:ln pen stroke instead of prstGeom + txbx.
// points = [{x,y}] overlay px; pen = { color:'#RRGGBB', width:Number(px), opacity:0..1 }; pos = {x,y} PAGE px (anchor mode).
// mode = 'anchor' (wp:anchor, floats where drawn — DEFAULT, oracle-gated in Step 4) | 'inline' (wp:inline fallback).
// RETURNS { drawingContent, wPx, hPx } so the caller sets node width/height from the SAME bbox (K3 — no divergence).
function synthesizeInkDrawing(points, pen = {}, pos = { x: 0, y: 0 }, mode = 'anchor') {
  const EMU = 9525; // px → EMU
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const pts = (points || []).filter((p) => p && isFinite(p.x) && isFinite(p.y));
  if (!pts.length) return { drawingContent: { elements: [] }, wPx: 1, hPx: 1 };
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);              // TIGHT bbox (NO ,0 floor — K-fix)
  const wPx = Math.max(1, Math.round(Math.max(...xs) - minX));
  const hPx = Math.max(1, Math.round(Math.max(...ys) - minY));
  const wEmu = wPx * EMU, hEmu = hPx * EMU;
  // process-UNIQUE positive-int wp:docPr id (a per-session counter collides with a reopened doc's ids → Word repair, K2b).
  const id = Math.max(1, parseInt(generateDocxRandomId(), 16));
  const color = String(pen.color || '#000000').replace(/^#/, '').toUpperCase();
  const strokeW = Math.max(1, Math.round((pen.width || 2) * EMU)); // line width in EMU
  const alpha = Math.round(Math.max(0, Math.min(1, pen.opacity == null ? 1 : pen.opacity)) * 100000);
  const pt = (p) => ({ name: 'a:pt', attributes: { x: String(Math.round((p.x - minX) * EMU)), y: String(Math.round((p.y - minY) * EMU)) } });
  const cmds = [{ name: 'a:moveTo', elements: [pt(pts[0])] }];
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }; // quadBezTo: control=prev pt, end=midpoint (mirrors smooth())
    cmds.push({ name: 'a:quadBezTo', elements: [pt(p0), pt(mid)] });
  }
  cmds.push({ name: 'a:lnTo', elements: [pt(pts[pts.length - 1])] });
  // The wps:wsp (custGeom freeform + a:ln pen stroke) is shared by both wrappers. spPr child ORDER
  // xfrm→custGeom→noFill→ln and custGeom child order avLst→gdLst→rect→pathLst are schema-correct
  // (CT_ShapeProperties / CT_CustomGeometry2D) — DO NOT reorder (the import round-trip can't detect a regression).
  const graphic = { name: 'a:graphic', attributes: { 'xmlns:a': A }, elements: [
    { name: 'a:graphicData', attributes: { uri: 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape' }, elements: [
      { name: 'wps:wsp', elements: [
        { name: 'wps:cNvSpPr' },
        { name: 'wps:spPr', elements: [
          { name: 'a:xfrm', elements: [{ name: 'a:off', attributes: { x: '0', y: '0' } }, { name: 'a:ext', attributes: { cx: String(wEmu), cy: String(hEmu) } }] },
          { name: 'a:custGeom', elements: [
            { name: 'a:avLst' }, { name: 'a:gdLst' },
            { name: 'a:rect', attributes: { l: '0', t: '0', r: String(wEmu), b: String(hEmu) } },
            { name: 'a:pathLst', elements: [{ name: 'a:path', attributes: { w: String(wEmu), h: String(hEmu), fill: 'none' }, elements: cmds }] },
          ] },
          { name: 'a:noFill' },
          { name: 'a:ln', attributes: { w: String(strokeW), cap: 'rnd' }, elements: [
            { name: 'a:solidFill', elements: [{ name: 'a:srgbClr', attributes: { val: color }, elements: alpha < 100000 ? [{ name: 'a:alpha', attributes: { val: String(alpha) } }] : [] }] },
            { name: 'a:round' },
          ] },
        ] },
        { name: 'wps:bodyPr' },
      ] },
    ] },
  ] };
  let root;
  if (mode === 'inline') {
    root = { name: 'wp:inline', attributes: { distT: '0', distB: '0', distL: '0', distR: '0' }, elements: [
      { name: 'wp:extent', attributes: { cx: String(wEmu), cy: String(hEmu) } },
      { name: 'wp:effectExtent', attributes: { l: '0', t: '0', r: '0', b: '0' } },
      { name: 'wp:docPr', attributes: { id: String(id), name: 'Ink ' + id } },
      { name: 'wp:cNvGraphicFramePr' },
      graphic,
    ] };
  } else {
    const off = (v) => String(Math.max(0, Math.round(v * EMU))); // PAGE px → EMU, clamped >= 0 (K2)
    root = { name: 'wp:anchor', attributes: { distT: '0', distB: '0', distL: '0', distR: '0', simplePos: '0', relativeHeight: String(id), behindDoc: '0', locked: '0', layoutInCell: '1', allowOverlap: '1' }, elements: [
      { name: 'wp:simplePos', attributes: { x: '0', y: '0' } },
      { name: 'wp:positionH', attributes: { relativeFrom: 'page' }, elements: [{ name: 'wp:posOffset', elements: [{ type: 'text', text: off(pos.x) }] }] },
      { name: 'wp:positionV', attributes: { relativeFrom: 'page' }, elements: [{ name: 'wp:posOffset', elements: [{ type: 'text', text: off(pos.y) }] }] },
      { name: 'wp:extent', attributes: { cx: String(wEmu), cy: String(hEmu) } },
      { name: 'wp:effectExtent', attributes: { l: '0', t: '0', r: '0', b: '0' } },
      { name: 'wp:wrapNone' },
      { name: 'wp:docPr', attributes: { id: String(id), name: 'Ink ' + id } },
      { name: 'wp:cNvGraphicFramePr' },
      graphic,
    ] };
  }
  return { drawingContent: { elements: [root] }, wPx, hPx };
}
```

> The `a:path fill="none"` + `a:noFill` + `a:ln` = an unfilled stroked freeform (the ink line). `a:alpha` only when the pen is
> translucent (highlighter — an honest degrade vs Word's true highlighter fill; record in deferrals). The smoother's `M`/`Q` map
> to `moveTo`/`quadBezTo` 1:1 (F2); the trailing `lnTo` pins the last point. **`generateDocxRandomId` must be imported** (the
> translateImageNode id minter) — a per-session counter would collide with a reopened doc's ids (K2b, the PR3 cover-id class).

- [ ] **Step 3: Add `addCommands()` `insertInkShape`** (inside `Node.create({...})`, alongside `insertWordArt`):
```js
      /**
       * NET-NEW (slice 10 PR4 draw, NOTICE'd). Insert one freehand ink stroke as a REAL anchored DrawingML
       * freeform shape (a:custGeom replayed by translateVectorShape → round-trips Word + fork). The PM ink
       * overlay renders it in-app (createElement is empty for isInk). options: { points:[{x,y}], pen:{color,width,opacity}, pos:{x,y}, mode:'anchor'|'inline' }.
       */
      insertInkShape:
        (options = {}) =>
        ({ commands }) => {
          const points = Array.isArray(options.points) ? options.points : []
          if (points.length < 1) return false
          const pen = options.pen || {}
          const pos = options.pos || { x: 0, y: 0 }
          const mode = options.mode === 'inline' ? 'inline' : 'anchor'
          // ONE bbox computation, shared with the blob (K3 — node width/height must match wp:extent).
          const { drawingContent, wPx, hPx } = synthesizeInkDrawing(points, pen, pos, mode)
          return commands.insertContent({
            type: this.name,
            attrs: {
              isInk: true,
              kind: 'custom',
              width: wPx,
              height: hPx,
              isAnchor: mode === 'anchor',
              wrap: { type: mode === 'anchor' ? 'None' : 'Inline' },
              drawingContent,
              // stash raw stroke for the overlay renderer (px-space, pen, page pos). NOTE: on export→reimport the
              // fork OVERWRITES customGeometry with { paths:[{d,w,h}] } and drops isInk (K3) — the overlay must
              // render from BOTH .inkPoints (fresh) AND .paths (reopened).
              customGeometry: { inkPoints: points, inkPen: pen, inkPos: pos },
            },
          });
        },
```

- [ ] **Step 4: NOTICE.md** — append the ink fork edit. **Step 5: Build clean.**

- [ ] **Step 6: EARLY ORACLE ACCEPTANCE GATE (decides anchor vs inline BEFORE the overlay/flip are built — the PR3 lesson).**
  Author a tiny one-stroke doc TWICE (a `--shot-evalfile` probe calling `editor.commands.insertInkShape` directly, saved via
  `wordAPI.saveBytes`) — once `mode:'inline'`, once `mode:'anchor'` — and run the COM oracle on EACH:
```powershell
powershell -STA -ExecutionPolicy Bypass -File scripts/oracle/word-oracle-win.ps1 roundtrip C:\tmp\wc-ink-inline-clone.docx C:\tmp\wc-ink-inline-resaved.docx
powershell -STA -ExecutionPolicy Bypass -File scripts/oracle/word-oracle-win.ps1 roundtrip C:\tmp\wc-ink-anchor-clone.docx C:\tmp\wc-ink-anchor-resaved.docx
```
  - `inline` MUST open clean (it's byte-for-byte the proven WordArt wrapper, only `prstGeom`→`custGeom` + `a:ln`). If even inline
    repairs, the `a:custGeom`/`a:ln` blob itself is wrong — STOP and fix the blob before proceeding.
  - If `anchor` opens clean (EXIT=0, `<a:custGeom>` survives the resave) → **default `mode:'anchor'`** (ink floats where drawn).
    If `anchor` REPAIRS → set the bridge's default `mode:'inline'` + record an "exact ink position" deferral. Note the verdict in
    the eventual oracle JSON. This gate de-risks Tasks 3-6 (the overlay is built on a Word-validated wrapper).
- [ ] **Step 7: Commit** (`feat(fork): net-new insertInkShape command (real DrawingML freeform ink)`), the probe(s) included.

---

### Task 2: Fork — `VectorShapeView` renders empty for `isInk` (the overlay draws ink)

**Files:** Modify `vector-shape/VectorShapeView.js` (NOTICE'd).

- [ ] **Step 1: Read `VectorShapeView.js`** — the entry is `createElement` → `createSVGElement` → `buildView` (there is NO
  `render()` method; the node is `atom:true`/`contentDOM:null`). In `createElement`, add an early branch: if `node.attrs.isInk`,
  return a zero-size, non-painting placeholder DOM (an empty inline `<span data-ink-anchor>` with `width:0;height:0;overflow:hidden`)
  so the inline anchor occupies no visual space and the overlay is the sole ink renderer (K3). Keep all non-ink rendering identical.
  (Reopened ink has `isInk:false` + `customGeometry.paths` — it would otherwise fall to the null preset branch and paint nothing;
  the overlay renders it, so the empty span is harmless either way.)
- [ ] **Step 2: Build clean.** **Step 3: Commit** (`feat(fork): VectorShapeView renders empty for isInk (PM ink overlay owns ink paint)`), NOTICE updated.

---

### Task 3: `bridge/draw.ts` — the `d*`/`ink*` verb surface

**Files:** Create `src/renderer/bridge/draw.ts`; Modify `bridge/index.ts` (import + stubs + `Object.assign`, NOT the FLIP).

- [ ] **Step 1: Create `bridge/draw.ts`** (mirrors `insert-exotica.ts`; reads `editor.commands`/`state` fresh; tool-state is held in a
  module object the overlay also reads). Verbs:
  - `dInsertInk(points, pen, pos?)` → `editor.commands.insertInkShape({ points, pen, pos, mode: INK_MODE })` (returns boolean,
    `INK_MODE` = the module default set by the Task-1 oracle gate, `'anchor'` or `'inline'`; `pos` optional → `{x:0,y:0}` for the
    direct `[10dr]` test path). The CANONICAL persist verb the overlay calls on stroke-up; also directly callable.
  - `dInsertCanvas()` → insert a real bounded `vectorShape` rect (a `prstGeom rect` blob with `a:ln` border, `a:noFill`) — reuse a
    small `synthesizeRectFrame()` (or a minimal inline blob) for the "Drawing Canvas" frame. Toast "Drawing canvas inserted."
  - tool-state (NON-dirtying, NO transaction): `dSetDrawing(on)`, `dIsDrawing()` (→ `drawState.on`), `dSetEraser(radius?, mode?)`
    (mode = `'stroke'|'point'|'segment'`, default `'stroke'` — thread the legacy eraser mode, commands.js:1423), `dSetSelect()`,
    `dSetLasso()`, `dSetPen(pen)`, `dReplay()` — set `drawState` (the shared object) + call the overlay handle to toggle
    capture/cursor/replay. Return boolean; never mutate the doc.
  - `dClearInk()` → delete ALL `isInk` (and reopened ink) `vectorShape` nodes in ONE transaction + clear the overlay (re-points
    the legacy "Clear All Ink", commands.js:529 + the eraser flyout). This DOES dirty (real removal).
  - honest degrades: `dInkToShape()`, `dInkToMath()` → toast + return true (no-op). **(Reserve/test verbs — `inkToShape`/`inkToMath`
    are NOT in the `draw` AREA map, so THE FLIP never routes them; the real ribbon buttons keep toasting via
    `H.inkToShape`/`H.inkToMath`, commands.js:514-515. They exist so the `[10dr]` degrade test can call them.)**
  - `drawState` shared object: `{ on, tool:'pen'|'eraser'|'select'|'lasso', pen:{color,width,opacity}, eraseRadius, eraseMode }`.
- [ ] **Step 2: Wire `bridge/index.ts`** (NOT the FLIP): import `installDraw` + `installInkOverlay`; add the `d*`/`ink*` pre-mount
  stub family to `preinstallBridge` (index.ts:363-367, mirror the `xe*` block) — **MUST include `dInsertInk`, `dInsertCanvas`,
  `dSetDrawing`, `dIsDrawing`, `dSetEraser`, `dSetSelect`, `dSetLasso`, `dSetPen`, `dReplay`, `dClearInk`, `dInkToShape`,
  `dInkToMath`** (any verb a re-point or test calls must be stubbed, or PM-mode calls TypeError before mount); append
  `installDraw(editor)` + `installInkOverlay(editor)` to the `Object.assign`.
- [ ] **Step 3: Build + run the suite — the engine-half `[10dr]` tests PASS (FLIP test still red).** Debug custGeom export via
  `exportDocumentXml()` if needed.
- [ ] **Step 4: Commit** (`feat(draw): bridge/draw.ts — ink/canvas verbs on the PM engine (real a:custGeom freeform; honest degrades)`).

---

### Task 4: `bridge/ink-overlay.ts` — the PM-only live ink overlay (capture + render)

**Files:** Create `src/renderer/bridge/ink-overlay.ts`; Modify `editor.css` (PM-scoped ink CSS); Modify `bridge/index.ts` (PM-load re-link hook).

- [ ] **Step 1: Create `bridge/ink-overlay.ts`** — `installInkOverlay(editor)` returns a handle the bridge uses. Responsibilities
  (port the proven legacy `WC.Draw` geometry — Catmull-Rom `smooth`, `pointInPoly`, `pathNear` — but operate over `#pm-editor`):
  - **Layer (mount point — CRITICAL):** an `<svg class="wc-ink-layer">` (the EXACT class the pre-wired Hide-Ink rule
    `track-chrome-pm.css:91-92` targets — NOT `pm-ink-layer`). Do NOT append it as a top-level child INSIDE the ProseMirror-managed
    `#pm-editor` content — PM reconciles that subtree and will remove/reorder it on every transaction. Mount it the way
    `bridge/notes-area.ts:236-238` / `bridge/track-chrome.ts` mount their overlays: as a sibling positioned over the `#pages`
    container (reuse the `track-chrome.ts:98-103` zoom-scale correction `scale = rect.width / pages.offsetWidth`, dividing it out of
    pointer coords — legacy draw-tools.js:103-104 divides by zoom too). **Reconcile with the Hide-Ink selector:** keep the layer a
    descendant of an element that carries `#pm-editor.pm-hide-ink`, OR (if mounted as a `#pages` sibling) widen
    `track-chrome-pm.css:92` to a sibling-combinator selector. Confirm which during implementation; the test for Hide Ink is
    `getComputedStyle(layer).display === 'none'` when the class is set.
  - **Capture:** on `drawState.on`, bind pointerdown/move/up. pointerdown→start a temp `<path class="pm-ink-stroke in-progress">`;
    pointermove→extend (smoothed); pointerup→ (a) compute PAGE-px position (overlay px → page sheet, sheet offset + margin + zoom
    divided out — K2/R3), (b) call `PM.dInsertInk(points, pen, pos)` (the bridge forwards `INK_MODE`), (c) remove the temp path (the
    persisted node now renders via re-render). K7/K8: one transaction per stroke, on pointerup ONLY.
  - **Render-from-doc (handle BOTH fresh and reopened ink — K3):** a `renderInk()` that clears + redraws every ink `vectorShape`.
    A node is ink if `attrs.isInk === true` (fresh: read `attrs.customGeometry.inkPoints`/`inkPen`/`inkPos` → smoothed `<path>` at
    `inkPos`) OR `attrs.customGeometry.paths` exists (reopened: the importer's ready-made SVG `d` strings — draw each
    `paths[].d`; recover the pen color from `attrs.drawingContent` or default, recover position from the anchor `posOffset` /
    `attrs.anchorData` if present). Call `renderInk()` on every editor transaction AND on document load. **Verify the fork editor's
    transaction event name** while implementing (`editor.on('transaction', …)` / `'update'` — grep how track-chrome/notes-area
    subscribe; do not assume).
  - **eraser/select/lasso:** operate over the persisted ink — eraser = find ink nodes whose path is near the pointer and DELETE them
    (a PM tr removing the node); select/lasso = mark nodes (overlay highlight) + Delete key removes them (`pointInPoly`/`pathNear`).
  - **replay:** `dReplay()` animates the rendered `.pm-ink-stroke` paths (stroke-dashoffset, ported from legacy `replay()`).
  - **hide/show:** honor `#pm-editor.pm-hide-ink` (the H.hideInk PM branch already latches it, commands.js:1218-1223; the pre-wired
    CSS rule consumes it once the layer is `.wc-ink-layer` + correctly placed).
- [ ] **Step 2: `editor.css`** — add the STROKE styling (the Hide-Ink toggle rule already exists in track-chrome-pm.css):
  `body.pm-active .wc-ink-layer { position:absolute; inset:0; }`, `.wc-ink-layer .pm-ink-stroke { fill:none; stroke-linecap:round; stroke-linejoin:round; }`,
  `.wc-ink-layer .pm-ink-stroke.sel { … }`, `.wc-ink-layer.pm-ink-active { pointer-events:auto; cursor:crosshair; }`,
  `.pm-ink-canvas { … }` (mirror the legacy `.ink-*` rules, PM-scoped). Do NOT add a duplicate `#pm-editor.pm-hide-ink .wc-ink-layer` rule.
- [ ] **Step 3: `bridge/index.ts`** — call the overlay's re-link on PM document load (wherever `openDocx`/mount re-creates the doc;
  the overlay must re-attach its layer + `renderInk()`).
- [ ] **Step 4: Build + visual smoke** (`npm start`; toggle Drawing, draw a stroke — it persists + survives a reload). Commit
  (`feat(draw): bridge/ink-overlay.ts — PM-only live ink overlay (capture, persist-as-shape, render-from-doc, eraser/select/lasso/replay)`).

---

### Task 5: Re-point the legacy entry points (legacy ELSE byte-identical)

**Files:** Modify `commands.js` + `ribbon.js`.

- [ ] **Step 1: `commands.js` re-points** — for each, PM-branch+return BEFORE the legacy `WC.Draw.*` line (use `PMA()`):
  - `H.drawing` (:497) → `pm.dSetDrawing(!pm.dIsDrawing())` (toggle); `H.eraser` (:510) → `pm.dSetDrawing(true); pm.dSetEraser();`
  - `H.selectObjects` (:511) → `pm.dSetSelect()`; `H.lassoSelect` (:512) → `pm.dSetLasso()`;
  - `H.drawingCanvas` (:513) → `pm.dInsertCanvas()`; `H.inkReplay` (:516) → `pm.dReplay()`;
  - `H.pensGallery`/pensMenu (:498,518-531) → **the pensMenu item onClicks call `WC.Draw.setPen`/`.toggle`/`.clearAll`
    DIRECTLY (commands.js:522,528,529) — `WC.Draw.setPen`→`setEnabled(true)`→`ensureLayer()` does `E().node.appendChild` into the
    HIDDEN legacy #editor (draw-tools.js:37,53-56) = a real legacy-doc mutation LEAK in PM mode.** PM-guard each: setPen→`pm.dSetPen(pen)`,
    toggle→`pm.dSetDrawing(!pm.dIsDrawing())`, "Clear All Ink"→`pm.dClearInk()`;
  - `H.addPen` flyout + addPenDialog (:499-508,532-540) → keep pen STATE in the UI layer (D10dr.6), but the onClicks that call
    `WC.Draw.setPen` (commands.js:501,538) leak the same way → PM-guard them to `pm.dSetPen(pen)`;
  - eraser arrow flyout (:1421-1431) → PM branch maps Stroke/Small/Medium/Large/Segment to `pm.dSetEraser(radius, mode)` (thread the
    legacy `eraseMode`, :1423) and Erase-All to `pm.dClearInk()`;
  - Layout select-menu (:1884,1887) → replace the "arrives with the Draw engine re-host" toast with the real `pm.dSetSelect()`;
  - `H.hideInk` (:1218-1223) → the PM branch toggles `#pm-editor.pm-hide-ink` (already latches the class; the overlay + CSS now consume it).
  Each legacy `WC.Draw.*`/`E().*` body stays byte-identical after the guard.
- [ ] **Step 2: `ribbon.js` pen-tile bypass (:194-220, esp. 207-211)** — the tiles call `draw.toggle()`/`draw.setPen()` DIRECTLY,
  bypassing dispatch, AND the tile "active" class reads `draw.pen.id===pen.id && draw.enabled` (:203-204). **Preserve the two-state:**
  a second click on the ACTIVE pen toggles drawing OFF (`draw.toggle()`). Guard while mirroring that:
  `const pm = (window.WC.PM && window.WC.PM.active && window.WC.PM.ready) ? window.WC.PM : null; if (pm) { const active = pm.dIsDrawing() && WC.Draw.pen && WC.Draw.pen.id === pen.id; pm.dSetPen(pen); pm.dSetDrawing(!active); return; }`
  then the unchanged legacy `draw.*` call. Have the tile-`render()` "active" highlight read `pm.dIsDrawing()` in PM mode (ribbon.js:203-204,216).
- [ ] **Step 3: Build + gates (draw NOT yet flipped — re-points dormant):** `npm run build && npm run test:pm && npm run test:legacy`
  — `test:legacy` **257/257 byte-identical**; `test:pm` unchanged (FLIP test still red).
- [ ] **Step 4: Commit** (`refactor(draw): re-point WC.Draw + ribbon pen tiles to the PM bridge (legacy ELSE byte-identical)`).

---

### Task 6: THE FLIP + leak audit

**Files:** Modify `bridge/index.ts` (add `'draw'` to `FLIPPED`).

- [ ] **Step 1: THE FLIP (index.ts:45)** — add `'draw'` to the `FLIPPED` set.
- [ ] **Step 2: Leak audit** — grep both dispatch paths + the bypass + the legacy mutators:
```bash
rg -n "WC\.Draw\.|E\(\)\.(dirty|insertHTML|insertNodeHTML)" src/renderer/public/js/commands.js src/renderer/public/js/ribbon.js
rg -n "draw\.(toggle|setPen|setEnabled|setTool|insertCanvas|replay|clearAll)" src/renderer/public/js/ribbon.js
```
  Confirm every `WC.Draw.*` mutation/toggle sits behind a PM-branch+return in PM mode, AND the `ribbon.js` tiles are guarded.
  `draw-tools.js` itself is never entered in PM mode (its callers all branch first). Document the audit in the commit body.
- [ ] **Step 3: Build + FULL PM suite green.** `npm run build && npm run test:pm` — ALL 7 `[10dr]` PASS incl. `[10dr] D6 flip`; prior 310 unchanged → PM total **317** (310 + 7).
- [ ] **Step 4: Commit** (`feat(draw): THE FLIP — draw onto the PM engine + leak audit`).

---

### Task 7: Six gates + oracle vs Word 16 + checkpoint + PR

- [ ] **Step 1: Six gates green** (build first): `test:pm` (317), `test:legacy` (257 byte-identical), `test:smoke` + `test:smoke:legacy` (9/9 ×2), `test:roundtrip` (27/0), `test:docx` (17/0). Idle machine.
- [ ] **Step 2: Visual verify** — `npm start`; Draw tab → toggle Drawing, draw strokes (persist + render), eraser removes a stroke, select/lasso, Ink Replay animates, Drawing Canvas inserts a frame, Hide Ink hides. Screenshot into `.oracle-probes/slice10-draw/`.
- [ ] **Step 3: Oracle vs Word for Windows 16.0** (PID-safe, foreground) — author a doc with 2-3 ink strokes + a canvas frame (an authoring probe like `scripts/oracle-probe-slice10-exotica.js`, saved via `wordAPI.saveBytes`), then:
```powershell
powershell -STA -ExecutionPolicy Bypass -File scripts/oracle/word-oracle-win.ps1 roundtrip C:\tmp\wc-slice10-draw-clone.docx C:\tmp\wc-slice10-draw-resaved.docx
```
  - **Leg A (clone→Word):** ROUNDTRIP_OK (no repair). Inspect the resaved docx: `<a:custGeom>`/`<a:pathLst>` (ink), `prst="rect"` (canvas), the anchored `wp:anchor` survive Word's resave. **If Word repairs the anchored blob (K2), fall back to `wp:inline` + record an "exact ink position" deferral; re-oracle.**
  - **Leg B (Word→clone):** the `[10dr] IMPORT round-trip` pins clone-authored round-trip; this leg confirms Word's serialization imports (author ink in the clone → Word resave → `PM.openDocx`).
  Write verdicts to `docs/superpowers/plans/notes/2026-06-13-slice10-draw-oracle.json` + commit the probe(s).
- [ ] **Step 4: Checkpoint (plan-tracking skill)** — append a dated `last-point.md` entry; tick `execution-map.md`; advance the banner to "slice 10 PR4 (draw) DONE → slice 11 (legacy retirement) next"; record deferrals in `deferrals.md`: real InkML `w14:contentPart` ink (Class A/B, like chart/smartart); real `wpc:wpc` Drawing Canvas (Class A/B); inkToShape/inkToMath (no real ML construct); `arcTo` in custGeom dropped by the parser (the smoother never emits arcs); **highlighter = a fat translucent freeform stroke, not Word's true highlighter fill** (D10dr honest degrade); **eraser mode (point/segment) collapses to whole-stroke delete** if `dSetEraser` mode-threading was deferred; and **anchored-vs-inline** ink positioning IF the Task-1 oracle gate forced the `inline` fallback (exact-position deferral). Update `docs/DRAW_TAB.md`. Commit.
- [ ] **Step 5: PR into `main`, merge, delete branch, refresh graph** via `/graphify` (fork excluded).

---

## §5. Definition of done

- Area `draw` FLIPPED; all 8 cmds dispatch to `bridge/draw.ts`/`ink-overlay.ts` in PM mode; legacy ELSE byte-identical; the `ribbon.js` pen-tile bypass guarded.
- Freehand strokes persist as REAL DrawingML freeform shapes (`a:custGeom`/`a:pathLst` + `a:ln`; `wp:anchor` floating-where-drawn if the Task-1 oracle gate passed, else `wp:inline` + an exact-position deferral) that round-trip Word AND the fork — a strict upgrade over the non-exporting legacy ink. **Reopened ink stays VISIBLE** (the overlay renders it from the importer's `customGeometry.paths`, not just freshly-drawn `inkPoints` — K3). Drawing Canvas = a real bounded rect shape.
- Live drawing/eraser/select/lasso/replay work in PM mode via the overlay; Hide Ink wired.
- chart/smartart-tier honest degrades for real InkML / `wpc:wpc` canvas / inkToShape/inkToMath, recorded in deferrals.md.
- Six gates green (PM 317, legacy 257 byte-identical, smoke 9/9 ×2, roundtrip 27/0, docx 17/0). Oracle Leg A PASS (+ Leg B).
- Fork edits NOTICE'd. Plan docs checkpointed. PR merged. Graph refreshed.

## §6. Execution order (one commit each, subagent-driven w/ two-stage review)

1. Task 0 — red `[10dr]` tests.
2. Task 1 — fork `insertInkShape` + `synthesizeInkDrawing` + `isInk` (NOTICE'd).
3. Task 2 — fork `VectorShapeView` empty-for-ink (NOTICE'd).
4. Task 3 — `bridge/draw.ts` + index.ts wiring (NOT the flip) → engine-half `[10dr]` green.
5. Task 4 — `bridge/ink-overlay.ts` + PM-scoped CSS + PM-load re-link.
6. Task 5 — re-point WC.Draw/commands.js/ribbon.js (legacy ELSE byte-identical) — dormant until the flip.
7. Task 6 — THE FLIP + leak audit → full `[10dr]` green.
8. Task 7 — six gates + oracle + checkpoint + PR.
