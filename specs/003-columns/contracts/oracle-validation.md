# Contract — Word-COM oracle validation (dev-box-only)

New `scripts/oracle/validate-columns-win.ps1`, invoked via `scripts/oracle/com-validate.js`
`comValidate('validate-columns-win.ps1', docxAbsPath)` — **sandbox-disabled + PID-safe** (kill only the
spawned WINWORD). Dev-box-only (Windows + Word 16); excluded from headless CI. Mirrors
`validate-headerfooter-win.ps1` (002).

## Read-backs

| Field | Word COM | Phase |
|-------|----------|-------|
| Column count | `Sections(1).PageSetup.TextColumns.Count` | P1 |
| Evenly spaced | `Sections(1).PageSetup.TextColumns.EvenlySpaced` | P1/P2 |
| Spacing | `Sections(1).PageSetup.TextColumns.Spacing` (points) | P2 |
| Line between | `Sections(1).PageSetup.TextColumns.LineBetween` | P2 (if no-fork-reachable) |
| Per-column width | `Sections(1).PageSetup.TextColumns.Item(n).Width` | P2 (unequal; if reachable) |
| Column break present | the body `Range` contains a `w:type="column"` break (a break char / `Range.Text` boundary at the column break) | P3 |

## Hardening

- **OpenAndRepair:=false** — open with the `validate-open-win.ps1` positional form so a malformed `.docx`
  ERRORS (`ok:false`) instead of being silently repaired. `openedWithoutRepair` mirrors `ok`.
- **PID-safety** — before/after WINWORD PID diff; `finally` Stop-Process only the spawned PID.
- Heed the M6 lesson: PowerShell variable names are case-insensitive — keep names distinct from constants.

## Result shape

`ConvertTo-Json -Compress` one line: `{ ok, openedWithoutRepair, sectionCount, columnCount, evenlySpaced,
spacing, lineBetween?, columnWidths?[] }` (fields present per phase). `ok:false` only on a producer error
(open-repair, COM failure) — the Node driver asserts equality of each authored value.

## Acceptance (per phase)

- **P1**: a doc set to N columns opens without repair; `TextColumns.Count == N` reads back equal.
- **P2**: spacing reads back ≈ authored; evenlySpaced reflects equal/unequal; line-between + unequal widths
  read back IF the spike proved them no-fork-reachable (else recorded as a bounded gap).
- **P3**: a column break renders in Word (text in the next column) + the export carries `w:type="column"`.

Wired into `test-roundtrip-paged.js` seeded by an extended/`paged-export-columns-probe.js`, alongside the
existing read-backs.
