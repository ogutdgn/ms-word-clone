# Implementation Plan: Paged Render Migration — **Milestone 4a** (overlay retarget: helpers + comments + track-chrome)

**Feature**: `001-paged-render-migration` (umbrella) · **This plan covers ONLY Milestone 4a** (the first sub-slice of M4)
**Branch (slice)**: `slice/m4a-overlay-helpers-comments-track` (off `layout-engine`) · **Date**: 2026-06-20
**Spec**: [spec.md](spec.md) (US2 / FR-005 / SC-006) · **Runbook**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)
**M1/M2/M3 (done)**: archived at [milestones/](milestones/) · adapter at `src/renderer/layout/coordinate-adapter.ts` (`WC.PM.coords`)

> **M4 is split into sub-slices** (decision): **M4a** = shared helpers + comments-ui + track-chrome (THIS plan).
> **M4b** = image-resize. **M4c** = ink-overlay (the hard one). **M4d** = notes-area (disable in paged) +
> header-footer (integration test). Each sub-slice gets its own `/speckit-plan` when reached; all roll up
> under runbook milestone **M4**. M5–M6 out of scope.

## Summary

In paged mode the comment glyphs/cards and tracked-change bars/balloons mis-position because they read
`editor.view.coordsAtPos(pos)` (the HIDDEN off-screen editor's geometry) instead of the painted pages. M4a
retargets the **two coupled "moderate" overlays** (their layouts interact — track balloons collision-detect
against comment cards) by building the two shared helpers on the `WC.PM.coords` seam and routing both
overlays through them. **Overlay mode stays byte-identical.**

**Key enabling insight (research):** both overlays compute *#pages-local* coordinates the same way —
`local = (view.coordsAtPos(pos) − #pages.rect) / (#pages.rect.width / #pages.offsetWidth)`
([comments-ui.ts:125-136](../../src/renderer/bridge/comments-ui.ts), [track-chrome.ts:91-106](../../src/renderer/bridge/track-chrome.ts)).
If the helper swaps **only** `view.coordsAtPos` → the M1 `posToClientRect` (painted-aware in paged, identical
in overlay) and keeps the `#pages` container math, it is **mode-agnostic and byte-identical in overlay**, and
`#pages`'s own rendered scale (`rect.width/offsetWidth`) resolves the zoom baseline in both modes.

## Decisions

1. **Two helpers on `WC.PM.coords`** (the M1-deferred contract):
   - `posToOverlayLocalRect(pos): { top, bottom, left } | null` — replaces `track-chrome.localRect` (incl. its
     clamp-to-doc-bounds and its "zero rect → null" hidden-run guard, verbatim).
   - `posToOverlayLocalY(pos): number | null` — replaces `comments-ui.localY` (verbatim, no zero-rect guard).
   Both = `posToClientRect(clampedPos)` → `(rect.top − #pages.rect.top) / scale`, with `scale = #pages.rect.width/offsetWidth`.
2. **Per-page visibility contract:** if `pos` is on a non-painted (virtualized) page, `posToClientRect` →
   null → the helper returns null → the overlay simply doesn't render that annotation until its page paints
   (matches virtualization; the card/bar appears when the user scrolls to its page).
3. **Paged relayout trigger (extensible):** extend the M3 `presentation.onLayoutUpdated` handler to ALSO emit
   a `window` event `wc:paged-relayout`; comments-ui + track-chrome add a listener that calls their existing
   `schedule()`. (M3's `StatusBar.update()` call stays; M4b/M4c overlays will listen to the same event.)
4. **No fork edits.** PE decorates the text (highlights/strikethrough) natively; the bridge keeps owning the
   glyphs/cards/bars/balloons UI and just repositions them via the seam.

## Technical Context

**Language/Version**: TypeScript (adapter, bridge overlays) on `window.WC`; Electron 31.
**Primary Dependencies**: M1 `WC.PM.coords` (`posToClientRect`); `bridge/comments-ui.ts`, `bridge/track-chrome.ts`; `presentation.onLayoutUpdated` (M3).
**Testing**: 3 gates (475/9/27) + `test:bundle` (4); a NEW overlay probe (paged anchoring + overlay parity).
**Constraints**: model page-free; **overlay byte-identical** (helpers replicate the consumers' formulas verbatim); paged behavior behind `WC_LAYOUT=paged`.
**Scale/Scope**: +2 helpers on the adapter; swap 1 call each in comments-ui/track-chrome; +1 relayout-event listener each; extend the M3 onLayoutUpdated handler by one line. One new probe.

## Constitution Check

Unratified template; gates = project rules + runbook invariants.

| Gate | M4a compliance |
|------|----------------|
| Model page-free | ✅ overlay positioning only. |
| Overlay byte-identical | ✅ helpers replicate `localY`/`localRect` verbatim (only the `coordsAtPos`→`posToClientRect` swap, identical in overlay); gate-verified. |
| 3 gates (475/9/27) + bundle 4 | ✅ required. |
| New behavior behind `WC_LAYOUT=paged` | ✅ paged-correct positioning only differs when `presentation` is present; the `wc:paged-relayout` event only fires in paged. |
| No hand-edit of generated files | ✅ `ribbon-data.js`/`icons-fluent.js` untouched. |

**Result: PASS.**

## Project Structure
```text
specs/001-paged-render-migration/
├── spec.md · plan.md (THIS, M4a) · research.md · data-model.md
├── contracts/overlay-helpers.md
├── quickstart.md
└── milestones/{m1,m2,m3}/   # archived
```
### Source Code — M4a touch set
```text
src/renderer/layout/coordinate-adapter.ts  # ADD posToOverlayLocalRect + posToOverlayLocalY
src/renderer/bridge/comments-ui.ts         # localY() -> WC.PM.coords.posToOverlayLocalY; listen 'wc:paged-relayout'
src/renderer/bridge/track-chrome.ts        # localRect() -> WC.PM.coords.posToOverlayLocalRect; listen 'wc:paged-relayout'
src/renderer/bridge/index.ts               # onLayoutUpdated handler also dispatches window 'wc:paged-relayout'
scripts/paged-overlays-probe.js            # NEW — paged anchoring (comments/track) + overlay parity
package.json                               # add probe:overlays
```
**Structure Decision**: the per-annotation coordinate logic centralizes on `WC.PM.coords` (M1 philosophy);
the overlays become thin consumers. No fork edits.

## Phase 0 — Research
See [research.md](research.md): the full 6-overlay map, the two helpers' exact source formulas, the
mode-agnostic container insight, the relayout-trigger gap, and the M4b–M4d split.

## Phase 1 — Design & Contracts
- **Entities**: [data-model.md](data-model.md) — OverlayLocalRect/Y, the per-page visibility rule, the relayout event.
- **Contract**: [contracts/overlay-helpers.md](contracts/overlay-helpers.md) — the two helper signatures + the consumer swaps + the `wc:paged-relayout` event.
- **Validation**: [quickstart.md](quickstart.md).

## Verification (definition of done for M4a)
1. `npm run build` clean.
2. **3 gates** green (475 / 9 / 27) + `test:bundle` 4/4 (overlay unchanged).
3. **New overlay probe** (`WC_LAYOUT=paged`, multi-page doc w/ a comment + a tracked change):
   `posToOverlayLocalY`/`posToOverlayLocalRect` return finite page-relative coords for an anchor on a painted
   page and `null` for an off-page anchor; the rendered comment card top ≈ `posToOverlayLocalY(anchor)`; the
   rendered change bar top ≈ `posToOverlayLocalRect(anchor).top`; a `wc:paged-relayout` event repositions both.
4. **Overlay parity** (default build): `posToOverlayLocalY`/`Rect` equal the legacy `localY`/`localRect` for the
   same pos; comment/track chrome renders byte-identically to pre-M4a.
5. **`/code-review`** on the slice; fix all findings; re-verify.

COM-oracle: **N/A** (overlay-chrome positioning; no docx artifact).

## Complexity Tracking
*No constitution violations — empty.*
