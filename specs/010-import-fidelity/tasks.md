# Tasks: Paged import fidelity (html/txt/csv)

**Feature**: `specs/010-import-fidelity/` | **Branch**: `010-import-fidelity` (off `general-done`)
**Inputs**: spec.md, plan.md
**Merge mode**: ff-merge into `general-done`. `/code-review` before merge.
**Type**: paged open-flow fix — `src/renderer/bridge/index.ts` + `scripts/test-suite-pm.js`. NO fork edit.

---

## Phase 0: Spike (DONE)
- [x] T001 On `010-import-fidelity` off `general-done`; feature.json → this dir.
- [x] T002 Reproduce the gap: build paged, `PM.openHtml(html)` → dump the doc model → confirm raw-html-as-text
  (`rawHtmlDumpedAsText:true`, `markTypes:[textStyle]`, the whole `<!DOCTYPE html>…` as one text node). Confirm
  `insertContent(htmlString)` does NOT parse in the PE; no `setContent` command.
- [x] T003 Find the NO-FORK fix: `createDocFromHTML` (public `@core/helpers` export) parses in the PE context —
  verified via `replaceNodeWithHTML` (which uses it): `markTypes:['bold']`, `rawHtmlDumpedAsText:false`, parsed texts.

## Phase 1: Implement
- [x] T004 `src/renderer/bridge/index.ts`: import `createDocFromHTML` from `@core/helpers/index.js`. In `replaceEditor`'s
  html leg, replace `insertContent(extra.html)` with `createDocFromHTML(extra.html, pres.editor)` → `tr.replaceWith(0,
  doc.content.size, parsed.content)` → `view.dispatch`. Keep the §5.3 data-loss guard (`landed`/`lastImportBlanked`).
- [x] T005 Build + verify via the spike: `PM.openHtml(html)` now yields `markTypes:['bold']`,
  `rawHtmlDumpedAsText:false`, parsed structure. (txt/csv ride the same leg.)

## Phase 2: Test + gates
- [x] T006 `scripts/test-suite-pm.js`: remove the `[7]` entry from PAGED_KNOWN_GAP (it is now a genuine pass).
- [x] T007 `test:pm` → 416/416, pagedKnownGaps 10→9, `[7]` PASS. `test:smoke` 9 / `test:roundtrip` 27 /
  `test:bundle` 4 unaffected. Clean up the throwaway spike script.

## Phase 3: Review + close-out
- [x] T008 `/code-review` (adversarial-review workflow) — focus: is the parse genuinely no-fork (public helper, not a
  fork edit); does the full-body `replaceWith` preserve the doc attrs (sectPr) + not corrupt the PE; is the data-loss
  guard intact; do txt/csv still import; any edge (empty html, parse throw) handled. FIX confirmed findings.
- [x] T009 Docs: note the `[7]` gap is FIXED (removed from PAGED_KNOWN_GAP). Tick this tasks.md.
- [x] T010 ff-merge `010-import-fidelity` → `general-done` (NOT main, no push). plan-tracking checkpoint. Then 011.

---
## Notes
- The fork's html parser maps Word-model headings/lists to styled paragraphs (schema choice; same as the overlay
  produced). The `[7]` acceptance bar (bold mark + content) is the signal.
- No new Word-COM oracle: this is a doc-MODEL fidelity fix; mark export → Word is already round-trip-covered.
