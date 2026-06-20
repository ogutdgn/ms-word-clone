# Quickstart — Validate Milestone 4c (ink-overlay retarget)

M4c retargets the freehand ink overlay to the painted pages in paged mode via
`WC.PM.coords.clientToOverlayLocalPt`, keeping overlay mode byte-identical (mode-branch).

## Prerequisites
- Branch `slice/m4c-ink` (off `layout-engine`); `npm run build` succeeds.

## 1. Regression gates (overlay default — MUST stay flat)
```bash
npm run build
npm run test:pm        # expect 475
npm run test:smoke     # expect 9
npm run test:roundtrip # expect 27
npm run test:bundle    # expect 4/4
```

## 2. Paged ink probe (the headline checks)
```bash
WC_LAYOUT=paged npm run build
electron . --probe-out=/tmp/wc-ink.json --shot-evalfile=scripts/paged-ink-probe.js
```
Expect PASS (paged):
- **render-on-page**: `dInsertInk` a stroke at the caret → exactly ONE `.pm-ink-stroke` renders; its `getBBox` lands
  inside the target `.superdoc-page[data-page-index]`'s `#pages`-local box (NOT at the `#pm-editor`-offset origin).
- **page-2 placement**: multi-page fixture, caret on page 2 → the stroke's bbox falls inside page 2's painted box.
- **clientToOverlayLocalPt round-trip**: a viewport point over a painted page → correct `pageIndex` + `#pages`-local
  coords that invert `posToOverlayLocalRect` for a known pos on that page.
- **tools**: synthetic eraser pointerdown on a rendered stroke → its `vectorShape` node is deleted (`data-ink-pos`);
  select adds `.sel`; a lasso loop selects the enclosed stroke(s).
- **reopened-ink no-double-draw**: export→openDocx an ink stroke → it renders exactly once at the right page (PE OR
  overlay, not both).
- **probe-first checks** (surface as explicit rows): `getElementAtPos(inkPos)` resolves the stroke's
  `.superdoc-page`; PE's invisible fallback box does not intercept the overlay's pointer events.

## 3. Overlay parity
```bash
npm run build   # default (overlay)
electron . --probe-out=/tmp/wc-ink-ovl.json --shot-evalfile=scripts/paged-ink-probe.js
```
Expect overlay rows PASS: `.pm-ink-stroke` `d`-strings + `svg.wc-ink-layer` geometry byte-identical to pre-M4c for
the same inputs (the mount stays on the `#pm-editor`-offset origin; `localPt` unchanged).

## 4. Manual draw spot-check (real app — automation can't drive a live draw)
`WC_LAYOUT=paged npm run build && npx electron .` → Draw tab → pick the pen → draw on page 1 and page 2; the stroke
should follow the cursor and land on the page drawn on; eraser/select/lasso should hit the right strokes.
(computer-use is blocked for the dev build → this is a human spot-check, not a gate.)

## 5. Code review
`/code-review` on the slice diff; fix all findings; re-run 1–3.

## Done checklist
- [ ] Build clean.
- [ ] test:pm 475 / smoke 9 / roundtrip 27 / bundle 4.
- [ ] paged ink probe all-PASS (render-on-page, page-2, round-trip, tools, reopened no-double-draw + probe-first rows).
- [ ] overlay parity PASS (byte-identical).
- [ ] manual draw spot-check OK (or noted).
- [ ] `/code-review` clean.
- [ ] Runbook Current Status updated; slice ff-merged into `layout-engine`.
