# M6 Data Model — glyph-geometry divergence

Entities are runtime/JSON records (M6 is validation-only — no persistent model change). All units stated explicitly.

## Fixture
A single calibration `.docx` + its identity.
- `id` (e.g. `aptos-11`, `aptos-11-justified`, `times-12`, `multipage`)
- `font` (family name as installed on the dev box, e.g. `Aptos`, `Calibri`, `Times New Roman`)
- `sizePt` (10–12)
- `alignment` (`left` | `justify`)
- `kind` (`single-para` | `multi-page`)
- `text` (the body string — BYTE-IDENTICAL across all single-para fixtures, so per-font width deltas are isolated)
- `docxPath` (absolute `C:/tmp/wc-m6-<id>.docx`)
- **Generation:** the app's paged export (D7) — the engine that paints == the producer of the `.docx` Word opens.

## PE line-geometry record (from `paged-glyphgeom-probe.js`, real renderer)
One per painted line, read from the painted `.superdoc-page`. Units = **CSS px @ 96 DPI**, page-box-relative.
- `page` (0-based painted page index)
- `lineIndex` (0-based within the doc)
- `topPx` (line top Y, relative to its `.superdoc-page` top)
- `leftPx` (line start X / wrap X, relative to the page left)
- `widthPx`
- `firstCharOffset` (the document character offset of the line's first glyph — the alignment key)
- plus `pageCount` + `perPageLineCount[]` (doc-level)

## Word char/line-geometry record (from `validate-glyphgeom-win.ps1`, hidden PID-safe COM)
One per character (or word) after `Repaginate()` + print view. Units = **POINTS**, page-space.
- `start` (`Range.Start` — the document char offset; the alignment key ↔ PE `firstCharOffset`)
- `xPagePt` (`Information(<verified wdHorizontalPositionRelativeToPage>)`)
- `yPagePt` (`Information(<verified wdVerticalPositionRelativeToPage>)`)
- `line` (`Information(<verified wdFirstCharacterLineNumber>)` — wrap boundary = `start` where this increments)
- `col` (`Information(<verified wdFirstCharacterColumnNumber>)`)
- plus `lines` (`ComputeStatistics(wdStatisticLines)`) + `pages` (`ComputeStatistics(wdStatisticPages)`) + `enumCheck` (the self-verification result: first-char `xPagePt` ≈ left margin)

## Divergence record (per fixture, from `paged-glyphgeom-validate.js`)
PE and Word aligned by char offset (PE `firstCharOffset` ↔ Word `start`), PE px→pt via ×0.75.
- `fixtureId`, `font`, `sizePt`, `alignment`
- `pageCount` `{pe, word, equal}` (target: **exact**)
- `linesPerPage` `{pe[], word[], maxAbsDelta}` (target: **exact or ±1**)
- `wrapPoints` `{agree:int, total:int, mismatches:[{lineIndex, peStartChar, wordStartChar}]}` (does line N start on the same char?)
- `lineYDeltaPt[]` + `lineStartXDeltaPt[]` (per-line, signed)
- **distribution** per metric: `{min, median, p95, max}` (absolute deltas)

## Report (top-level, from `paged-glyphgeom-validate.js`)
- `generatedFor` (Word build + font set + date — stamped by the driver)
- `perFixture[]` (the Divergence records)
- `perFontSummary[]` — per font: the worst-case + p95 of each metric across its fixtures (this is what SETS the tolerance)
- `enumVerified` (bool — the ps1 self-verification passed for every fixture)
- `pidSafe` (bool — no leaked WINWORD)

## Tolerance (written into [contracts/m6-glyph-tolerance.md](contracts/m6-glyph-tolerance.md) AFTER the report runs)
Derived from `perFontSummary`: page count = exact; lines-per-page = exact-or-±1; break/X = p95 (px or pt), per metric,
reported per font. Lives ABOVE the 15-twip/1px floor. This is the M6 deliverable — the number that a FUTURE gate uses.
