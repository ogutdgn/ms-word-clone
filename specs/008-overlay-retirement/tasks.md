# Tasks: Overlay Retirement (008) — STAGED

**Feature**: `specs/008-overlay-retirement/` | **Branch**: `008-overlay-retirement` (off `general-done`)
**Plan**: [deletion-plan.md](deletion-plan.md) (reconciled inventory + the 3 resolved decisions)
**Merge mode**: ff-merge into `general-done` (NOT main). `/code-review` the full diff before merge.
**Decisions**: STAGED execution · DELETE the 59 overlay-only tests · CONVERT test:bundle to a size ceiling.
**Constraints**: NO fork edits (`src/renderer/core/superdoc-fork/**`); keep PAGED arms, delete OVERLAY arms;
re-run gates after each stage. Overlay stays recoverable in git history.

---

## Phase 0: Setup (DONE)
- [x] T001 Branch `008-overlay-retirement` off `general-done`; feature.json → this dir.
- [x] T002 5-agent read-only mapping sweep + verification → `deletion-plan.md`. User HARD-STOP approval (staged).

## Phase 1 (P1): Dead-engine deletion — then re-run ALL gates [REVIEWABLE STAGE]
- [x] T003 Delete `src/renderer/pagination/pagination.ts` + its import/usage in `create-editor.ts` (the
  `constructPmEditor` overlay path: the `Pagination` import + extension entry).
- [x] T004 Delete `src/renderer/bridge/notes-area.ts` + its `installNotesArea()` call site in `index.ts`
  (the PE paints footnotes in paged; the overlay region was already disabled in paged). Keep `WC.NotesArea`
  references in `references.ts` resolved (the paged `refShowNotes` stays — see P2).
- [x] T005 `main.ts` → paged unconditional: drop the `localStorage WC_LAYOUT || __WC_LAYOUT_DEFAULT__ || 'paged'`
  resolution → `__WC_LAYOUT_MODE = 'paged'`; delete the overlay `else` arms (the `createPmEditor` branch + the
  `installBridge` overlay arm). Remove `constructPmEditor` from `create-editor.ts` (keep `constructPresentationEditor`).
- [x] T006 `electron.vite.config.ts` → remove the `__WC_LAYOUT_DEFAULT__` define.
- [x] T007 BUILD (paged) + re-run ALL gates: `npm run build` + `test:pm:paged` 475 + `test:smoke` 9 +
  `test:roundtrip` 27 + `test:bundle` (still old gate here) + the key paged probes (opennew/coords/statusbar/
  notes). FIX any breakage. **STAGE CHECKPOINT** — commit P1.

## Phase 2 (P2): Branch simplification (delete overlay arms) [REVIEWABLE STAGE]
- [x] T008 `src/renderer/layout/coordinate-adapter.ts` — delete the overlay arms of `clientToPos` / `getPages` /
  `nodeBoxFor` / `clientToOverlayLocalPt` (always paged `.superdoc-page`).
- [x] T009 `src/renderer/bridge/index.ts` — `replaceEditor` → paged-only (**always** `replaceFile`); remove the
  `__repaginate` calls (setZoom/setView) + overlay-only `__WC_LAYOUT_MODE` ENGINE_READY gates. **VERIFY the
  007 `[8]`+`[11]` known-gap is now FIXED** (the openDocx teardown was the overlay arm) — if so, move those 3
  out of PAGED_KNOWN_GAP to genuine passes.
- [x] T010 `focus.ts` (delete the overlay margin-click handler), `references.ts` (keep paged refShowNotes, delete
  the `WC.NotesArea` overlay arm), `ink-overlay.ts` (keep paged multi-page anchoring, delete the overlay arms +
  `isPaged()` gate), `header-footer.ts` (drop the paged guard). Grep src/renderer/bridge + public/js for residual
  `__WC_LAYOUT_MODE`/`'overlay'` and clear the overlay arms.
- [x] T011 BUILD + re-run ALL gates + probes (esp. opennew/pointer/ink/notes/headerfooter). FIX. **STAGE CHECKPOINT** — commit P2.

## Phase 3 (P3): Test-infra + CSS + probes [REVIEWABLE STAGE]
- [x] T012 `scripts/test-suite-pm.js` — DELETE the 59 `PAGED_SKIP` tests (and the PAGED_SKIP map + the skip branch
  in `t()` if PAGED_SKIP becomes empty; KEEP PAGED_KNOWN_GAP + the `[0a]` port). Since overlay is gone, the
  mode-record can simplify (always paged) — but keep `summary.mode`/`pagedKnownGaps`. Write
  `specs/008-overlay-retirement/test-mapping.md` (each deleted test → the covering probe).
- [x] T013 `scripts/run-pm-overlay.js` DELETE; `test:pm` → `node scripts/run-pm-paged.js` (asserts mode=paged).
  Delete `test:pm:paged` alias (test:pm IS paged now) OR keep both pointing at run-pm-paged. `scripts/paged-overlays-probe.js`
  DELETE + the `probe:overlays` script.
- [x] T014 `scripts/test-roundtrip-paged.js` — delete the paged-vs-overlay TIER-1 byte-equality arm + the
  `build('overlay')` leg; KEEP the Word-COM validate-open + read-backs. Update `test:roundtrip:paged`.
- [x] T015 `scripts/check-overlay-bundle.js` → CONVERT to a generic renderer entry-size ceiling (mode-agnostic);
  keep `test:bundle` pointing at it.
- [x] T016 The per-feature probes' overlay-parity arms (coords/headerfooter/columns/linenumbers/hyphenation) →
  simplify to paged-only (delete the `build('overlay')` parity leg).
- [x] T017 CSS (`editor.css`) — delete the overlay pagination seam rules `.pm-page-spacer`/`.pm-gap-band` +
  residual `.wc-page-gap`/`.wc-gap-band`; index.html overlay script/style tags. Drop `#pm-notes-area` CSS with notes-area.
- [x] T018 BUILD + re-run the FULL adapted gate set. FIX. **STAGE CHECKPOINT** — commit P3.

## Phase 4 (P4): Docs reconcile + close-out
- [x] T019 Reconcile docs: CLAUDE.md (TL;DR + the gate command), AGENTS.md, docs/PAGINATION.md (delete/archive),
  docs/ARCHITECTURE.md, docs/LAYOUT_ENGINE.md, docs/BUILD_AND_RUN.md, docs/TESTING.md, docs/SCOPE.md,
  docs/FEATURES.md, the plan docs — overlay retired; paged is the sole engine; the gate command is paged-only.
- [x] T020 `/code-review` the FULL deletion diff (general-done..008) — focus: a deleted overlay arm that took a
  shared/paged dependency with it; the [8]/[11] synergy; no fork edit; gates honest. FIX confirmed findings.
- [x] T021 Final gates green; ff-merge `008-overlay-retirement` → `general-done`; plan-tracking checkpoint
  (note the [8]/[11] synergy outcome). **Unblocks the loop tail (009–012).**

---
## Notes
- The agents' arm-labels are NOT authoritative — keep PAGED, delete OVERLAY, verified by re-running gates per stage.
- `line-numbers-overlay.ts` is the PAGED line-number renderer — PRESERVE (despite the name).
- Watch the `replaceEditor` → `replaceFile` change for the 007 `[8]`/`[11]` known-gap fix (T009).
