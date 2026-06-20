# Quickstart — Validate Milestone 4b (image-resize overlay retarget)

M4b retargets the image resize-handle overlay to the painted image in paged mode via `WC.PM.coords.nodeBoxFor`
+ `overlayScale`, overlay byte-identical.

## Prerequisites
- Branch `slice/m4b-image-resize` (off `layout-engine`); `npm run build` succeeds.

## 1. Regression gates (overlay default — MUST stay flat)
```bash
npm run build
npm run test:pm        # expect 475
npm run test:smoke     # expect 9
npm run test:roundtrip # expect 27
npm run test:bundle    # expect 4/4
```

## 2. Paged image-resize probe (the headline check)
```bash
WC_LAYOUT=paged npm run build
electron . --probe-out=/tmp/wc-imageresize.json --shot-evalfile=scripts/paged-image-resize-probe.js
```
Expect PASS: an inserted+selected image → `nodeBoxFor(imagePos)` finite; the rendered `.wc-img-resize` box ≈
`nodeBoxFor(imagePos)`; painted-aware (≠ the hidden `view.nodeDOM` box); `overlayScale()` finite.

## 3. Overlay parity
```bash
npm run build   # default (overlay)
electron . --probe-out=/tmp/wc-imageresize-ovl.json --shot-evalfile=scripts/paged-image-resize-probe.js
```
Expect overlay rows PASS: `nodeBoxFor` === the legacy `boxFor` formula; `overlayScale()` === `WC.PM.zoom`; the
image overlay byte-identical to pre-M4b.

## 4. Manual drag spot-check (real app — automation can't drive a live drag)
Open a doc with an image in paged mode (`WC_LAYOUT=paged npm run build && npx electron .`), select the image,
and drag a corner handle → the image resizes following the cursor. (computer-use is blocked for the dev build.)

## 5. Code review
`/code-review` on the slice diff; fix all findings; re-run 1–3.

## Done checklist
- [ ] Build clean.
- [ ] test:pm 475 / smoke 9 / roundtrip 27 / bundle 4.
- [ ] paged image-resize probe all-PASS (handle box ≈ nodeBoxFor; painted-aware).
- [ ] overlay parity PASS (nodeBoxFor === legacy boxFor; byte-identical).
- [ ] manual drag spot-check OK (or noted).
- [ ] `/code-review` clean.
- [ ] Runbook Current Status updated; slice ff-merged into `layout-engine`.
