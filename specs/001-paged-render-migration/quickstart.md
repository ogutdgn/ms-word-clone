# M6 Quickstart — run the glyph-geometry divergence report

**Dev-box only** (Windows + Word 16). The PE side needs the **real Electron renderer**; the Word side needs **real
foreground-capable Word COM** run **sandbox-disabled** + **PID-safe**. See [plan.md](plan.md) / [contract](contracts/m6-glyph-tolerance.md).

## Prerequisites
- On `slice/m6-glyph-tolerance` (off `layout-engine`).
- `npm run build` clean (no `src` change in M6, so the 5 gates stay green: pm 475 / smoke 9 / roundtrip 27 / bundle 4 / roundtrip:paged 19).
- Office fonts installed (the fixture generator enumerates them).

## 1. Generate the fixtures (the app's own paged export)
```bash
# builds paged + drives the app to author one .docx per installed Office font (byte-identical text) + a justified
# variant + a ~2.5-page multi-page doc → C:/tmp/wc-m6-*.docx
WC_LAYOUT=paged npm run build
electron --user-data-dir=C:/tmp/wc-probe-profile --disable-http-cache . \
  --probe-out=/tmp/wc-m6-fixtures.json --shot-evalfile=scripts/paged-glyphgeom-fixtures.js
```

## 2. Run the report (sandbox-disabled — Word COM)
```bash
npm run report:glyphgeom      # node scripts/paged-glyphgeom-validate.js
```
This, per fixture: runs the **PE probe** (real renderer → per-line px geometry) + the **Word ps1**
(`validate-glyphgeom-win.ps1` → per-char point geometry, **self-verifying its `Information()` enum ints first**), aligns
by character offset, converts px→pt, and emits the **per-font, per-metric divergence distribution**.

> Must be invoked via the dangerously-disable-sandbox path for the powershell COM spawns (Word COM hangs at
> `New-Object` inside a sandbox). PID-safe: only the spawned WINWORD is killed.

## 3. Read the result + set the tolerance
The report JSON's `perFontSummary[]` is the tolerance-setting artifact. Fill the blank right-hand column of the
[contract](contracts/m6-glyph-tolerance.md) tolerance table from the measured p95 (per metric, per font). That number
**is** the M6 deliverable; a future milestone turns it into a gate.

## Expected outcome
- `ok:true`, `enumVerified:true`, `pidSafe:true`.
- A per-font breakdown showing page count (exact), lines-per-page (exact or ±1), wrap-point agreement, and the p95 of
  per-line Y and per-char X deltas. Justified + the worst font characterize the ceiling; the tolerance is set above the
  15-twip/1px floor.
- The 5 existing gates unchanged (M6 added no `src`).
