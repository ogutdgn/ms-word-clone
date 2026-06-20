# Phase 0 Research — Milestone 4c (ink-overlay retarget)

> ## ⚠️ SPIKE-CORRECTED SCOPE (supersedes the pre-spike premise below)
> The probe-first spike (`scripts/paged-ink-spike.js`, 4 rounds under `WC_LAYOUT=paged`) **disproved the central
> premise** that ink "mis-positions on every axis in paged because `localPt` reads the hidden editor". Findings:
> - **`#pm-editor` is NOT hidden in paged.** It is `parent=#pages`, fills `#pages` exactly (`offL/offT=0`, rect ==
>   `#pages` rect), and PE paints the `.superdoc-page` *inside* it. So `localPt` (`(client − #pm-editor.rect)/scale`)
>   and `sizeLayer` (sized to `#pm-editor.offset*`) already resolve to `#pages`-local — **correct in paged**.
> - **In-app paged ink ALREADY WORKS** (proven): a fresh stroke captures + renders on the correct page (page 0 AND
>   page 1 of an 8-page doc), the `svg.wc-ink-layer` (`zIndex:5`) spans all stacked pages and toggles
>   `pointer-events` (`none`→`auto` on `pm-ink-active`); a synthetic pointerdown on the **active** layer captures
>   (`elementFromPoint`→the SVG, `insideInk=true`) → in-progress path → committed stroke. Eraser/select/lasso ride
>   the same working space.
> - **The ONE real defect = multi-page `.docx` EXPORT.** The persisted `pos` is `#pages`-local but
>   `synthesizeInkDrawing` writes it as `wp:positionH/V relativeFrom='page'` `posOffset` (vector-shape.js:137-138)
>   → a page-2+ stroke exports at the wrong on-page offset, on the wrong page. Two parts: (i) `posOffset` must be
>   **page-local**; (ii) the node anchors at the **caret**, not the draw page — `computeCaretLayoutRect`/
>   `posToClientRect`/`getElementAtPos` all return **null for the anchored ink node itself**, but resolve for a
>   *nearby in-flow* position (`computeCaretLayoutRect(nodePos−1).pageIndex` ✓). Correct export needs **re-anchoring
>   the node to the page drawn on** (via `WC.PM.coords.clientToPos` at pointerdown) + a page-local `posOffset`.
> - **Decision (user): lock in-app correctness with a comprehensive probe + fix the multi-page export** (re-anchor +
>   page-local). Overlay mode stays byte-identical. See the corrected plan/tasks. Page-resolution at render uses
>   `computeCaretLayoutRect(nodePos−1)` + `overlayPageBox`; page 0 origin `(0,0)` → no change (single-page/overlay
>   byte-identical).

---

Sourced from the **M4c understanding sweep** (5 parallel readers → synthesis → adversarial completeness critic;
all findings code-grounded, file/line cited). **NB: the spike (above) corrected several premises — read it first.**

## Decision: PE does NOT paint FRESH in-app ink → the overlay stays the SOLE renderer in paged (the M4b inversion)
- **Rationale**: A fresh ink node is a `vectorShape` with `attrs.isInk:true` + `customGeometry.{inkPoints,inkPen,inkPos}`
  and **no `.paths`** (vector-shape.js `insertInkShape`). Three independent confirmations: (1) the live NodeView
  returns a zero-size placeholder span for `isInk` ("isInk nodes are painted by the PM ink overlay",
  VectorShapeView.js:99-106); (2) the PE painter's `tryCreateCustomGeometrySvg` bails `if (!custGeom?.paths?.length)
  return null` (renderer.ts:3237) and the preset-geometry lib is stubbed `()=>''` in this fork build; (3) grep for
  `isInk` across `_vendor/superdoc` painter = **zero matches**. So PE renders, at most, an invisible fallback box —
  never the stroke geometry. **Consequence**: unlike M4b (PE painted the image, overlay added handles), here
  `renderInk()` must KEEP rendering committed fresh strokes in paged; the SVG layer is a real render + hit-test
  surface, so eraser/select/lasso are preserved for free.
- **Alternatives considered**: (a) teach PE to paint `isInk` → REJECTED (fork edit + duplicates working overlay
  render). (b) capture-only scratch layer (let PE paint committed strokes) → REJECTED (PE doesn't paint fresh ink, so
  committed strokes would vanish).

## Decision: add ONE seam method `clientToOverlayLocalPt(cx,cy) → {x,y,pageIndex}|null`
- **Rationale**: It is the literal inverse of the shipped M4a/M4b `#pages`-local mapping
  (`(client − #pages.rect)/#pages.scale` via the existing internal `pagesScale()` — coordinate-adapter.ts:218/232/259),
  so it round-trips cleanly (critic-CONFIRMED by code read). The `pageIndex` is NEW: scan `#pm-editor`'s
  `.superdoc-page[data-page-index]` rects for pointer containment (PE exposes no client→page helper). This is the
  M4-deferred method already stubbed at coordinate-adapter.ts:81.
- **Alternatives considered**: reuse `clientToPos` (gives a doc pos, not a page-local point/index) — insufficient for
  the SVG draw space. A new per-page SVG — see below.

## Decision: SINGLE `#pages`-spanning SVG layer (option A), not per-page
- **Rationale**: matches the existing single-layer model, survives PE repaints as a `#pages` child, preserves ONE
  unified hit-test surface for the tools, avoids per-page DOM churn under PE virtualization. `renderInk` offsets each
  committed stroke onto its page origin.
- **Alternatives considered**: (B) a surface inside each `.superdoc-page` (Word-accurate clipping but DOM rebuilt on
  every PE repaint/virtualization) — REJECTED at this milestone (per-page clipping is not a visible in-canvas ink
  fidelity gap). (C) live-capture-only surface repositioned on pointerdown — REJECTED (overlay must also RENDER
  committed strokes, which a capture-only layer can't).

## Decision: cross-page stroke CLAMPED to the pointerdown page
- **Rationale** (user): a committed stroke is ONE `vectorShape` anchored to ONE page (`wp:anchor relativeFrom='page'`).
  Resolve the page once at `onDown` and map all points into that page's local space → faithful single-anchor Word
  export. Lasso *selection* may still iterate all rendered strokes regardless of page.
- **Alternatives considered**: allow cross-page (no faithful single-anchor export); split into per-page nodes
  (schema churn, not Word-shaped) — both REJECTED.

## Decision: byte-identity via MODE-BRANCH
- **Rationale**: ink is the ONLY overlay that mounts at `#pm-editor.offsetLeft/Top` (ink-overlay.ts:122-138), which is
  NON-ZERO in overlay (the sheet is centered in `#pages`). Routing overlay through a `#pages(0,0)` origin would SHIFT
  overlay ink. The safe path: keep overlay on its `#pm-editor`-local origin + `localPt`; gate every retarget on
  `window.__WC_LAYOUT_MODE==='paged'`. The probe's overlay-parity rows are the guard.
- **Alternatives considered**: move BOTH origin and `localPt` to `#pages`-local in lockstep (cleaner long-term, higher
  regression risk) — DEFERRED; not worth the risk for M4c.

## Decision: reopened-ink (`.paths`) double-draw → suppress the overlay's `.paths` branch in paged
- **Rationale**: the docx importer rewrites `customGeometry` to `{paths}` and drops `isInk` (extractCustomGeometry,
  vector-shape-helpers.js:469-480), so PE's `.paths` gate PASSES and PE paints it. The overlay's `.paths` branch
  (ink-overlay.ts:310-325) would also draw it → double-draw. Gate that branch off in paged (PE owns reopened ink;
  fresh `inkPoints` strokes stay overlay-rendered). **Probe-gated**: confirm reopened ink actually paints via PE in
  paged before disabling the overlay branch.

## Decision: NO fork edits for PE's invisible fallback box
- **Rationale**: a fresh `isInk` node, lacking `.paths`, falls through to `applyFallbackShapeStyle` (renderer.ts:2817)
  → a `width×height` CONTAINER box, invisible only because `dInsertInk` leaves `fillColor=null` (→ `background:none`,
  2840) and `strokeColor=null` (→ `border:none`, 2861). The project invariant forbids editing the vendored painter.
  **Probe-first**: confirm the box is invisible AND doesn't steal overlay pointer events / skew `getElementAtPos`; if
  it does, neutralize with a paged CSS rule in OUR stylesheet (`pointer-events:none` on the painted `isInk` box).

## Probe-FIRST unknowns (code-read could not settle; verify empirically during implementation — the M4b discipline)
1. **`getElementAtPos(inkPos)` resolves a fresh `isInk` node's painted page?** Proven only for IMAGE nodes
   (paged-image-resize-probe.js). The painted element is PE's invisible fallback box, NOT the hidden-view placeholder
   span (critic flagged the synthesis conflated them). If it doesn't resolve, fall back to a `clientToOverlayLocalPt`
   page-containment / `overlayPageBox(pageIndex)` placement.
2. **The invisible fallback box** — visible? in the DomPositionIndex? intercepts overlay pointer events?
3. **Persist round-trip** — fresh ink is overlay-rendered, so page-local-vs-`#pages`-local correctness only bites at
   **export→reopen**; needs a dedicated export→openDocx paged probe. Also confirm what `relativeFrom`
   `synthesizeInkDrawing` (draw.ts) actually emits, and from which origin the `posOffset` is computed.

## The ink coordinate consumers (what M4c must keep consistent)
`localPt` (ink-overlay.ts:141), `ensureLayer`/`sizeLayer` (107-138), `onDown`/`onMove`/`onUp` (157-214),
`renderInk` (286-328: fresh `inkPoints` placed at `inkPos`-offset px; reopened `.paths` EMU→px), `eraseAt`/`selectAt`/
`finishLasso`/`pathNear`/`pointInPoly` (246-283, hit-test the rendered SVG paths via `getBBox`/`getTotalLength`/
`getPointAtLength` → `data-ink-pos` → `deleteNodesAt`). All operate in ONE space today; M4c keeps them consistent by
fixing `localPt` (capture) and `renderInk` (placement) to the SAME painted-page space.
