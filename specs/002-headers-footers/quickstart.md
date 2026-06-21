# Quickstart — validate Headers & Footers in paged

**Dev-box only** for the COM oracle (Windows + Word 16, sandbox-disabled, PID-safe). The PE side needs the
**real Electron renderer** (never headless — the headless canvas is a measurement stub). Probe profile is
isolated: `--user-data-dir=C:/tmp/wc-probe-profile --disable-http-cache`.

## Prerequisites

- On `feature/headers-footers-paged` (off `main`).
- `npm run build` clean (paged is the default). The 4 core gates green: `test:pm` 475 / `test:smoke` 9 /
  `test:roundtrip` 27 / `test:bundle` 4.

## 0. Spike (run FIRST, before production code)

```bash
WC_LAYOUT=paged npm run build   # (paged is default; explicit for clarity)
# Q1 import→render, Q2 on-page activation, Q3 bridge↔paint — throwaway probes, real renderer:
npx electron --user-data-dir=C:/tmp/wc-probe-profile --disable-http-cache . \
  --probe-out=/tmp/wc-hf-spike.json --shot-evalfile=scripts/hf-spike-probe.js
```

Expected: the spike resolves the entry mechanism (existing accessor / synthetic-pointer / minimal fork accessor)
and confirms import→render + bridge↔paint consistency. Records the decision into `research.md` "OPEN" section.

## 1. In-app paged probe (per phase)

```bash
npm run probe:headerfooter   # scripts/paged-headerfooter-probe.js — extended per phase
```

- **P1**: enter header → type → Go to Footer → type → Close; assert the contextual tab shows/hides, the bands
  paint the text per page, focus returns to the body, and the plain-text path still works. Overlay parity where
  applicable.
- **P2**: toggle Different First Page / Odd & Even; author distinct variant content; assert the painted first/even
  bands + the exported `sectPr titlePg` / `evenAndOddHeaders` + variant parts.
- **P3**: insert a page number; assert each page paints its own number and the exported `PAGE` field.

## 2. Word-COM oracle (dev-box-only, sandbox-disabled)

```bash
npm run test:roundtrip:paged   # includes the extended validate-headerfooter-win.ps1 read-backs
```

Asserts, via real Word: opens without repair; primary header/footer text; (P2) DifferentFirstPage +
OddAndEvenPages flags + first/even variant text; (P3) a live `wdFieldPage` page-number field. `enumCheck:true`,
`openedWithoutRepair:true`, PID-safe (user's Word untouched).

## 3. Gates (must stay green every phase)

```bash
npm run build && npm run test:pm        # 475
npm run build && npm run test:smoke     # 9
npm run build && npm run test:roundtrip # 27
npm run test:bundle                     # 4
```

## Expected outcome (definition of done, per phase)

- All 4 core gates green; the extended paged HF probe green; the COM oracle reads back every authored
  header/footer value equal in real Word with no repair.
- No regression to the existing Insert → Header/Footer plain-text path.
- `/code-review` (xhigh) clean on the slice.
