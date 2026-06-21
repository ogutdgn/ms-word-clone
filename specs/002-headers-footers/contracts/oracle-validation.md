# Contract — Word-COM oracle validation (dev-box-only)

Extends `scripts/oracle/validate-headerfooter-win.ps1`, invoked via `scripts/oracle/com-validate.js`
`comValidate('validate-headerfooter-win.ps1', docxAbsPath)` — **sandbox-disabled + PID-safe** (kill only the
spawned WINWORD, never the user's window). Dev-box-only (Windows + Word 16); excluded from headless CI.

## Read-backs (extend the current primary-text-only validator)

| Field | Word COM | Phase |
|-------|----------|-------|
| Primary header/footer text | `Sections(1).Headers(1)/Footers(1).Range.Text` (CR-trimmed) | existing |
| Different First Page flag | `Sections(1).PageSetup.DifferentFirstPageHeaderFooter` | P2 |
| Different Odd & Even flag | `Sections(1).PageSetup.OddAndEvenPagesHeaderFooter` | P2 |
| First-page header/footer text | `Sections(1).Headers(2)/Footers(2).Range.Text` (`wdHeaderFooterFirstPage`) | P2 |
| Even-page header/footer text | `Sections(1).Headers(3)/Footers(3).Range.Text` (`wdHeaderFooterEvenPages`) | P2 |
| Page-number field present + live | the header/footer `Range.Fields` contains a `wdFieldPage` (type 33), result text is a number | P3 |

## Hardening

- **OpenAndRepair:=false** — open with the `validate-open-win.ps1:32` positional form
  (`[Reflection.Missing]::Value` padding, arg 13 `$false`) so a malformed `.docx` ERRORS (`ok:false`) instead of
  being silently repaired before read-back.
- **Enum self-verification** — assert the `wdHeaderFooter*` ints in-run (Primary=1, FirstPage=2, EvenPages=3) and
  `wdFieldPage=33` before trusting them; `ok:false` if they don't hold. Heed the M6 lesson: PowerShell variable
  names are **case-insensitive** — do not reuse a name that collides with a pinned constant.
- **PID-safety** — before/after WINWORD PID diff; `finally` Stop-Process only the spawned PID.

## Result shape

`ConvertTo-Json -Compress` one line: `{ ok, enumCheck, openedWithoutRepair, sectionCount, primaryHeader,
primaryFooter, differentFirstPage, differentOddEven, firstHeader, evenHeader, pageNumberField }` (fields present
per phase). `ok:false` only on a producer error (open-repair, enum mismatch, COM failure) — the Node driver
asserts equality of each authored value.

## Acceptance (per phase)

- **P1**: a doc authored on-page (enter → type → close) opens without repair; primary header/footer text reads
  back equal.
- **P2**: `differentFirstPage`/`differentOddEven` flags + the first/even variant text read back equal.
- **P3**: the header/footer carries a real `wdFieldPage` field whose result is the page number; opens without
  repair.

Wired into `test-roundtrip-paged.js` (after :140) seeded by an extended `paged-export-*-probe.js`, keeping the
paged-vs-overlay byte-equality plus the COM read-back.
