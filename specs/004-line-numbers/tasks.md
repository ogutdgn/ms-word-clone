# Tasks: Line Numbers

**Feature**: `specs/004-line-numbers/` | **Branch**: `feature/line-numbers-paged` (off `main`)
**Inputs**: plan.md, research.md, data-model.md, contracts/{bridge-verbs,oracle-validation}.md, quickstart.md
**Merge mode**: ff-merge to `main` + push per phase. `/code-review` each slice.

**Conventions**: probes run in the REAL paged renderer (isolated `C:/tmp/wc-probe-profile`). COM oracle is
dev-box-only (sandbox-disabled, PID-safe). Every fidelity claim is read back from real Word. The `WC.PM`
bridge is the only document-write path. NO fork edits.

---

## Phase 1: Setup

- [ ] T001 Confirm on `feature/line-numbers-paged` (off `main`); `npm run build` clean (paged default); baseline gates green — `test:pm` 475 / `test:smoke` 9 / `test:roundtrip` 27 / `test:bundle` 4. Record the baseline.
- [ ] T002 Commit the spec-kit planning artifacts (spec/plan/research/data-model/contracts/quickstart/checklists/tasks + `.specify/feature.json`) on the feature branch.

---

## Phase 2: Foundational — THE SPIKE (bounds P3 only; P1+P2 are proven)

- [ ] T003 SPIKE Q1 (per-paragraph `w:suppressLineNumbers`): in a throwaway probe, find a NO-FORK way to set the current paragraph's `w:suppressLineNumbers` (a fork paragraph command / `editor.doc` paragraph-attr API / an owned `pPr` write like the 003 `bodySectPr` write); confirm the export carries it. Record the mechanism (or honest-toast gap) into research.md. Delete the spike script.

**Checkpoint**: the P3 suppress mechanism is decided. P1 (model/export, feasibility-proven) + P2 (owned overlay, comments/ink pattern) need no spike.

---

## Phase 3: User Story 1 — Mode on/off (P1) 🎯 MVP

**Goal**: None / Continuous / Restart Each Page / Restart Each Section export `w:lnNumType` + open in Word with the matching `LineNumbering`. **Independent test**: Continuous → save → Word `Active`+`RestartMode=Continuous`; None → inactive.

- [ ] T004 [US1] Create `src/renderer/bridge/line-numbers.ts`: `setLineNumbers({mode,countBy?,start?,distance?})` → `editor.doc.sections.setLineNumbering({enabled:mode!=='none', restart:mode, countBy, start, distance(in), target})` (markDirty; NO_OP=success; mode:'none' ⇒ enabled:false); `getLineNumbers()` → `sections.get().lineNumbering`. Mirror `bridge/columns.ts`.
- [ ] T005 [US1] Merge onto `WC.PM` in `src/renderer/bridge/index.ts` (+ no-op fallbacks); UN-DEFER `lineNumbers` in `ENGINE_READY`; **repoint the three D6 guards** (`[0a]` run + `[0a]` dropdown + `[11]`) off `lineNumbers` to a still-deferred layout-page rep (e.g. `hyphenation`) — the 003 cascade lesson.
- [ ] T006 [US1] REWIRE `src/renderer/public/js/commands.js` `H.lineNumbers` (the Line Numbers dropdown) OFF the retired `E()`: None/Continuous/Restart-Each-Page/Restart-Each-Section → `WC.PM.setLineNumbers({mode})`; checked-state from `getLineNumbers()`. Keep "Line Numbering Options" as a P3 placeholder; "Suppress for Current Paragraph" → P3 (honest no-op/toast until then). DELETE every `E()` ref in the handler.
- [ ] T007 [US1] Create `scripts/paged-linenumbers-probe.js` (real renderer): each mode → assert the export `sectPr` `<w:lnNumType>` carries the right `w:restart` (continuous/newPage/newSection) + `getLineNumbers()` round-trips + None drops `w:lnNumType`. Add a `probe:linenumbers` npm script.
- [ ] T008 [US1] Create `scripts/oracle/validate-linenumbers-win.ps1` (PID-safe, OpenAndRepair:=false, enum self-verify 0/1/2): read `PageSetup.LineNumbering.Active`/`.RestartMode`; result `{ok, openedWithoutRepair, enumCheck, lineNumbersActive, restartMode}`. Create `scripts/paged-export-linenumbers-probe.js` (author a Continuous-line-numbers doc, save `C:/tmp/wc-<mode>-linenumbers.docx`).
- [ ] T009 [US1] Wire the line-numbers doc + read-back into `scripts/test-roundtrip-paged.js` (probe run + DOCS entry + a C-section: validate-open no-repair + `Active` + `RestartMode`==Continuous).
- [ ] T010 [US1] VERIFY P1: build + 4 gates + `probe:linenumbers` + the COM oracle (Active + RestartMode) green. `/code-review`; FIX; re-verify.
- [ ] T011 [US1] CLOSE-OUT P1: commit; update `docs/plan/layout-engine-runbook.md` + memory; ff-merge → `main` + push.

**Checkpoint**: line-number modes export + read back in real Word; `lineNumbers` un-deferred.

---

## Phase 4: User Story 2 — In-app margin render (P2)

**Goal**: an owned overlay shows the numbers beside the painted lines, counting per mode/countBy/start. **Independent test**: Continuous → 1,2,3…; Restart-Each-Page → page 2 restarts at 1; count-by 5 → 5,10,15.

- [ ] T012 [US2] Create `src/renderer/public/js/line-numbers-overlay.js` (owned, mirrors comments-ui/ink overlay): read `.superdoc-page .superdoc-line` rects + `getLineNumbers()`; draw a number in the left margin beside each counted line (continuous, or reset per `.superdoc-page` for newPage); show every `countBy`-th starting at `start`; recompute on `wc:paged-relayout` + zoom/scroll; paged-only; hide when off/None. Register its `<script>` in `index.html`.
- [ ] T013 [US2] Drive the overlay from line-number state changes — after `setLineNumbers` (and on relayout/open), refresh the overlay (a `wc:linenumbers-changed` event or a refresh call from `commands.js`/`state-sync`).
- [ ] T014 [US2] Extend `scripts/paged-linenumbers-probe.js` (paged-only): assert the overlay paints ≥N number elements beside the lines for Continuous; restart-per-page resets on page 2; count-by 5 shows only 5/10/15; None ⇒ 0 numbers.
- [ ] T015 [US2] VERIFY P2: build + 4 gates + `probe:linenumbers` (paged overlay + overlay-mode parity) green; `/code-review`; FIX.
- [ ] T016 [US2] CLOSE-OUT P2: commit; update runbook + memory; ff-merge → `main` + push.

**Checkpoint**: line numbers render in the margin in-app, matching the export.

---

## Phase 5: User Story 3 — Options dialog + Suppress for Current Paragraph (P3)

**Goal**: start/count-by/distance + per-paragraph suppress. **Independent test**: start 5/count-by 2 → Word StartingNumber 5/CountBy 2; suppress a paragraph → `w:suppressLineNumbers` + Word excludes it.

- [ ] T017 [US3] Add `suppressLineNumbers(on?)` to `src/renderer/bridge/line-numbers.ts` (the spike-chosen no-fork `pPr/w:suppressLineNumbers` write); merge onto `WC.PM` + no-op fallback.
- [ ] T018 [US3] Add the "Line Numbering Options" dialog in `commands.js` (`WC.dialog`: start-at / count-by / from-text distance / numbering mode) → `WC.PM.setLineNumbers(...)`; wire "Suppress for Current Paragraph" → `WC.PM.suppressLineNumbers()`. Seed from `getLineNumbers()`. DELETE the remaining `E()` refs in the lineNumbers handler.
- [ ] T019 [US3] Extend `scripts/paged-linenumbers-probe.js`: start 5/count-by 2 → export `w:start="5" w:countBy="2"`; suppress a paragraph → export `<w:suppressLineNumbers/>` in its `pPr`; overlay reflects count-by 2 + skips the suppressed paragraph.
- [ ] T020 [US3] Extend `scripts/oracle/validate-linenumbers-win.ps1`: read `.CountBy`/`.StartingNumber`/`.DistanceFromText` + the suppressed paragraph's flag; extend the roundtrip C-section.
- [ ] T021 [US3] VERIFY P3: build + 4 gates + `probe:linenumbers` + the COM oracle green; `/code-review`; FIX.
- [ ] T022 [US3] CLOSE-OUT P3: commit; update runbook + memory; ff-merge → `main` + push.

**Checkpoint**: options + per-paragraph suppress work + round-trip to real Word.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T023 Grep-confirm NO `E()` (= `WC.Editor`) remains in the `H.lineNumbers` path; confirm `ribbon-data.js` was NOT hand-edited.
- [ ] T024 Final docs reconciliation: `docs/SCOPE.md` (Line Numbers row → ✅), `docs/FEATURES.md`, `docs/LAYOUT_ENGINE.md`. Conservative claims (only what the oracle verified).
- [ ] T025 Confirm `test:roundtrip:paged` includes the line-numbers read-backs; full gate sweep green on `main`.

---

## Dependencies & order

- **T0 spike (T003) bounds P3 only** — P1+P2 are proven (feasibility probe + the comments/ink overlay pattern).
- **P1 (T004–T011) → P2 (T012–T016) → P3 (T017–T022)** are sequential (shared `line-numbers.ts`, the overlay, `commands.js`, the probe, the validator).
- Within P1, T004/T005 (bridge+un-defer) gate T006 (UI) gate T007 (probe); T005's D6 repoint pairs with the un-defer.
- Polish (T023–T025) after P3.

## Implementation strategy

- **MVP = Phase 3 (US1)** — modes + export + oracle (Word-correct; the prerequisite). Feasibility-proven.
- Land each user story as its own verify → `/code-review` → ff-merge-to-`main` → push cycle.
- The spike (Phase 2) bounds ONLY P3's per-paragraph suppress.

## Notes

- Tests = the real-renderer `scripts/paged-linenumbers-probe.js` + the dev-box-only `validate-linenumbers-win.ps1`.
- The COM oracle (T008/T020) is dev-box-only, excluded from headless CI.
- **D6 repoint reminder:** un-deferring `lineNumbers` requires repointing the three D6 guards (`[0a]`×2 + `[11]`) to another still-deferred layout-page command (e.g. `hyphenation`) — a missed one cascades (003 lesson).
