# Implementation Plan: Milestone 6 — glyph-metric tolerance vs the Word-for-Windows COM oracle

**Branch**: `slice/m6-glyph-tolerance` (off `layout-engine`; NEVER off/onto `main`) · **Spec**: [spec.md](spec.md) (FR-009 + SC-005)
**Input**: the M6 understanding-sweep brief + the session decisions (below). **Prior milestone (M5) archived** → [milestones/m5/](milestones/m5/).

## Summary

M1–M5 proved the paged `PresentationEditor` (PE) engine is **self-consistent** (every prior Δ=0 is the engine agreeing
with itself) and **exports structurally correctly** (M5: `.docx` ↔ Word COM parity — counts/markers/no-repair, never a
coordinate). **M6 newly proves the PE's painted TYPESETTING matches real Word-for-Windows 16.0** — line-break / wrap
points / per-line Y / per-char X — by **measuring the divergence and reporting its distribution**, from which the
tolerance is set. **No tolerance number exists** (FR-009/SC-005 say "the *agreed* tolerance"; the quantifying spike was
never run), so M6 is **REPORT-ONLY**: it produces the per-font, per-metric divergence distribution that *sets* the
number. Turning it into a pass/fail gate is a follow-up (out of scope).

**Shape: validation-only test infra — ZERO `src`/fork edits** (exactly like M5). The doc model stays page-free; M6 only
MEASURES the existing engine's fidelity.

## Decisions (locked this session)

| Decision | Choice |
|---|---|
| First cut | **REPORT-ONLY** — measure + set the tolerance; no red/green gate in M6 |
| Metrics | **FULL glyph X-Y** — page count + per-page line count + per-line wrap points + per-line Y + per-char X (points) |
| Fixtures | **FULL Office font set** (enumerate dev-box-installed fonts), byte-identical text per font + justified variant + a ~2.5-page multi-page doc |
| Tolerance expression | **PER-METRIC, reported PER-FONT** (page count exact; lines/page exact-or-±1; break/X from measured p95) |

## Technical Context

- **Two measurement primitives (the heart of M6):**
  - **PE (painted DOM):** glyph advance = `ctx.measureText(text).width` (`measuring-dom/src/measurementCache.ts:92`, Chromium advance) → greedy line-fill (`measuring-dom/src/index.ts:2535-2541`, fit `width+word > maxWidth − 0.5px`); line height `index.ts:369` (Word-2007 ×1.15) + ascent/descent `fontMetricsCache.ts:202-215`. The probe reads each painted line's `getBoundingClientRect()` inside its `.superdoc-page` (top = line Y, left = wrap X). Units = **CSS px @ 96 DPI**.
  - **Word (COM):** `$r.Collapse(1)` → `Range.Information(N)` → per-char page-space **X/Y in POINTS** (`wdHorizontalPositionRelativeToPage` / `…Vertical…`) + per-line wrap (`wdFirstCharacterLineNumber` / `…ColumnNumber` — the char offset where line# increments = Word's wrap boundary) + `ComputeStatistics(wdStatisticLines/Pages)`. Works in the HIDDEN instance after `$doc.Repaginate()` + `View.Type=3`. **Convert PE px→pt via ×0.75** before diffing.
- **⚠️ Real-renderer requirement:** a headless/JSDOM run measures the mock-canvas 0.5-units/char stub (`canvas-resolver.ts:20-21`), NOT Chromium. M6 MUST measure in the **real Electron renderer** (the `electron . --probe-out --shot-evalfile` harness).
- **⚠️ Enum self-verification:** the ONLY `Information()` int proven in-repo is `Information(3)` = wdActiveEndPageNumber (`word-oracle-win.ps1:341`). The ps1 MUST empirically confirm each new enum int on a known one-line fixture (assert first-char X ≈ left margin in pt) before trusting it — do NOT hardcode the ints.
- **NOT `Window.GetPoint`** — the only w/h-rect call, but it returns SCREEN pixels, is zoom/DPI/window-coupled, and requires `Visible=$true` (fights the hidden-instance PID-safety model). Use `Information()` points only.
- **15-twip / 1px floor:** the engine lays out on a 15-twip ≈ 1px ≈ 0.75pt integer grid (`word-layout/src/unit-conversions.ts:16`). Sub-px tolerances are below the engine's own granularity → meaningless. Tolerances live ABOVE this floor.
- **Predicted worst divergence (never measured):** justified text (slack-spread multiplies per-glyph error); ascent/descent line-height drifting lines-per-page; the mock-canvas stub if run headless.
- **Reuse from M5:** `scripts/oracle/com-validate.js` (`comValidate()` — spawnSync powershell sandbox-disabled, PID-safe, result-shape JSON) + the `validate-open-win.ps1:15-54` PID-safe spawn-snapshot-kill skeleton (copied verbatim).

## Constitution Check

- **Validate against real Word:** YES — M6 IS the glyph-fidelity-vs-Word milestone (Word COM oracle, PID-safe). ✅
- **No fork edits / model stays page-free:** YES — zero `src`/fork edits; all new files are `scripts/` + specs. ✅
- **Gates:** M6 adds NO `src`, so `test:pm` 475 / `test:smoke` 9 / `test:roundtrip` 27 / `test:bundle` 4 / `test:roundtrip:paged` 19 stay unchanged; the new report is a SEPARATE `report:glyphgeom` (not a gate). ✅
- **Merge mode:** ff-merge the slice into `layout-engine` after check-in (no PR). ✅

No violations.

## Phase 0 — Research → [research.md](research.md)

Resolves: report-only rationale; the PE/COM measurement primitives + units; the enum-self-verification protocol; the
GetPoint rejection; the 15-twip floor; fixture generation (app-export vs OOXML-author); the font enumeration.

## Phase 1 — Design → [data-model.md](data-model.md), [contracts/m6-glyph-tolerance.md](contracts/m6-glyph-tolerance.md), [quickstart.md](quickstart.md)

**Entities:** Fixture (font, size, alignment, pages, byte-identical text); PE-line-geometry record; Word-char/line
geometry record; the Divergence Report (per-metric, per-font distribution). **Contract:** the report's JSON shape + the
tolerance-setting rule (p95 per metric per font). **Quickstart:** how to generate fixtures + run `report:glyphgeom` on
the dev box (sandbox-disabled, PID-safe).

## The M6 build (4 steps; NO `src`/fork edits — all `scripts/` + specs)

0. **Fixtures** — a `.docx` per dev-box-installed Office font (byte-identical body paragraph, ~6–8 wrapped lines, Letter, 1in margins) + a justified variant + a ~2.5-page multi-page doc. **Generation: the app's own paged export** (set font + insert the fixed paragraph + `WC.PM.exportDocxBytes` → `wordAPI.saveBytes`) so the engine that PAINTS is the one that produced the `.docx` Word OPENS — single source of truth. (Fall back to a tiny OOXML author only if a font can't be driven through the app.)
1. **`scripts/paged-glyphgeom-probe.js`** (NEW, paged, real renderer) — per fixture, emit per-painted-line `{page, lineIndex, topPx, leftPx, widthPx, firstCharOffset}` relative to the `.superdoc-page` box + page count + per-page line count. Pure DOM read.
2. **`scripts/oracle/validate-glyphgeom-win.ps1`** (NEW; copy the PID-safe skeleton verbatim) — Open-no-repair → Repaginate → print view → SELF-VERIFY the enum ints → iterate `doc.Characters`/`doc.Words` → per item `Collapse(1)` + `Information(<verified X/Y/line/col>)` + `.Start` → one JSON line `{ok, lines, pages, items:[…]}`.
3. **`scripts/paged-glyphgeom-validate.js`** (NEW; reuse `com-validate.js`, sandbox-disabled) — per fixture run the probe + the ps1, ALIGN by char offset (PE `firstCharOffset` ↔ Word `.Start`), px→pt, DIFF per axis (wrap-point agreement, per-line Y, per-line start-X, page count, per-page line count), and EMIT THE DISTRIBUTION (min/median/p95/max per metric per fixture) + a PER-FONT breakdown. **Report-only.**
4. **`package.json`** — add `report:glyphgeom` = `node scripts/paged-glyphgeom-validate.js` (NOT in the 3-gate set). Then WRITE the tolerance the data yields into [contracts/m6-glyph-tolerance.md](contracts/m6-glyph-tolerance.md): per-metric, per-font, from the p95.

**NO engine change in M6** — a systematic-offset CALIBRATION (the empty hook at `measuring-dom/src/index.ts:139-143`) would be a SEPARATE milestone.

## Verification (definition of done)

- `npm run build` clean; the 5 existing gates UNCHANGED (no `src`): pm 475 / smoke 9 / roundtrip 27 / bundle 4 / roundtrip:paged 19.
- `report:glyphgeom` runs on the Windows dev box (**real Electron renderer** for PE; **Word COM sandbox-disabled + PID-safe** for the ps1) and emits the per-font, per-metric divergence distribution for the full Office font set + justified + multi-page; the enum ints are self-verified in-run; the tolerance is written into the m6 contract from the measured p95.
- PID-safety confirmed (only spawned WINWORD killed — never the user's Word window).
- `/code-review` on the slice diff; fix findings; re-verify. **CHECK-IN: only after the user is satisfied**, ff-merge `slice/m6-glyph-tolerance` into `layout-engine`.

## Out of scope (documented)

Turning the report into a pass/fail GATE; any engine/metrics CALIBRATION fix (the systematic-offset correction); M7 +
the `layout-engine → main` endgame.
