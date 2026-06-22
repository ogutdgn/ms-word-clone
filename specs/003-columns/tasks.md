# Tasks: Multi-column page layout (Columns)

**Feature**: `specs/003-columns/` | **Branch**: `feature/columns-paged` (off `main`)
**Inputs**: plan.md, research.md, data-model.md, contracts/{bridge-verbs,oracle-validation}.md, quickstart.md
**Merge mode**: ff-merge to `main` + push per phase (standing preference). `/code-review` (high) each slice.

**Conventions**: probes run in the REAL paged renderer (`electron --user-data-dir=C:/tmp/wc-probe-profile
--disable-http-cache . --probe-out=… --shot-evalfile=…`, never headless). COM oracle is dev-box-only
(sandbox-disabled, PID-safe). Every fidelity claim is read back from real Word. The `WC.PM` bridge is the
only document-write path. Prefer NO fork edits.

---

## Phase 1: Setup

- [x] T001 Confirm on `feature/columns-paged` (off `main`); `npm run build` clean (paged default); baseline gates green — `test:pm` 475 (overlay) / `test:smoke` 9 / `test:roundtrip` 27 / `test:bundle` 4. Record the baseline.
- [x] T002 Commit the spec-kit planning artifacts (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md, checklists/, tasks.md, `.specify/feature.json`) on the feature branch.

---

## Phase 2: Foundational — THE SPIKE (bounds P2/P3; P1 is already feasibility-proven)

**Goal**: resolve research.md's 3 OPEN questions (unequal columns / line-between / column-break) before the
P2/P3 production code. Throwaway probe scripts, deleted before each slice's commit. Records the no-fork reach.

- [x] T003 Write a throwaway spike probe `scripts/tmp-columns-spike.js` (real paged renderer) exercising: (a) `sections.setColumns` with a separator + unequal widths if any option exists; (b) inserting a `w:br w:type="column"`; export + read the painted columns.
- [x] T004 SPIKE Q1+Q2 (unequal + line-between): determine whether `<w:col>` children / `w:cols/@w:sep` are reachable NO-FORK (a `setColumns` option, an owned post-export `sectPr` write, or `sections.setPageSetup`). Record pass/fail + the chosen mechanism (or "honest-toast gap") into research.md.
- [x] T005 SPIKE Q3 (column break): confirm a no-fork insert of a `w:br w:type="column"` (a break command / `insertContent` of a column-break run) moves the painted text to the next column + exports `w:type="column"`. Record the mechanism. Delete the spike script; fold anything reusable into `scripts/paged-columns-probe.js`.

**Checkpoint**: the unequal / line-between / column-break no-fork reach is decided + written into research.md. Any forced minimal fork accessor → plan.md Complexity Tracking.

---

## Phase 3: User Story 1 — Apply a column preset (P1) 🎯 MVP

**Goal**: One/Two/Three render N equal columns + export `w:cols` + open in Word with `TextColumns.Count==N`.
**Independent test**: Columns → Two splits the text into two columns; save → reopen (and Word) shows two columns; Columns → One restores single.

- [x] T006 [US1] Create the owned bridge module `src/renderer/bridge/columns.ts`: `setColumns({count, gap?, equalWidth?})` → `editor.doc.sections.setColumns({count, gap*1440→twips, equalWidth, target: section-0 addr})` (markDirty; NO_OP counts as success; `count:1` normalizes to single) + `getColumns()` → `{count, gap, equalWidth}` from `sections.get`/`list`. Mirror `bridge/header-footer.ts` structure.
- [x] T007 [US1] Merge the verbs onto `WC.PM` in `src/renderer/bridge/index.ts` (+ pre-mount no-op fallbacks: `setColumns`→false, `getColumns`→`{count:1,gap:0.5,equalWidth:true}`); UN-DEFER `columns` by adding it to `ENGINE_READY` (and reconcile `AREA`/`DEFERRED`) so the `isBlocked` gate no longer toasts it.
- [x] T008 [US1] REWIRE `src/renderer/public/js/commands.js` `columnsMenu`: the One/Two/Three items call `WC.PM.setColumns({count})`; show the active preset's checked state from `getColumns()`. Keep "More Columns" as a placeholder item (wired in P2). Remove any dead `E()`/legacy refs in the columns handler.
- [x] T009 [US1] Repoint any D6 guard that uses `columns` as a still-deferred representative (`scripts/test-suite-pm.js` `[0a]`/`[11]`) to a different still-deferred command (e.g. `breaks`/`docInfo`) — un-deferring `columns` will otherwise fail those tests (the 002 P3 lesson).
- [x] T010 [US1] Create `scripts/paged-columns-probe.js` (real renderer): setColumns count 2 → assert the painted body renders at ≥2 distinct line-x bands + the export `sectPr` carries `<w:cols w:num="2">`; count 3 → 3 bands + `w:num="3"`; count 1 → single band + no multi-column `w:cols`; `getColumns()` round-trips. Add a `probe:columns` npm script.
- [x] T011 [US1] Create `scripts/oracle/validate-columns-win.ps1` (PID-safe, `OpenAndRepair:=false`): read `Sections(1).PageSetup.TextColumns.Count` + `.EvenlySpaced`; result shape `{ok, openedWithoutRepair, sectionCount, columnCount, evenlySpaced}`. Create `scripts/paged-export-columns-probe.js` (author a 2-column doc, save `C:/tmp/wc-<mode>-columns.docx`).
- [x] T012 [US1] Wire the columns doc + read-back into `scripts/test-roundtrip-paged.js` (a `paged-export-columns-probe.js` run + a C-section: validate-open no-repair + `columnCount==2`).
- [x] T013 [US1] VERIFY P1: `npm run build` + 4 core gates green; `probe:columns` green; the COM oracle (`TextColumns.Count==2`, opens-without-repair) green. Run `/code-review` (high) on the slice; FIX every finding; re-verify until clean.
- [x] T014 [US1] CLOSE-OUT P1: commit (commit-style; explicit `git add`; what/why; no AI trailer); update `docs/plan/layout-engine-runbook.md` + memory; ff-merge `feature/columns-paged` → `main` + push.

**Checkpoint**: One/Two/Three columns render + export + read back in real Word; `columns` is un-deferred.

---

## Phase 4: User Story 2 — Customize columns ("More Columns") (P2)

**Goal**: count + spacing + equal-width via a More Columns dialog; Left/Right + line-between bounded by the spike.
**Independent test**: More Columns → 2 cols, 1" spacing → export `w:space="1440"` + Word `Spacing≈72pt`; Left preset → unequal widths (to the spike's reach).

- [x] T015 [US2] Extend `src/renderer/bridge/columns.ts`: `setColumns` accepts `gap` (spacing) + `equalWidth` (already) + `lineBetween?` + `columns?[]` (unequal) — applying line-between/unequal ONLY via the spike-chosen no-fork mechanism (else ignore + the caller toasts). Extend `getColumns()` to read spacing/lineBetween.
- [x] T016 [US2] Add the "More Columns" dialog in `src/renderer/public/js/commands.js` (`WC.dialog`: number-of-columns, spacing input, "Equal column width" checkbox, "Line between" checkbox) → `WC.PM.setColumns(...)`; seed defaults from `getColumns()`. Wire the Left/Right preset items (equal-width false / unequal via the spike mechanism, else honest toast).
- [x] T017 [US2] Extend `scripts/paged-columns-probe.js`: 2 cols + 1" spacing → assert export `w:space="1440"` + the painted gap; equalWidth off → assert; Left/Right + line-between → assert per the spike's reach (or assert the honest-toast path if gapped).
- [x] T018 [US2] Extend `scripts/oracle/validate-columns-win.ps1`: read `.Spacing` (+ `.LineBetween` / per-column `.Item(n).Width` where reachable); assert spacing≈authored + even/uneven flag. Extend the roundtrip C-section.
- [x] T019 [US2] VERIFY P2: build + 4 gates + `probe:columns` + the COM oracle (count + spacing + flags) green; `/code-review` high; FIX; re-verify.
- [x] T020 [US2] CLOSE-OUT P2: commit; update runbook + memory; ff-merge → `main` + push.

**Checkpoint**: count + spacing + equal-width round-trip to real Word; Left/Right + line-between work to the recorded no-fork reach.

---

## Phase 5: User Story 3 — Column break (P3)

**Goal**: a Column break moves following text to the next column + exports `w:br w:type="column"`.
**Independent test**: in a 2-column doc, insert a Column break → following text starts the next column; export carries `w:type="column"`; Word honors it.

- [ ] T021 [US3] Add `insertColumnBreak()` to `src/renderer/bridge/columns.ts` (the spike-chosen no-fork insert of a `w:br w:type="column"` run); merge onto `WC.PM` + no-op fallback; un-defer the `columnBreak` command in `bridge/index.ts`.
- [ ] T022 [US3] Wire the Column break item under the Layout → Breaks dropdown in `src/renderer/public/js/commands.js` → `WC.PM.insertColumnBreak()`.
- [ ] T023 [US3] Extend `scripts/paged-columns-probe.js`: in a 2-column doc insert a column break → assert the following text paints in the next column + the export carries `<w:br w:type="column"/>`.
- [ ] T024 [US3] Extend `scripts/oracle/validate-columns-win.ps1`: assert the body Range carries a `w:type="column"` break (a break boundary); opens-without-repair. Extend the roundtrip C-section.
- [ ] T025 [US3] VERIFY P3: build + 4 gates + `probe:columns` + the COM oracle green; `/code-review` high; FIX; re-verify.
- [ ] T026 [US3] CLOSE-OUT P3: commit; update runbook + memory; ff-merge → `main` + push.

**Checkpoint**: column break renders + exports + Word honors it.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T027 Grep-confirm NO `E()` (= `WC.Editor`) or legacy refs remain in the columns/`columnsMenu` path; confirm `ribbon-data.js` was NOT hand-edited (the Columns dropdown is from `raw-research.json`).
- [ ] T028 Final docs reconciliation: update `docs/SCOPE.md` (Columns row) + `docs/FEATURES.md` + `docs/LAYOUT_ENGINE.md` to reflect what shipped; keep claims conservative (only what the oracle verified; record any unequal/line-between gap).
- [ ] T029 Confirm `test:roundtrip:paged` includes the columns read-backs; full gate sweep green on `main` after the last merge.

---

## Dependencies & order

- **T0 spike (T003–T005) bounds P2/P3** — it decides the no-fork reach of unequal/line-between/column-break. P1 needs NO spike (feasibility-proven).
- **P1 (T006–T014) → P2 (T015–T020) → P3 (T021–T026)** are sequential: they share `columns.ts`, `commands.js`, the probe, and the validator.
- Within P1, T006/T007 (bridge) gate T008 (UI) gate T010 (probe). T009 (D6 repoint) pairs with T007 (the un-defer).
- Polish (T027–T029) after P3 (some doc updates can land per-phase).

## Implementation strategy

- **MVP = Phase 3 (US1)**: One/Two/Three columns + export + oracle — independently demonstrable + feasibility-proven; the prerequisite for P2/P3.
- Land each user story as its own verify → `/code-review` → ff-merge-to-`main` → push cycle.
- The spike (Phase 2) bounds P2/P3 (NOT P1) — it removes the unequal/line-between/column-break unknowns before building them.

## Notes

- Tests = the real-renderer `scripts/paged-columns-probe.js` + the dev-box-only `scripts/oracle/
  validate-columns-win.ps1`. No separate unit-test framework.
- The COM oracle (T011/T018/T024) is dev-box-only, excluded from headless CI.
- If a P2/P3 sub-capability forces a minimal fork accessor, record it in plan.md Complexity Tracking + keep
  it to one documented passthrough; the default is no-fork.
