# Contract: M6 glyph-geometry divergence report (`report:glyphgeom`)

**Type:** dev-box-only validation report (REPORT-ONLY — not a pass/fail gate). **Reuses** the M5 Node→Word-COM bridge
(`scripts/oracle/com-validate.js`, sandbox-disabled, PID-safe). Run on the Windows dev box only (real Word + real
Chromium renderer; Word COM hangs at `New-Object` in a sandbox).

## Inputs
- The fixture set under `C:/tmp/wc-m6-*.docx` (one per installed Office font + a justified variant + a multi-page doc), generated via the app's paged export (see [data-model.md](../data-model.md) → Fixture / D7).

## Producers
1. **`scripts/paged-glyphgeom-probe.js`** (real Electron renderer, paged) → PE line-geometry records (px @96dpi).
2. **`scripts/oracle/validate-glyphgeom-win.ps1`** (hidden PID-safe COM) → Word char/line-geometry records (points) + `ComputeStatistics` counts + the enum self-verification result. **MUST self-verify each `Information()` enum int** on the first char (assert `xPagePt` ≈ left-margin pt) before emitting `ok:true`.
3. **`scripts/paged-glyphgeom-validate.js`** (Node driver) → aligns by char offset, px→pt (×0.75), diffs, emits the report.

## Output (JSON, the M6 deliverable)
```jsonc
{
  "ok": true,                       // false if the enum self-verification failed for any fixture, or a producer crashed
  "enumVerified": true,             // every ps1 run confirmed its Information() ints empirically
  "pidSafe": true,                  // no WINWORD leaked (before/after PID diff)
  "perFixture": [
    {
      "fixtureId": "aptos-11", "font": "Aptos", "sizePt": 11, "alignment": "left",
      "pageCount": { "pe": 1, "word": 1, "equal": true },
      "linesPerPage": { "pe": [8], "word": [8], "maxAbsDelta": 0 },
      "wrapPoints": { "agree": 8, "total": 8, "mismatches": [] },
      "dist": {                     // absolute deltas, after px->pt
        "lineYPt":     { "min": 0.0, "median": 0.3, "p95": 0.8, "max": 1.1 },
        "lineStartXPt":{ "min": 0.0, "median": 0.2, "p95": 0.6, "max": 0.9 }
      }
    }
    // … one per fixture …
  ],
  "perFontSummary": [               // THE TOLERANCE-SETTING ARTIFACT
    { "font": "Aptos", "pageCountExact": true, "linesPerPageMaxDelta": 0,
      "wrapMismatchRate": 0.0, "lineYPt_p95": 0.8, "lineStartXPt_p95": 0.6 }
    // … one per font …
  ]
}
```

## Tolerance-setting rule (filled in AFTER the report runs — this is the M6 deliverable)
Above the engine's **15-twip ≈ 1px ≈ 0.75pt** floor (`word-layout/src/unit-conversions.ts:16`), per metric, reported per font:

**MEASURED on the dev box (Word-for-Windows 16.0; 15 installed Office fonts + a justified variant + a multi-page doc;
byte-identical body text at 11pt, Letter, 1in margins). enumVerified=true, pidSafe=true.** The right-hand column is the
M6 deliverable — the tolerance the data yields.

| Metric | Target shape | **Measured tolerance (single-page fixtures)** |
|---|---|---|
| page count | exact | `=` ✅ (every single-page fixture: PE == Word) |
| wrap-point agreement | every line starts on the same word | **`100%` — 0 mismatches across all 15 fonts** ✅ (PE line-breaking == Word) |
| per-line start-X delta | ≤ p95, per font | **`0.75pt` (= 1px, the engine's 15-twip grid floor) for ALL fonts** — i.e. exact to the grid |
| per-line Y delta | ≤ p95, per font | **`≤ 5pt` p95 (worst = Segoe UI 4.91pt; Georgia 3.64; most ≤ 1.7pt; Times/Cambria/Consolas 0.73pt)** — set per-font from `lineYPt_p95`; a single number is **5pt (≈ ⅓ line)** |

**Headline:** the paged engine's typesetting matches Word remarkably well on body text — **wrap points exact, start-X
exact to the 1px grid, line-Y within ⅓ of a line** across the full Office font set.

**Multi-page finding — ✅ CLOSED by feature 011 (pagination calibration, 2026-06-22).** The multi-page fixture (one
98-line paragraph) originally paginated to **PE = 2 pages, Word = 3 pages**. 011's deeper-spike pinned the root cause:
PE's "single" line spacing was a flat **1.15× font-size** floor, which fed the *tight* glyph box (`actualBoundingBox`)
into the line-height max so the floor always won — but Word's single spacing is the font's NATURAL box. Canvas
`fontBoundingBox` for Calibri 11pt = 18px = **13.5pt = Word's exact pitch** (PE was 12.65pt). The fix feeds
`max(tightBox, fontBoundingBox)` into `resolveLineHeight` (`measuring-dom/src/{fontMetricsCache,index}.ts`) — a
user-authorized Constitution P1 exception. Result: the fixture now paginates **PE 3 == Word 3** (lines 48/48/2 @
13.5pt), AND single-page line-Y p95 IMPROVED (Segoe UI 4.91→1.5pt, Calibri 1.69→0.75pt). The 009 gate now **ASSERTS**
the multi-page page-count (65/65), so a regression re-fails it. See `specs/011-pagination-calibration/`.

> 009 turned these numbers into a red/green gate (page count exact for single-page; wrap 100%; start-X ≤ 1px; line-Y
> p95 ≤ 6pt); 011 then closed the multi-page pagination divergence (PE 3 == Word 3, now asserted by the gate).

## Invariants
- **No `src`/fork edit** — probe = pure painted-DOM read; ps1 = COM read; driver = diff. The engine is unchanged.
- **PID-safe** — the ps1 spawns its own hidden WINWORD and kills ONLY that PID (never the user's window).
- **Real renderer** — the PE probe runs in Electron, never headless (else it measures the mock-canvas stub).
- **Enum-honest** — the ps1 confirms its `Information()` ints in-run; an unverified int → `ok:false`.
