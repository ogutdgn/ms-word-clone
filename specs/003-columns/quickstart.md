# Quickstart — Columns (validation/run guide)

Prove the feature end-to-end in the **real paged renderer** + against **real Word**. (Detail in
[contracts/](contracts/) + [data-model.md](data-model.md).)

## Prerequisites

- Windows + Microsoft Word 16 (for the COM oracle; dev-box-only).
- `npm install` done. Probes run in an isolated Electron profile (`--user-data-dir=C:/tmp/wc-probe-profile`).

## Build

```bash
npm run build          # paged is the default engine
```

## Probe (real paged renderer — render + export)

```bash
npm run probe:columns  # electron … --shot-evalfile=scripts/paged-columns-probe.js → /tmp/wc-columns.json
```

Expected: `setColumns({count:2})` renders the body in 2 columns (lines at 2 distinct x-bands) and the export
carries `<w:cols w:num="2">`; `count:3` → 3 columns / `w:num="3"`; `count:1` → single column; (P3) a column
break moves following text to the next column + exports `w:type="column"`. `summary.fail === 0`.

## Word-COM oracle (dev-box-only, sandbox-disabled, PID-safe)

Run via the paged roundtrip gate (which seeds a columns `.docx`, opens it in real Word, and reads back
`PageSetup.TextColumns`):

```bash
npm run test:roundtrip:paged   # includes the columns read-back section
```

Expected (per phase): the doc opens **without repair**; `TextColumns.Count` == the authored count (P1);
spacing/evenlySpaced read back ≈ authored (P2); a column break is honored (P3). No leaked WINWORD.

## Core gates (must stay green)

```bash
WC_LAYOUT=overlay npm run build && npm run test:pm   # 475
npm run build && npm run test:smoke                  # 9
npm run test:roundtrip                               # 27
npm run test:bundle                                  # 4
```

## Success

All of: `probe:columns` green · the Word-COM `TextColumns` read-back == authored · the 4 core gates green
(SC-001…SC-005).
