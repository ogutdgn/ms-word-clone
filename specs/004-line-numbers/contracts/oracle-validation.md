# Contract — Word-COM oracle validation (dev-box-only)

New `scripts/oracle/validate-linenumbers-win.ps1`, invoked via `com-validate.js`
`comValidate('validate-linenumbers-win.ps1', docxAbsPath)` — sandbox-disabled + PID-safe (kill only the
spawned WINWORD). Dev-box-only (Windows + Word 16); excluded from headless CI. Mirrors 002/003.

## Read-backs

| Field | Word COM | Phase |
|-------|----------|-------|
| Active | `Sections(1).PageSetup.LineNumbering.Active` | P1 |
| Restart mode | `.RestartMode` (wdRestartContinuous=0 / wdRestartPage=1 / wdRestartSection=2) | P1 |
| Count by | `.CountBy` | P3 (Options) |
| Starting number | `.StartingNumber` | P3 (Options) |
| Distance from text | `.DistanceFromText` (points) | P3 (Options) |
| Paragraph suppress | the target paragraph's `Range.ParagraphFormat` / `pPr` carries `w:suppressLineNumbers` (read back the paragraph that should be excluded) | P3 |

## Hardening

- **OpenAndRepair:=false** — open with the positional form so a malformed `.docx` ERRORS instead of being
  silently repaired. `openedWithoutRepair` mirrors `ok`.
- **Enum self-verification** — assert the `wdLineNumberRestartMode` ints in-run (0/1/2) before trusting them
  (`ok:false` if they don't hold). M6 lesson: PowerShell variable names are case-insensitive — keep distinct names.
- **PID-safety** — before/after WINWORD PID diff; `finally` Stop-Process only the spawned PID.

## Result shape

`ConvertTo-Json -Compress`: `{ ok, openedWithoutRepair, enumCheck, sectionCount, lineNumbersActive,
restartMode, countBy, startingNumber, distanceFromText, paragraphSuppressed? }` (fields per phase).
`ok:false` only on a producer error; the Node driver asserts equality of each authored value.

## Acceptance (per phase)

- **P1**: a doc set to a mode opens without repair; `LineNumbering.Active` true + the matching `RestartMode`;
  None ⇒ `.Active` false.
- **P3**: CountBy/StartingNumber/DistanceFromText read back equal; the suppressed paragraph carries
  `w:suppressLineNumbers`.

Wired into `test-roundtrip-paged.js` seeded by `paged-export-linenumbers-probe.js`, alongside the existing
read-backs.
