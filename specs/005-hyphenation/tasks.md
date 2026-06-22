# Tasks: Hyphenation

**Feature**: `specs/005-hyphenation/` | **Branch**: `005-hyphenation` (off `general-done`)
**Inputs**: plan.md, research.md, data-model.md, contracts/{bridge-verbs,oracle-validation}.md, quickstart.md
**Merge mode**: ff-merge into `general-done` per phase (NOT main). `/code-review` each slice.

**Conventions**: probes run in the REAL paged renderer (isolated `C:/tmp/wc-probe-profile`). COM oracle is
dev-box-only (sandbox-disabled, PID-safe). Every fidelity claim is read back from real Word. The `WC.PM`
bridge is the only document-write path. NO fork edits.

---

## Phase 1: Setup

- [x] T001 Confirm on `005-hyphenation` (off `general-done`); `npm run build` clean (paged default); baseline gates green — `test:pm` overlay 475 / `test:smoke` 9 / `test:roundtrip` 27 / `test:bundle` 4. Record the baseline.
- [x] T002 Spec-kit planning artifacts committed on the feature branch (done: `f704d6f`).

---

## Phase 2: Foundational — THE SPIKE (bounds the whole feature)

- [x] T003 SPIKE (research.md Decision 1): in a throwaway probe, confirm a NO-FORK owned upsert into
  `editor.converter.convertedXml['word/settings.xml']` of `<w:autoHyphenation w:val="true"/>` (find-or-create the
  `w:settings` root, mirror `document-settings.ts`'s upsert) survives `editor.exportDocx()` (appears in the
  exported `word/settings.xml`) AND a re-import reads it back. If unreachable no-fork → record + decide a
  documented last-resort accessor with the user (Constitution Check exception). Also spike the P3 optional-hyphen
  (U+00AD) write. Record the mechanism into research.md; delete the spike script.

**Checkpoint**: the settings-write mechanism is decided. If it needs a fork edit, STOP and ask the user.

---

## Phase 3: User Story 1 — None / Automatic (P1) 🎯 MVP

**Goal**: None / Automatic export `w:autoHyphenation` + open in Word with the matching `AutoHyphenation`.
**Independent test**: Automatic → save → Word `AutoHyphenation` true; None → false.

- [x] T004 [US1] Create `src/renderer/bridge/hyphenation.ts`: `setHyphenation({mode:'none'|'auto', zone?, consecutiveLimit?, hyphenateCaps?})` → owned upsert into the settings part (`w:autoHyphenation` true/false; zone/limit/caps when provided; CAPS inverted vs `w:doNotHyphenateCaps`); `getHyphenation()` → read the settings part (+ `zoneExplicit`/`limitExplicit`). Mirror `bridge/columns.ts`'s owned write.
- [x] T005 [US1] Merge onto `WC.PM` in `src/renderer/bridge/index.ts` (+ no-op fallbacks); UN-DEFER `hyphenation` in `ENGINE_READY`; **repoint the three D6 guards** (`[0a]` run + `[0a]` dropdown + `[11]`) off `hyphenation` to a still-deferred layout-page/arrange rep (e.g. `position`) — the cascade lesson.
- [x] T006 [US1] REWIRE `src/renderer/public/js/commands.js` `H.hyphenation` OFF the retired `WC.Layout`/`E()`: None/Automatic → `WC.PM.setHyphenation({mode})`; checked-state from `getHyphenation()`. Keep "Hyphenation Options" as a P2 placeholder; "Manual" → P3 (honest toast until then). DELETE the `WC.Layout`/`E()` refs + the legacy `manualHyphenate()` DOM hack.
- [x] T007 [US1] Create `scripts/paged-hyphenation-probe.js` (real renderer): each mode → assert the export `word/settings.xml` carries `<w:autoHyphenation w:val="true|false">` + `getHyphenation()` round-trips. Add a `probe:hyphenation` npm script.
- [x] T008 [US1] Create `scripts/oracle/validate-hyphenation-win.ps1` (PID-safe, OpenAndRepair:=false): read `ActiveDocument.AutoHyphenation`; result `{ok, openedWithoutRepair, autoHyphenation}`. Create `scripts/paged-export-hyphenation-probe.js` (author an Automatic doc, save `C:/tmp/wc-<mode>-hyphenation.docx`).
- [x] T009 [US1] Wire the hyphenation doc + read-back into `scripts/test-roundtrip-paged.js` (probe run + DOCS entry + a C7 block: validate-open no-repair + `AutoHyphenation` true).
- [x] T010 [US1] VERIFY P1: build + 4 gates + `probe:hyphenation` + the COM oracle green. `/code-review`; FIX; re-verify.
- [x] T011 [US1] CLOSE-OUT P1: commit; ff-merge `005-hyphenation` → `general-done` is at the END (T022); within the feature, P1/P2/P3 commit on the branch.

**Checkpoint**: None/Automatic export + read back in real Word; `hyphenation` un-deferred.

---

## Phase 4: User Story 2 — Hyphenation Options (P2)

**Goal**: zone / consecutive-limit / hyphenate-CAPS export + read back in Word. **Independent test**: zone 0.25"/limit 2/CAPS off → Word HyphenationZone 18pt / ConsecutiveHyphensLimit 2 / HyphenateCaps false.

- [x] T012 [US2] Extend `setHyphenation`/`getHyphenation` for zone (inches→twips), consecutiveLimit (int≥0), hyphenateCaps (inverted ↔ `w:doNotHyphenateCaps`); each written only when provided; clean-clear on toggle (the 004 carryover lesson).
- [x] T013 [US2] Add the "Hyphenation Options" dialog in `commands.js` (`WC.dialog`: zone / consecutive-limit / hyphenate-CAPS) → `WC.PM.setHyphenation(...)`; seed from `getHyphenation()` (Auto vs explicit via `*Explicit`).
- [x] T014 [US2] Extend `scripts/paged-hyphenation-probe.js`: zone 0.25"→`w:hyphenationZone="360"`; limit 2→`w:consecutiveHyphenLimit="2"`; CAPS off→`<w:doNotHyphenateCaps/>` present, on→absent; carryover (CAPS on removes a prior element).
- [x] T015 [US2] Extend `validate-hyphenation-win.ps1` (`.HyphenationZone`/`.ConsecutiveHyphensLimit`/`.HyphenateCaps`) + the export probe + the C7 block.
- [x] T016 [US2] VERIFY P2: build + 4 gates + `probe:hyphenation` + the COM oracle green; `/code-review`; FIX.

**Checkpoint**: options export + read back in real Word.

---

## Phase 5: User Story 3 — Manual (P3)

**Goal**: optional-hyphen insertion into long words. **Independent test**: Manual → long words carry optional hyphens; the doc opens in Word without repair.

- [x] T017 [US3] Add `applyManualHyphenation()` to `bridge/hyphenation.ts` (the spike-chosen no-fork U+00AD optional-hyphen write into long body words); merge onto `WC.PM` + no-op fallback.
- [x] T018 [US3] Wire "Manual" in `commands.js` `H.hyphenation` → `WC.PM.applyManualHyphenation()` + an honest toast of what it did. DELETE the remaining legacy refs in the handler.
- [x] T019 [US3] Extend `scripts/paged-hyphenation-probe.js`: Manual inserts optional hyphens that survive export; extend the oracle (the marked word carries a soft hyphen) + the C7 block.
- [x] T020 [US3] VERIFY P3: build + 4 gates + `probe:hyphenation` + the COM oracle green; `/code-review`; FIX.

**Checkpoint**: Manual best-effort works + round-trips.

---

## Phase 6: Polish & Close-out

- [x] T021 Grep-confirm NO `WC.Layout`/`E()` remains in the `H.hyphenation` path; confirm `ribbon-data.js` was NOT hand-edited.
- [x] T022 Docs reconciliation: `docs/SCOPE.md` (Hyphenation row → ✅), `docs/FEATURES.md`. Conservative claims (only what the oracle verified). Then **ff-merge `005-hyphenation` → `general-done`** + checkpoint (runbook + docs/plan + memory + tick this tasks.md). Do NOT merge into main.

---

## Dependencies & order

- **T0 spike (T003) bounds the feature** — if the settings write isn't no-fork, STOP (Constitution Check exception is the user's call).
- **P1 (T004–T011) → P2 (T012–T016) → P3 (T017–T020)** are sequential (shared `hyphenation.ts`, `commands.js`, the probe, the validator).
- Within P1, T004/T005 gate T006 gate T007; T005's D6 repoint pairs with the un-defer.
- Polish (T021–T022) after P3; the ff-merge into `general-done` is the very last step.

## Notes

- Tests = `scripts/paged-hyphenation-probe.js` + the dev-box-only `validate-hyphenation-win.ps1`.
- **D6 repoint reminder:** un-deferring `hyphenation` requires repointing the three D6 guards to another
  still-deferred layout command (e.g. `position`) — a missed one cascades (003 lesson).
- In-app mid-word hyphenation render is OUT OF SCOPE (known-limitation); export + Word read-back is the guarantee.
