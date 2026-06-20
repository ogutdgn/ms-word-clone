# Quickstart — Validate Milestone 4a (overlay helpers + comments + track-chrome)

M4a retargets the comment + tracked-change overlays to the painted pages in paged mode via two new
`WC.PM.coords` helpers, overlay byte-identical.

## Prerequisites
- Branch `slice/m4a-overlay-helpers-comments-track` (off `layout-engine`); `npm run build` succeeds.

## 1. Regression gates (overlay default — MUST stay flat)
```bash
npm run build
npm run test:pm        # expect 475
npm run test:smoke     # expect 9
npm run test:roundtrip # expect 27
npm run test:bundle    # expect 4/4
```
Any deviation fails M4a (helpers replicate localY/localRect verbatim; overlays delegate to them).

## 2. Paged overlay probe (the headline check)
```bash
WC_LAYOUT=paged npm run build
electron . --probe-out=/tmp/wc-overlays.json --shot-evalfile=scripts/paged-overlays-probe.js
```
Expect PASS on a multi-page doc with a comment + a tracked change:
- `posToOverlayLocalY`/`posToOverlayLocalRect` finite + page-relative for an anchor on a painted page; `null` off-page;
- rendered comment card top ≈ `posToOverlayLocalY(anchor)`; change bar top ≈ `posToOverlayLocalRect(anchor).top`;
- a `wc:paged-relayout` event repositions both overlays.

## 3. Overlay parity
```bash
npm run build   # default (overlay)
electron . --probe-out=/tmp/wc-overlays-ovl.json --shot-evalfile=scripts/paged-overlays-probe.js
```
Expect overlay rows PASS: `posToOverlayLocalY`/`Rect` equal the legacy `localY`/`localRect` for the same pos;
comment/track chrome positions byte-identical to pre-M4a.

## 4. Manual smoke (optional)
Open a multi-page doc in paged mode; add a comment on page 2 and a tracked change → the comment card and the
change bar appear next to their text on page 2 (not mis-stacked at the top).

## 5. Code review
`/code-review` on the slice diff; fix all findings; re-run 1–3.

## Done checklist
- [ ] Build clean.
- [ ] test:pm 475 / smoke 9 / roundtrip 27 / bundle 4.
- [ ] paged overlay probe all-PASS (anchoring + relayout).
- [ ] overlay parity PASS (chrome byte-identical).
- [ ] `/code-review` clean.
- [ ] Runbook Current Status updated; slice ff-merged into `layout-engine`.
