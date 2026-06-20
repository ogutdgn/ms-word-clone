# Implementation Plan: Paged Render Migration — **Milestone 4c** (ink-overlay retarget)

**Feature**: `001-paged-render-migration` (umbrella) · **This plan covers ONLY Milestone 4c** (a sub-slice of M4)
**Branch (slice)**: `slice/m4c-ink` (off `layout-engine`) · **Date**: 2026-06-20
**Spec**: [spec.md](spec.md) (US2 / FR-005 / SC-006) · **Runbook**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)
**M1/M2/M3/M4a/M4b (done)**: archived at [milestones/](milestones/) · adapter at `src/renderer/layout/coordinate-adapter.ts` (`WC.PM.coords`)

> **M4 sub-slices:** M4a ✓ (comments+track) · M4b ✓ (image-resize) · **M4c** = ink (THIS — the hard one) · M4d = notes-disable + header-footer-test. M5–M6 out of scope.

## Summary

**Spike-corrected (see [research.md](research.md) ⚠️).** In paged, `#pm-editor` is the **visible paint host** (PE
paints the `.superdoc-page` *into* it; it fills `#pages` at offset 0,0), so the ink overlay's `localPt`/`sizeLayer`
already resolve to `#pages`-local — **in-app paged ink already works** (capture + live render + commit + tools, on
page 0 AND later pages; the `svg.wc-ink-layer` `zIndex:5` spans all pages and captures when active). The **one real
defect is the multi-page `.docx` EXPORT**: the persisted `pos` is `#pages`-local but `synthesizeInkDrawing` writes it
as `wp:positionH/V relativeFrom='page'` `posOffset` (vector-shape.js:137-138) → a page-2+ stroke saves at the wrong
on-page offset, on the wrong page (the node also anchors at the **caret**, not the draw page).

**M4c (user-chosen scope): LOCK in-app correctness with a comprehensive probe + FIX the multi-page export.**

## Decisions (planning Q&A + the spike)

1. **Scope** (user): lock in-app correctness (probe-guarded) **and** fix the page-2+ export.
2. **Export fix** = re-anchor + page-local: at `onDown` resolve the draw page (`pageIndex` + origin) AND the doc
   insertion position on that page (`WC.PM.coords.clientToPos`); at `onUp` (paged) insert the ink node at that doc
   position (so its **anchor page = the draw page**) and persist `pos` = **page-local** (`#pages`-local bbox −
   page origin) → `synthesizeInkDrawing` `posOffset` becomes correct page-local. Matches Word's `relativeFrom='page'`.
3. **Cross-page stroke = CLAMP to the start page** (user): the page is resolved ONCE at `onDown`; all points map into
   that page's local space.
4. **renderInk page-resolution** (paged, fresh strokes): `pos` is now page-local, so offset each stroke onto its
   page origin. Resolve the page from a **nearby in-flow position** — `computeCaretLayoutRect(nodePos−1).pageIndex`
   (the node's OWN position returns null — it's a `relativeFrom='page'` float) — then `overlayPageBox(pageIndex)`.
   Page 0 origin `(0,0)` → no-op → single-page/overlay byte-identical.
5. **Seam additions** on `WC.PM.coords`: `clientToOverlayLocalPt(cx,cy) → {x,y,pageIndex}|null` (the M4-deferred stub
   at coordinate-adapter.ts:81; `#pages`-local point + the page under the pointer via `.superdoc-page[data-page-index]`
   containment) and `overlayPageBox(pageIndex) → {left,top,width,height}|null` (the page's `#pages`-local origin).
   Both reuse `pagesScale()`. `clientToPos` already exists (M1).
6. **Reopened ink (`.paths`)**: the importer rewrites `customGeometry` to `.paths` + drops `isInk`, so PE paints it.
   **Probe whether the overlay's `.paths` branch (ink-overlay.ts:310-325) double-draws in paged**; if so, suppress it
   (PE owns reopened ink). Gate behind the probe finding.
7. **Byte-identity = MODE-BRANCH.** Every paged-specific change is `__WC_LAYOUT_MODE==='paged'`-gated; overlay keeps
   the caret-anchor + `#pm-editor`-local persist + `inkPos`-px render. The probe's overlay rows are the guard.
8. **NO FORK EDITS.** `synthesizeInkDrawing` (fork) already emits `relativeFrom='page'` from `pos`; we only change
   the `pos` we PASS (page-local) and the insertion position — both bridge-side. The svg layer already has the right
   `zIndex`; a paged CSS rule (our stylesheet) is the fallback if a regression appears.

## Technical Context

**Language/Version**: TypeScript on `window.WC`; Electron 31. **Primary Dependencies**: M1 `WC.PM.coords` (+ the
M4a `posToOverlayLocalRect`/`pagesScale` internals, M4b `nodeBoxFor`/`getElementAtPos`); `ink-overlay.ts` + `draw.ts`;
the M4a `wc:paged-relayout` event. **Testing**: 3 gates (475/9/27) + `test:bundle` (4) + a NEW `paged-ink-probe.js`
(`probe:ink`). **Constraints**: model page-free; **overlay byte-identical** (mode-branch); paged behind
`WC_LAYOUT=paged`; **no fork edits**. **Scale/Scope**: +1 (maybe +2) seam method; retarget `localPt`/`sizeLayer`/
`ensureLayer`/`renderInk`/`onUp`/`bind` in ink-overlay.ts (paged-branched); 1 new probe. **Target Platform**:
Windows (Word-for-Windows COM parity), Electron renderer.

## Constitution Check
Unratified template; gates = project rules + runbook invariants.

| Gate | M4c compliance |
|------|----------------|
| Model page-free | ✅ overlay capture/render only; the doc keeps the same `vectorShape` nodes. |
| Overlay byte-identical | ✅ MODE-BRANCH — overlay keeps the `#pm-editor`-local mount + `localPt`; only paged routes through the seam. Gate-verified by the probe's overlay-parity rows (`.pm-ink-stroke` `d`-strings + layer geometry unchanged). |
| 3 gates (475/9/27) + bundle 4 | ✅ required. |
| New behavior behind `WC_LAYOUT=paged` | ✅ every retarget branch is `__WC_LAYOUT_MODE==='paged'`-gated. |
| No fork edits | ✅ PE's invisible fallback box handled via OUR CSS / leave-as-is; the seam + overlay are bridge-side. |
| No hand-edit of generated files | ✅ untouched. |

**Result: PASS.**

## Project Structure
```text
specs/001-paged-render-migration/
├── spec.md · plan.md (THIS, M4c) · research.md · data-model.md
├── contracts/ink-overlay.md
├── quickstart.md · checklists/requirements.md
└── milestones/{m1,m2,m3,m4a,m4b}/   # archived
```
### Source Code — M4c touch set
```text
src/renderer/layout/coordinate-adapter.ts  # ADD clientToOverlayLocalPt(cx,cy)→{x,y,pageIndex}|null + overlayPageBox(pageIndex)→{box}|null
src/renderer/bridge/ink-overlay.ts         # onDown(paged): resolve pageIndex+origin (clientToOverlayLocalPt) + draw docPos (clientToPos) + clamp; onUp(paged): insert at draw docPos (re-anchor) + persist page-local pos; renderInk(paged): offset fresh strokes onto their page origin (page via computeCaretLayoutRect(nodePos−1)); suppress reopened-.paths branch in paged IF the probe shows double-draw — ALL paged-branched
src/renderer/bridge/draw.ts                # dInsertInk: allow an explicit insertion docPos (paged re-anchor) without disturbing overlay; no fork edit (synthesizeInkDrawing already emits relativeFrom='page')
src/renderer/public/css/*                  # FALLBACK ONLY if the probe shows a paged regression (layer stacking / fallback box)
scripts/paged-ink-probe.js                 # NEW — paged: capture+render on page 1 AND page 2, tools, page-local EXPORT (export→reopen lands on the right page), reopened no-double-draw; overlay parity (byte-identical)
package.json                               # add probe:ink
```
**Structure Decision**: in-app coordinates already work; M4c adds page-resolution (`overlayPageBox`) + the
`clientToPos` re-anchor on `WC.PM.coords` (M1 philosophy) and a thin paged branch in ink-overlay. No fork edits.

## Phase 0 — Research
See [research.md](research.md): the ink coordinate surface (every consumer); the decisive PE-does-not-paint-fresh-ink
proof; `getElementAtPos`-for-ink + the invisible-fallback-box unknowns (probe-first); the page-resolution +
page-local-persist model; the cross-page clamp; the reopened-ink double-draw caveat; the byte-identity risk.

## Phase 1 — Design & Contracts
- **Entities**: [data-model.md](data-model.md) — the OverlayLocalPt (`{x,y,pageIndex}`), the ink layer surface, the
  per-mode placement model, the persist frame.
- **Contract**: [contracts/ink-overlay.md](contracts/ink-overlay.md) — `clientToOverlayLocalPt` (+ optional
  `overlayPageBox`) signatures + the ink-overlay paged-branch behaviors.
- **Validation**: [quickstart.md](quickstart.md).

## Verification (definition of done for M4c)
1. `npm run build` clean.
2. **3 gates** green (475/9/27) + `test:bundle` 4/4.
3. **New ink probe** (`WC_LAYOUT=paged`): **in-app capture+render** — synthesize a draw on page 1 AND on page 2
   (active layer captures; the committed `.pm-ink-stroke` lands inside the target `.superdoc-page[data-page-index]`);
   **tools** (synthetic eraser/select/lasso delete/select the right `vectorShape` via `data-ink-pos`); **page-local
   EXPORT** — a stroke drawn on page 2, exported (`exportDocx`/`save`) → reopened (`openDocx`), lands on page 2 (the
   crux fidelity gate; today it lands wrong); **reopened-ink no-double-draw** (renders exactly once).
4. **Overlay parity** (default build): a drawn/rendered stroke's `.pm-ink-stroke` `d`-strings + `svg.wc-ink-layer`
   geometry byte-identical to pre-M4c (the mode-branch guard).
5. **`/code-review`** on the slice; fix all findings; re-verify.
6. **Real-app paged verification is BLOCKED** (computer-use can't target the dev Electron build) → headless probes
   are the gate (noted in Risks). The 4-round spike (`scripts/paged-ink-spike.js`) already proved in-app capture/
   render empirically.

## Risks
- **Overlay byte-identity** — ink uniquely mounts at `#pm-editor.offset` (non-zero in overlay due to centering),
  unlike all other overlays (`#pages(0,0)`). The MODE-BRANCH keeps overlay untouched; the probe's parity rows are the
  guard.
- **`getElementAtPos` for an `isInk` node is UNPROVEN** (proven only for IMAGE nodes). The painted element is PE's
  invisible fallback box, NOT the hidden-view placeholder span — **probe-first**: confirm `getElementAtPos(inkPos)`
  resolves the correct `.superdoc-page` before relying on it; fall back to `clientToOverlayLocalPt`-style page
  containment / `overlayPageBox` if not.
- **PE's invisible fallback box** may intercept overlay pointer events or skew `getElementAtPos` — **probe-first**;
  neutralize via OUR CSS if needed (no fork edit).
- **Persist-space** — fresh ink is overlay-rendered, so page-local-vs-`#pages`-local only bites at **export→reopen**;
  a dedicated export→openDocx paged probe is required, plus confirming the `relativeFrom` `synthesizeInkDrawing`
  emits.
- **Computer-use blocked** for the dev build → every coordinate/origin assumption ships on headless probes alone.
- **Virtualization** — `getElementAtPos` / `.superdoc-page` lookups return `null` for unmounted pages; the seam +
  `renderInk` must no-op gracefully (skip render / drop the gesture), never place ink at a `(0,0)` origin.

## Complexity Tracking
*No constitution violations — empty.*
