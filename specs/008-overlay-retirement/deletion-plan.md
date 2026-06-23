# 008 Overlay Retirement — Reconciled Deletion Plan (HARD-STOP review)

**Branch**: `008-overlay-retirement` (off `general-done`). Built from a 5-agent read-only mapping sweep +
direct verification. **This is the plan presented to the user before ANY destructive step.**

## What the overlay engine IS (verified)
The legacy continuous-flow renderer reachable only via `WC_LAYOUT=overlay`. `constructPmEditor` (overlay) adds the
owned `Pagination` decoration-paginator (`create-editor.ts:55`); `constructPresentationEditor` (paged) **omits it**
(`:96` — "NOT Pagination — PE is the sole paginator"). Paged (the SuperDoc PresentationEditor) is the shipping
default and does NOT depend on any overlay code.

## DELETE (files removed entirely)
- `src/renderer/pagination/pagination.ts` (709 lines — the overlay decoration paginator; verified overlay-only).
- `src/renderer/bridge/notes-area.ts` (the overlay `#pm-notes-area` region; the PE paints footnotes per-page in
  paged, M4d — the overlay was already disabled in paged). Remove its `installNotesArea()` call in index.ts.
- `scripts/run-pm-overlay.js` (no overlay engine to gate).
- `scripts/paged-overlays-probe.js` (validates the overlay-retarget helpers `posToOverlayLocalY/Rect` — vestigial).
- `scripts/check-overlay-bundle.js` — **DECISION 3** (moot vs convert to a generic size ceiling).

## SIMPLIFY (delete the OVERLAY arm, inline the PAGED arm — paged stays)
- `src/renderer/main.ts` — drop the `localStorage WC_LAYOUT || __WC_LAYOUT_DEFAULT__ || 'paged'` resolution →
  `__WC_LAYOUT_MODE = 'paged'` unconditional; delete the overlay `else` arms (the `createPmEditor` branch).
- `electron.vite.config.ts` — remove the `__WC_LAYOUT_DEFAULT__` define (~line 139).
- `src/renderer/bridge/create-editor.ts` — remove `constructPmEditor` + the `Pagination` import; keep
  `constructPresentationEditor` (the PE; keep the dynamic import as a code-split/regression guard).
- `src/renderer/layout/coordinate-adapter.ts` — delete the overlay arms of `clientToPos` / `getPages` /
  `nodeBoxFor` / `clientToOverlayLocalPt` (always assume paged `.superdoc-page`).
- `src/renderer/bridge/index.ts` — `replaceEditor` becomes paged-only (**always** `replaceFile`); remove the
  `__repaginate` calls (setZoom/setView) + any overlay-only `__WC_LAYOUT_MODE` ENGINE_READY gates.
  **⭐ SYNERGY: this likely FIXES the 007 `[8]`+`[11]` known-gap** (the openDocx round-trip teardown — it was the
  overlay `replaceEditor` arm that called `failBridge`; deleting it leaves only the paged `replaceFile` path).
- `src/renderer/bridge/focus.ts` — delete the overlay margin-click handler (the PE's `EditorInputManager` owns
  clicks in paged; the handler already bails when paged).
- `src/renderer/bridge/references.ts` — KEEP the paged `refShowNotes` (scroll to the painted footnote), delete
  the overlay `WC.NotesArea.showNotes` arm.
- `src/renderer/bridge/ink-overlay.ts` — KEEP the paged multi-page page-anchoring, delete the overlay simple-pos
  arms + the `isPaged()` gate (always true).
- `src/renderer/bridge/header-footer.ts` — drop the `__WC_LAYOUT_MODE !== 'paged'` guard (always paged).
- CSS (`editor.css`) — delete the overlay pagination seam rules `.pm-page-spacer` / `.pm-gap-band` (generated
  ONLY by the deleted pagination.ts) + any residual `.wc-page-gap` / `.wc-gap-band` (older legacy). KEEP
  `#pm-notes-area` CSS only if harmless; otherwise drop with notes-area.

## PRESERVE (explicitly stays — the paged world)
- The PresentationEditor + the 6 overlays' PAGED paths (comments-ui, track-chrome, image-resize, ink anchoring —
  already mode-agnostic or paged-retargeted).
- `src/renderer/bridge/line-numbers-overlay.ts` — the **PAGED** line-number renderer (004 P2; "overlay" in name
  only — it's a no-op in overlay, so it's pure paged). NOT deleted.
- The shared chrome (ribbon/dialogs/backstage/statusbar — mode-agnostic, read the `WC.PM.coords` seam).
- The vendored fork `src/renderer/core/superdoc-fork/**` — untouched (Constitution I). Its internal "overlay"
  (table autofit) is unrelated.

## TEST GATES AFTER retirement
- `test:pm` → points at the paged runner (run-pm-paged.js, asserts mode=paged); `run-pm-overlay.js` deleted. The
  mode-assertion stays (now only paged is valid).
- **The 59 `PAGED_SKIP` overlay-only tests** — **DECISION 2** (delete / keep-skipped / port). The 10
  `PAGED_KNOWN_GAP` stay (real paged gaps). `[0a]` port stays.
- `test:roundtrip:paged` → loses the paged-vs-overlay TIER-1 byte-equality arm (no overlay comparand); KEEPS the
  Word-COM validate-open + read-backs (the real-fidelity evidence).
- `test:bundle` → **DECISION 3** (delete moot / convert to a generic entry-size ceiling).
- Per-feature probes' overlay-parity arms (`probe:coords/headerfooter/columns/linenumbers/hyphenation` build
  overlay for a parity check) → simplify to paged-only; `probe:overlays` deleted.

## RISKS
- Mislabeled arms: the mapping agents sometimes inverted which arm to keep — the implementation KEEPS PAGED,
  DELETES OVERLAY, file-by-file, gated by re-running `test:pm:paged` + the probes after each.
- `replaceEditor` paged-only: must confirm the html/text/csv import legs + the `lastImportBlanked` guard still
  behave (the overlay arm owned some of that). Covered by `probe:opennew` + the io tests.
- The 59-skip disposition (DECISION 2) is the one with lasting test-coverage consequences.

## STAGED TASK BREAKDOWN (reviewable + reversible — overlay stays in git history)
- **P1 — dead-engine deletion**: pagination.ts + notes-area.ts + the create-editor overlay constructor + the
  main.ts/vite toggle → paged unconditional. Re-run all gates.
- **P2 — branch simplification**: coordinate-adapter + index.ts(replaceEditor) + focus/references/ink/header-footer
  overlay arms. Re-run all gates + probes (watch the [8]/[11] synergy).
- **P3 — test-infra + CSS + probes**: the test:pm/roundtrip/bundle/probe adaptations per DECISIONS 2+3 + CSS.
- **P4 — docs reconcile**: CLAUDE.md/AGENTS.md/PAGINATION.md/ARCHITECTURE.md/LAYOUT_ENGINE.md + plan docs.
- `/code-review` the full deletion diff before ff-merge into `general-done`.

## THE DECISIONS — RESOLVED (user, 2026-06-22 HARD-STOP)
1. **Go / approach → STAGED.** Land P1 (dead-engine delete) + re-run ALL gates first; then P2, P3, P4 — each
   reviewable. Autonomous between stages. ff-merge into `general-done` at the end (`/code-review` the diff first).
2. **The 59 overlay-only `test:pm` tests → DELETE.** Remove them from the suite (paged coverage lives in the
   dedicated probes). RECORD the deleted-test → covering-probe mapping in `specs/008-overlay-retirement/`
   (test-mapping.md). The 10 `PAGED_KNOWN_GAP` stay; the `[0a]` port stays.
3. **`test:bundle` → CONVERT to a generic renderer entry-size ceiling.** Repurpose `check-overlay-bundle.js`
   (or replace it) into a mode-agnostic bundle-size guard (the PE is heavy; catch accidental bloat). Keep the
   `test:bundle` npm script pointing at the repurposed gate.
