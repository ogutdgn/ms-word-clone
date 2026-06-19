# Quickstart — Validate Milestone 1 (coordinate adapter + dynamic-import)

M1 is **pure infra**: no user-visible behavior changes. Validation = the 3 gates stay flat, a new probe
exercises the adapter in paged mode, and a bundle check proves the paged path is code-split out of the
default build.

## Prerequisites
- On branch `slice/m1-coordinate-adapter` (off `layout-engine`).
- `npm install` done; `npm run build` succeeds.

## 1. Regression gates (overlay default — MUST stay flat)
```bash
npm run build
npm run test:pm         # expect 268
npm run test:smoke      # expect 9
npm run test:roundtrip  # expect 27
```
Any deviation from **268 / 9 / 27** fails M1 (overlay default must be byte-identical).

## 2. Paged-mode adapter probe (the headline check)
```bash
WC_LAYOUT=paged npm run build
electron . --probe-out=/tmp/wc-m1-coords.json --shot-evalfile=scripts/paged-coords-probe.js
```
Expect all probe rows PASS:
- `WC.PM.coords` present with `clientToPos` / `posToClientRect` / `getPageCount` / `getPages`.
- `getPageCount()` equals `presentation.getPages().length`.
- client→pos→client round-trips within tolerance on a painted page.
- overlay-parity row: adapter results equal direct `view.*` for the same inputs.

## 3. Bundle-size gate (proves dynamic-import worked)
```bash
npm run build            # DEFAULT (overlay) build — no WC_LAYOUT
npm run test:bundle      # scripts/check-overlay-bundle.js
```
Asserts: the `PresentationEditor` subgraph is in a **separate lazy chunk** (not the eager entry graph),
and the eager overlay renderer JS total is back near the **~8.5 MB** baseline (well under the ~10.9 MB
static-import regression). Threshold is pinned in `check-overlay-bundle.js`.

## 4. COM oracle
N/A for M1 — no `.docx` export or page-geometry behavior changes. Record as N/A in the runbook status.

## 5. Code review
Run `/code-review` on the slice diff; fix **all** findings; re-run steps 1–3 before declaring done.

## Done checklist
- [ ] Build clean.
- [ ] test:pm 268 / test:smoke 9 / test:roundtrip 27.
- [ ] paged-coords probe all-PASS.
- [ ] test:bundle PASS (PE code-split; overlay near 8.5 MB).
- [ ] `/code-review` clean (or all findings fixed + re-verified).
- [ ] Runbook **Current Status** updated; slice ff-merged into `layout-engine`.
