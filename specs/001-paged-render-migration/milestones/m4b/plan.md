# Implementation Plan: Paged Render Migration — **Milestone 4b** (image-resize overlay retarget)

**Feature**: `001-paged-render-migration` (umbrella) · **This plan covers ONLY Milestone 4b** (a sub-slice of M4)
**Branch (slice)**: `slice/m4b-image-resize` (off `layout-engine`) · **Date**: 2026-06-20
**Spec**: [spec.md](spec.md) (US2 / FR-005 / SC-006) · **Runbook**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)
**M1/M2/M3/M4a (done)**: archived at [milestones/](milestones/) · adapter at `src/renderer/layout/coordinate-adapter.ts` (`WC.PM.coords`)

> **M4 sub-slices:** M4a ✓ (comments+track). **M4b** = image-resize (THIS). M4c = ink (hard). M4d = notes-disable + header-footer-test. M5–M6 out of scope.

## Summary

In paged mode the image resize-handle overlay (`.wc-img-resize`: 8 grips + a move-region, mounted in `#pages`)
mis-positions because `boxFor(pos)` reads `view.nodeDOM(pos).getBoundingClientRect()` — the HIDDEN off-screen
editor's image geometry. M4b retargets it to the painted image.

**Research verdict (decisive):** PE's `ImageInteractionLayer` only stamps drag METADATA (`draggable=true`,
dataset) — it draws **NO resize handles** ([ImageInteractionLayer.ts:83-89](../../src/renderer/core/superdoc-fork/core/presentation-editor/dom/ImageInteractionLayer.ts)).
So **disable is not viable → RETARGET** the bridge overlay. PE exposes `editor.getElementAtPos(pos)` (mode-aware:
painted element in paged, view-based in overlay, null off-page) — the painted-image access `nodeBoxFor` needs.
**Zoom is safe:** `#pages` carries the only zoom transform (`scale(WC.PM.zoom)`) in both modes and we never set
PE's internal zoom (stays 1), so the rendered `#pages` scale (`rect.width/offsetWidth`) is the total visible scale.

## Decisions (from planning Q&A)

1. **Build two seam methods** on `WC.PM.coords`:
   - `nodeBoxFor(pos)` (the M1-deferred helper): `editor.getElementAtPos(pos).getBoundingClientRect()` → the
     proven M4a `(rect − #pages.rect)/#pages.scale` formula → `{left,top,width,height}|null`.
   - `overlayScale()`: the rendered `#pages` scale (`rect.width/offsetWidth`, =`WC.PM.zoom` today) — ONE
     coherent scale source for both handle positioning AND the drag math.
2. **Retarget image-resize.ts** — `boxFor(pos)` delegates to `WC.PM.coords.nodeBoxFor(pos)`; `zoom()` delegates
   to `WC.PM.coords.overlayScale()` (so the drag delta uses the same rendered scale as positioning — the more
   professional, coherent, Word-faithful choice; byte-identical in overlay). All else (handle render, selection,
   drag pipeline) unchanged.
3. **Paged relayout trigger** — image-resize adds a once-bound `wc:paged-relayout` listener → `update()` (the
   M4a event), so handles follow the image on a no-transaction reflow.
4. **No fork edits.** PE draws no handles; the bridge keeps owning them.

## Technical Context

**Language/Version**: TypeScript on `window.WC`; Electron 31.
**Primary Dependencies**: M1 `WC.PM.coords`; `editor.getElementAtPos` (Editor→PE delegation); `imageresize/image-resize.ts`; the M4a `wc:paged-relayout` event.
**Testing**: 3 gates (475/9/27) + `test:bundle` (4); a NEW image-resize probe (real-image insert+select → handle box ≈ nodeBoxFor; overlay parity); a manual real-app drag spot-check (computer-use is blocked for the dev build — see Risks).
**Constraints**: model page-free; **overlay byte-identical** (delegations equal the legacy formulas); paged behavior behind `WC_LAYOUT=paged`.
**Scale/Scope**: +2 seam methods; 2 delegations + 1 listener in image-resize.ts. One new probe.

## Constitution Check
Unratified template; gates = project rules + runbook invariants.

| Gate | M4b compliance |
|------|----------------|
| Model page-free | ✅ overlay positioning only. |
| Overlay byte-identical | ✅ nodeBoxFor==legacy boxFor (verify getElementAtPos≡view.nodeDOM in overlay); overlayScale==WC.PM.zoom in overlay; gate-verified. |
| 3 gates (475/9/27) + bundle 4 | ✅ required. |
| New behavior behind `WC_LAYOUT=paged` | ✅ paged-correct only differs when getElementAtPos hits PE; the relayout event only fires in paged. |
| No hand-edit of generated files | ✅ untouched. |

**Result: PASS.**

## Project Structure
```text
specs/001-paged-render-migration/
├── spec.md · plan.md (THIS, M4b) · research.md · data-model.md
├── contracts/image-resize.md
├── quickstart.md
└── milestones/{m1,m2,m3,m4a}/   # archived
```
### Source Code — M4b touch set
```text
src/renderer/layout/coordinate-adapter.ts  # ADD nodeBoxFor(pos) + overlayScale()
src/renderer/imageresize/image-resize.ts   # boxFor → WC.PM.coords.nodeBoxFor; zoom() → overlayScale; wc:paged-relayout listener
scripts/paged-image-resize-probe.js        # NEW — real-image insert+select → handle box ≈ nodeBoxFor; overlay parity
package.json                               # add probe:imageresize
```
**Structure Decision**: image-node geometry centralizes on `WC.PM.coords` (M1 philosophy); image-resize stays a thin consumer. No fork edits.

## Phase 0 — Research
See [research.md](research.md): the image-resize coordinate surface; PE draws no handles (quoted); getElementAtPos as the painted-image access; the zoom-safety proof; the retarget verdict.

## Phase 1 — Design & Contracts
- **Entities**: [data-model.md](data-model.md) — NodeBox, the overlay scale, the relayout trigger.
- **Contract**: [contracts/image-resize.md](contracts/image-resize.md) — `nodeBoxFor`/`overlayScale` signatures + the image-resize delegations.
- **Validation**: [quickstart.md](quickstart.md).

## Verification (definition of done for M4b)
1. `npm run build` clean.
2. **3 gates** green (475/9/27) + `test:bundle` 4/4.
3. **New image-resize probe** (`WC_LAYOUT=paged`): insert an image + select it (NodeSelection); `nodeBoxFor(imagePos)`
   returns a finite painted-page box; the rendered `.wc-img-resize` overlay box ≈ `nodeBoxFor(imagePos)`; the box is
   painted-aware (differs from the hidden `view.nodeDOM` box); `overlayScale()` finite.
4. **Overlay parity** (default build): `nodeBoxFor` === the legacy `boxFor` formula; `overlayScale()` === `WC.PM.zoom`; image overlay byte-identical.
5. **Manual drag spot-check** (real app): drag a corner handle in paged mode → the image resizes following the cursor (the live gesture synthetic events can't reliably drive; computer-use blocked for the dev build).
6. **`/code-review`** on the slice; fix all findings; re-verify.

## Risks
- **getElementAtPos ≡ view.nodeDOM in overlay?** Must confirm the overlay path returns the same element (and box) as the legacy `view.nodeDOM(pos)`, else overlay parity breaks — gate-checked by the parity probe.
- **Computer-use is blocked** for the CLI-launched dev Electron build (not a Start-menu app; title collides with MS Word) → the live drag gesture is verified manually, not by automation.

## Complexity Tracking
*No constitution violations — empty.*
