---
description: "Task list — Milestone 4d (notes-area disable + header-footer test)"
---

# Tasks: Paged Render Migration — **Milestone 4d** (notes-area disable + header-footer test)

**Input**: Design documents from `specs/001-paged-render-migration/`
**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/notes-headerfooter.md](contracts/notes-headerfooter.md) · [quickstart.md](quickstart.md)
**Sequencing authority**: [../../docs/plan/layout-engine-runbook.md](../../docs/plan/layout-engine-runbook.md)

## Scope & format
- **M4d ONLY** — the LAST M4 sub-slice (the LIGHT one): **DISABLE the notes-area overlay in paged** + **header-footer
  integration TEST** (zero production change to header-footer.ts). M5/M6 out of scope. spec **US2 / FR-005**.
- Overlay **byte-identical** (every change paged-gated on `window.__WC_LAYOUT_MODE === 'paged'`); **no fork edits**.
  All tasks Setup/Foundational/Verification/Polish → **no `[US#]` label**.
- `[P]` = parallelizable (different file, no incomplete-task dependency).

---

## Phase 1: Setup
- [ ] T001 Confirm on slice branch `slice/m4d-notes-hf` (off `layout-engine`; NEVER off/onto `main`). Run `git branch --show-current` before any edit. (M4c specs already archived to `specs/001-paged-render-migration/milestones/m4c/`.)

---

## Phase 2: Probe-FIRST spike (PIN the unknowns before wiring refShowNotes + the probes)
- [ ] T002 Write a throwaway `scripts/paged-notes-spike.js` (deleted/folded into the real probes at T007/T008). Build `WC_LAYOUT=paged npm run build` + run via `electron . --probe-out=/tmp/wc-notes-spike.json --shot-evalfile=scripts/paged-notes-spike.js`. PIN, with evidence: **(i)** the `WC.PM` verb(s) to INSERT a footnote AND an endnote (grep `src/renderer/bridge/references.ts` for `refInsertFootnote`/`refInsertEndnote`/similar; confirm they exist on `WC.PM`); **(ii)** the PE-PAINTED per-page footnote/endnote DOM selector (insert a footnote in paged, dump the `.superdoc-page` subtree — find the element class/attr PE uses for the painted note body, e.g. a footnote/note container — so `refShowNotes` + the probe can target it); **(iii)** whether `WC.presentation` (or `WC.editor`) exposes the `HeaderFooterSessionManager` (activateRegion/focusShortcut) — if NOT, note the smallest test-only accessor hook to add. **Record (i)/(ii)/(iii) in the task notes** — they steer T004 (refShowNotes selector), T007 (notes probe), T008 (header-footer interop). *(depends on T001)*

**Checkpoint**: the footnote-insert verb, the painted-footnote selector, and the PE-session accessor are pinned.

---

## Phase 3: Production — notes-area disable + Show-Notes (paged-gated; overlay byte-identical)
- [ ] T003 In `src/renderer/bridge/notes-area.ts`, add the 2-point paged gate (`window.__WC_LAYOUT_MODE === 'paged'`): **(1)** in `renderInner()` right after `let region = document.getElementById('pm-notes-area')` (~line 168): `if (window.__WC_LAYOUT_MODE === 'paged') { if (region) { region.innerHTML = ''; region.style.display = 'none' } lastSig = ''; return }`; **(2)** in `installNotesArea()` (~291-303) keep the `WC.NotesArea` facade (`refresh`/`render`/`showNotes`) DEFINED but wrap `ed.on?.('transaction', schedule); schedule()` (lines ~301-302) in `if (window.__WC_LAYOUT_MODE !== 'paged') { ... }` so the per-keystroke driver is NOT installed in paged. Overlay takes neither branch → byte-identical. *(depends on T001)*
- [ ] T004 In `src/renderer/bridge/references.ts` `refShowNotes()` (~283-292): add a paged branch (gated on `window.__WC_LAYOUT_MODE === 'paged'`) that finds the FIRST PE-painted footnote element (the selector pinned in T002), `scrollIntoView({block:'nearest'})`, returns `true`; returns `false` (documented inert) if none is painted. **Overlay path UNCHANGED** (routes to `WC.NotesArea.showNotes()`). *(depends on T002, T003)*

**Checkpoint**: in paged, `#pm-notes-area` never mounts/shows + no transaction driver fires; footnotes/endnotes render per-page via PE; Show Notes scrolls to the painted footnote. Overlay byte-identical. (header-footer.ts UNCHANGED.)

---

## Phase 4: Verification artifacts (standalone paged probes — NOT new test-suite-pm.js cases)
- [ ] T005 [P] Create `scripts/paged-notes-probe.js` (mode-aware `{summary,results[]}`; fold in the useful T002 spike, then delete `paged-notes-spike.js`). **paged**: insert a footnote → (a) PE PAINTED a per-page footnote body (the T002 selector — so "disabled" ≠ "no notes"), (b) `#pm-notes-area` is absent OR `display:none`, (c) the transaction driver did NOT re-render it (assert no `#pm-notes-area` content after a doc transaction / `WC.NotesArea.refresh()` is a no-op in paged), (d) endnotes ALSO disabled (insert an endnote → still no region), (e) `refShowNotes()` scrolls the painted footnote into view (returns true). **overlay**: `#pm-notes-area` mounts + renders the editable Footnotes/Endnotes region (parity). Honest fail-returns (`return 'msg'`); no bug-hiding slack. *(depends on T003, T004)*
- [ ] T006 [P] Create `scripts/paged-headerfooter-probe.js` (mode-aware). **paged parity** (mirror the overlay test `[9]`, test-suite-pm.js:4853-4900, incl. its `newBlank` teardown — header/footer is GLOBAL converter state): `newBlank`; no pre-existing `w:headerReference`; `setHeaderText('HdrProbe')`/`setFooterText('FtrProbe')`; `get*` round-trip; `exportDocxBytes()` → assert `word/headerN.xml <w:hdr>` + `sectPr <w:headerReference r:id>` + the `.rels` relationship + a REPLACE (`HdrTwo`, no stale `HdrProbe`). **interop**: programmatically open a PE header session (`HeaderFooterSessionManager` via the T002 accessor; NO synthetic clicks), then `WC.PM.get/setHeaderText` routes through the live session editor + survives exit/commit. **overlay parity**: the same set/get + export round-trip. *(depends on T002)*
- [ ] T007 Add `probe:notes` (`electron . --probe-out=/tmp/wc-notes.json --shot-evalfile=scripts/paged-notes-probe.js`) + `probe:headerfooter` (`… scripts/paged-headerfooter-probe.js`) to `package.json`. *(depends on T005, T006)*

---

## Phase 5: VERIFY loop + close-out
- [ ] T008 `npm run build` (default/overlay), then **smoke 9 / roundtrip 27 / bundle 4** (test:pm — note the pre-existing 268/475 early-abort; paged behavior is PROBE-gated, so confirm the suite is no WORSE than baseline 268, not a new regression). *(depends on T003–T004)*
- [ ] T009 `WC_LAYOUT=paged npm run build` + run `probe:notes` and `probe:headerfooter` → all-PASS (paged disabled + PE-painted + Show-Notes scroll; header/footer parity export + interop). Then default build + run both again → **overlay-parity rows PASS** (byte-identical: `#pm-notes-area` mounts in overlay; header/footer round-trips). *(depends on T005–T007, T008)*
- [ ] T010 Run **`/code-review`** on the slice diff (adversarial; scrutinize the paged install leaks NO transaction listener, the `WC.NotesArea` facade stays defined, overlay byte-identity, the probes for false-confidence). FIX every finding, then re-run T008–T009 until clean. *(depends on T008–T009)*
- [ ] T011 Commit per `.claude/skills/commit-style` (explicit `git add <path>`; what/why body; **no AI trailer**). Update the runbook **Current Status** (M4d done → **M4 COMPLETE**; NEXT = M5) + memory. **At CHECK-IN, only after the user is satisfied:** leave the paged app open for a manual footnote/header spot-check, then ff-merge `slice/m4d-notes-hf` into `layout-engine`. *(depends on T010)*

---

## Dependencies & execution order
- **T001 → all. T002 (spike) → T004/T005/T006.** **T003 → T004 → T005.** **T005/T006 → T007.** **Verify**: T008 → T009 → T010 → T011.
- COM-oracle: **OPTIONAL** for M4d (header/footer export is doc-model/converter, mode-independent — already validated by overlay test `[9]`).

## Parallel opportunities
- T005 ∥ T006 (different probe files). T003 ∥ T006 (notes-area vs the header-footer probe — different files).

## MVP / increment
"Done" = T008–T009 green + T010 clean + T011 merged → STOP. **M4 is COMPLETE** → return to the runbook for **M5** (paged `.docx` export COM-oracle parity) + M6 (glyph-metric tolerance).

## Notes
- Keep the model **page-free**; keep the overlay default **byte-identical** (paged-gated; the probe overlay rows are the gate).
- `notes-area.ts`/`references.ts` are hand-authored owned modules (NOT generated) — safe to edit. **No fork edits**; `header-footer.ts` UNCHANGED.
- Real-app footnote-editing-in-paged is PE-native (double-click) — the probe asserts the PAINTED footnote exists (computer-use is blocked for the dev build); `refShowNotes` only scrolls.
