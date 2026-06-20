# Quickstart — Validate Milestone 3 (status bar → real page count)

M3 makes "Page X of Y" correct + caret-tracking in paged mode (via `WC.PM.coords.getCurrentPage()`/
`getPageCount()` + an `onLayoutUpdated` refresh), overlay byte-identical.

## Prerequisites
- Branch `slice/m3-status-bar-pages` (off `layout-engine`); `npm run build` succeeds.

## 1. Regression gates (overlay default — MUST stay flat)
```bash
npm run build
npm run test:pm        # expect 475
npm run test:smoke     # expect 9
npm run test:roundtrip # expect 27
npm run test:bundle    # expect 4/4
```
Any deviation fails M3 (overlay break-scan moved verbatim; render unchanged).

## 2. Paged status-bar probe (the headline check)
```bash
WC_LAYOUT=paged npm run build
electron . --probe-out=/tmp/wc-statusbar.json --shot-evalfile=scripts/paged-statusbar-probe.js
```
Expect all rows PASS on a forced multi-page doc:
- `getPageCount()` === `presentation.getPages().length` (> 1) === the rendered "of Y";
- caret on page 0 → X = 1; caret on a later page → X = `computeCaretLayoutRect(pos).pageIndex + 1` (> 1) and the rendered X matches;
- a no-transaction relayout (zoom) leaves the rendered text consistent with the live counts (the `onLayoutUpdated` trigger).

## 3. Overlay parity
```bash
npm run build   # default (overlay)
electron . --probe-out=/tmp/wc-statusbar-ovl.json --shot-evalfile=scripts/paged-statusbar-probe.js
```
Expect overlay rows PASS: `getCurrentPage()` equals the legacy `__pagination.breaks` scan; `getPageCount()`
equals `__pagination.pageCount`; rendered "Page X of Y" byte-identical to pre-M3.

## 4. Manual smoke (optional)
Open a multi-page doc in paged mode; click on page 2/3 → the status bar reads "Page 2 of N" / "Page 3 of N".

## 5. Code review
`/code-review` on the slice diff; fix all findings; re-run 1–3.

## Done checklist
- [ ] Build clean.
- [ ] test:pm 475 / smoke 9 / roundtrip 27 / bundle 4.
- [ ] paged status-bar probe all-PASS (total + caret-tracking X + trigger).
- [ ] overlay parity PASS (render byte-identical).
- [ ] `/code-review` clean.
- [ ] Runbook Current Status updated; slice ff-merged into `layout-engine`.
