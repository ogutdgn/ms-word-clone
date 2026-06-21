# M6 Research — glyph-metric tolerance vs the Word COM oracle

All decisions are grounded in the M6 understanding-sweep (verified file:line). Format: Decision / Rationale / Alternatives.

## D1 — Report-only first cut (measure, then set the tolerance)
- **Decision:** M6 ships a divergence **REPORT** (distribution that *sets* the tolerance), NOT a pass/fail gate.
- **Rationale:** No tolerance number exists — FR-009/SC-005 (`spec.md:96,116`) literally say "the *agreed* tolerance", and the S3 quantifying spike (`docs/research/opensource-deepdive/05-edge-cases-and-technical-risks.md:81`) was never run. You can't gate against a threshold you haven't measured. Measuring first yields the data that *defines* the threshold.
- **Alternatives:** A provisional pass/fail gate now (rejected — the threshold would be a guess); deferring measurement (rejected — M6's whole point is to quantify the ceiling).

## D2 — Full glyph X-Y comparison
- **Decision:** compare page count + per-page line count + per-line **wrap points** (which char each line starts on) + per-line **Y** + per-char **X** (in points).
- **Rationale:** The richest characterization. Wrap points answer "does our line-breaking match Word"; Y answers lines-per-page drift (the SC-005 metric); X answers intra-line glyph-advance drift. All come from the SAME `Range.Information()` reads, so the extra axes are nearly free once the ps1 exists.
- **Alternatives:** counts-only (the literal spec minimum — too coarse to diagnose); counts+wrap (good, but X-Y is available for the same cost and the user wants the full picture).

## D3 — Fixtures: full Office font set, byte-identical text, + justified + multi-page
- **Decision:** one `.docx` per **dev-box-installed Office font** (enumerate at fixture-gen time), a byte-identical body paragraph (~6–8 wrapped lines, Letter, 1in margins), body sizes ~10–12pt; PLUS a **justified** variant (predicted worst case) and a **~2.5-page** multi-page doc (page-break + per-page line count).
- **Rationale:** Divergence is inherently **per-font** (Chromium's advances ≠ Word's GDI advances, scaling with glyph count). Byte-identical text isolates the per-font delta. Justified multiplies per-glyph error (worst case). Multi-page exercises the lines-per-page → page-break chain. The fonts must be the ones Word actually uses on this box = the system Office fonts.
- **Alternatives:** Aptos-only (fastest, but misses the per-font spread the user wants characterized); a synthetic font list (rejected — must be the installed fonts Word renders).

## D4 — Tolerance expressed per-metric, reported per-font
- **Decision:** page count = **exact**; lines-per-page = **exact or ±1**; break/X position = **px (or pt) from the measured p95**; everything **reported per-font** so any font needing its own number is visible.
- **Rationale:** The engine's **15-twip ≈ 1px ≈ 0.75pt** integer grid (`word-layout/src/unit-conversions.ts:16`) makes sub-px tolerance meaningless — tolerances live above this floor. A single universal px number would be set to the worst font's p95 and over-penalize good fonts; per-metric/per-font matches reality.
- **Alternatives:** single universal number (blunt — rejected as the default); a sub-px tolerance (meaningless below the grid floor).

## D5 — PE measurement: read the painted DOM in the REAL renderer
- **Decision:** the PE probe reads each painted line's `getBoundingClientRect()` inside its `.superdoc-page` (CSS px @96dpi), running in the **real Electron renderer** (`electron . --shot-evalfile`), never headless.
- **Rationale:** PE's advance comes from `ctx.measureText().width` (`measuring-dom/src/measurementCache.ts:92`) — REAL Chromium metrics. A headless/JSDOM run hits the mock-canvas 0.5-units/char stub (`canvas-resolver.ts:20-21`) → measures the stub, not the engine. The painted line element's rect is the engine's actual on-page output.
- **Alternatives:** instrument the engine's internal layout objects (rejected — would need a fork edit; the painted rect is the same data, externally).

## D6 — Word measurement: Range.Information() points, enum self-verified, NOT GetPoint
- **Decision:** `$r.Collapse(1)` + `Range.Information(N)` for per-char page X/Y (points) + per-line wrap; `ComputeStatistics` for line/page counts; in the HIDDEN instance after `Repaginate()` + print view. **Self-verify each enum int** on a known one-line fixture before trusting it. Do NOT use `Window.GetPoint`.
- **Rationale:** `Information()` is view-independent + works hidden → reuses the M5 PID-safe spawn-snapshot-kill skeleton (`validate-open-win.ps1:15-54`). The only enum proven in-repo is `Information(3)` (`word-oracle-win.ps1:341`); the readers disagreed on the X/Y/line/col ints, so they MUST be confirmed empirically. `GetPoint` returns SCREEN pixels and requires `Visible=$true` → fights PID-safety.
- **Alternatives:** `GetPoint` for true w/h rects (rejected — visible window, DPI/zoom-coupled); hardcoding the enum ints from notes (rejected — unverified).

## D7 — Fixture generation: the app's own paged export
- **Decision:** generate each fixture `.docx` via the app — set the font + insert the fixed paragraph (+ alignment) + `WC.PM.exportDocxBytes` → `wordAPI.saveBytes`. Fall back to a tiny OOXML author only if a font can't be driven through the UI/bridge.
- **Rationale:** The engine that PAINTS the fixture is the one that produced the `.docx` Word OPENS — single source of truth, no third-party authoring tool to introduce its own layout. Reuses the M5 export path.
- **Alternatives:** hand-authored OOXML (more control but a second layout authority); a Word-COM-authored fixture (rejected — circular: Word would author what we then measure Word against).

## D8 — No engine change in M6
- **Decision:** M6 makes NO `src`/fork edit. If the data shows a *systematic* offset correctable via the empty calibration hook (`measuring-dom/src/index.ts:139-143`), that is a SEPARATE milestone.
- **Rationale:** M6 is the *measurement* milestone (set the tolerance), mirroring M5's validation-only shape. Mixing in a calibration fix would conflate measuring the gap with closing it.
