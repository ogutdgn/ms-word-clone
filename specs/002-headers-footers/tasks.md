# Tasks: Headers & Footers in the paged editor

**Feature**: `specs/002-headers-footers/` | **Branch**: `feature/headers-footers-paged` (off `main`)
**Inputs**: plan.md, research.md, data-model.md, contracts/{bridge-verbs,contextual-tab,oracle-validation}.md, quickstart.md
**Merge mode**: ff-merge to `main` + push per phase (standing preference). `/code-review` (xhigh) each slice.

**Conventions**: probes run in the REAL paged renderer (`electron --user-data-dir=C:/tmp/wc-probe-profile
--disable-http-cache . --probe-out=… --shot-evalfile=…`, never headless). COM oracle is dev-box-only
(sandbox-disabled, PID-safe). Every fidelity claim is read back from real Word. The `WC.PM` bridge is the only
document-write path. Doc model stays page-free. Prefer NO fork edits.

---

## Phase 1: Setup

- [ ] T001 Confirm on `feature/headers-footers-paged` (off `main`); `npm run build` clean (paged default); baseline gates green — `test:pm` 475 / `test:smoke` 9 / `test:roundtrip` 27 / `test:bundle` 4. Record the baseline.
- [ ] T002 Commit the spec-kit planning artifacts (spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md, checklists/, tasks.md, the CLAUDE.md SPECKIT marker, .specify/feature.json) on the feature branch.

---

## Phase 2: Foundational — THE SPIKE (blocks all user stories)

**Goal**: resolve research.md's 3 OPEN questions before any production code. Throwaway probe scripts, deleted before the P1 commit. Records the chosen entry mechanism + single persistence path.

- [ ] T003 Write a throwaway spike probe `scripts/hf-spike-probe.js` (real paged renderer) and a small headered fixture (a `.docx` with primary header+footer, a first-page variant, and a PAGE field — author via Word COM or a minimal OOXML author into `C:/tmp/wc-hf-fixture.docx`).
- [ ] T004 SPIKE Q1 (import→render): open the headered fixture in paged and read the painted `.superdoc-page` header/footer band DOM; confirm the authored text paints on the right pages (and whether import reaches the header/footer registry init). Record pass/fail + the band selector.
- [ ] T005 SPIKE Q2 (entry mechanism — the central unknown): enumerate `WC.presentation` / the inner editor for any accessor reaching `HeaderFooterSessionManager.activateRegion/exitMode`; if none, test whether synthesizing the existing double-click pointer sequence on the painted header band triggers activation (confirm in-app double-click-to-edit works first). Record the chosen mechanism (existing accessor → synthetic-pointer → one minimal fork accessor only if both fail).
- [ ] T006 SPIKE Q3 (bridge↔paint consistency): `WC.PM.setHeaderText('SPIKE')` via the headless story-runtime, then read the painted band; confirm it updates (single persistence path) or note the repaint hook needed. Record the decision into `specs/002-headers-footers/research.md` "OPEN" section (mechanism + persistence path).
- [ ] T007 Delete the throwaway spike scripts; fold the kept fixture-authoring into `scripts/paged-headerfooter-probe.js` if reusable.

**Checkpoint**: the entry mechanism + persistence path are decided and written into research.md. If Q2 forced a minimal fork accessor, record it in plan.md Complexity Tracking.

---

## Phase 3: User Story 1 — Enter, edit, and close header/footer editing (P1) 🎯 MVP

**Goal**: a Word-like on-page header/footer editing experience: enter → edit on page → navigate → close, with the contextual tab; rewire dead handlers; un-defer. **Independent test**: enter header → type → Go to Footer → type → Close; both appear per page, tab shows/hides, focus returns to body, the plain-text modal still works, save→reopen (and Word open) shows the text.

- [ ] T008 [US1] Add bridge verbs `enterHeaderFooter(region)`, `closeHeaderFooter()`, `headerFooterState()` to `src/renderer/bridge/header-footer.ts` using the spike's chosen mechanism; add inactive-bridge no-op fallbacks (parity with `bridge/index.ts:410`).
- [ ] T009 [US1] Merge the 3 new verbs onto `WC.PM` in `src/renderer/bridge/index.ts`; UN-DEFER the delivered commands (goToHeader/goToFooter/closeHeaderFooter) by adding them to `ENGINE_READY` (and reconcile `AREA`/`DEFERRED` at :56,146-150,161) so the `isBlocked` gate no longer toasts them.
- [ ] T010 [P] [US1] Create the owned chrome module `src/renderer/public/js/header-footer-tools-pm.js`: the "Header & Footer Tools" contextual-tab def + `syncContextualTab()` (modeled on `picture-tools-pm.js:22-78` / `table-tools-pm.js`), controls per contracts/contextual-tab.md (Go to Header, Go to Footer, Close, Link to Previous [inert]). Register its `<script>` in the renderer HTML in dependency order.
- [ ] T011 [US1] Drive the contextual tab from `src/renderer/bridge/state-sync.ts`: on `WC.PM.headerFooterState().active` true → `WC.Ribbon.showContextualTab(headerFooterToolsTab)`; false → `hideContextualTab(id)` (mirror the picture/table activation path).
- [ ] T012 [US1] Add the HF Tools contextual-tab controls to the ribbon via the `scripts/gen.js` SOURCE (NOT hand-edited `ribbon-data.js`); regenerate `ribbon-data.js`.
- [ ] T013 [US1] REWIRE `src/renderer/public/js/commands.js:399-408,457`: rewrite `goToHeader`/`goToFooter`/`closeHeaderFooter` to call the new `WC.PM` verbs; DELETE every `E()` (= `WC.Editor`, retired) and `WC.HeaderFooter` (deleted) reference in the header/footer handler block. Keep the Insert→Header/Footer plain-text modal (`headerFooterDialog`, 437-456) working (FR-005).
- [ ] T014 [US1] Extend `scripts/paged-headerfooter-probe.js`: enter header → type → assert painted band per page; Go to Footer → type → assert; assert the contextual tab shows on enter and hides on Close; assert focus returns to body on Close; assert the plain-text modal path still round-trips (no regression). Real renderer; overlay parity where applicable.
- [ ] T015 [US1] Harden `scripts/oracle/validate-headerfooter-win.ps1`: add `OpenAndRepair:=false` (the `validate-open-win.ps1:32` positional form) + self-verify `wdHeaderFooterPrimary=1`; assert opens-without-repair + primary header/footer text reads back equal (author a doc on-page in the probe, save, validate).
- [ ] T016 [US1] VERIFY P1: `npm run build` + 4 core gates green; `probe:headerfooter` green; the COM oracle (primary text, opens-without-repair) green. Run `/code-review` (xhigh) on the slice; FIX every finding; re-verify until clean.
- [ ] T017 [US1] CLOSE-OUT P1: commit (commit-style; explicit `git add`; what/why; no AI trailer); update `docs/plan/layout-engine-runbook.md` + memory; ff-merge `feature/headers-footers-paged` → `main` + push.

**Checkpoint**: P1 is independently shippable — on-page enter/edit/close + the contextual tab work, dead handlers are gone, the delivered commands are un-deferred, and the plain-text path still works.

---

## Phase 4: User Story 2 — Different First Page / Odd & Even (P2)

**Goal**: distinct first-page and odd/even header/footer variants that round-trip to Word. **Independent test**: enable Different First Page, give page 1 a distinct header; save → reopen → Word — first-page header differs and the flag is set; repeat for Odd & Even.

- [ ] T018 [US2] Extend `src/renderer/bridge/header-footer.ts`: `setHeaderText(text, opts?)`/`getHeaderText(opts?)` and footer twins take `opts.variant ∈ {default,first,even}` + `opts.section` (default 0), backward-compatible (no `opts` ⇒ default/section-0); route variants through `resolveHeaderFooterSlotRuntime`.
- [ ] T019 [US2] Add `setDifferentFirstPage(on)` (sectPr `titlePg`), `setDifferentOddEven(on)` (settings `evenAndOddHeaders`), and `getHeaderFooterOptions()` to `src/renderer/bridge/header-footer.ts`; merge onto `WC.PM` in `bridge/index.ts` with no-op fallbacks.
- [ ] T020 [US2] Wire the two contextual-tab toggles in `src/renderer/public/js/header-footer-tools-pm.js` + `commands.js` (`differentFirstPage`/`differentOddEven` → the verbs; checked-state from `getHeaderFooterOptions()`); add the controls via `scripts/gen.js`; un-defer them in `bridge/index.ts`.
- [ ] T021 [US2] Extend `scripts/paged-headerfooter-probe.js`: toggle each option, author distinct first/even content, assert the painted first/even bands + the exported `sectPr titlePg` / `evenAndOddHeaders` + the variant header/footer parts.
- [ ] T022 [US2] Extend `scripts/oracle/validate-headerfooter-win.ps1`: self-verify `wdHeaderFooterFirstPage=2`/`EvenPages=3`; read back `PageSetup.DifferentFirstPageHeaderFooter`, `PageSetup.OddAndEvenPagesHeaderFooter`, `Headers(2)/Headers(3)/Footers(2)/Footers(3).Range.Text`; assert equal to authored.
- [ ] T023 [US2] VERIFY P2: build + 4 gates + `probe:headerfooter` + the COM oracle (flags + variant text) green; `/code-review` xhigh; FIX; re-verify.
- [ ] T024 [US2] CLOSE-OUT P2: commit; update runbook + memory; ff-merge → `main` + push.

**Checkpoint**: first-page and odd/even variants work on-page and round-trip to real Word.

---

## Phase 5: User Story 3 — Page numbers (P3)

**Goal**: real page-number fields in the header/footer. **Independent test**: insert a page number into the footer, each page shows its own number; add a page → numbers update; remove; save → Word shows a live page-number field.

- [ ] T025 [US3] Add `insertPageNumber({position})` (`top`/`bottom`/`current`) to `src/renderer/bridge/header-footer.ts` — insert a REAL OOXML `PAGE` field (`w:fldSimple w:instr=" PAGE "` or `fldChar`+`instrText`), NOT plain text — and `removePageNumbers(opts?)`; merge onto `WC.PM` with no-op fallbacks.
- [ ] T026 [US3] Wire the Page Number flyout in `src/renderer/public/js/header-footer-tools-pm.js` + rewrite `commands.js:457` `H.pageNumber` (DELETE the dead `WC.HeaderFooter.pageNumberMenu`) → `insertPageNumber`/`removePageNumbers`; add the flyout controls via `scripts/gen.js`; un-defer `pageNumber` in `bridge/index.ts`.
- [ ] T027 [US3] Extend `scripts/paged-headerfooter-probe.js`: insert a page number, assert each page paints its own number; add/remove a page and assert numbers update; assert the exported `PAGE` field (not static text); Remove clears it.
- [ ] T028 [US3] Extend `scripts/oracle/validate-headerfooter-win.ps1`: self-verify `wdFieldPage=33`; assert the header/footer `Range.Fields` contains a live `wdFieldPage` field whose result is a number; opens-without-repair.
- [ ] T029 [US3] VERIFY P3: build + 4 gates + `probe:headerfooter` + the COM oracle (live PAGE field) green; `/code-review` xhigh; FIX; re-verify.
- [ ] T030 [US3] CLOSE-OUT P3: commit; update runbook + memory; ff-merge → `main` + push.

**Checkpoint**: page numbers render per page and export as a live Word field.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T031 Grep-confirm NO remaining `E()` (= `WC.Editor`) or `WC.HeaderFooter` references in the header/footer paths (`commands.js` + anywhere); confirm `ribbon-data.js` was regenerated from `scripts/gen.js` (not hand-edited).
- [ ] T032 Final docs reconciliation: update `docs/SCOPE.md` (Header & Footer row: Reconciling → ✅ for the delivered parts), `docs/FEATURES.md`, and `docs/LAYOUT_ENGINE.md` (#8 Headers/footers) to reflect what shipped; keep claims conservative (only what the oracle verified).
- [ ] T033 Confirm `test:roundtrip:paged` includes the extended header/footer read-backs; full gate sweep green on `main` after the last merge.

---

## Dependencies & order

- **T0 spike (T003–T007) blocks everything** — the entry mechanism + persistence path gate P1's handler internals.
- **P1 (T008–T017) → P2 (T018–T024) → P3 (T025–T030)** are sequential: they share `header-footer.ts`, `commands.js`, `header-footer-tools-pm.js`, the probe, and the validator, so they do NOT run in parallel.
- Within P1, **T010 [P]** (new file `header-footer-tools-pm.js`) can be drafted in parallel with the bridge verbs (T008/T009), but T011–T013 depend on both.
- Polish (T031–T033) after P3 (some doc updates can land per-phase).

## Implementation strategy

- **MVP = Phase 3 (US1)**: ship the on-page editing experience + contextual tab + dead-handler reconciliation first; it is independently demonstrable and the prerequisite for P2/P3.
- Land each user story as its own verify → `/code-review` → ff-merge-to-main → push cycle.
- The spike (Phase 2) is mandatory before P1 — it removes the central unknown (the entry mechanism) and prevents building on an unverified assumption.

## Notes

- Tests for this feature = the extended `scripts/paged-headerfooter-probe.js` (real-renderer regression) + the
  extended `scripts/oracle/validate-headerfooter-win.ps1` (real-Word read-back). No separate unit-test framework.
- The COM oracle (T015/T022/T028) is dev-box-only and excluded from headless CI.
- If the spike (T005) forces a minimal fork accessor, record it in plan.md Complexity Tracking and keep it to one
  documented passthrough.
