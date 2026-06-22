# Quickstart — Line Numbers (validation/run guide)

Prove the feature end-to-end in the **real paged renderer** + against **real Word**. (Detail in
[contracts/](contracts/) + [data-model.md](data-model.md).)

## Prerequisites

- Windows + Microsoft Word 16 (COM oracle; dev-box-only). `npm install` done. Probes run in an isolated
  Electron profile (`--user-data-dir=C:/tmp/wc-probe-profile`).

## Build

```bash
npm run build          # paged is the default engine
```

## Probe (real paged renderer — export + overlay)

```bash
npm run probe:linenumbers   # electron … --shot-evalfile=scripts/paged-linenumbers-probe.js → /tmp/wc-ln.json
```

Expected: `setLineNumbers({mode:'continuous'})` exports `<w:lnNumType w:countBy="1" w:restart="continuous"/>`
and (P2) the overlay shows numbers beside the painted lines; `mode:'newPage'` ⇒ `w:restart="newPage"` + the
margin restarts at 1 on page 2; `mode:'none'` ⇒ no `w:lnNumType` + no overlay numbers; `getLineNumbers()`
round-trips. `summary.fail === 0`.

## Word-COM oracle (dev-box-only, sandbox-disabled, PID-safe)

```bash
npm run test:roundtrip:paged   # seeds a line-numbers .docx, opens it in real Word, reads PageSetup.LineNumbering
```

Expected: opens **without repair**; `LineNumbering.Active` true + the matching `RestartMode` (P1); CountBy /
StartingNumber / DistanceFromText read back ≈ authored (P3); the suppressed paragraph carries
`w:suppressLineNumbers`. No leaked WINWORD.

## Core gates (must stay green)

```bash
WC_LAYOUT=overlay npm run build && npm run test:pm   # 475
npm run build && npm run test:smoke                  # 9
npm run test:roundtrip                               # 27
npm run test:bundle                                  # 4
```

## Success

`probe:linenumbers` green · the Word-COM `LineNumbering` read-back == authored · the 4 core gates green
(SC-001…SC-005).
