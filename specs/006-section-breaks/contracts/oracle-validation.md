# Contract — Word-COM oracle validation (dev-box-only)

New `scripts/oracle/validate-sectionbreaks-win.ps1`, invoked via `com-validate.js`
`comValidate('validate-sectionbreaks-win.ps1', docxAbsPath)` — sandbox-disabled + PID-safe (kill only the spawned
WINWORD). Dev-box-only (Windows + Word 16); excluded from headless CI. Mirrors 002–005.

## Read-backs

| Field | Word COM | Phase |
|-------|----------|-------|
| Section count | `ActiveDocument.Sections.Count` | P1 |
| Section start (per section) | `Sections(i).PageSetup.SectionStart` (WdSectionStart: continuous 0 / newColumn 1 / newPage 2 / evenPage 3 / oddPage 4) | P1 (newPage) + P2 (the others) |

## Hardening

- **OpenAndRepair:=false** — open positionally so a malformed `.docx` ERRORS instead of repairing;
  `openedWithoutRepair` mirrors `ok`.
- **Enum self-verification** — assert the `WdSectionStart` ints in-run (0–4) before trusting them.
- **PID-safety** — before/after WINWORD PID diff; `finally` Stop-Process only the spawned PID.

## Result shape

`ConvertTo-Json -Compress`: `{ ok, openedWithoutRepair, enumCheck, sectionCount, sectionStarts:[…] }`.
`ok:false` only on a producer error; the Node driver asserts the count + the per-type `SectionStart`.

## Acceptance (per phase)

- **P1**: a Next-Page break doc opens without repair; `Sections.Count == 2`; `Sections(1).SectionStart == 2` (newPage).
- **P2**: Continuous → `SectionStart == 0`; Even Page → `3`; Odd Page → `4`.

Wired into `test-roundtrip-paged.js` (C8) seeded by `paged-export-sectionbreaks-probe.js`.
