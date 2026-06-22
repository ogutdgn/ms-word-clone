# Implementation Plan: Line Numbers

**Branch**: `feature/line-numbers-paged` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-line-numbers/spec.md`

## Summary

Wire Layout → Line Numbers onto the paged engine: the presets (None / Continuous / Restart Each Page /
Restart Each Section) write real `sectPr/w:lnNumType` via the public `sections.setLineNumbering`, validated
vs real Word (`PageSetup.LineNumbering`). Because the paged engine does NOT paint line numbers natively
(feasibility-probed: `setLineNumbering` exports `<w:lnNumType>` + reads back, but 0 line-number DOM), the
in-app render is an **owned overlay** drawing numbers in the left margin beside the painted `.superdoc-line`
elements (the comments/ink-overlay pattern). P3 adds the Line Numbering Options dialog (start/count-by/
distance) + per-paragraph `w:suppressLineNumbers`.

## Technical Context

**Language/Version**: TypeScript bridge (`src/renderer/bridge/*.ts`) + vanilla JS chrome
(`src/renderer/public/js/*.js`, `window.WC`); Electron 31; electron-vite.

**Primary Dependencies**: the fork's public Document API `editor.doc.sections.setLineNumbering({enabled,
countBy, start, distance, restart, target})` / `sections.get` (read-back); the paged PresentationEditor's
painted `.superdoc-page .superdoc-line` DOM (the overlay's render target); the `WC.PM` bridge.

**Storage**: OOXML `.docx` — line numbering = `sectPr/w:lnNumType`; per-paragraph suppress =
`pPr/w:suppressLineNumbers`. The model stays page-free.

**Testing**: the real-paged-renderer probe (`scripts/paged-linenumbers-probe.js`) + the dev-box-only
Word-COM oracle (`scripts/oracle/validate-linenumbers-win.ps1` via `com-validate.js`, sandbox-disabled,
PID-safe). The 4 core gates stay green.

**Target Platform**: Windows (Word-for-Windows 16.0 COM oracle).

**Project Type**: desktop app — owned-layers wiring + an owned render overlay over the vendored engine.

**Constraints**: NO fork edits; `WC.PM` bridge is the only doc-write path; model stays page-free; every
fidelity claim read back from real Word.

**Scale/Scope**: single (primary) section; 3 incremental slices (P1 model/export/ribbon, P2 overlay render,
P3 options + per-paragraph suppress).

## Constitution Check

*GATE: pass before Phase 0; re-check after Phase 1.* (No formal constitution file; the repo rules are binding.)

- **No fork edits** — PASS: P1 is the public `sections.setLineNumbering` seam; P2 is an owned overlay
  (DOM-only, like comments-ui/ink); P3's per-paragraph suppress uses a paragraph-attr write through the
  bridge (verify a no-fork path at the P3 spike; minimal documented accessor only as a last resort).
- **`WC.PM` bridge is the only doc-write path** — PASS: a new `WC.PM.setLineNumbers`/`getLineNumbers`
  (+ `suppressLineNumbers` for P3) wraps the fork API; the overlay only READS the DOM/model + paints.
- **Model stays page-free** — PASS: `w:lnNumType` is a `sectPr` prop; suppress is a `pPr` flag.
- **Regression test + Word-COM validation** — PASS: the paged probe + the new COM oracle.
- **Don't hand-edit generated files** — PASS: the Line Numbers dropdown is already in `ribbon-data.js`
  (from `raw-research.json`); only the handler + bridge + overlay change.

→ **GATE PASS**.

## Project Structure

```text
specs/004-line-numbers/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/{bridge-verbs,oracle-validation}.md
└── tasks.md   (/speckit-tasks)

src/renderer/bridge/
├── line-numbers.ts   # NEW: setLineNumbers({mode,countBy?,start?,distance?}) / getLineNumbers() /
│                     #   suppressLineNumbers(on) over editor.doc.sections.setLineNumbering (+ a pPr write)
└── index.ts          # merge onto WC.PM (+ no-op stubs) + un-defer lineNumbers in ENGINE_READY

src/renderer/public/js/
├── line-numbers-overlay.js  # NEW owned overlay (P2): numbers beside each painted .superdoc-line, counting
│                            #   per mode/countBy/start/restart; listens to wc:paged-relayout (comments/ink pattern)
├── commands.js              # rewire H.lineNumbers OFF the retired E() -> WC.PM verbs; the Options dialog (P3)
└── index.html               # register the overlay <script> (P2)

scripts/
├── paged-linenumbers-probe.js          # NEW real-renderer probe (export w:lnNumType + overlay numbers)
├── paged-export-linenumbers-probe.js   # NEW export probe -> a .docx for the COM oracle
├── oracle/validate-linenumbers-win.ps1 # NEW Word-COM read-back: PageSetup.LineNumbering Active/RestartMode/CountBy/Start/Distance
└── test-roundtrip-paged.js             # wire the line-numbers doc + read-back (dev-box-only)
```

**Structure Decision**: single project, owned-layers + one owned render overlay. New `bridge/line-numbers.ts`
(mirrors `bridge/columns.ts`); `commands.js` rewire; un-defer in `bridge/index.ts`; new
`line-numbers-overlay.js` (mirrors the comments/ink overlay). New probe + `validate-linenumbers-win.ps1`
(the 002/003 oracle pattern). No fork edits.

## Complexity Tracking

> Filled because two sub-capabilities carry risk.

| Risk | Why | Resolution |
|------|-----|------------|
| **In-app overlay render (P2)** — the engine paints no line numbers; an owned overlay must count painted `.superdoc-line` rows per page + position numbers in the left margin, surviving zoom/scroll/relayout | Visible parity (FR-005) | The comments/ink overlays prove the pattern (read `.superdoc-page`/`.superdoc-line` rects + a `wc:paged-relayout` listener). Restart-per-page = reset the counter per `.superdoc-page`; count-by = show every Nth. No fork edit. |
| **Per-paragraph `w:suppressLineNumbers` (P3)** | "Suppress for Current Paragraph" (FR-007) | Spike: a no-fork paragraph-attr write (a fork command / `editor.doc` paragraph API / an owned `pPr` write like the columns `bodySectPr` write). If unreachable no-fork → record + honest toast. |

A minimal documented fork accessor is the last resort for P3's suppress only; P1 (model/export) + P2
(overlay) are no-fork.
