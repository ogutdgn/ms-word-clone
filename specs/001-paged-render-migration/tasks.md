---
description: "Task list — Milestone 6 (glyph-metric tolerance vs the Word-COM oracle, REPORT-ONLY)"
---

# Tasks: Paged Render Migration — **Milestone 6** (glyph-metric tolerance vs the Word-COM oracle)

**Input**: Design documents from `specs/001-paged-render-migration/`
**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) (FR-009 + SC-005) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/m6-glyph-tolerance.md](contracts/m6-glyph-tolerance.md) · [quickstart.md](quickstart.md)
**Sequencing authority**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)

## Scope & format
- **M6 ONLY** — MEASURE how far the paged PE's painted typesetting diverges from real Word-for-Windows 16.0 and
  REPORT the per-font, per-metric distribution that **sets** the tolerance. **REPORT-ONLY** (no pass/fail gate this
  milestone). **Dev-box-only** validation infra: **NO `src` change, NO fork edits.** M7 + the →main endgame out of scope.
- All tasks Setup/Foundational/Verification/Polish → **no `[US#]`**. `[P]` = parallelizable (different file, no
  incomplete-task dependency). **Word COM spawns run SANDBOX-DISABLED** (Word hangs at `New-Object` in a sandbox) and
  **PID-safe** (only the spawned WINWORD dies); **PE measured in the REAL Electron renderer** (headless = mock-canvas
  stub). All probe/fixture electron launches use `--user-data-dir=C:/tmp/wc-probe-profile --disable-http-cache` (M5 isolation).

---

## Phase 1: Setup
- [ ] T001 Confirm on slice branch `slice/m6-glyph-tolerance` (off `layout-engine`; NEVER off/onto `main`). `git branch --show-current` before any edit. (M5 specs already archived to `milestones/m5/`.)

---

## Phase 2: Probe-FIRST spike (the NOVEL surfaces — do BEFORE building the report)
- [ ] T002 Write a throwaway `scripts/m6-spike-enum.ps1` + run it SANDBOX-DISABLED to PIN, with evidence, the four `Range.Information()` enum ints. Open a KNOWN one-line left-aligned `.docx` (known left margin, e.g. 1in=72pt) in a HIDDEN PID-safe Word COM (copy the `validate-open-win.ps1:15-54` skeleton), `Repaginate()` + `View.Type=3`, then for the FIRST character try CANDIDATE ints for X-page / Y-page / line# / col# and assert the one whose value ≈ the left margin in points IS `wdHorizontalPositionRelativeToPage` (the readers disagreed; only `Information(3)` is proven). RECORD the 4 verified ints + confirm PID-safety (only the spawned WINWORD dies). *(depends on T001)*
- [ ] T003 [P] Write a throwaway `scripts/m6-spike-pe.js` + run it in the REAL renderer (paged) to PIN: WHAT DOM element is a "painted line" inside `.superdoc-page` (the per-line box for `getBoundingClientRect`), and HOW to read its `firstCharOffset` (the document char offset of the line's first glyph — the alignment key vs Word's `.Start`). Force a wrapped multi-line paragraph; dump the candidate line elements + a way to map each to its first doc char. RECORD the selector + the firstCharOffset method. *(depends on T001)*
- [ ] T004 [P] Write a throwaway spike (extend `m6-spike-pe.js` or a `scripts/m6-spike-fixture.js`) to confirm the app can AUTHOR a fixture: set a font + insert the fixed paragraph (+ alignment) + `WC.PM.exportDocxBytes` → `wordAPI.saveBytes` → a valid `.docx` that `validate-open-win.ps1` opens clean; AND enumerate the installed Office fonts (query the system font list / what the renderer/Word exposes). RECORD the font list + the set-font + export path. *(depends on T001)*

**Checkpoint**: the 4 enum ints are pinned + PID-safe; the painted-line selector + firstCharOffset method are known; the app-export fixture path + the Office font list are confirmed.

---

## Phase 3: Foundational — fixtures
- [ ] T005 Create `scripts/paged-glyphgeom-fixtures.js` (renderer fixture generator, paged, REAL renderer): enumerate the installed Office fonts (from T004); for each, author a `.docx` with a BYTE-IDENTICAL body paragraph (~6–8 wrapped lines, Letter, 1in margins, ~10–12pt) via set-font + `insertContent` + `exportDocxBytes` → `wordAPI.saveBytes('C:/tmp/wc-m6-<fontid>.docx')`; PLUS a justified variant (`wc-m6-<aptos>-justified.docx`) PLUS a ~2.5-page multi-page doc (`wc-m6-multipage.docx`). Emit a manifest `{fixtures:[{id,font,sizePt,alignment,kind,docxPath,text}]}` to `--probe-out`. *(depends on T002–T004)*

---

## Phase 4: The two producers (PE probe + Word ps1)
- [ ] T006 Create `scripts/paged-glyphgeom-probe.js` (PE probe, paged, REAL renderer): given a fixture `.docx` (open it via the app), emit per-painted-line `{ page, lineIndex, topPx, leftPx, widthPx, firstCharOffset }` read from each line element inside its `.superdoc-page` (page-box-relative, px@96dpi) + `pageCount` + `perPageLineCount[]`, using the T003 line selector + firstCharOffset method. Pure DOM read; NO fork edit. *(depends on T003, T005)*
- [ ] T007 [P] Create `scripts/oracle/validate-glyphgeom-win.ps1` (copy the `validate-open-win.ps1:15-54` PID-safe spawn-snapshot-kill skeleton VERBATIM — `DisplayAlerts=0`, `AutomationSecurity=3`, before/after WINWORD PID diff, `finally` Stop-Process ONLY the spawned PID): Open-no-repair → `$doc.Repaginate()` → `View.Type=3` → SELF-VERIFY the T002 enum ints on the first char (assert X-page ≈ left margin; `ok=false` + `enumCheck` detail if not) → iterate `doc.Characters` (or `doc.Words`): `$r=item.Duplicate; $r.Collapse(1)` → `xPagePt`/`yPagePt`/`line`/`col` via the verified ints + `start=$r.Start` → ONE `ConvertTo-Json -Compress` line `{ ok, enumCheck, lines:ComputeStatistics(1), pages:ComputeStatistics(2), items:[{start,line,col,xPagePt,yPagePt}] }`. NOT `Window.GetPoint`. *(depends on T002)*

---

## Phase 5: The driver + the report wiring
- [ ] T008 Create `scripts/paged-glyphgeom-validate.js` (Node driver; reuse `scripts/oracle/com-validate.js` `comValidate()` sandbox-disabled + PID-safe + `winwordPids()`): read the fixtures manifest (run T005 first if absent); per fixture spawn the PE probe (REAL renderer, isolated `--user-data-dir`) + `comValidate('validate-glyphgeom-win.ps1', docx)`; ALIGN by char offset (PE `firstCharOffset` ↔ Word `.Start`), convert PE px→pt (×0.75); DIFF per axis — wrap-point agreement (does line N start on the same char on both?), per-line Y delta (pt), per-line start-X delta (pt), page count (exact), per-page line count; EMIT the DISTRIBUTION (min/median/p95/max per metric per fixture) + `perFontSummary[]` (the tolerance-setting artifact: per-font `pageCountExact`/`linesPerPageMaxDelta`/`wrapMismatchRate`/`lineYPt_p95`/`lineStartXPt_p95`). REPORT-ONLY: emit `{ ok, enumVerified, pidSafe, perFixture[], perFontSummary[] }` — `ok:false` ONLY if the enum self-verification failed or a producer crashed. Before/after WINWORD PID diff for `pidSafe`. *(depends on T005, T006, T007)*
- [ ] T009 Add `report:glyphgeom` (`node scripts/paged-glyphgeom-validate.js`) to `package.json`. A REPORT, NOT a gate — do NOT touch the 5 gate scripts (`test:pm`/`test:smoke`/`test:roundtrip`/`test:bundle`/`test:roundtrip:paged`). *(depends on T008)*

---

## Phase 6: VERIFY loop + close-out
- [ ] T010 `npm run build` clean; the 5 existing gates STAY GREEN (no `src` change): `test:pm` (475), `test:smoke` (9), `test:roundtrip` (27), `test:bundle` (4), `test:roundtrip:paged` (19). *(depends on T005–T009)*
- [ ] T011 Run `npm run report:glyphgeom` on the Windows dev box **SANDBOX-DISABLED** → it generates the fixtures (full Office font set + justified + multi-page), runs the PE probe (real renderer) + the Word ps1 per fixture, and emits the per-font, per-metric divergence distribution with `enumVerified:true` (the ps1 self-verified its ints in-run) + `pidSafe:true` (the user's Word window untouched). Delete the throwaway `m6-spike-*` files. *(depends on T010)*
- [ ] T012 WRITE the measured p95 tolerances into `contracts/m6-glyph-tolerance.md` — fill the blank right-hand column of the tolerance table (per metric, per font) from `perFontSummary`. This is the M6 deliverable. *(depends on T011)*
- [ ] T013 Run **`/code-review`** on the slice diff. FIX every finding — scrutinize: the enum SELF-VERIFICATION honesty (a wrong int that still passes the ≈left-margin check — verify it against a SECOND known position, e.g. a known second-line Y or a right-edge char); the PE `firstCharOffset` ↔ Word `.Start` ALIGNMENT (off-by-one / leading whitespace / the paragraph-mark + run-boundary handling); the px→pt ×0.75 conversion; the REAL-renderer requirement (assert NOT the mock-canvas stub); PID-safety; the p95 computation (interpolation + small-N). Re-run T010–T011 until clean. *(depends on T011–T012)*
- [ ] T014 Commit per `.claude/skills/commit-style` (explicit `git add <path>`; what/why body; **no AI trailer**). Update the runbook **Current Status** (M6 done; `report:glyphgeom` is **dev-box-only / report-only / not a gate**; the measured tolerance now lives in the m6 contract; NEXT = turn-it-into-a-gate or the `layout-engine → main` endgame) + memory. **At CHECK-IN, only after the user is satisfied:** ff-merge `slice/m6-glyph-tolerance` into `layout-engine`. *(depends on T013)*

---

## Dependencies & execution order
- **T001 → all. T002/T003/T004 (spikes) → fixtures/producers.** **T005 (fixtures) + T006 (PE probe) + T007 (Word ps1) → T008 → T009.** **Verify**: T010 → T011 → T012 → T013 → T014.
- COM-oracle: M6 IS a COM-oracle milestone (real Word geometry). PID-safe; sandbox-disabled; dev-box-only.

## Parallel opportunities
- T003 (PE line spike) ∥ T004 (fixture/font spike) — different files. T006 (PE probe) ∥ T007 (Word ps1) — different files (both gated on their spikes).

## MVP / increment
"Done" = T010 green (existing gates flat) + T011 emits the per-font divergence distribution (enum-verified, PID-safe) + T012 writes the measured tolerance into the m6 contract + T013 clean + T014 merged → STOP. The tolerance NUMBER is the M6 deliverable; a FUTURE milestone turns it into a gate.

## Notes
- NO `src` change; NO fork edits; the doc model stays page-free (M6 only MEASURES). All new files are `scripts/` + the spec contract.
- The report needs the REAL Electron renderer (PE) + real foreground-capable Word COM (sandbox-disabled). It can NOT run in headless CI. OUT OF SCOPE: turning the report into a pass/fail GATE; any engine/metrics CALIBRATION fix (the `measuring-dom/src/index.ts:139-143` systematic-offset hook); M7 + the →main endgame.
