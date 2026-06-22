# Implementation Plan: Hyphenation

**Branch**: `005-hyphenation` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-hyphenation/spec.md`

## Summary

Wire Layout → Hyphenation onto the document via the `WC.PM` bridge: None / Automatic set the document-level
`settings.xml` flag `w:autoHyphenation`; a Hyphenation Options dialog sets `w:hyphenationZone` /
`w:consecutiveHyphenLimit` / `w:doNotHyphenateCaps`; Manual applies best-effort optional-hyphen insertion. All
validated vs real Word (`ActiveDocument.AutoHyphenation` / `HyphenationZone` / `ConsecutiveHyphensLimit` /
`HyphenateCaps`). Because the fork has **no** hyphenation translator (`autoHyphenation` is unreferenced in
`src/renderer/core/superdoc-fork`), the no-fork write mirrors 003 columns' owned `bodySectPr` write: an owned
bridge upsert into the converter's settings XML (`editor.converter.convertedXml['word/settings.xml']`),
serialized on export — confirmed by a probe-first spike.

## Technical Context

**Language/Version**: TypeScript bridge (`src/renderer/bridge/*.ts`) + vanilla JS chrome
(`src/renderer/public/js/*.js`, `window.WC`); Electron 31; electron-vite.

**Primary Dependencies**: the fork's converter settings part (`editor.converter.convertedXml['word/settings.xml']`,
the same tree `document-api-adapters/document-settings.ts` reads/writes via `w:settings`-root upserts); the
`WC.PM` bridge; the Layout ribbon plumbing.

**Storage**: OOXML `.docx` — hyphenation = document-level `settings.xml` (`w:autoHyphenation`,
`w:hyphenationZone` [twips], `w:consecutiveHyphenLimit`, `w:doNotHyphenateCaps`). Manual = optional hyphens in
run text. The model stays page-free (these are document settings, not page nodes).

**Testing**: the real-renderer probe (`scripts/paged-hyphenation-probe.js`) + the dev-box-only Word-COM oracle
(`scripts/oracle/validate-hyphenation-win.ps1` via `com-validate.js`, sandbox-disabled, PID-safe). The 4 core
gates stay green.

**Target Platform**: Windows (Word-for-Windows 16.0 COM oracle).

**Project Type**: desktop app — owned-layers wiring (no new render overlay; hyphenation needs no margin paint).

**Constraints**: NO fork edits; `WC.PM` bridge is the only doc-write path; model stays page-free; every fidelity
claim read back from real Word.

**Scale/Scope**: single document (document-level settings); 3 incremental slices (P1 None/Automatic + export +
ribbon + oracle, P2 the Options dialog, P3 Manual best-effort).

## Constitution Check

*GATE: pass before Phase 0; re-check after Phase 1.* Checked against `.specify/memory/constitution.md` v1.0.0.

- **I. No Fork Edits** — PASS (planned): the settings write is an OWNED bridge upsert into the converter's
  settings XML (the 003 `bodySectPr` precedent); the SPIKE confirms the seam (`convertedXml['word/settings.xml']`
  reachable + export-serialized) before any production code. A documented fork accessor is a last resort only if
  the spike fails, recorded in Complexity Tracking.
- **II. The WC.PM Bridge Is the Only Write Path** — PASS: new `WC.PM.setHyphenation`/`getHyphenation`
  (+ `applyManualHyphenation` for P3) wrap the owned write; nothing else writes the document.
- **III. Page-Free Model** — PASS: `settings.xml` flags are document-level; no page nodes.
- **IV. Real-Word Fidelity, Oracle-Validated** — PASS: a new `validate-hyphenation-win.ps1` reads
  `ActiveDocument.AutoHyphenation`/`HyphenationZone`/`ConsecutiveHyphensLimit`/`HyphenateCaps`, PID-safe,
  `OpenAndRepair:=false`, wired into `test:roundtrip:paged`.
- **V. Test-Gated** — PASS: the paged probe + the 4 gates + the COM oracle.
- **VI. Spec-Kit-Driven** — PASS: this feature; P1/P2/P3 slices, each verify → review → ff-merge into general-done.
- **VII. Generated Files** — PASS: the Hyphenation dropdown is already in `ribbon-data.js`; only the handler +
  bridge change.

→ **GATE PASS** (pending the spike's confirmation of the owned settings-write seam).

## Project Structure

```text
specs/005-hyphenation/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/{bridge-verbs,oracle-validation}.md
└── tasks.md   (/speckit-tasks)

src/renderer/bridge/
├── hyphenation.ts   # NEW: setHyphenation({mode,zone?,consecutiveLimit?,hyphenateCaps?}) / getHyphenation() /
│                    #   applyManualHyphenation() — owned upsert into convertedXml['word/settings.xml']
└── index.ts         # merge onto WC.PM (+ no-op stubs) + un-defer `hyphenation` in ENGINE_READY; repoint D6 guards

src/renderer/public/js/
└── commands.js      # rewire H.hyphenation OFF the retired WC.Layout/E() → WC.PM verbs; the Options dialog (P2)

scripts/
├── paged-hyphenation-probe.js          # NEW real-renderer probe (export settings flags + round-trip)
├── paged-export-hyphenation-probe.js   # NEW export probe → a .docx for the COM oracle
├── oracle/validate-hyphenation-win.ps1 # NEW Word-COM read-back: AutoHyphenation/HyphenationZone/...
└── test-roundtrip-paged.js             # wire the hyphenation doc + read-back (dev-box-only) — C7 block
```

**Structure Decision**: single project, owned-layers wiring (no render overlay). New `bridge/hyphenation.ts`
(mirrors `bridge/columns.ts`'s owned `bodySectPr` write, but on the settings part); `commands.js` rewire;
un-defer in `bridge/index.ts`; new probe + `validate-hyphenation-win.ps1` (the 002/003/004 oracle pattern).
No fork edits.

## Complexity Tracking

> Filled because the no-fork settings-write seam carries the feature's only real risk.

| Risk | Why | Resolution |
|------|-----|------------|
| **No-fork `settings.xml` write (P1)** — the fork has no `w:autoHyphenation` translator, so setting it must go through an owned write to the converter's settings part and survive export + re-import | Principle I + FR-003/FR-004 | **SPIKE first** (T003): confirm `editor.converter.convertedXml['word/settings.xml']` is reachable from the bridge, an owned upsert of `w:autoHyphenation` survives `exportDocx`, and a re-import reads it back. Mirrors 003's `bodySectPr` owned write + `document-settings.ts`'s upsert shape. If unreachable no-fork → record + a minimal documented accessor (last resort, Constitution Check exception). |
| **Manual hyphenation (P3)** | FR-006 | Best-effort: insert optional hyphens (U+00AD) into long words via the `WC.PM` bridge so they survive export; honest toast; full interactive walkthrough out of v1. Spike the no-fork optional-hyphen write; record the gap if unreachable. |

A minimal documented fork accessor is the last resort for the settings write only; everything else is no-fork.
