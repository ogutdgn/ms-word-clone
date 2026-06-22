# Contract — Word-COM oracle validation (dev-box-only)

New `scripts/oracle/validate-hyphenation-win.ps1`, invoked via `com-validate.js`
`comValidate('validate-hyphenation-win.ps1', docxAbsPath)` — sandbox-disabled + PID-safe (kill only the spawned
WINWORD). Dev-box-only (Windows + Word 16); excluded from headless CI. Mirrors 002/003/004.

## Read-backs

| Field | Word COM | Phase |
|-------|----------|-------|
| Automatic | `ActiveDocument.AutoHyphenation` (bool) | P1 |
| Hyphenation zone | `ActiveDocument.HyphenationZone` (points) | P2 (Options) |
| Consecutive limit | `ActiveDocument.ConsecutiveHyphensLimit` | P2 (Options) |
| Hyphenate CAPS | `ActiveDocument.HyphenateCaps` (bool) | P2 (Options) |
| Manual optional hyphen | the marked word's run carries a soft hyphen (read its `Range.WordOpenXML`) | P3 |

## Hardening

- **OpenAndRepair:=false** — open positionally so a malformed `.docx` ERRORS instead of silently repairing;
  `openedWithoutRepair` mirrors `ok`.
- **PID-safety** — before/after WINWORD PID diff; `finally` Stop-Process only the spawned PID.
- Booleans normalized (`[int]$x -ne 0`); zone read in points (compare to authored inches × 72).

## Result shape

`ConvertTo-Json -Compress`: `{ ok, openedWithoutRepair, autoHyphenation, hyphenationZone,
consecutiveHyphensLimit, hyphenateCaps, manualHyphenFound? }` (fields per phase). `ok:false` only on a producer
error; the Node driver asserts equality of each authored value.

## Acceptance (per phase)

- **P1**: an Automatic doc opens without repair; `AutoHyphenation` true; a None doc ⇒ false.
- **P2**: `HyphenationZone` ≈ authored (pt), `ConsecutiveHyphensLimit` = authored, `HyphenateCaps` = authored
  (correctly inverted vs `w:doNotHyphenateCaps`).
- **P3**: the marked paragraph's word carries an optional hyphen after Word opens it.

Wired into `test-roundtrip-paged.js` (C7) seeded by `paged-export-hyphenation-probe.js`.
