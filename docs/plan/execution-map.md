# Execution Map — session playbook + daily work log

> How to orient, execute the current phase, and record what got done. The forward plan lives
> here; the **Daily work log** (below) records what we actually did each day, with checkboxes.
> Big picture: [plan.md](plan.md) · dated state snapshots: [last-point.md](last-point.md).
> Renewed via the `plan-tracking` skill.
>
> **▶ Layout-engine (Option-B paged render migration) execution is tracked in
> [layout-engine-runbook.md](layout-engine-runbook.md) — read it + its "Current Status" to
> resume that work; keep its status section up-to-date every session.**

## At session START (always, in order)
1. Read **[last-point.md](last-point.md)** (top entry) — where we left off, current branch, next.
2. Read **this file** — current phase, next actions, and the Daily work log.
3. Skim **[plan.md](plan.md)** — goal, locked architecture, the two hard constraints, dev process.
4. Read the **ADR(s)** + matching [OPEN_DECISIONS.md](../decisions/OPEN_DECISIONS.md) item for
   the current phase.

> ⚠️ **Branching rule — never do code work on `main`.** Before writing or committing any code,
> **create and checkout a fresh feature branch** off the integration line, e.g. `feature/logger`.
> Confirm first with `git branch --show-current`. `main` receives **only reviewed merges at
> stable milestones**. (Docs-only updates may go on a docs branch and PR.)

## How to execute ANY phase/subsystem (the loop)
1. **Create + checkout a feature branch** (e.g. `feature/<subsystem>`) — do **NOT** work on
   `main`. Verify with `git branch --show-current` before any edit.
2. **Confirm the decision:** read its `OPEN_DECISIONS.md` recommendation + edge cases; confirm or
   adjust against the *real* code; if it changes a locked choice, add a superseding ADR.
3. **Build** it (strangler-fig — behind the existing ribbon; never break the Word UI).
4. **Test:** the three gates (test:pm / test:smoke / test:roundtrip) stay green; add a regression
   test per change; check feature parity.
5. **Checkpoint** (via the `plan-tracking` skill): **append** a dated entry to last-point.md and
   **tick** the Daily work log below.
6. **PR** for review; merge to the integration line; merge to `main` only at a stable milestone.

## CURRENT PHASE → POST-MIGRATION (per-feature reconciliation + cleanup) — the layout engine (Phase 4) is DONE & SHIPPED
> **🏁 The paged-render migration is COMPLETE & shipped to `main`** (paged = the default engine; the overlay
> engine is legacy behind `WC_LAYOUT=overlay`). We are now in the **POST-MIGRATION phase**: per-feature
> reconciliation + cleanup, driven by **spec-kit features** under `specs/00N-*`. The migration's full record is
> [layout-engine-runbook.md](layout-engine-runbook.md) + `specs/001-paged-render-migration/`.
>
> **The loop (post-migration):** for each item, PLAN via `/speckit-specify` + `/speckit-plan` + `/speckit-tasks`
> (or a scoped slice) on a **fresh feature branch off `main`** → a probe-first SPIKE for any unknown → IMPLEMENT
> (NO fork edits; the `WC.PM` bridge is the only doc-write path; doc model stays page-free) → VERIFY (the gates +
> the **Word-COM oracle** for fidelity + the `/code-review` fix-loop) → **ff-merge to `main` + push** → checkpoint
> (this skill). **Standing directive** (memory `autonomous-postmigration-exec`): the user pre-approves the spec-kit
> plans + wants autonomous execution (plan → execute, no per-step approval).
>
> **⚠️ GATES (post-flip — CORRECTED this session):** `test:pm` validates the **OVERLAY** engine — **build overlay**
> (`WC_LAYOUT=overlay npm run build && npm run test:pm` → **475**; a boot-guard fails LOUDLY on a paged build, see
> memory `paged-testpm-overlay-suite`). `test:smoke` (**9**) + `test:roundtrip` (**27**) + `test:bundle` (**4**) are
> mode-agnostic (paged default OK). **Paged rendering is covered by the dedicated `probe:*` probes**
> (coords/pointer/statusbar/overlays/imageresize/ink/notes/headerfooter/opennew + `report:glyphgeom`,
> `test:roundtrip:paged` — dev-box-only).
>
> **✅ DONE — 002 Headers & Footers** (`5d86503`) · **003 Columns** (`eff06c3`) · **004 Line Numbers** (`02a54f7`). All
> three post-migration spec-kit features are **COMPLETE + MERGED** to `main`, all NO-FORK, all Word-COM-validated:
> - **002** (`specs/002-headers-footers/`): on-page edit + the "Header & Footer Tools" tab; Different First Page /
>   Odd & Even variants; real `PAGE`-field page numbers. (KNOWN fork-gated gap: a *freshly-inserted* page-number
>   field renders "0" in-app until reopen — Word resolves per page.)
> - **003** (`specs/003-columns/`): One/Two/Three + More Columns + Left/Right unequal + line-between + column break
>   (real `w:cols`/`<w:col>`/`w:sep` + `w:br w:type="column"`; an owned `bodySectPr` write for unequal/line-between).
> - **004** (`specs/004-line-numbers/`): None/Continuous/Restart-Each-Page/Restart-Each-Section + an owned
>   margin-number overlay + the Line Numbering Options dialog (start/count-by/distance) + per-paragraph
>   `w:suppressLineNumbers`. (`test:roundtrip:paged` C6: StartingNumber via the `w:start = userStart−1` off-by-one,
>   CountBy, the suppressed-paragraph flag — all read back from real Word.)
>
> **NEXT: pick the next spec-kit feature (005+)** from the backlog below.
>
> **POST-MIGRATION BACKLOG** (independent; user picks order): **overlay retirement** (remove
> the decoration-overlay engine + the `WC_LAYOUT=overlay` path) · **more per-feature reconciliation** (the residual
> `isBlocked` gates on layout-page/layout-arrange/text-effects — un-block + wire vs the oracle) · **port the ~70
> overlay-only `test:pm` tests** to paged-aware variants (real paged-suite coverage) · **M6 → pass/fail gate** + the
> multi-page pagination calibration (PE 2 vs Word 3) · **paged html/txt/csv import fidelity**.
>
> **⚠️ EVERYTHING from here is a SPEC-KIT FEATURE — no ad-hoc coding.** Per item: `/speckit-specify` →
> `/speckit-plan` → `/speckit-tasks` (under `specs/00N-*`) → probe-first SPIKE → IMPLEMENT → VERIFY (gates +
> Word-COM oracle + `/code-review` fix-loop) → ff-merge to `main` → checkpoint (plan-tracking). **The spec-kit
> artifacts ARE the cross-session memory: a new session resumes the ACTIVE feature from its `spec.md` + `tasks.md`**
> (session-start = read last-point.md → this CURRENT PHASE → the active feature's `tasks.md`, then continue the
> unchecked `[ ]` tasks). `.specify/feature.json` points at the active feature dir.
>
> **THE SPEC-KIT FEATURE SEQUENCE (post-migration roadmap):**
> 1. **002 headers-footers** — P1 ✅ · P2 ✅ (variants) · P3 ✅ (page numbers) · Phase-6 ✅. **COMPLETE + MERGED** (`5d86503`).
> 2. **003 columns** — P1 ✅ · P2 ✅ (unequal + line-between) · P3 ✅ (column break). **COMPLETE + MERGED** (`eff06c3`).
> 3. **004 line-numbers** — P1 ✅ (modes) · P2 ✅ (margin overlay) · P3 ✅ (Options dialog + per-paragraph suppress).
>    **COMPLETE + MERGED** (`02a54f7`).
> 4. **005+ cleanup features** — one spec-kit feature each (scope decided at `/speckit-specify`): overlay-retirement ·
>    residual-`isBlocked`-layout reconciliation (position/align/group/rotate/hyphenation/section-breaks) ·
>    paged-test-coverage port · M6→gate+pagination-calibration · import-fidelity. **USER PICKS the order.**
> 3. **THE COMPLETENESS PASS — fix ALL bugs + implement ALL features, SPEC-DRIVEN** (the big final post-migration phase):
>    SOURCE = `docs/bug-hunt/` — **BUG-LEDGER.md (65 numbered bugs)** + the **feature / 321-control audit (76 features)**.
>    Turn them into spec-kit features (group related bugs/features per spec) and work each through the loop until the
>    ledger + the audit are CLEAR. **NO ad-hoc fixes** — every fix/feature ships under a spec + a regression test (+ the
>    Word-COM oracle for any fidelity claim). **Re-triage the ledger against the current PAGED codebase first** (some
>    bugs pre-date the migration; several may already be fixed or moot under the paged engine).
>
> <details><summary>Prior PAGINATION CARET-BUG CURRENT-PHASE note (kept for context)</summary>
>
> **PAGINATION CARET BUG (user-reported) — root-caused + PRIMARY fix MERGED** (PR #54 `11909cd`):
> page breaks + blank pages were breaking editing + the caret/click position because their seam was a
> block `<div>` injected at the INLINE hardBreak position inside a paragraph (block-in-inline corrupts
> PM `posAtCoords`). FIXED: forced/blank/section seams now emit a coords-safe BLOCK-BOUNDARY seam
> (`emitSeamBefore`/`trailingForcedCount`, pagination.ts); probe blockInInline 1→0 / 2→0; 2 `[4a]`
> regressions; `/code-review` + re-review clean. `focus.ts` CONFIRMED fine post-fix (no change needed).
> Render-only → oracle page counts preserved. Gates: **PM 431 / smoke 9 / roundtrip 27**. **REMAINS
> (low-severity, deferrals §A.1b):** line-split + mid-paragraph in-`<p>` spacers still misland a click in
> the narrow GAP of a page-overflowing paragraph (word round-trips stay clean) — a hard coords-safe
> rework (custom split-paragraph NodeView / frames-overlay). Full writeup: [[pagination-caret-rootcause]].
>
> </details>
>
> <details><summary>Prior 4d.4 CURRENT-PHASE note (kept for context)</summary>
>
> **4d.4 AutoFit Window+Fixed geometry DONE + MERGED** (PR #52 `627cfdf`): AutoFit stored only the
> layout/width INTENT — the column geometry it visibly produces was never applied (Window didn't fill
> the page; window→contents stayed stretched). Now `autoFitTable('window', targetWidthPx)` (fork
> `extensions/table/table.js`) **scales every column proportionally to fill** the page text-column
> width (writes per-cell `colwidth` via the TableMap → grid-sync rebuilds the twips `grid` → in-app
> render AND export both fill, no Phase-7 paint); `'contents'` now also clears any prior Window stretch.
> The bridge (`tableAutoFit`, `bridge/table.ts`) computes the text width from `getPageStyles()`. Oracle
> `read-table`: Window 1:2 → 155.85pt+311.65pt (sum 6.5" text column, ratio 2.0); Fixed 120/180px →
> 90pt+135pt preserved; both open WITHOUT repair. 4 `[4d]` tests. `/code-review` high: **zero correctness
> findings** (5 cleanup/altitude unify-primitive findings deferred — would refactor tested commands).
> Gates: **PM 429 / smoke 9 / roundtrip 27**. **AutoFit Contents** in-app reflow stays a layout-pass
> deferral (export intent correct). **NEXT (pick one):** remaining 4d — **table RELOCATE →
> row-split-across-pages → AutoFit Contents**; OR the **FRAMES-OVERLAY** (§A.1d); OR **4e headers/footers**.
> Session is VERY long — a fresh session is strongly recommended next.
>
> </details>
>
> <details><summary>Prior 4d.3 CURRENT-PHASE note (kept for context)</summary>
>
> **4d.3 Row/Column size ribbon controls DONE + MERGED** (PR #50 `3c1b527`): added **Row Height** +
> **Column Width** `dropdown` controls to the Table Layout "Cell Size" group (`table-tools-pm.js`) →
> shared `tblSizeFly` flyout (`commands.js`, inches input + presets) → `tableSetRowHeight(px,'atLeast')`
> / `tableSetCellWidth(px)` (inches×96=px; model/exporter → twips). Cmds added to the dropdown-dispatcher
> allow-list. Oracle: 0.5" → row 36pt atLeast; 1.5" → col 108pt. `/code-review` xhigh: **zero findings.**
> Gates: **PM 425 / smoke 9 / roundtrip 27**.
>
> </details>
>
> <details><summary>Prior 4d.2 CURRENT-PHASE note (kept for context)</summary>
>
> **4d.2 row-height EXPORT fix DONE + MERGED** (PR #48 `8849c4e`): `tr-translator` reconciliation wrote
> the nested row-height `value` as a STRING → the `trHeight` decode (typeof===number) silently dropped
> it → a set row height produced NO `<w:trHeight>` (Word saw auto). Now a number + keeps the rule.
> Oracle: 60px → 45pt atLeast. Gates: **PM 423 / smoke 9 / roundtrip 27**.
> </details>
>
> <details><summary>Prior 4d.1 CURRENT-PHASE note (kept for context)</summary>
>
> **4d.1 table COLUMN RESIZE DONE + MERGED** (PR #46 `52d88dd`): re-enabled prosemirror-tables
> `columnResizing` (`handleWidth` 0→5); drag a column border → `colwidth`. A grid-sync
> `appendTransaction` rebuilds the table `grid` (twips) from the changed colwidths so the resize
> round-trips (the exporter emits `w:gridCol` from `grid`; otherwise an IMPORTED-table resize was
> dropped on save — caught by review). New oracle verb `read-table`. Oracle-validated: 180px → Word
> 135pt for new + imported tables. Gates: **PM 422 / smoke 9 / roundtrip 27**. **NEXT (pick one):**
> 4d.2 row RESIZE (+ fix the `setRowHeight` px-vs-twips export bug; no built-in row resize → custom
> handle) → table RELOCATE → row-split → AutoFit; OR the FRAMES-OVERLAY (faithful image reposition +
> render z-stacking + floating shapes, LAYOUT_ENGINE.md §3); OR 4e headers/footers. deferrals §A.1d/§A.1e.
>
> </details>
>
> <details><summary>Prior 4c.3 CURRENT-PHASE note (kept for context)</summary>
>
> **4c.3 z-order DONE + MERGED** (PR #44 `66d691e`): `WC.PM.setImageZOrder(forward|backward|toFront|
> toBack)` mutates the floating image's `relativeHeight` (forward/backward use `>=`/`<=` for tied
> peers); ribbon Bring/Send wired. EXPORT faithful (oracle `read-shapes` → distinct ZOrderPositions).
> Gates: **PM 420 / smoke 9 / roundtrip 27**. **DECISION POINT:** the remaining 4c work (faithful
> free-REPOSITION 4c.2 + render-faithful z-stacking) needs the **frames-overlay** (all floating
> objects as absolutely-positioned frames with text-exclusion — LAYOUT_ENGINE.md §3) — a substantial
> piece, not a clean slice. Next session: build the frames-overlay, OR pivot to **4d (tables)** /
> **4e (headers-footers)** which may be cleaner wins. Confirm priority first (deferrals.md §A.1d).
>
> </details>
>
> <details><summary>Prior 4c.1 CURRENT-PHASE note (kept for context)</summary>
>
> **4c.1 text-wrap DONE + MERGED** (PR #42 `4bbdb51`): `WC.PM.setImageWrap(mode)` wires the ribbon
> Wrap Text (7 modes) to the image `wrap`+`isAnchor` attrs — the fork already renders (float/shape-
> outside/absolute) + round-trips; the gap was a phantom `WC.Layout` stub. Key fix: the anchor
> exporter now emits a schema-valid `CT_Anchor` (simplePos child + required attrs) so Word OPENS a
> freshly-floated image; tight/through get a default bounding-box `wp:wrapPolygon`. Oracle: all 6
> floating modes open as floatingShapes. Gates: **PM 419 / smoke 9 / roundtrip 27**. Edges →
> deferrals.md §A.1d. **NEXT: 4c.2 drag-to-reposition** (frames overlay mirroring the 4b resize
> overlay → writes `marginOffset`/`wp:posOffset`), then **4c.3 z-order** (Bring/Send →
> `relativeHeight`). Branch `build/phase-4c2-reposition` off `main`. Then 4d tables → 4e → 4f.
>
> </details>
>
> <details><summary>Prior 4b CURRENT-PHASE note (kept for context)</summary>
>
> **4b image resize DONE + MERGED** (PR #40 `6d8c448`): a live 8-handle resize overlay
> (`src/renderer/imageresize/image-resize.ts`, owned/out-of-fork) writes the image `size` attr →
> `wp:extent`/`a:ext` (EMU); aspect-locked (Word default); the overlay rides `#pages` so it tracks the
> image through zoom+scroll. Oracle-validated via the new `read-shapes` verb (200×100→260×130 px =
> 195pt×97.5pt). Deferred 4b edges → deferrals.md §A.1c. Gates on main: **PM 414 / smoke 9 / roundtrip
> 27**. **NEXT: sub-phase 4c (floating anchor/position/wrap)** — branch `build/phase-4c-floating` off
> `main`; the frames overlay (inline⇄floating, drag-reposition, text-wrap, `w:anchor`/`posH`/`posV`);
> LAYOUT_ENGINE.md §2.3. Then 4d tables → 4e headers/footers → 4f page-bg/columns/section-geometry.
>
> </details>
>
> <details><summary>Prior 4a CURRENT-PHASE note (kept for context)</summary>
>
> **4a pagination is FULLY COMPLETE** for the page-break family, all oracle-validated vs Word for Windows
> 16.0 and merged to `main`: core (PR #36 `1c00252`), the unified forced-seam redesign that finished
> mid-paragraph + trailing + blank breaks (**4a2**, PR #37 `7779c53`), and next-page **section breaks**
> incl. multi-section + before-a-table (**4a3**, PR #38 `0e0f29f`). Engine =
> `src/renderer/pagination/pagination.ts`: auto multi-page, margins, live page count, manual breaks
> (mid/end/trailing/blank via one `emitSeam` at the break position), line-split (widow/orphan), and section
> breaks (`sectionBoundaries` — break governed by the NEXT section's type). Gates on main: **PM 410 / smoke 9
> / roundtrip 27.** Still deferred (NOT page-break pagination): per-section GEOMETRY + even/odd parity → 4f;
> over-tall-block + table row-split → 4b/4d; two 4a2-review deep edges; see deferrals.md §A.1b. **NEXT:**
> **sub-phase 4b (image resize)** — branch `build/phase-4b-image-resize` off `main`; image NodeView + 8 live
> handles writing `w:extent` (EMU) + aspect-lock (LAYOUT_ENGINE.md §4). Then 4c floating → 4d tables → 4e
> headers/footers → 4f page-bg/columns/section-geometry.
>
> </details>
>
> **PIVOT (2026-06-15, user decision): build the LAYOUT ENGINE next, then fix the gated bugs.** Phase-3
> ribbon-hardening did enough (Home/Insert/Design/Editor on `fix/ribbon-home`) and then hit the ceiling:
> a whole class of features/bugs — image **resize/relocate**, table **resize/relocate/row-split**, floating
> objects, headers/footers, page-border render, columns, multi-page — are **fundamentally layout-gated**.
> Piecemeal fixes leak, so Phase 4 is now **active**. **START at [../LAYOUT_ENGINE.md](../LAYOUT_ENGINE.md)**
> (spec + acceptance checklist + sub-phases 4a→4f); its checklist is fed by [deferrals.md](deferrals.md) §A.1.
> First sub-phase = **4a pagination core** (model-driven multi-page sheets), oracle-validated lines/page;
> PAGINATION.md is the prior art. **Branch off `main`** (PR `fix/ribbon-home` first) — never work on `main`.
> Logger/Verifier/MCP remain at Phases 5/6/7.
>
> <details><summary>Phase-3 ribbon-hardening playbook (PAUSED — kept for when we return to per-tab polish)</summary>
>
> **Phase 3 = the ribbon-hardening pass** (re-sequenced 2026-06-14; goal = a fully working env BEFORE
> logger/verifier/MCP). Go **tab by tab, section by section.** Logger/Verifier/MCP slip to Phases 5/6/7;
> the **pagination / layout engine is pulled up to Phase 4.**
>
> - **Section kickoff = a HUMAN GATE:** general research of the whole section → propose in/out scope →
>   **user LOCKS scope** (recorded in [SCOPE.md](../SCOPE.md)). Out-of-scope sections (Acrobat, Voice,
>   Add-ins) are cut here, not researched deeply.
> - **Per in-scope feature (run autonomously):** (1) research Word's behavior **+ enablement/checked-state
>   rules**; (2) compare **three-sided** — Word reference (COM oracle + live Word) vs the **clone's actual
>   in-env behavior, driven live** (real effect + its *scope* + edge cases + control state); (3) decide
>   **fix-now vs layout-flag**; (4) fix + **regression test** (logic + state) + eyeball the visuals; (5) three gates.
> - **Ribbon STATE MACHINE = first-class, built concurrently.** Two facets per control: **enablement**
>   (grey when unusable — Paste w/ empty clipboard, Table tools off-table, Undo w/ empty stack,
>   Accept-change off-a-change, Decrease-indent at zero) + **checked/latch + current value**. Build the
>   shared spine ONCE in the first section (a single evaluator recomputing enablement every transaction +
>   a declarative per-control rule registry, extending `PM.queryState()`→ribbon); each section then registers
>   its rules. Enablement IS `test:pm`-assertable (unlike pure-visual fixes).
> - **Layout = FLAG-AS-SPEC, NEVER hack.** A bug needing the layout engine (multi-page / floating-object
>   position / text-wrap / headers-footers-on-page / columns / vertical page geometry) is **flagged in
>   [deferrals.md](deferrals.md) §A.1** (the accumulating Phase-4 spec), not faked in continuous-flow. The
>   architecture is RIGHT (PM = a text-flow doc + anchored floating-object layer, like Word/OOXML); the gap is
>   the missing layout engine. Phase 4 builds it model-driven (PM plugin + overlay) to **clear the flags**.
> - **Git:** one branch/PR per **tab** (`fix/ribbon-<tab>`), **commit per section**, merge to `main`, delete
>   branch. Split a big tab (Home) into section-group PRs only if review gets unwieldy. Every section ends gates-green.
> - **Tests cover logic + state, NOT clicks/visual/arrangement** — those are eyeballed vs live Word.
>
> </details>

> ---
> **Phase 2 (editing core) is COMPLETE — slice history below (most recent first):**
>
> **Slice 11 (legacy retirement) is DONE** (`feature/phase-2-slice-11-legacy-retirement`, PR #34 merged): the
> dual-world scaffolding is GONE — PM (ProseMirror/SuperDoc-fork) is the ONLY editor. Removed the `--legacy`
> flag/boot + `bridge/mode.ts`, the legacy `WC.Editor`/`#editor` + leaf engines (formatting/comments/table-tools/
> layout-tools/header-footer + the review-tools Track-Changes engine), the legacy docx converter
> (html-to-docx/mammoth/docx-utils + copyDocxUtilsPlugin + the doc:save/saveAs IPC + wordAPI.save/saveAs), and the
> 3 frozen legacy gates (test:legacy/test:smoke:legacy/test:docx; test-suite.js archived in git tag
> `legacy-suite-257-archive`). Collapsed every dual-world `pm?PM:legacy` branch to PM-only; migrated zoom/view +
> the styles catalog (`WC.Styles`→`WC.PM.allStyleNames`) + Office-Clipboard paste + equation built-ins onto the
> `WC.PM` bridge; retired D6 `FLIPPED`/`isFlipped` and rewrote `isBlocked` against a static `DEFERRED` set (kept as
> the permanent Phase-7 deferral gate for layout-page/layout-arrange/header-footer/text-effects). KEPT the shared
> `window.WC` chrome as classic scripts (TS/ESM migration deferred). Net **−4229 lines / 54 files**. **Gates (now
> THREE): PM 326/326, smoke 9/9, roundtrip 27/0**; converter-removal oracle Leg A PASS; 2-reviewer whole-branch
> review → Ready to merge (zero Critical/Important). Process: 3 hidden conflicts (WC.Styles, the WC.Editor zoom/view
> ownership, the lodash transitive dep) + 4 reachable E() leaks (equation dropdown, shapes/Excel/draw-table) were
> caught by the gates+leak-audit and fixed; final audit = **zero reachable E()** (the rest is isBlocked-gated Phase-7
> residue). **Phase 2 editing core COMPLETE → Phase 3 (ribbon hardening) next** (re-scoped 2026-06-14 — see the CURRENT PHASE header above; Logger moved to Phase 5).
>
> **Phase 1 (Scaffold) is COMPLETE** — see the 2026-06-05 entry in [last-point.md](last-point.md).
> The owned ProseMirror engine mounts/renders/edits a real `.docx` on `build/phase-1-scaffold`
> (all gates green: smoke 9/9, functional 257/257, docx 17/17; single PM copy; telemetry off; no
> `superdoc` npm dep). Branch **pushed**; merged to `main` via PR #10.
>
> **Slice 0a is DONE** (merged to `main` via PRs #11/#15): `#pm-editor` is now the visible
> editor behind the `WC.PM` bridge; `--legacy` restores the full legacy app; D6 two-layer guards live;
> ribbon state-sync from engine events; dirty/statusbar/visible-page re-pointed. Gates: 257/21/9×2/17.
>
> **Slices 0b, 0c and 1 are DONE and INTEGRATED** (all on `main` via PRs #11–#15; the stacked
> PRs #12–#14 cascaded into their bases, #15 was the catch-up — see last-point.md): file-IO
> bytes layer, the macOS Word oracle harness, and the **character-formatting flip** (area
> `character` on the PM engine, oracle-validated both ways vs Word 16.77.1). Gates re-verified
> on `main`: PM 43/43, 257, 9/9 × 2, 17.
>
> **Slice 2 is DONE** (`feature/phase-2-slice-2-paragraph`, PR #17): areas **`paragraph` +
> `lists` FLIPPED** — align/indent/spinners/line-spacing/shading/borders/sort, glyph-honoring
> list libraries, Word-native multilevel, Paragraph dialog, Word shortcuts; the slice-1
> hanging-indent gap closed (fork CSS shipped); new `read-para-props` oracle verb (quirks
> #16-23). Gates: **PM 76/76**, legacy 257, smoke 9/9 × 2, docx 17.
>
> **Slice 3 is DONE** (`feature/phase-2-slice-3-styles`, PR pending): area **`styles`
> FLIPPED** — gallery click + PM-native hover live-preview (`bridge/style-preview.ts`:
> throwaway txn + `editor.setState` restore), styles pane applies (chevron leak closed;
> New Style deferred), 4 chords (+ the Ctrl+N `!shift` shadow fix), caret-driven gallery
> highlight (`st.block`), 4 minted built-in style defaults (SubtleEmphasis oracle-amended),
> heading keymap stripped; BOTH slice-2 revisits closed (resolved-ilvl level menu;
> resolvedPropertiesCache TableInfo+tblLook). New `read-style-props` verb (quirks #24-27);
> slice-2 oracle followUps closed; oracle legs A 5/5 + B 9/9 PASS. Gates: **PM 96/96**,
> legacy 257, smoke 9/9 × 2, docx 17.
>
> **Slice 4 is DONE** (`feature/phase-2-slice-4-clipboard`, PR pending): areas
> **`clipboard` + `editing-misc` FLIPPED** — ribbon Cut/Copy/Paste (PM-native via
> `webContents` clipboard IPC), the Paste dropdown + a real `D.pasteSpecial` dialog
> (flavor list clipboard-state-driven, oracle-confirmed), Format Painter on the fork's
> `copyFormat` extended to Word scope (para props + first-run marks, replace-not-merge,
> link-preserving, double-click-sticky + Esc, state-sync button latch/copy cursor),
> Select All + Similar Formatting; `select` remapped find-replace → editing-misc (spec
> §9.1 row 4); Cmd+Shift+C/V chords (oracle B5). New `wordAPI.clipboard.*` IPC. Oracle
> leg A clone→Word PASS (full list fidelity), leg B Word→clone PASS core + a recorded
> list-marker leak (ship-and-track, user-approved 2026-06-08); physical Cmd+C/V both
> directions confirmed. Gates: **PM 112/112**, legacy 257, smoke 9/9 × 2, docx 17.
>
> **Slice 5 is DONE** (`feature/phase-2-slice-5-find-replace`, PR pending): area
> **`find-replace` FLIPPED** — the legacy destructive `.find-hit` rewrite replaced by the fork's
> **decoration-based Search extension**; find pane (`pmFindPane`) drives the `WC.PM` search surface
> with a Word-faithful options row (Match case / Whole words / Use wildcards), live count, Replace +
> Replace All, close→`clearFind`; full Word scope (Match Case + Whole Words + Wildcards + Advanced
> Find) + all three Find-dropdown items (Find · Advanced Find · Go To); new `D.goToDialog`;
> Ctrl+F/H + edit.find/replace `pmBlockedOr`-wrapped in the flip commit. Fork edits (NOTICE'd): the
> Search ext gained `name:'search'` (was undefined storage), whole-word + Word-wildcard on the
> session path, wildcards forced case-sensitive (oracle A4). Oracle legs A 'QUX' clone→Word + B
> 'alpha×4' Word→clone both PASS; zero decoration leak in saved docx. Gates: **PM 130/130**, legacy
> 257, smoke 9/9 × 2, docx 17.
>
> **Slice 6 is DONE** (`feature/phase-2-slice-6-insert-basics`, PR pending): area
> **`insert-basics` FLIPPED** + the **net-new full Table Tools** built — insert primitives (link/
> image/page-break/blank-page/hr/symbol/equation-as-styled-text/bookmark-paired) via `bridge/insert.ts`;
> table insertion + the 9 ops + **14 NOTICE'd fork table commands** (style/align/indent/size/margins/
> borders/distribute/split/convert/text-direction/autofit — export round-trip-verified) via
> `bridge/table.ts`; **Table Layout + Table Design contextual ribbon tabs** (runtime-injected
> `{cmd,label,type}` via new `H.tbl*` handlers; `ribbon.js` extended for multiple contextual tabs,
> Header & Footer byte-identical) + a PM table context menu; exotica carve-out (14 → `insert-exotica`,
> `crossReference` → `references`); `Ctrl+K` guard; D6 tests repointed `link`→`newComment`,
> `table`→`tableOfContents`. Headless leg-A oracle PASS (link/table/image/bookmark survive export —
> docx-inspect). A post-build **table-defect fix batch** (user report → 4-agent hunt → 6 reviewed
> fixes on PR #23) landed: passive contextual tabs (no ribbon yank; Word Mac 'Layout' label),
> Center/Right table alignment geometry fix, caret-cell shading parity, AutoFit-Fixed un-stretch,
> **table styles end-to-end** (minted real-Word definitions + visual bake + dynamic gallery +
> direct-border precedence), 27 real Fluent icons, and **fresh/imported tables now render cell
> gridlines** (the "big box" fix — inside borders paint via CSS vars, export-pure).
> Gates: **PM 192/192**, legacy 257, smoke 9/9 × 2, docx 17.
>
> **Slice 7 is DONE** (`feature/phase-2-slice-7-file-io`, PR #24 pending): **file-io on the PM
> engine** — open docx/html/htm/txt/**csv-as-table** (recorded deviation; csv opens UNSAVED per
> §5.3) + save/Save As docx/html/txt (two-phase `doc:askSavePath`; `doc:saveAsBytes` removed);
> imports rebuild the editor from the blank template + the fork's `html` constructor option
> (stay docx-exportable); degraded imports recover to a blank PM editor + `Files` unbinds via
> `PM.lastImportBlanked()`. **Gate transition (D7.6):** new **`test:roundtrip`** (27 checks,
> real-Word fixtures) is THE docx gate; `test_docx.js` demoted to the frozen legacy-converter
> gate (retires at slice 11). Slice-4 list-marker leak FIXED in fork `handleDocxPaste`
> (tag-early/remove-late, NOTICE'd). Oracle legs A–D PASS/recorded vs Word 16.77.1 — driven
> directly via computer-use MCP (first slice; slice-6 table-style reopen recheck closed).
> Gates (six): **PM 206/206**, legacy 257, smoke 9/9 × 2, docx 17, **roundtrip 27/0**.
>
> **Windows replication is DONE (2026-06-11):** development moved to the user's **Windows 11**
> machine — all six gates green on Windows (one Mac-vacuous PM test spy-hardened); the
> **Windows COM oracle** (`scripts/oracle/word-oracle-win.ps1`) ported, live-validated,
> critique-hardened; the two gitignored real-Word roundtrip fixtures re-authored
> (`author-fixtures-win.ps1`). From slice 8 the parity reference is **Word for Windows 16.0**
> (slices 1–7 stay validated vs Word for Mac 16.77.1). *(The short-lived
> completion-driven-agent-loop process was retired the same day — its Windows Step-0 work and
> the slice-8 build merged to `main` via the normal PR flow (PR #25); `docs/loop/` was removed
> and the deferral ledger lives on at [deferrals.md](deferrals.md).)*
>
> **Slice 8 is DONE** (`feature/phase-2-slice-8-review`, PR #25): area **`review` FLIPPED** —
> fork-engine **Track Changes** (ribbon latch + Ctrl+Shift+E + D8.7 Lock Tracking password
> dialog), tracked ins/del/format render + changed-line bars + format balloons + the
> Word-anatomy **Revisions pane** (comments count), modern contextual **comment cards**
> (composer/reply/like/edit/resolve + Contextual|List + right-dock pane) on the Document-API
> path (A2 — comments EXPORT), accept/reject(+advance)/all/by-selection, display modes
> (All/Simple/None/Original — fork-native ×3 + CSS ×1), Show Markup latches, **Track Changes
> Options (+Advanced, honestly-consumed settings) + Change User Name**, **Compare → REAL
> tracked-changes diff** (`PM.runCompare`, right-to-left fresh-offset-map apply), **Restrict
> Editing pane** (engine `setEditable`), proofing re-points (Word Count/Editor pane/Thesaurus/
> Accessibility Assistant/Read Aloud per-word `::highlight`/Language P9/Spelling P3), R2/R3
> enablement greys, **D8.8 titlebar mode pill** (Editing|Reviewing|Viewing). Parity: 57-item
> checklist ticked via the 58/58 DOM/behavior audit (`scripts/probe-slice8-parity.js`);
> **oracle legs A+B PASS vs Word for Windows 16.0 over COM** (w:ins/w:del/**w:rPrChange** +
> comments survive Word's own resave; Word-authored revisions import with real authors;
> `notes/2026-06-11-slice8-oracle.json`). Gates (six): **PM 237/237**, legacy 257,
> smoke 9/9 × 2, docx 17, roundtrip 27/0.
>
> **Slice 9 is DONE** (`feature/phase-2-slice-9-references`, PR pending): area **`references`
> FLIPPED** — TOC (create-from-headings/update/remove; page numbers degrade to `'0'`),
> footnotes/endnotes (insert + a clone-owned continuous-flow **notes area** `#pm-notes-area`
> editing bodies via the Document API), captions + Table of Figures (SEQ; ToF = raw `TOC \c` field),
> citations/bibliography (real source store + exportable CITATION/BIBLIOGRAPHY fields + style combo),
> index + Table of Authorities (numeric `\c`), and cross-reference — all wired to the fork's
> **SuperDoc Document API** (`editor.doc.*`) via new `bridge/references.ts` + `bridge/notes-area.ts`;
> ribbon `H.*` re-pointed via `PMA()` (legacy byte-identical; leak audit clean); both `[0a]` D6
> guards repointed `tableOfContents`→`startMailMerge`; NOTICE'd fork fix (`toc-entry-builder.ts` reads
> `outlineLevel ?? outlineLvl`) so Add-Text feeds the TOC. Gates (six): **PM 275/275**, legacy 257,
> smoke 9/9 × 2, roundtrip 27/0, docx 17/0. Oracle vs Word for Windows 16.0: **Leg A clone→Word
> PASS** (footnotes/TOC/SEQ/CITATION/sources survive Word's resave unchanged), **Leg B Word→clone
> partial** (footnotes+TOC import; SEQ caption + CITATION drop on import — a recorded fork-converter
> follow-up). `notes/2026-06-12-slice9-oracle.json`.
> **Next: slice 10 — themes · mail-merge · draw · insert-exotica** (§9.1 row 10; independent PRs).
> ⚠️ Carry-over: the fork docx importer drops SEQ/CITATION complex fields → nodes (Leg B) — a
> prioritized fork-importer follow-up; slice-6 UI-Codex leftovers fold into slice-10/11 parity.
>
> **Slice 10 PR 1 (mail-merge) is DONE** (`feature/phase-2-slice-10-mail-merge`, PR pending): area
> **`mail-merge` FLIPPED** with MAXIMAL real-MS-Word fidelity — merge fields are REAL Word
> `MERGEFIELD` field codes (`w:fldSimple`/`w:fldChar`), NOT `w:sdt` content controls, round-tripping
> BOTH directions over the fork's mounted `FieldAnnotation` node. New fork work (NOTICE'd): an export
> branch in `translate-field-annotation.js` (`w:fldSimple` MERGEFIELD/GREETINGLINE · 5-run `w:fldChar`
> ADDRESSBLOCK · **3-run** NEXT, no spurious result) + an import path (`mergefield-preprocessor` +
> `sd:mergeField` `NodeTranslator` + a `generateV2HandlerEntity` in `docxImporter`, flag-independent of
> `editor.options.annotations`). New `bridge/mail.ts` (insert/highlight/non-destructive preview via
> `updateFieldAnnotations`/PM-aware Finish&Merge); `WC.Mail` doc-writes + `commands.js` rule inserts
> re-pointed via `PMA()` (legacy byte-identical; leak audit clean); both `[0a]` D6 guards repointed
> `startMailMerge`→`margins`/`header` (Phase-7-gated). Gates (six): **PM 285/285**, legacy 257, smoke
> 9/9 × 2, roundtrip 27/0, docx 17/0. Oracle vs Word 16: **Leg A clone→Word PASS** (ROUNDTRIP_OK no
> repair; Word's own resave preserved all 5 field codes), **Leg B Word→clone PASS** (automated
> `[10mm]` real-fixture import). `notes/2026-06-12-slice10-mailmerge-oracle.json`. A 2-lens review of
> the flip commit verified byte-identity+leak clean and caught 2 majors on gate-untested paths (PM
> merge resolver vs preview; checkErrors name read) — fixed in `e9e2242`. ⚠️ Ledger: rule-field IF
> operator semantics (C) · composite-import placeholder (C) · envelopes/labels page geometry (A).
>
> **Slice 10 PR 4 (draw) is DONE** (`feature/phase-2-slice-10-draw`, PR pending): area **`draw` FLIPPED** at MAXIMAL
> real-MS-Word fidelity — a STRICT UPGRADE over legacy (whose SVG ink never exported to .docx). Freehand strokes persist as
> REAL DrawingML freeform shapes: net-new fork `insertInkShape` + `synthesizeInkDrawing` (a:custGeom/a:pathLst moveTo+quadBezTo
> + a:ln pen stroke, wp:anchor floats-where-drawn, on a vectorShape.drawingContent blob the existing translateVectorShape
> replays — zero new exporter code, the WordArt mechanism; docPr id via generateDocxRandomId); `VectorShapeView` empty-for-isInk.
> New `bridge/draw.ts` (d* verbs incl. dInsertCanvas = a real prstGeom rect frame; non-dirtying tool state) + `bridge/ink-overlay.ts`
> (a `.wc-ink-layer` #pages-sibling overlay: captures strokes, persists each as a real shape on pointerup, renders ALL ink from
> the doc — fresh inkPoints AND reopened importer customGeometry.paths). Legacy WC.Draw/commands.js/ribbon.js re-pointed (pen-tile
> bypass + two-state; legacy byte-identical; leak audit clean). Gates (six): **PM 317/317**, legacy 257, smoke 9/9 × 2,
> roundtrip 27/0, docx 17/0. Oracle vs Word 16 **Leg A+B PASS**: an EARLY Task-1 gate proved the custGeom blob opens in Word
> (inline+anchor) BEFORE the flip (the PR3 lesson) → kept INK_MODE='anchor'; Leg A Word opens a 3-stroke+canvas doc without repair
> + preserves custGeom/wp:anchor/pen-colors/highlighter-alpha/prstGeom-rect on resave; Leg B clone re-imports Word's serialization
> healthy + the overlay renders all 3 imported strokes. `notes/2026-06-13-slice10-draw-oracle.json`. ⚠️ Ledger: real InkML
> w14:contentPart + real wpc:wpc canvas deferred (net-new); inkToShape/inkToMath honest toasts; arcTo dropped; highlighter =
> translucent freeform; live pointer-capture needs a manual `npm start` draw to confirm.
> **Next: slice 11 = legacy retirement** (slice 10 complete).
>
> **Slice 10 PR 3 (insert-exotica) is DONE** (`feature/phase-2-slice-10-insert-exotica`, merged): area
> **`insert-exotica` FLIPPED** at MAXIMAL real-MS-Word fidelity. The 14 exotic Insert commands dispatch to the
> new **`bridge/insert-exotica.ts`** (15 `xe*` verbs): dropCap = real `w:framePr`; coverPage = real `w:sdt`
> docPartObj (replace-existing); dateTime/quickParts = real `DATE`/`AUTHOR`/… `w:fldChar` fields
> (`editor.doc.fields.insert`); screenshot/icons/onlinePictures = real `w:drawing` images (`PM.insertImage`);
> textBox = editable VML `v:textbox` via net-new fork `insertTextBox` (NOTICE'd); WordArt = real DrawingML via
> net-new fork `insertWordArt` + `synthesizeWordArtDrawing` (`wps:wsp`+`bodyPr fromWordArt`+`a:prstTxWarp`+`w14`,
> NOTICE'd); onlineVideo = real link + Phase-7 toast; chart/smartart/object(OLE)/signatureLine = honest no-op
> toasts. 2 net-new fork commands. Legacy `WC.Insert.*`/commands.js re-pointed (legacy byte-identical; leak audit
> clean incl. the screenshot leak the first grep missed). Gates (six): **PM 310/310**, legacy 257, smoke 9/9 × 2,
> roundtrip 27/0, docx 17/0. Oracle vs Word 16 **Leg A+B PASS**: first run FAILED Word open — **bisected** to the
> coverPage sdt `<w:id>` (an ST_DecimalNumber; the critique-driven non-numeric string id was a hard schema
> violation) — **fixed** to a digits-only string; after the fix Word opens the 5-construct doc WITHOUT repair +
> preserves framePr/docPartObj/DATE/WordArt-wps/v:textbox on resave; Leg B clone re-imports Word's serialization
> healthy. `notes/2026-06-13-slice10-exotica-oracle.json`. ⚠️ Ledger: block-level VML-textbox import (user-approved
> defer — EXPORT real, reopen→passthrough) · WordArt non-editable/flat in-app · dropCap 'drop' not painted in-app ·
> icon SVG-only drawing · chart/smartart/OLE/signatureLine no construction path · onlineVideo no webVideoPr.
> **Next: slice 10 PR 4 = draw** (then slice 11 legacy retirement).
>
> **Slice 10 PR 2 (themes) is DONE** (`feature/phase-2-slice-10-themes`, merged): area **`themes`
> FLIPPED** at MAXIMAL real-MS-Word fidelity — themes/styleSet/colors/fonts **redefine NAMED-STYLE
> DEFINITIONS** (Heading1/2/3/Title/Subtitle/Normal) so headings restyle like real Word. Net-new fork
> command `redefineNamedStyles` (NOTICE'd) mutates BOTH the export structure (`translatedLinkedStyles.styles`
> + `syncStylesDiffToConvertedXml` → real `<w:style><w:rPr>` font+color, DELETING the `w:asciiTheme`/
> `w:themeColor` bindings so Word honors the literal) AND the visual array (`converter.linkedStyles[].definition.styles`,
> the decoration source), then forces a regen + emit (PREVIEW_META-tagged in hover so it never dirties).
> pageColor = net-new real `w:background` exporter/importer + `background` doc-attr + `displayBackgroundShape`
> settings flag (4 fork edits, NOTICE'd); pageBorders = real `w:pgBorders` (`editor.doc.sections.setPageBorders`);
> paragraphSpacing = real docDefaults `w:spacing` (`editor.doc.styles.apply`); watermark = honest visual stand-in
> + toast (Phase-7); effects/setAsDefault clone-owned. New `bridge/design.ts` (17 `de*` verbs + hover preview)
> + `PM.markDirty()` in io.ts; `WC.Design` re-pointed via `PMA()` (legacy byte-identical; leak audit clean).
> Gates (six): **PM 299/299**, legacy 257, smoke 9/9 × 2, roundtrip 27/0, docx 17/0. Oracle vs Word 16:
> **Leg A clone→Word PASS** (ROUNDTRIP_OK no repair; Word preserved w:background/displayBackgroundShape/
> w:pgBorders/heading color/Normal font/docDefaults spacing; K9 theme-deletes held; heading font survives via
> Normal-inheritance), **Leg B Word→clone PASS** (clone imports Word's serialization healthy). Live heading
> repaint confirmed. `notes/2026-06-13-slice10-themes-oracle.json`. The final whole-branch review caught a
> hover-preview-dirties-styled-doc bug (fixed `06bfeb5`, PREVIEW_META). ⚠️ Ledger: Style-Set/Spacing hover
> preview commit-only (C) · body-font live render best-effort (A/K2) · named-style not theme-token (C/K5) ·
> watermark/on-page render Phase-7 (A).
> **Next: slice 10 PR 3 = insert-exotica** (then draw).

**Goal:** make the owned engine the **ACTIVE** editor — wire `WC.RIBBON` commands → PM transactions,
feature area by feature area, and **retire the legacy `contenteditable` editor** (no more "two
worlds"; the new `#pm-editor` becomes THE page). Strangler-fig: flip one feature at a time, never
big-bang; gate on the 257/17 suites + per-feature Word fidelity.

**First actions (next session — slice 0b):**
- [x] **Integrate Phase 1 first** (merged to `main` via PR #10), then cut `feature/phase-2-editing-core`.
- [x] Run Phase 2 through its own cycle: **`brainstorming` → `writing-plans` → subagent execution**.
- [x] Decide the **command→transaction bridge**: `WC.PM` bridge (D5) + page flip to `#pm-editor` (D1) — DONE in slice 0a.
- [x] **Per feature flipped:** validate behavior + UI vs real Word (macOS AppleScript oracle); keep
  the gates green; add PM regression tests in `scripts/test-suite-pm.js`. *(Protocol established +
  run for slice 1; repeats every slice.)*
- [x] Wire **`.docx` SAVE/export** on the new engine — slice 0b (file-IO bytes layer). DONE.

**Watch-outs:** no pagination yet (Phase 7 — continuous flow is expected, not a regression);
list-marker/spacing fidelity is per-feature polish; keep the headless Editor reachable for export;
hold the single-PM-copy + telemetry-off invariants.

## Daily work log (newest first — check off what got done)

### 2026-06-26 (COMPLETENESS PASS — Home tab: 018 Find/Replace advanced + ultracode "finish all")
- [x] **🏁 018 Find/Replace advanced COMPLETE + ff-merged → main** (`feat(home)` @ `dd33a2a`, pushed): special chars ^p/^t/^l (NO-FORK regexSource seam), Go To Page (NO-FORK coords.pageIndexOfPos), find-by-formatting (NO-FORK navigation `findFormatting`), wildcard {n,m}/() (2 minimal additive fork edits). Built off a 5-reader spike Workflow. Gates pm 473 / smoke 9 / roundtrip 27 / bundle 4. /code-review high → 8 fixes.
- [x] **User directive: "finish all" + ultracode ON** → autonomous workflow-orchestrated execution of the remaining Home direct-TDD features.
- [x] **🏁 Home-polish batch COMPLETE + ff-merged → main** (`feat(home)` @ `34e8ebd`): Font name catalog (main `fonts:list` IPC), Selection Pane (un-deferred; listObjects/selectObjectAt), Show/Hide ¶ FULL marks (owned formatting-marks decoration plugin), Text Effects Options dialogs. Planned via a 7-reader Workflow. Gates pm 479 / smoke 9 / roundtrip 27 / bundle 4. /code-review high → 13 fixes.
- [x] **🏁 019 Borders (run-level Apply-to-Text) COMPLETE + merged** (`7fc664b`): owned run-border.ts + 3 additive fork edits → `<w:bdr>`. COM: Word opens without repair.
- [x] **🏁 020 Font Color Gradient COMPLETE + merged** (`02c0509`): owned gradient-text-fill.ts + a net-new w14:textFill translator + the import/export/whitelist edits. COM: `Font.Fill.Type == msoFillGradient`.
- [x] **🏁 021 Create-a-Style COMPLETE + merged** (`36ac9ef`): NO-FORK bridge/styles.ts mints a custom paragraph style → styles.xml. COM: Word reads `Styles('WcStyleRed')` (paragraph, bold, 20pt, red TextColor).
- [x] **🏁🏁 ALL HOME FEATURES DONE.** test:pm 491 / smoke 9 / roundtrip 27 / bundle 4. 4 new COM oracles this session.
- [x] **Stubs resolved (user decision):** Dictate, Sensitivity, Add-ins, Reuse Files REMOVED from the Home ribbon (`chore(ribbon)` @ `11ccfaa` — gen.js EXCLUDED_CONTROL_IDS + regenerated ribbon-data.js; dead handlers dropped). The **Editor** stays — its local spell/grammar pane works (only the cloud refinements were ever a stub; test [editor] confirms it renders counts + a suggestion fixes the doc).
- [x] **Home end-to-end review (user-requested):** (a) ICONS — captured the live ribbon (electron `--shot`); the Editing group (Find/Replace/Select) rendered as thin hollow `_24_regular` glyphs vs the solid ribbon. Added a `!filled` opt-in to gen-icons + switched the 3 to filled variants; re-screenshotted to confirm (`ui(home)` @ `84e7e5a`). (b) BUGS — adversarial finder-per-group Workflow → 11 confirmed/plausible of 27 → fixed 9 (`fix(home)` @ `c603f31`): Font-dialog vertAlign-clear + Shading Apply-to-Text [HIGH], gradient-0°/wildcard-match-case/create-style-toast [MED], set-num-value-validate/multilevel-%N/paste-.catch/goto-heading-bounds [LOW]; +4 regression tests. test:pm 491→495.
- [ ] **NEXT:** the INSERT-tab completeness pass (same per-tab loop). (Home is feature-complete + reviewed.)

### 2026-06-26 (COMPLETENESS PASS — Home tab: 017 List authoring)
- [x] **🏁 017 List authoring COMPLETE + ff-merged → main** (`feat(home)` @ `4a1c1a9`, pushed): Bullets/Numbering/Multilevel dropdowns gain Change List Level + Set Numbering Value… + Define New Bullet/Number Format/Multilevel dialogs. **NO-FORK** — new `bridge/lists.ts` (`setNumberingValue`/`continueListNumbering`) reuses the fork's restartNumbering/continueNumbering/changeListLevelBy/applyListDefinition; arbitrary Set-Value = restart + `ListHelpers.setLvlOverride({startOverride:N})` (synchronous invalidation, range-validated 0..32767).
- [x] **Spike (code-read):** confirmed the fork pre-registers every numbering primitive → NO fork edit needed (the ONLY net-new logic was arbitrary Set-Numbering-Value). Recorded in `specs/017-list-authoring/spec.md`.
- [x] **COM oracle** `validate-listauthoring-win.ps1`: Set Numbering Value 5 → Word ListValue 5 (next 6); Define New Number Format lowerLetter "%1)" → "a)","b)". Gates: **pm 459** / smoke 9 / roundtrip 27 / bundle 4.
- [x] **/code-review high** → 3 fixes (value-range validation; multilevel cleared-level keeps its own %N; dialog value clamp) + 2 regression tests; 2 edges documented as v1 limits.
- [ ] **NEXT (Home features):** spec-kit **018** Find/Replace advanced; then the direct medium features (Show/Hide ¶ marks, Font Color Gradient, Create-a-Style, Selection Pane, Text-Effects Options, Borders Inside-Vertical/Apply-to-Text, Font-name catalog); then final Home regression sweep → INSERT tab.

### 2026-06-25 (RE-DISCOVERY campaign — bug-hunt corpus re-baselined; COMPLETENESS PASS active)
- [x] **Re-discovery campaign roadmap** (`13b4394`) — `docs/bug-hunt/RE-DISCOVERY-CAMPAIGN.md`, a re-runnable playbook (full re-baseline · hybrid method · 3 phases). Designed via brainstorming (user: full re-baseline + hybrid).
- [x] **Phase 1 sweep** — 102-agent Workflow (per-tab finder → adversarial verify → synthesis): 137 findings → **127 confirmed** (54 bugs · 73 gaps · 0 S1) in **22 spec-kit-feature buckets**. The old layout-keystone cluster did NOT resurface (paged engine retired it).
- [x] **Fresh corpus committed + pushed** (`f17537c`) — archived the stale 2026-06-17 corpus → `archive-2026-06-17/`; wrote fresh BUG-LEDGER (54 RB-NNN bugs) / FEATURE-IMPROVEMENTS (73 gaps) / FIDELITY-AUDIT / COMPLETENESS-BACKLOG (22 buckets) / findings-2026-06-25.json.
- [x] **Phase 2 — P1 tier hardened** (runtime probes): protection bypass ✅, page-count stuck ✅, mail-merge field codes ✅ (all worse-or-equal to the archived findings); citation data-loss code-confirmed; print/PDF → Phase 3.
- [ ] **NEXT:** **start the Completeness Pass fixes** — P1 #1 protection bypass (feature 014, no-fork editable guard at the WC.PM write seam) first, then P1 #2–5; remaining Phase-2 (~40 needsRuntime) + Phase-3 (46 needsLive) interleave/follow.

### 2026-06-25 (loose-ends session — main pushed; importer page-break + focus-jump scoped)
- [x] **`general-done` → `main` + the page-break FIX shipped to `main`** (user-confirmed, prior sessions): HEAD `150a2b5` — `31a4033` (page break = a real `pageBreakBefore` paragraph, editable) + `150a2b5` (blank-page +2→+1, runaway-Enter via stripping pageBreakBefore from the split continuation [fork edit], edit-scroll-jump deferral). Gates: pm 420 / smoke 9 / roundtrip 27 / bundle 4. User live-confirmed "i can write now."
- [x] **Pushed `main` → `origin/main`** (`487efbd..150a2b5`; in sync 0/0).
- [x] **Scoped the 2 remaining page-break loose ends** (read-only investigation): importer inline-`<w:br page>` gap CONFIRMED (translates to `paragraph→run→hardBreak{page}` → fragment-less uneditable page; fixable NO-FORK by import-time normalization into the shipped `pageBreakBefore`-paragraph model, or fork Option-B) → feature `013` candidate; focus-jump LIKELY RESOLVED by `31a4033`+`150a2b5`, no code change identified, live-only confirmation.
- [x] **Plan docs renewed** (plan-tracking): last-point.md state-correction entry + this log; CURRENT PHASE unchanged (post-migration, closing the page-break thread).
- [x] **🏁 013 importer page-break fix COMPLETE + ff-merged → main** (`694763d`+`005cb9b`, `3fb2e66..005cb9b`, pushed): NO-FORK `bridge/page-breaks-import.ts` normalizes imported inline `<w:br page>` → a real `pageBreakBefore` paragraph (editable page), auto-runs in `replaceEditor`. 3 regression tests; gates pm 423 / smoke 9 / roundtrip 27 / bundle 4; `/code-review` 1 fix (fresh split-attrs via `getSplittedAttributes`); **LIVE-verified by the user** ("it works") on a real Word fixture `C:/tmp/wc-013-input.docx`. The open importer-inline-break gap is CLOSED. v1 limit: table-cell breaks left as-is.
- [x] **Focus-jump recheck — RESOLVED** (no code change; `31a4033`+`150a2b5` already fixed it; live-confirmed via the 013 arrow-key crossing).
- [x] **🏁 All four page-break-thread loose ends CLOSED.** NEXT (user's pick, deferred per "stop & reassess"): the COMPLETENESS PASS (`docs/bug-hunt/`) OR pivot to Phase 5 (Logger).

### 2026-06-21 (🚢 MIGRATION SHIPPED + 002 headers/footers P1 + the test:pm false-green fix)
> (The migration days 06-18→06-21 were tracked in [layout-engine-runbook.md](layout-engine-runbook.md), not here — this is the consolidated checkpoint.)
- [x] **Paged-render migration** M1…M6 + paged open/new + the paged-default **FLIP (FR-013)** + doc reconciliation — **shipped to `origin/main`** (`7af5590`); paged is the default engine, overlay is legacy behind `WC_LAYOUT=overlay`.
- [x] **002 Headers & Footers P1** (`specs/002-headers-footers/`) — on-page header/footer editing on the paged engine + the "Header & Footer Tools" contextual tab, **fully no-fork** (probe-first spike found the entry/exit/state on the PE's public surface); 52-agent `/code-review` → 4 fixes; **merged to `main`** (`a3e46da`).
- [x] **Gate fix** — found the migration's "paged test:pm 475" was a **FALSE GREEN** (a stale `localStorage WC_LAYOUT` made paged builds boot overlay; `test:pm` is an overlay-rendering suite — ~70 overlay-only tests). Pinned `test:pm` to overlay via a boot-guard (`0f828a7`); paged covered by the `probe:*` probes. Memory `paged-testpm-overlay-suite`.
- [x] **Plan docs renewed** (plan-tracking): the layout engine (Phase 4) is DONE → **POST-MIGRATION phase**; CURRENT PHASE + gate baseline corrected.
- [x] **002 Headers & Footers P2** (`fefbbf9`) — Different First Page + Different Odd & Even header/footer variants (story-runtime `variant` locator + `sections.setTitlePage`/`setOddEvenHeadersFooters`); "Options" toggles on the H&F Tools tab; **no-fork**, Word-COM-validated; 40-agent `/code-review` → 1 fix + a pre-existing gate-`build('overlay')`bug. Merged to `main`.
- [x] **002 Headers & Footers P3** (`4bfb442`) — real OOXML `PAGE`-field page numbers (`fields.insert` on the slot story editor); Page Number flyout; `ensureInlineTarget` (K-risk-1); **no-fork**; oracle C3 (wdFieldPage=33). **KNOWN fork-gated gap:** in-app render of a freshly-inserted field shows "0" (Word resolves per page). 36-agent `/code-review` → 1 fix. Merged to `main`.
- [x] **002 Phase-6 polish** (`5d86503`) — doc reconciliation (SCOPE/FEATURES/LAYOUT_ENGINE). **🏁 002 COMPLETE.** Gates: pm 475 / smoke 9 / roundtrip 27 / bundle 4 / `test:roundtrip:paged` 36 / `probe:headerfooter` paged 52 + overlay 45.
- [x] **003 columns — planned + P1 shipped** (`a2bc298` plan, `3326938` P1): `/speckit-specify`+`/speckit-plan`+`/speckit-tasks` → `specs/003-columns/`; P1 (One/Two/Three presets) wired no-fork onto the paged engine (`bridge/columns.ts` → `sections.setColumns`; un-deferred `columns`; rewired the dead-`E()` `columnsMenu`; 3 D6 guards repointed columns→breaks). Real Word: `TextColumns.Count==2`. Gates: pm 475 / smoke 9 / roundtrip 27 / bundle 4 / `test:roundtrip:paged` 42 / `probe:columns` paged 15 + overlay 12.
- [x] **003 columns COMPLETE** (P2 `63d94ee`, P3+polish `eff06c3`): P2 = More Columns (count/spacing/equalWidth) + Left/Right unequal + line-between (owned `bodySectPr` w:cols write — `<w:col>`/`w:sep`); P3 = a column break (`hardBreak{lineBreakType:'column'}`); un-deferred columns+breaks, rewired the dead-`E()` columnsMenu + Breaks flyout. Real Word: `TextColumns` Count/even/spacing/LineBetween/per-col Width (= Word's Left preset) + column break. Gates: pm 475 / smoke 9 / roundtrip 27 / bundle 4 / `test:roundtrip:paged` 49 / `probe:columns` paged 39 + overlay 36.
- [x] **004 line-numbers P1 DONE** (`aaf0347`): Layout→Line Numbers modes (None/Continuous/Restart-Each-Page/Restart-Each-Section) → `bridge/line-numbers.ts` `setLineNumbers`→`sections.setLineNumbering` (real `sectPr/w:lnNumType`); un-deferred `lineNumbers`, rewired `H.lineNumbers` off the retired `E()`/`WC.Layout`, repointed 3 D6 guards →`hyphenation`. Real Word (C6): Active + RestartMode=continuous + CountBy=2, no repair. DISCOVERY: `w:start=3`→Word `StartingNumber=4` (off-by-one) → start-at deferred to P3. Gates: pm 475 / smoke 9 / roundtrip 27 / bundle 4 / `test:roundtrip:paged` 57 / `probe:linenumbers` paged 19 + overlay 19.
- [x] **004 line-numbers P2 DONE** (`fe12e4b`): the in-app owned margin-number overlay `bridge/line-numbers-overlay.ts` — draws `.wc-line-number` beside each painted body line (count `n%countBy===0`, per-page reset for newPage, excludes header/footer/footnote/table), `#pages`-local geometry, `wc:linenumbers-changed`+`wc:paged-relayout` triggers, READ-ONLY + paged-only. Built via ultracode workflows (understanding sweep + adversarial review → 2 refuted + 5 fixed, incl. multi-column line ordering via `data-pm-start`). Gates: pm 475 / smoke 9 / roundtrip 27 / bundle 4 / `probe:linenumbers` paged 25 + overlay 21.
- [x] **004 line-numbers P3 DONE → 🏁 004 COMPLETE** (`02a54f7`): the Line Numbering Options dialog (mode/start/count-by/from-text distance, `replace:true` full-set) + per-paragraph suppress (`updateAttributes('paragraph', {'paragraphProperties.suppressLineNumbers': true|null})` — spike-proven no-fork) + the overlay skipping suppressed paragraphs. `start` is USER-FACING (bridge writes raw `w:start=userStart−1`, the P1 off-by-one). Ultracode: spike workflow + a 28-agent adversarial review → 2 confirmed (the SAME bug: partial-update **carryover** — lowering start/distance left the stale attr) + 21 refuted; FIXED via the `replace:true` drop-then-recreate. Real Word (C6): StartingNumber===5, CountBy 2, the suppressed paragraph carries `w:suppressLineNumbers`. Gates: pm 475 / smoke 9 / roundtrip 27 / bundle 4 / `test:roundtrip:paged` 60 / `probe:linenumbers` paged 52 + overlay 45.
- [x] **005+ cleanup backlog → an autonomous `/loop` into a `general-done` branch** (user decision 2026-06-22): the 5 cleanup items run as spec-kit features into `general-done` (off `main`; **user merges general-done→main at the END** — nothing pushed during the loop). Ratified a project **CONSTITUTION** first (`.specify/memory/constitution.md` v1.0.0, `4b00681`). Loop order: **005 hyphenation ✅** → 006 section breaks → 007 paged test-coverage port → 008 overlay retirement (after 007) → 009 M6→gate → 010 import fidelity → 011 pagination calibration → 012 frames group. Each: full spec-kit chain + 4 gates + paged probe + Word-COM oracle + `/code-review` → ff-merge into general-done. STOP-and-ask: 011 fork-edit, the 008 overlay deletion, any not-no-fork spike.
- [x] **🏁 005 hyphenation COMPLETE** (ff-merged into `general-done` @ `22f682d`): None/Automatic + Options dialog (zone/consecutive-limit/hyphenate-CAPS) + Manual — document-level `settings.xml` via an OWNED converter write (`bridge/hyphenation.ts`; the fork has no hyphenation translator), NO-FORK. 31-agent `/code-review` → 2 confirmed (multi-node Manual position-map bug + a probe-placement gap) both fixed. KEY: Word COM `HyphenationZone` is broken (9999999 for any value) → zone XML-validated; CT_Settings order load-bearing (`placeHyphenation`). Gates: pm 475 / smoke 9 / roundtrip 27 / bundle 4 / probe:hyphenation paged 28 + overlay 28 / `test:roundtrip:paged` 68.
- [x] **🏁 006 mid-doc section breaks COMPLETE** (ff-merged into `general-done` @ `008db22`): Layout → Breaks → Section Breaks (Next Page / Continuous / Even Page / Odd Page), NO-FORK. The PUBLIC `insertSectionBreakAtSelection` command sets a paragraph `pPr/w:sectPr` (Next Page); typed variants add `<w:type>` on the BODY sectPr (the section after the break) via an owned `state.doc.attrs.bodySectPr` write. Early spike proved feasibility (Word reads 2 sections). 14-agent `/code-review` → 1 confirmed (multi-break typed corruption) → FIXED with a v1 guard (refuse a 2nd+ typed break; multiple Next Page fine). KEY findings: type goes on the body/next-section sectPr (Word-verified); the caret needs `setTextSelection({from,to})`; the mid-doc break sectPr exports self-closing. KNOWN: no in-app repaginate (export-faithful); single typed break per doc. Gates: pm 475 / smoke 9 / roundtrip 27 / bundle 4 / probe:sectionbreaks 16 / `test:roundtrip:paged` 78.
- [x] **🏁 007 paged test-coverage port COMPLETE** (ff-merged into `general-done` @ `b89bdc5`): `test:pm` is now MODE-AWARE — a genuine paged build passes without a false-green (the met prerequisite for 008). `PAGED_SKIP` (59 overlay-only → ⊘ skip-pass naming the covering probe) + `PAGED_KNOWN_GAP` (10 real deferred gaps → ⚠️ visible) + `[0a]` ported; `t()` runs-body-then-converts (skip-body broke chained tests); new `run-pm-overlay.js`/`run-pm-paged.js` assert the booted mode (footgun closed both ways). 20-agent `/code-review` → 2 defects fixed (6 `[4d]` over-skips re-triaged SKIP→KNOWN_GAP; the overlay gate's lost mode-assertion restored). **3 REAL PAGED GAPS surfaced (tracked):** html-import-dumps-raw-text→010; `PM().openDocx()` teardown→open-path backlog; ribbon table-formatting no-ops in paged→`task_cb2781a7`. Gates: overlay `test:pm` 475 (mode=overlay) / `test:pm:paged` 475 (mode=paged, 59 skip + 10 known-gap) / smoke 9 / roundtrip 27 / bundle OK. TEST INFRA only (no src/fork/generated/oracle).
- [x] **🏁 008 overlay retirement COMPLETE** (ff-merged into `general-done` @ `475173f`): the legacy continuous-flow OVERLAY render engine is FULLY removed (user-approved at a HARD-STOP). Paged PresentationEditor is the SOLE engine. Staged P1–P4: P1 deleted `pagination.ts`+`notes-area.ts`, paged-unconditional (footgun killed); P2 `replaceEditor`→paged-only + all dead overlay branches cleared (zero `__WC_LAYOUT_MODE` refs in app code); P3 deleted the 59 overlay-only `test:pm` tests (paged-only 416 + `test-mapping.md`) + the overlay test infra + `check-overlay-bundle`→`check-entry-bundle` + dead CSS; P4 docs reconciled (gate command → `npm run build && npm run test:pm`) + 12-agent `/code-review` (0 confirmed / 8 refuted, SAFE). KEY: the `[8]`/`[11]` synergy was DISPROVEN (openDocx→replaceFile round-trip teardown is a separate backlog gap — stays known-gap); entry ~8.5MB is the shared fork graph (not a regression). Gates: test:pm 416 / smoke 9 / roundtrip 27 / test:bundle 4 / test:roundtrip:paged 71.
- [x] **🏁 009 M6 glyph-tolerance GATE COMPLETE** (ff-merged into `general-done` @ `a33b760`): turned the dev-box-only `report:glyphgeom` (report-only) into a pass/fail GATE asserting the `m6-glyph-tolerance.md` thresholds per single-page fixture (wrap 100% / start-X p95 ≤ 1.0pt / line-Y p95 ≤ 6.0pt / page-count exact) + exit 1 on breach; `test:glyphgeom` alias. Validation infra, NO src/fork. The multipage PE-2-vs-Word-3 divergence is a ⚠️ known-gap → 011 (keyed on fixture IDENTITY after a review fix, so a single-page regression can't escape). Dev-box verify: GATE 64/64 PASS; SC-002 proven (not a no-op). 1-agent review → 1 Medium fixed (identity-vs-page-count routing). Core gates unaffected.
- [x] **🏁 010 PAGED IMPORT FIDELITY COMPLETE** (ff-merged into `general-done` @ `2f312ca`): fixed the `[7]` PAGED_KNOWN_GAP — paged `WC.Files.open('*.html')` dumped raw HTML as literal text (`insertContent(htmlString)` doesn't parse in the paged PE). NO-FORK fix: import the public `createDocFromHTML` helper (`@core/helpers`), parse `extra.html` → full-body `tr.replaceWith` in `bridge/index.ts`'s html leg; txt/csv ride the same leg → fixed for free. `[7]` moved OUT of PAGED_KNOWN_GAP → genuine PASS (test:pm 416, pagedKnownGaps 10→9). 1-agent review → 0 confirmed defects (no-fork confirmed; `replaceWith` preserves sectPr; guard intact). 4 core gates green.
- [x] **🏁 011 PAGINATION CALIBRATION COMPLETE** (ff-merged into `general-done` @ `2f188c1`): closed the M6/009 PE-2-vs-Word-3 multi-page divergence — ⚠️ a user-AUTHORIZED Constitution-P1 FORK EDIT (the stop-and-ask point; spike proved no no-fork seam). Root cause (spike): PE's "single" line spacing was a flat 1.15× floor fed the TIGHT glyph box, so the floor (12.65pt) always won; Word uses the font's NATURAL box (Canvas fontBoundingBox Calibri 11pt = 18px = 13.5pt). Fix: `measuring-dom` captures `fontBoxHeight` + feeds `max(ascent+descent, fontBoxHeight)` into resolveLineHeight (monotonic; fonts ≤1.15× unchanged; baseline untouched). Multipage now PE 3 == Word 3 [48,48,2]; single-page fidelity IMPROVED (Segoe 4.91→1.5, Calibri 1.69→0.75); the gate ASSERTS the multipage now (65/65). 1-agent review → 0 confirmed (empty-para 0.85pt-shorter = tracked follow-up `task_689a9083`). 4 core gates green.
- [x] **🏁 012 FRAMES GROUP COMPLETE** (ff-merged into `general-done` @ `979bb86`): un-deferred the last `layout-arrange` controls — Position, Align, Rotate — NO-FORK. They were `isBlocked` + routed to the retired `WC.Layout`; the bridge already had `setImageTransform` (rotate/flip → a:xfrm) + `setImagePosition` (offset → wp:posOffset). 012 = wiring + new `setImageAlign({h})` (margin-relative horizontal offset) + add position/align/rotate to ENGINE_READY + rewire H.position/align/rotate onto WC.PM. group/ungroup + selectionPane + vertical align stay deferred (documented v1). probe:frames 13/13; Word-COM oracle rotation=90/horizontalFlip=msoTrue/leftPt=75/wrapType=square. 1-agent review → 0 confirmed. 4 core gates green.
- [x] **🏁🏁 THE general-done LOOP IS COMPLETE — all 8 features (005–012) merged.** NEXT (USER): merge `general-done` → `main` (the loop never touched main / never pushed). Then the COMPLETENESS PASS (`docs/bug-hunt/`) or further per-feature reconciliation (user's pick). Follow-ups spun off: `task_689a9083` (011 empty-para line height), `task_cb2781a7` (paged ribbon table cmds), `task_3436e431` (paged counts().pages).
- [x] **POST-LOOP (2026-06-23) on `general-done`:** npm-start fix (`a92740b`, `start` → `electron-vite preview` so the app shows) + page-break root-cause deep-dive (`e621b18` → `docs/PAGE_BREAK_ROOT_CAUSE.md`). **`general-done` @ `e621b18` is READY for the user's ff-merge → `main`.** The page-break FIX is a SEPARATE branch `fix-pagebreak-optionB` @ `f9ba2cf` (no-fork pageBreakBefore model; gates green; ⚠️ PENDING the user's LIVE click/cursor test before merge). See last-point.md (top).

### 2026-06-17 (ITEM 4 keystone carve-out DONE — drag-reposition; STEERING INFLECTION on the render tier)
- [x] **Keystone scope-workflow** audited 4a-4f: MODEL/EXPORT tier ~90% done; the remainder is the
  VISUAL/RENDER tier (overlay/paged-container rework) — architectural, no objective COM gate, a design fork.
- [x] **ITEM 4 carve-out — image drag-to-reposition — DONE (PR #132 `15aae62`, Word-COM-validated)** —
  move-region on the resize overlay writes marginOffset → wp:posOffset; Word read-shapes Left=120pt/Top=60pt
  after a +160/+80px drag. `[4c]` synthetic-drag gate test + probe. /code-review fixed a listener
  cross-contamination. Gates: **PM 475 / smoke 9 / roundtrip 27**. ALL 4 big items now have shipped,
  COM-validated increments (#126/#128/#130/#132).
- [ ] **STEERING:** keystone COM-validatable surface EXHAUSTED. Remainder = visual render (z-stacking,
  line/row-split render, on-page header band, page-number render) — no COM gate + render-model fork
  (A overlay vs B paged containers). Asked the user (A/B + next priority). Possible export-loop increment:
  page-number FIELD in header/footer (builds on item 3; verify validatability).

### 2026-06-17 (finish-all loop — ITEM 3 header/footer text DONE; NEXT = item 4 frames-overlay keystone)
- [x] **ITEM 3 header/footer text — DONE (PR #130 `2e6302b`)** — set/read/round-trip the real OOXML parts
  (word/headerN.xml + sectPr w:headerReference + rel). New bridge/header-footer.ts over the story-runtime
  (resolveHeaderFooterSlotRuntime → headless story editor → commit); NO converter code. ENGINE_READY
  un-block header/footer; Edit modal (run + dropdown dispatch). **Word COM-validated:** Sections(1).Headers(1)
  .Range.Text=='HdrProbe'/Footers=='FtrProbe'. `[9]` test (parts+refs+round-trip+re-edit-replace); repointed
  [0a]/[11] block probes to pageNumber. /code-review: removed editability-leak + added re-edit test.
  Gates: **PM 474 / smoke 9 / roundtrip 27**. LESSON: "keystone-gated" can be PARTIAL — the export half is
  often independent of the visual half; ship the COM-validatable export slice, defer on-page rendering.
- [ ] **NEXT — ITEM 4: frames-overlay KEYSTONE** (docs/LAYOUT_ENGINE.md) — biggest/last, ARCHITECTURAL.
  Deep scope-workflow over LAYOUT_ENGINE.md + PresentationEditor/pagination → decompose into shippable
  sub-PRs (float/image resize+relocate, on-page header band, page numbers). Multiple PRs; steer if needed.

### 2026-06-16 (finish-all loop — ITEM 2 picture grayscale DONE; a14 deferral was an enum misread)
- [x] **ITEM 2 picture grayscale — DONE (PR #128 `091c737`)** — Picture Format > Color > Grayscale. Bridge
  setImageGrayscale + render attr as CSS filter (image.js renderDOM) + Adjust>Color UI. **Word's own OOXML
  is plain `<a:grayscl/>` (NOT a14) — the converter already round-trips it; ZERO converter work.** The prior
  "needs a14" deferral was a FALSE NEGATIVE: ColorType==2 IS grayscale (1-based MsoPictureColorType, not
  0-based). Scope-workflow authored grayscale in live Word + extracted bytes. **Word COM-validated:**
  InlineShapes(1).PictureFormat.ColorType==2. `[4b]` ON/OFF + coexistence(grayscale+rotate) test.
  /code-review clean. Gates: **PM 473 / smoke 9 / roundtrip 27**.
- [ ] **NEXT — ITEM 3: headers/footers (4e)** — real header/footer constructs (D6-blocked header-footer
  area). Scope-workflow → edit region + export (header*.xml + sectPr refs) + COM-validate
  (doc.Sections(1).Headers(wdHeaderFooterPrimary).Range.Text). Biggest item before the keystone.

### 2026-06-16 (NEW DIRECTIVE: finish ALL big Phase-4 items, no-stop loop — ITEM 1 page-setup DONE)
- [x] **User directive:** finish ALL big items autonomously, I pick order (memory phase4-finish-all-directive).
  ORDER: ① page-setup export → ② a14 picture effects → ③ headers/footers → ④ frames-overlay keystone.
- [x] **ITEM 1 page-setup export — DONE (PR #126 `aedf0da`)** — LAYOUT margins/size/orientation now export
  to body sectPr (were CSS-only + double-broken). Bridge dePageMargins/dePageSize → sections adapter
  (w:pgMar/w:pgSz). **Word COM-validated:** Narrow+Legal+Landscape → 36pt/1008/612/orient=1. Fixed 2 bugs
  to make it reachable: D6-unblock (ENGINE_READY) + setPageVar dead-E() throw → WC.PM.__repaginate. New
  bridge + UI-flyout-click gate tests; repointed [0a]/[11] block probes to `columns`. Scope via ultracode
  workflow; /code-review ×2 (caught the E() throw). Gates: **PM 472 / smoke 9 / roundtrip 27**.
- [x] **spawn_task task_a4196ed8:** dead E() in manualHyphenate + sibling layout handlers (latent, gated).
- [ ] **NEXT — ITEM 2: a14 picture effects** (deferred grayscale, real a14 OOXML not a:grayscl). Scope-workflow
  → implement → COM-validate (InlineShapes picture format) → gates → /code-review → merge → checkpoint.

### 2026-06-16 (v4 #5 page color — DONE; bounded design backlog EXHAUSTED, `/loop` 5-min cadence)
- [x] **v4 #5 pageColor export + COM — DONE (PR #124 `e325b9a`)** — new oracle; Word read page bg CLEANLY
  (Background.Fill.ForeColor.RGB=65535, Type=1, DisplayBackgrounds=true). New `[10th]` test gates BOTH
  document.xml `<w:background>` AND settings.xml `<w:displayBackgroundShape>` (K4 render flag the old test
  missed) — clear-first non-vacuous + teardown. `/code-review`: softened inaccurate "unreliable" framing.
  Gates: **PM 470 / smoke 9 / roundtrip 27**.
- [x] **v4 COMPLETE / VERDICT:** 5 slices — #1 endnote FOUND+FIXED a real bug; #2–#5 confirm-correct
  coverage. Bounded cleanly-COM-validatable export surface now largely covered + faithful.
- [ ] **NEXT — PATH A:** page-setup geometry (Section.PageSetup margins/size/orientation, clean COM) IF a
  mutate bridge verb exists (verify in bridge/layout.ts + commands.js); else flag it's a feature.
  Low-value remainder (TOC/caption/citation COM) is degraded-by-design — SKIP. **PATH B (recommended):**
  escalate to a STEERED bigger item (a14 picture effects / frames-overlay / 4e headers / highlight UX).

### 2026-06-16 (v4 #4 page borders — Word-COM-validated CORRECT, `/loop` 5-min cadence)
- [x] **v4 #4 pageBorders export + COM — DONE (PR #122 `4f2caf3`)** — Design page-border surface's FIRST
  Word-COM oracle (`oracle-probe-pageborders.js` + `validate-pageborders-win.ps1`, all 4 edges).
  `dePageBorders({solid,#FF0000,width:3})` → Word reads Borders.Enable=true, all edges LineStyle=1/
  LineWidth=24 (3pt)/Color=255 (red). Export faithful — NO source bug. New `[10th]` test gates val/sz/color
  on all 4 edges + `finally{}` teardown (dePageBordersRemove). `/code-review`: validator hardened to all-4
  edges (was top-only). Gates: **PM 469 / smoke 9 / roundtrip 27**.
- [x] **DIMINISHING RETURNS noted:** v4 = 1 real bug (#1 endnote) + 3 confirm-correct (#2–#4). Now mostly
  coverage-building (COM-oracle net), not bug-finding. Consider escalating to a steered bigger item soon.
- [ ] **NEXT (continue v4):** #5 pageColor (`dePageColor` design.ts:201). LOW COM confidence (doc.Background
  reads unreliable) → probe + honest COM-or-byte-only verdict; keep byte test, skip COM gate if unreliable.

### 2026-06-16 (v4 #3 paragraph spacing — Word-COM-validated CORRECT, `/loop` 5-min cadence)
- [x] **v4 #3 paragraphSpacing export + COM — DONE (PR #120 `76bec23`)** — Design tab's FIRST Word-COM
  oracle (`oracle-probe-paraspacing.js` + `validate-paraspacing-win.ps1`). `deParagraphSpacing({before:12,
  after:18,line:3})` → Word reads SpaceBefore=12, SpaceAfter=18, LineSpacing=36, LineSpacingRule=5
  (Multiple). Export faithful — NO source bug. New `[10th]` test gates the full chain (docDefaults
  before+after+line + Normal-style write). Gates: **PM 468 / smoke 9 / roundtrip 27**.
- [x] **Two lessons:** (1) global-style bridge verbs (`deParagraphSpacing` writes Normal+docDefaults, not
  reset by setDoc) need a `finally{}` teardown — a non-zero `before` leaked a top-margin into `[4a]`.
  (2) `/code-review` caught a vacuous `w:line` assertion (prior test leaves line:2→480 in persisted
  docDefaults) → use a DISTINCT value (line:3→720). Also fixed validator enum comment + `$p`→`$para`.
- [ ] **NEXT (continue v4):** #4 pageBorders export + COM (`dePageBorders` design.ts:228; COM
  `Sections(1).Borders`). Then #5 pageColor (LOW COM confidence — likely byte-only acceptable).

### 2026-06-16 (v4 #2 comments export — Word-COM-validated CORRECT, `/loop` 5-min cadence)
- [x] **v4 #2 comments export + COM — DONE (PR #118 `8497efc`)** — review area's FIRST Word-COM oracle
  (`oracle-probe-comments.js` + `validate-comments-win.ps1`). Word reads `Comments.Count==1`, body,
  author "Word User", **Scope "anchor"** (exact span). Export faithful — NO source bug. New `[8]` test
  gates the full set (3 document.xml markers + comments.xml body + non-empty author). `/code-review`:
  validator emits `<scope-error>` sentinel on broken-anchor throw. Gates: **PM 467 / smoke 9 / roundtrip 27**.
- [x] **NEAR-MISS caught:** initial probe showed Scope " ancho" (off-by-one) → traced to the PROBE's own
  `selectText` (`paraPos+1+idx` vs the doc's body-wrapped layout), NOT the exporter. Lesson: confirm the
  probe's selection (`textBetween`) before blaming the engine; anchor off the text node's own pos (`pos+i`).
- [ ] **NEXT (continue v4):** #3 paragraphSpacing export + COM (`deParagraphSpacing` design.ts:120; COM
  `Paragraphs.Item(1).SpaceAfter`/`.SpaceBefore`). Then pageBorders, pageColor (low COM confidence).

### 2026-06-16 (v4 re-scout — endnote-lost-on-export BUG FOUND + FIXED, `/loop` 5-min cadence)
- [x] **v4 RE-SCOUT (3 parallel agents)** over references / comments / design — ranked bounded
  COM-validatable candidates; #1 footnotes+endnotes, #2 comments, #3 paragraphSpacing.
- [x] **🐞 endnote lost on export — FIXED (PR #116 `62f100f`)** — exporter node-router had no
  `endnoteReference` entry → endnote marker dropped from document.xml → **Word read 0 endnotes**
  (body orphaned in endnotes.xml; byte test + roundtrip both stayed green and MISSED it). One router
  line (+import), symmetric with footnote. **Word COM-validated** (new `validate-notes-win.ps1`):
  endnoteCount 0→1. New `[9]` regression test (`<w:endnoteReference>` in document.xml). `/code-review`
  clean. Gates: **PM 466 / smoke 9 / roundtrip 27**.
- [x] **References area got its FIRST Word-COM oracle** (`oracle-probe-notes.js` + `validate-notes-win.ps1`).
- [ ] **NEXT (continue v4):** #2 comments export + COM (`doc.Comments.Count`/`.Range.Text`/`.Author`),
  then #3 paragraphSpacing (`Paragraphs.Item(1).SpaceAfter`). Default to v4 unless the user names a big item.

### 2026-06-16 (numbered-list export test — SCOUT BACKLOG v3 EXHAUSTED, `/loop` 5-min cadence)
- [x] **Numbered-list export test (PR #114 `b59c3ba`)** — v3 #5. Numbered → `w:numPr` + decimal
  numbering.xml abstractNum + multilevel probe. **Word COM-validated:** numbered "simple numbering"/"1.";
  multilevel "outline numbering"/"1.1." (gated multilevel test deferred — level-transition caret quirk).
  `/code-review` clean. Gates: **PM 465 / smoke 9 / roundtrip 27**.
- [x] **SCOUT BACKLOG v3 EXHAUSTED** (only #3 highlight remains — UX-judgment bug, steer). ~17 COM-validated
  export slices merged this run; gates PM 448→465.
- [ ] **NEXT (decision):** RE-SCOUT v4 (references/comments/track-changes/section-geometry/doc-settings export)
  — productive autonomous path; OR ESCALATE a steered big item (a14 picture effects / frames-overlay / 4e
  headers / highlight UX). Default to RE-SCOUT v4 unless the user picks a big item.

### 2026-06-16 (sub/superscript export test — CHAR-FORMAT MATRIX COMPLETE, `/loop` 5-min cadence)
- [x] **Sub/superscript export test (PR #112 `137e0cb`)** — char-format matrix 4e (last). Two paras →
  `<w:vertAlign w:val="subscript"|"superscript">` + probe + reusable `validate-vertalign-win.ps1`. **Word
  COM-validated:** Font.Subscript=-1, Font.Superscript=-1. `/code-review` clean. Gates: **PM 464 / smoke 9 / roundtrip 27**.
- [x] **🏁 CHARACTER-FORMAT EXPORT+COM MATRIX COMPLETE** (underline-style/color/size/family/sub-sup, PRs #104–112).
- [ ] **NEXT (decision point, surfaced to user):** #5 numbered/multilevel list export+COM (last clean v3 item)
  → then RE-SCOUT v4 OR escalate a bigger STEERED item (a14 picture effects / frames-overlay / 4e headers).
  #3 highlight = real bug w/ UX-judgment fix (steer). ~15 COM-validated export slices merged this run; gates PM 448→464.

### 2026-06-16 (font-family rFonts export test, `/loop` 5-min cadence)
- [x] **Font-family (rFonts) export test (PR #110 `fde5e76`)** — char-format matrix 4d.
  `setFontFamily('Georgia')` → `<w:rFonts w:ascii="Georgia">` + probe + reusable `validate-fontname-win.ps1`.
  **Word COM-validated:** Font.Name="Georgia". `/code-review` clean. Gates: **PM 463 / smoke 9 / roundtrip 27**.
- [ ] **NEXT:** char-format matrix 4e sub/superscript (Font.Subscript/Superscript) → FINISHES the matrix.
  Then v3 = #3 highlight (UX-judgment bug, steer) + #5 lists → RE-SCOUT v4 or escalate a bigger item.

### 2026-06-16 (font-size export test, `/loop` 5-min cadence)
- [x] **Font-size export test (PR #108 `2307876`)** — char-format matrix 4b. `setFontSize('20pt')` →
  `<w:sz w:val="40">` (half-points) + probe + reusable `validate-fontsize-win.ps1` (text-only range).
  **Word COM-validated:** Font.Size=20 — half-point conversion correct. `/code-review` clean. Gates: **PM
  462 / smoke 9 / roundtrip 27**.
- [ ] **NEXT:** char-format matrix 4d rFonts (Font.Name) → 4e sub/superscript (Font.Subscript/Superscript).
  After the matrix, only #3 highlight (UX-judgment bug — steer) + #5 lists remain in v3 → re-scout v4 or
  escalate a bigger item.

### 2026-06-16 (font-color export test, `/loop` 5-min cadence)
- [x] **Font-color export test (PR #106 `577bf07`)** — char-format matrix 4c. `setColor` → `<w:color
  w:val="FF0000">` (whole paragraph) + probe + reusable `validate-fontcolor-win.ps1` (text-only range).
  **Word COM-validated:** Font.Color=255 (no BGR swap). `/code-review` note applied (read text-only range,
  excludes the pilcrow). Gates: **PM 461 / smoke 9 / roundtrip 27**.
- [ ] **NEXT:** char-format matrix 4b font size (half-points / Font.Size) → 4d rFonts (Font.Name) → 4e
  sub-sup. #3 highlight over-exposure = real bug, UX-fix judgment (steer). LESSON: read TEXT-ONLY COM ranges.

### 2026-06-16 (underline-style export test, `/loop` 5-min cadence)
- [x] **Underline-style export test (PR #104 `dfa82fc`)** — scout-v3 #4a (char-format matrix). New `[1]` test
  driving the real underline menu (CSS→OOXML map) across 5 whole paragraphs → `<w:u w:val>`
  [single,double,dotted,dash,wave] + probe + reusable `validate-underline-win.ps1`. **Word COM-validated:**
  Font.Underline = [1,3,4,7,11] (Single/Double/Dotted/Dash/Wavy) — mapping correct. `/code-review` caught
  2 test-quality issues (probe-vs-test shape mismatch; map-bypass) → both fixed. Gates: **PM 460 / smoke 9 / roundtrip 27**.
- [ ] **NEXT:** char-format matrix #4b font size (half-points / Font.Size) or #4c font color (BGR-swap /
  Font.Color); then rFonts / sub-sup. #3 highlight over-exposure = real bug, UX-fix judgment (steer).

### 2026-06-16 (bookmark export test, `/loop` 5-min cadence)
- [x] **Bookmark export test (PR #102 `c3166eb`)** — scout-v3 #2. New `[6]` test: paired `<w:bookmarkStart
  w:name w:id>` + `<w:bookmarkEnd>` (same id) + probe + reusable `validate-bookmark-win.ps1`. **Word
  COM-validated:** Bookmarks.Count=1, .Exists("spot1")=true, .Name="spot1". `/code-review` clean.
  Gates: **PM 459 / smoke 9 / roundtrip 27**.
- [ ] **NEXT:** v3 #4 char-format matrix (underline-style / font size / color / rFonts / sub-sup — clean
  COM lock-ins; underline-style has the enum-mapping fidelity risk). #3 highlight over-exposure = real bug,
  UX-fix judgment (steer). Bigger items (a14 / frames-overlay / 4e headers) need a steered session.

### 2026-06-16 (hyperlink export test, `/loop` 5-min cadence)
- [x] **Hyperlink export test (PR #100 `6cd1647`)** — scout-v3 #1. New `[6]` test: `<w:hyperlink r:id>` +
  External `<Relationship>` (Target=url, TargetMode=External) in document.xml.rels + probe + reusable
  `validate-hyperlink-win.ps1`. **Word COM-validated:** Hyperlinks.Count=1, .Address="https://example.com/",
  .TextToDisplay="click here". `/code-review` clean (hardened rels lookup). Gates: **PM 458 / smoke 9 / roundtrip 27**.
- [ ] **NEXT:** v3 #2 (bookmark export+COM — mirrors the hyperlink recipe) then #4 (char-format matrix).

### 2026-06-16 (RE-SCOUT v3 + bullet-list export test + found a real bug, `/loop` 5-min cadence)
- [x] **#4-rPr SKIPPED** (judgment): low value (Word tolerates), CUA-adjacent (near reserved task_c62b4d4c),
  not cleanly testable via test:pm. Pivoted to re-scout.
- [x] **RE-SCOUT v3** (3 agents: char-format / lists / hyperlinks-bookmarks-images) → v3 queue in last-point.md.
- [x] **Bullet-list export test (PR #98 `b1b634d`)** — new `[2]` test: bullet → `w:numPr` linked to
  numbering.xml abstractNum (ilvl 0 numFmt bullet) + probes. **Word COM-validated:** bullet "•", numbered "1.".
  `/code-review` clean. Gates: **PM 457 / smoke 9 / roundtrip 27**.
- [x] **🐞 FOUND + FLAGGED a real bug (spawn_task `task_eb50ae00`):** bullet-then-numbered adjacent paras →
  the bullet loses its marker (COM "no numbering"). Robust repro `oracle-probe-2-mixedlist.js`. Fork list-toggle
  logic; not a bounded slice → focused task. **The re-scout paid off.**
- [ ] **NEXT:** v3 #1 hyperlink export+COM (or #2 bookmark) → char-format matrix (#4); bigger items need a steered session.

### 2026-06-16 (distribute-columns geometry export test, `/loop` 5-min cadence)
- [x] **Distribute-columns geometry export test (PR #96 `701a4a9`)** — scout-v2 #5. New `[6b]` test:
  uneven (widen col 0) → assert uneven (non-vacuous) → distribute → 3 EQUAL `<w:gridCol>` + probe +
  reusable `validate-distribute-win.ps1`. **Word COM-validated:** [260,208,208]→[225,225,225]px →
  3× gridCol 3375 → Columns even. `/code-review` caught a vacuous assertion → fixed (uneven-before
  precondition). Test-only. Gates: **PM 456 / smoke 9 / roundtrip 27**.
- [x] **SCOUT BACKLOG v2 ≈ DONE** (#1/#2/#3/#5 shipped; only #4 order-sweep remains, Word-tolerant). 6
  consecutive COM-validated export-regression slices this session — docx export surface broadly hardened.
- [ ] **NEXT:** #4-rPr (last v2 item, portability fix) → RE-SCOUT v3 (lists/numbering, fields, hyperlinks,
  image remnants) → or ESCALATE a bigger item (a14 picture effects / frames-overlay / 4e headers, steered session).

### 2026-06-16 (paragraph shading export test, `/loop` 5-min cadence)
- [x] **Paragraph shading export test (PR #94 `ce86522`)** — scout-v2 #2. New `[2]` test:
  `<w:pPr><w:shd w:val="clear" w:fill="..." w:color="auto">` (guards `val="clear"` + hex + CT_Shd) + probe
  + reusable `validate-parashading-win.ps1`. **Word COM-validated:** FF0000 → `Paragraphs(1).Shading.
  BackgroundPatternColor=255`, opens clean. Test-only. `/code-review` clean. Gates: **PM 455 / smoke 9 / roundtrip 27**.
- [ ] **DECISION POINT** (see last-point): 5 COM-validated export lock-ins shipped (all confirm Word fidelity;
  marginal value diminishing). Backlog v2 nearly done — remaining #5 (distribute geometry, bounded) + #4
  (order sweep, Word-tolerant/portability-only). NEXT: #5 then #4-rPr, then RE-SCOUT or escalate to a bigger
  focused item (a14 picture effects / frames-overlay / 4e headers — better suited to a steered session).

### 2026-06-16 (paragraph border export test, `/loop` 5-min cadence)
- [x] **Paragraph bottom-border export test (PR #92 `dc86aca`)** — scout-v2 #3. New `[2]` test:
  `<w:pBdr><w:bottom w:val="single" w:sz="4" w:color="auto" w:space="1">` + probe + reusable
  `validate-paraborder-win.ps1`. **Word COM-validated:** `Paragraphs(1).Borders(-3).LineStyle=1` (single),
  `.LineWidth=4` (0.5pt) — the eighths→half-point mapping is correct. Test-only. `/code-review` clean.
  Gates: **PM 454 / smoke 9 / roundtrip 27**.
- [ ] **NEXT:** scout-v2 #2 (paragraph shading export+COM — recommended) or #5 (distribute geometry).

### 2026-06-16 (merged-cell gridSpan export test, `/loop` 5-min cadence)
- [x] **Merged-cell gridSpan export test (PR #90 `efdaf1e`)** — scout-v2 #1. Horizontal `tableMerge` → new
  `[6b]` test: `<w:gridSpan w:val="2">` + `<w:tblGrid>` keeps all 3 `<w:gridCol>` + probe + reusable
  `validate-gridspan-win.ps1`. **Word COM-validated:** opens WITHOUT repair, `Rows(1).Cells.Count=2` /
  `Rows(2)=3` (positive structural guard against silent repair). No corruption. Test-only. `/code-review`
  clean. Gates: **PM 453 / smoke 9 / roundtrip 27**.
- [ ] **NEXT:** scout-v2 #2 (paragraph shading export+COM) or #3 (paragraph borders export+COM).

### 2026-06-16 (RE-SCOUT + Repeat Header Row export test, `/loop` 5-min cadence)
- [x] **RE-SCOUT** (backlog was exhausted): 4 parallel agents over CSS↔OOXML mapping / table export gaps /
  latent OOXML-order / paragraph-layout export gaps → fresh **SCOUT BACKLOG v2** in last-point.md (merged-cell
  gridSpan, paragraph shading/borders export+COM, rPr/pPr/trPr order sweep, distribute geometry).
- [x] **Repeat Header Row export test (PR #88 `478c8a4`)** — top layout-relevant pick. `tableToggleHeaderRow`
  → `<w:tblHeader>` (repeat-as-header-row pagination flag). New `[6b]` test (exactly one `<w:tblHeader>` in
  the first `<w:trPr>`; toggle-off clears) + probe + reusable `validate-repeatheader-win.ps1`. **Word
  COM-validated:** `Rows(1).HeadingFormat = -1` (True), `Rows(2) = 0`, opens clean. Test-only. `/code-review`
  clean. Gates: **PM 452 / smoke 9 / roundtrip 27**.
- [ ] **NEXT:** scout-v2 #1 (merged-cell gridSpan export) or #2/#3 (paragraph shading/borders export+COM).

### 2026-06-16 (cell-shading export test + picture-effects investigation, `/loop` 5-min cadence)
- [x] **Cell shading export test (PR #86 `7587365`)** — scout-backlog #4. New `[6b]` test (caret-cell shade
  → `<w:shd w:fill="FF0000">` verbatim) + probe + reusable `validate-cellshading-win.ps1`. **Word
  COM-validated:** FF0000 → `BackgroundPatternColor = 255` (no BGR swap). Test-only. `/code-review` clean.
  Gates: **PM 451 / smoke 9 / roundtrip 27**.
- [x] **🔬 Picture effects (#2) investigated → DEFERRED.** Built grayscale end-to-end (render filter +
  setImageColorAdjust + Color UI) on the fork's a:grayscl path, but **Word COM showed it's not faithful:
  Word uses the a14 (Office 2010) extension for recolor, not `<a:grayscl>`; Word reads our a:grayscl as
  ColorType=2 (BlackAndWhite).** Reverted (never committed). True fidelity needs a14 import/export (bigger
  fork change). LESSON: COM-validate caught a non-faithful representation pre-merge.
- [x] **SCOUT BACKLOG EXHAUSTED** (all 5 items DONE or deferred). NEXT loop step: **RE-SCOUT** for new
  bounded slices, or take a bigger item (frames-overlay keystone / 4e headers / picture-effects-via-a14).

### 2026-06-16 (Table Cell Margins flyout, `/loop` 5-min cadence)
- [x] **Table Cell Margins flyout (PR #84 `96681ff`)** — scout-backlog #3. Wired the dead `H.tblCellMargins`
  stub to an inches flyout (Top/Bottom/Left/Right + Apply) → `WC.PM.tableSetCellMargins` (px=in×96). Bridge +
  w:tcMar export already worked; only the UI was missing.
- [x] **Prefill fix (from `/code-review`):** new `tableGetCellMargins()` bridge reader prefills the flyout
  with the cell's CURRENT margins (Word Cell Options behavior) so re-editing one side no longer clobbers the
  others. Guard checks `tableInfo().inTable`.
- [x] **🔬 Word COM-validated:** 0.5" all sides → `Cells(1).Top/Bottom/Left/RightPadding = 36pt` (720 twips),
  opens clean. 1 `[4d]` test (ribbon path + re-open prefill assertion) + `oracle-probe-4d-cellmargins.js` +
  reusable `validate-cellmargins-win.ps1`. `/code-review high` + adversarial re-review clean. Gates: **PM 450
  / smoke 9 / roundtrip 27**.
- [ ] **NEXT:** scout #2 (picture effects — bigger) or #4 (cell shading export test — smallest). Deferred:
  Word's "Same as whole table" inherit checkbox.

### 2026-06-16 (w:tcPr child-order CT_TcPr fix, `/loop`)
- [x] **w:tcPr child-order fix (PR #82 `6d42e34`)** — scout-backlog #5. `tcPr-translator.js` passes a
  `TCPR_XML_ORDER` (CT_TcPr §17.4.66 sequence) so decoded cell-prop children stable-sort to schema order on
  export (mirror of the PR #77 `tblPr` fix). Reproduced the out-of-order export (`<w:tcBorders>` before
  `<w:tcW>`; the exporter migrates `attrs.borders` LAST). 1 `[4d]` test (red pre-fix) +
  `oracle-probe-4d-tcorder.js` + new reusable `scripts/oracle/validate-open-win.ps1`. `/code-review high`
  clean. Gates: **PM 449 / smoke 9 / roundtrip 27**.
- [x] **🔬 Word-tolerance finding (re-ranks scout #5):** COM-validated that live Word 16 TOLERATES the
  out-of-order `w:tcPr` (opens clean, `savedOnOpen=true`, no repair; control corrupt file correctly rejected).
  So this shipped as OOXML spec-compliance + `tblPr` consistency, NOT a Word-crash fix. LESSON re-confirmed:
  COM-validate before trusting a corruption hypothesis.
- [ ] **NEXT:** scout #3 (cell margins stub → wire the inches flyout — recommended) or #2 (picture effects).

### 2026-06-16 (Table cell vAlign fix via ultracode scout, `/loop`)
- [x] **Ultracode parallel-SCOUT workflow** (6 agents) ranked wired-but-untested table/image features by
  latent-Word-bug risk. Top hit → fixed; backlog recorded in last-point.md (picture effects, cell margins
  stub, shading test, tcBorders XML_ORDER).
- [x] **Table cell "Align Middle" w:vAlign fix (PR #80 `7fdf431`)** — "middle" is valid CSS but invalid
  OOXML ST_VerticalJc → Word ignored it (cell not centered). Mapped CSS middle ↔ OOXML center at both
  converter boundaries. **Word COM-validated: Cells(1).VerticalAlignment=1 (Center).** `/code-review` clean.
  1 `[4d]` test + oracle-probe-4d-cellvalign.js. Gates: **PM 448 / smoke 9 / roundtrip 27**.
- [x] **Flagged** the document-api/CUA adapters (use OOXML enum directly; pre-existing) → spawn_task `task_c62b4d4c`.

### 2026-06-16 (2+-table Word-corruption — root-caused, NOT shipped, `/loop` "keep go")
- [x] **Root-caused the 2+-table Word-corrupt export** (the flagged bug). OOXML CT_Tc: a `w:tbl` can't be the
  LAST child of a cell — needs a trailing `<w:p/>`. The natural "insert table, then insert table" nests the
  2nd in the 1st cell → no trailing p → Word rejects. Manual-patch confirmed (add `<w:p/>` → Word opens).
- [x] **Fix logic confirmed** (translateTableCell append trailing p; `type:'element'` required) — `exportXmlOnly`
  + `getUpdatedDocs` both gain the p. **NOT SHIPPED:** couldn't get a clean end-to-end Word-validation of the
  real `exportDocxBytes` save (env: `saveBytes` started failing, likely a hung WINWORD lock). REVERTED to keep
  main clean; re-flagged with full findings (spawn_task `task_0e043993`).
- [x] **LESSON re-confirmed:** `exportDocx({exportXmlOnly})` + `test:roundtrip` both MISS Word-corruption →
  validate the real save (exportDocxBytes → saveBytes → Word COM Documents.Open). Gates unchanged: PM 447/smoke 9/rt 27.

### 2026-06-16 (Table positioning — first NON-image slice, `/loop` "keep go")
- [x] **Table Indent + Alignment coverage + w:tblPr-order fix (PR #77 `1fa57cd`)** — wired the unwired
  `tableSetIndent` (Indent flyout in the Table Design Alignment group) + tested the existing-but-untested
  table Alignment. **🔬 ORACLE caught a Word-corruption bug:** aligned/indented tables exported `w:tblPr`
  with `w:jc`/`w:tblInd` AFTER `w:tblLook` (violates CT_TblPrBase → Word rejects as corrupt). Fixed:
  `createNestedPropertiesTranslator` takes an `xmlOrder`, `tblPr-translator` passes the schema order +
  stable-sorts (imported tables = no-op). Word COM-validated: center→Rows.Alignment=1, indent 0.5"→
  LeftIndent=36pt. `/code-review` clean. +2 `[4d]` tests + `oracle-probe-4d-tablepos.js`. Gates: **PM 447
  / smoke 9 / roundtrip 27**.
- [x] **⚠️ Flagged (spawn_task):** a doc with 2+ tables exports Word-CORRUPT (two PLAIN tables repro) —
  separate pre-existing base bug the fork-roundtrip gate misses. LESSON: oracle-validate (Word-open) docx features.

### 2026-06-16 (Floating-image arrow-key nudge 4c.2, `/loop` "keep go")
- [x] **Arrow-key nudge (4c.2, PR #75 `b87dbbd`)** — Word's arrow-key reposition of a selected floating
  picture (plain=8px, Shift=1px). The `wcImageResize` plugin gained `handleKeyDown` (handleNudgeKeyDown) →
  `setImagePosition({±step, relative:true})`. Bumped extension priority 1→200 so the nudge wins over the
  keymap deterministically. `/code-review` + re-review clean. 1 `[4c]` test (cumulative +16px without
  re-select proves selection persists). Gates: **PM 445 / smoke 9 / roundtrip 27**.
- [x] **4c.2 reposition now has numeric (flyout) + keyboard (nudge) affordances.** Remaining = drag overlay
  + imported-image reposition (both deferred §A.1d). Image area is now very deeply covered.

### 2026-06-16 (Picture Position 4c.2 + oracle-caught simplePos fix, `/loop` "keep go")
- [x] **Picture absolute Position (4c.2, PR #73 `cc566cb`)** — first floating reposition step.
  `setImagePosition({horizontal,top,relative?})` → `marginOffset` → render left/top + `wp:positionH/V`
  posOffset export. "Position" flyout in the Arrange group. Guarded vs silent save-drop on imported anchors.
- [x] **🔬 ORACLE caught a latent simplePos bug** — a generated complex-positioned anchor exported
  `@simplePos="1"`, so Word IGNORED positionH/V (read a 1"/0.5" picture at −1"/−1"). Fixed
  (`translate-anchor-node.js`: force `simplePos="0"` when positionH/V emitted). Latent since 4c.1.
  Re-oracle: Word reads Left=72pt / Top=36pt — exact. New `oracle-probe-4c2-position.js`.
- [x] **`/code-review` (+ re-review) clean.** 1 `[4c]` test (inline-guard / marginOffset / relative nudge /
  posOffset EMU / simplePos="0" / imported-refusal / round-trip). Gates: **PM 444 / smoke 9 / roundtrip 27**.

### 2026-06-16 (Picture Rotate/Flip — Picture Format tab Word-complete, `/loop` "keep go")
- [x] **Picture Rotate/Flip (PR #71 `6dd541c`)** — wired Word's Picture Format → Arrange → Rotate
  (Rotate Right/Left 90° / Flip V/H / Reset) onto the fork's already-complete `transformData` pipeline
  (render `transform: rotate/scaleX/scaleY`, export `a:xfrm` rot/flipH/flipV, import reads back). New
  `setImageTransform({rotate?,flipH?,flipV?,reset?})` (relative rotate delta normalized 0..359, flips
  toggle, transformData kept minimal); `H.imgRotate` flyout. `/code-review` clean (no production bugs).
  1 `[4b]` test. Gates: **PM 443 / smoke 9 / roundtrip 27**.
- [x] **🏁 Picture Format tab is Word-complete** — Size (Crop/H/W/Lock) + Arrange (Wrap/Bring/Send/
  Rotate) + Accessibility (Alt Text). NEXT = frames-overlay keystone (NOT a clean single-PR slice —
  reposition render spans ~10 branches) OR 4e headers/footers; each needs a dedicated push.

### 2026-06-16 (Picture Crop + clipPath→a:srcRect export, `/loop` "keep go")
- [x] **Picture Crop (PR #69 `ce1b31e`)** — Word's Picture Format → Crop (manual L/T/R/B %) on the
  Size group + closed a real export gap: a user crop was dropped on save. New `buildSrcRectFromClipPath`
  (`decode-image-node-helpers.js`) = exact inverse of the importer; blipFill emits `rawSrcRect || derived`
  (imports byte-identical, user crops round-trip). Bridge `setImageCrop({l,t,r,b}|{remove})`; `H.imgCrop`
  = an L/T/R/B % flyout + Remove Crop.
- [x] **`/code-review` clean** (no axis transposition across crop→clipPath→srcRect→clipPath; no
  roundtrip-gate regression — imports keep verbatim rawSrcRect). 1 `[4b]` test (set/export-thousandths/
  zero-omit/too-large-guard/remove/XML-boundary round-trip). Gates: **PM 442 / smoke 9 / roundtrip 27**.

### 2026-06-16 (Picture Alt Text — IMAGE AREA COMPLETE, `/loop` "keep go")
- [x] **Picture Alt Text (PR #67 `e27ec79`)** — Word's Picture Format → Alt Text pane on the Picture
  Format tab (new Accessibility group). New bridge verb `setImageAltText({title?,decorative?})`: the
  description is the node's `title` attr (→ `wp:docPr/@descr`); `decorative` sets the flag (→
  `adec:decorative` ext) and clears the description. `H.imgAltText` = a textarea + "Mark as decorative"
  checkbox flyout. `/code-review` clean (confirmed descr is XML-escaped). 1 `[4b]` test. Gates: **PM 441
  / smoke 9 / roundtrip 27**.
- [x] **🏁 IMAGE AREA COMPLETE** — Picture Format tab mirrors Word: Size (H/W/Lock) + Arrange
  (Wrap/Bring/Send) + Accessibility (Alt Text). 3 slices this session (#63/#65/#67). NEXT = frames-overlay
  keystone OR 4e headers/footers — each needs a FRESH session (this one is extremely long).

### 2026-06-16 (Picture Size group — numeric Height/Width, `/loop` "keep go")
- [x] **Picture Size group (PR #65 `361fb53`)** — Word's Picture Format → Size group (numeric Height +
  Width) on the Picture Format tab. New bridge verb `setImageSize({width?,height?})` (`bridge/insert.ts`):
  honors the aspect lock (locked → edited dim drives the other), clamps width to the content column +
  both dims to the overlay's `MAX_DIM=4000`. Generalized `tblSizeFly` → `sizeFly` and reused for
  `H.imgHeight`/`H.imgWidth`. Wires onto the already-shipped `size`-attr → `wp:extent` export (4b-proven).
- [x] **`/code-review` clean** + a review-noted MAX_DIM clamp added & re-reviewed clean via brute-force
  simulation. 1 `[4b]` test (lock-derive both ways, unlocked divergence 180×50, wp:extent EMU, 10000→cap
  4000). Gates: **PM 440 / smoke 9 / roundtrip 27**.

### 2026-06-16 (Picture Format contextual tab + Arrange un-block, `/loop` "keep go")
- [x] **Picture Format contextual tab (closes §A.1c)** — new `picture-tools-pm.js` injects a "Picture
  Format" tab on image `NodeSelection` (mirrors `table-tools-pm.js`): Size (Lock Aspect Ratio →
  `H.imgLockAspect` → `setImageLockAspect`) + Arrange (Wrap Text / Bring Forward / Send Backward).
  `state-sync.ts` drives `WC.PictureToolsPM.syncContextualTab`; probe-confirmed show-on-select /
  hide-on-deselect. (PR #63 `4064a71`)
- [x] **Dead-control root-cause fix (caught by `/code-review`)** — `wrapText`/`bringForward`/
  `sendBackward` were gated by the coarse `layout-arrange` DEFERRED flag and toasted "not available"
  instead of reaching their already-shipped bridge verbs (4c.1 wrap / 4c.3 z-order). Added an
  `ENGINE_READY` allow-set in `bridge/index.ts` un-blocking exactly those three; `align`/`group`/
  `rotate`/`position`/`selectionPane` (undefined `WC.Layout.*`) STAY blocked. Re-reviewed clean. (PR #63 `4e13be8`)
- [x] **2 `[4b]` tests**: tab appears on select + Lock Aspect toggles the attr; the three Arrange cmds
  report `isBlocked===false` (while `align`/`rotate` stay blocked) and `bringForward` via the ribbon
  `run()` path reaches `setImageZOrder`. Gates: **PM 439 / smoke 9 / roundtrip 27**. **Merged PR #63 `c914f66`.**

### 2026-06-16 (AutoFit Contents 4d.5 + exhaustive pagination audit, `/loop` "keep going")
- [x] **Audited pagination exhaustively** (post Fix A) via headless probes — ALL behaviors clean:
  auto-overflow (70 paras → break at line 45 = the oracle), manual breaks, blank pages, clicking at
  zoom 1.0/1.5/0.75, selecting across a break, typing-after-break, deleting a break, export.
  `focus.ts` confirmed FINE (only clamps X; Fix A un-poisoned posAtCoords). The line-split in-`<p>`
  spacer is the one rare+benign structural blemish → documented, deferred.
- [x] **AutoFit Contents (Phase 4d.5)** — completes the AutoFit trio. Bridge measures each column's
  content width (reflow the selected table at `table-layout:auto`, cap at page text width, restore in
  `finally`); `autoFitTable` UNIFIES window+contents into one TableMap colwidth writer.
- [x] **Oracle-validated** (`read-table`): short "Hi" col vs a long col → Word 22.15pt + 332.25pt
  (short ≪ long; col 1 exact). +1 `[4d]` test (asserts the short col shrank well below the default
  equal split) + oracle probe. Gates: **PM 432 / smoke 9 / roundtrip 27**.
- [x] **`/code-review high` + fixes**: finally-guarded style restore + a stronger shrink assertion;
  most candidates refuted (colspan trips the guard; rowspans don't shift the row-0 origin; auto-layout
  captures the cross-row per-column max). **4d.5 COMPLETE + merged** (PR #56 `c70c1fb`).

### 2026-06-16 (Pagination CARET BUG — root-cause + primary fix, `/loop` redirected by the user)
- [x] **User redirected the loop** to fix pagination: "page breaks, blank pages break normal editing +
  the mouse/caret location inside the page." Used `systematic-debugging` (root cause before any fix).
- [x] **Deep research** via a parallel Workflow (PM `posAtCoords`/`coordsAtPos` internals, the seam DOM,
  real-Word interaction behavior, git/deferrals history, repro-test design) + a headless reproduction
  probe (`scripts/probe-pagination-caret.js`).
- [x] **Reproduced + root-caused**: forced/blank-page seams were a block `<div>` injected at the INLINE
  hardBreak position INSIDE a paragraph → block-in-inline corrupts PM `posAtCoords` → clicking the next
  page mislands the caret. Probe: `.pm-page-spacer` with a `<span>` parent + a page-2 margin click landing
  on a page-1 pos.
- [x] **Fix A (PR #54 `11909cd`)**: forced breaks that END a block + blank pages + section breaks now emit
  a coords-safe BLOCK-BOUNDARY seam before the next block (`emitSeamBefore`/`trailingForcedCount`,
  pagination.ts); a seam reports `pages` (band span) so the status bar weights, not counts. 2 new `[4a]`
  regressions (red before). Probe: blockInInline 1→0 / 2→0.
- [x] **`/code-review high` + re-review of the review-fixes** (the project's "re-review your own fixes"
  lesson): clean. Fixed doc-start guard, table guard in `trailingForcedCount`, a per-keystroke perf guard,
  and a vacuous test assertion.
- [x] **`focus.ts` CONFIRMED FINE post-fix** (cause 2 dismissed via a repro probe — it only clamps X, and
  Fix A un-poisoned posAtCoords). No change needed.
- [x] **Line-split / mid-paragraph in-`<p>` spacer = LOW-severity remainder, documented** (deferrals §A.1b
  + [[pagination-caret-rootcause]] memory): only clicks in the narrow GAP of a page-overflowing paragraph
  misland (word round-trips stay clean); coords-safe fix is hard/risky → deferred to a focused session.
- [x] Render-only change → model/export unchanged → oracle page counts preserved. Gates: **PM 431 /
  smoke 9 / roundtrip 27**. PRIMARY user complaint RESOLVED.

### 2026-06-16 (Phase 4d.4 — AutoFit Window+Fixed geometry, `/loop`)
- [x] **Diagnosed the AutoFit gap** — `autoFitTable` stored only the layout/width INTENT
  (`tableLayout`/`tblW`); the column geometry AutoFit visibly produces was never applied (the deferral's
  "needs the layout pass"). Window didn't fill the page; window→contents stayed stuck-stretched.
- [x] **Window geometry** (fork `extensions/table/table.js`): `autoFitTable('window', targetWidthPx)`
  scales every column **proportionally** to fill the page text-column width — writes per-cell `colwidth`
  via the TableMap; the `tableColwidthGridSync` plugin rebuilds the twips `grid` → in-app render AND
  export (`w:gridCol`/`w:tcW`) both fill (no Phase-7 paint).
- [x] **Contents fix**: `'contents'` now also clears a prior Window stretch (`delete tableWidth`; was a no-op).
- [x] **Bridge** (`bridge/table.ts`): `tableAutoFit` computes the text width from `getPageStyles()`
  (`pageSize − L/R margins`)×96 and passes it down; `'fixed'`/`'contents'` ignore it.
- [x] **Oracle-validated** (`read-table`, real Word 16): Window 1:2 → 155.85pt+311.65pt (sum 467.5pt =
  6.5" text column, ratio 2.0); Fixed 120/180px → 90pt+135pt preserved; both open WITHOUT repair.
- [x] **+4 `[4d]` regression tests** (Window proportional fill + precondition guard, Fixed preserves,
  Contents clears stretch, full ribbon flyout path) + oracle authoring probe. Gates: **PM 429 / smoke 9
  / roundtrip 27**.
- [x] **`/code-review` (high)**: **zero correctness findings**; 5 cleanup/altitude "unify Window +
  `distributeColumnsEvenly` + `setCellWidth` into one `setColumnsToTotal(total, even|proportional)`
  primitive" findings DEFERRED (would refactor existing tested commands — recorded in deferrals §A.1e).
- [x] **4d.4 COMPLETE + merged** (PR #52 `627cfdf`). AutoFit Contents in-app reflow stays a layout-pass
  deferral. NEXT (pick one): table RELOCATE / row-split / AutoFit Contents; OR frames-overlay (§A.1d);
  OR 4e headers/footers. Session very long — fresh session recommended.

### 2026-06-16 (Phase 4d.3 — Row/Column size ribbon controls, `/loop`)
- [x] **Built the row-resize UI affordance** (deferred §A.1e) as the faithful Word ribbon controls:
  **Row Height** + **Column Width** `dropdown`s in the Table Layout "Cell Size" group (`table-tools-pm.js`).
- [x] **`commands.js`**: shared `tblSizeFly(node,title,presets,apply)` flyout (inches number input + presets)
  + `H.tblRowHeight` → `tableSetRowHeight(px,'atLeast')`, `H.tblColWidth` → `tableSetCellWidth(px)`
  (inches×96=px). Added both cmds to the dropdown-dispatcher allow-list (was returning "no options").
- [x] **Oracle-validated** (`read-table`): Row Height 0.5" → row 1 = 36pt heightRule=atLeast;
  Column Width 1.5" → col 0 = 108pt.
- [x] **+2 `[4d]` regression tests** (full ribbon path: `WC.Commands.dropdown` → flyout preset → assert
  model attr + exported OOXML). Gates: **PM 425 / smoke 9 / roundtrip 27**.
- [x] **`/code-review`** (xhigh, 3 finder passes incl. a test false-pass sweep): **zero findings**
  (all `WC.fly*` helpers exist, `flyItem` auto-closes, bridge signatures match, 2160-twip column ≠ 4680 default).
- [x] **4d.3 COMPLETE + merged** (PR #50 `3c1b527`). NEXT (pick one): table RELOCATE / row-split / AutoFit;
  OR the FRAMES-OVERLAY (§A.1d); OR 4e headers/footers. Session very long — fresh session recommended.

### 2026-06-16 (Phase 4d.2 — row-height export fix, `/loop`)
- [x] **Investigated row resize** — the suspected px-vs-twips bug was misdiagnosed: `tr-translator`
  already reconciles px→twips, but rebuilt the nested `value` as a STRING, which the `trHeight` decode
  (`typeof === number`) silently dropped → a set row height produced NO `<w:trHeight>` (Word: auto).
- [x] **Fix** (PR #48, merge `8849c4e`, `fix(docx)`): write a NUMBER value + spread the existing nested
  rowHeight (keep `rule`). +1 `[4d]` test; fixed a stale vendored `tr-translator.test.js`.
- [x] **Oracle-validated**: 60px row → `w:trHeight w:val="900" w:hRule="atLeast"` → Word 45pt atLeast;
  unset rows stay auto. Imported unchanged rows skip the reconciliation (roundtrip gate green).
- [x] **`/code-review`**: confirmed idempotent + no string consumers; caught the stale vendored test (fixed).
  Gates: **PM 423 / smoke 9 / roundtrip 27**.
- [x] **4d.2 COMPLETE + merged.** Row-resize UI affordance (drag/spinner) deferred to 4d.3 (deferrals §A.1e).

### 2026-06-16 (Phase 4d.1 — table column resize, `/loop`)
- [x] **Investigated the table subsystem** — prosemirror-tables `columnResizing` already loaded but
  `handleWidth: 0` (disabled for a never-built custom overlay); `colwidth` (px) → `w:gridCol`/`w:tcW`.
- [x] **Enable column resize** (`handleWidth` 0→5) + **grid-sync appendTransaction** (PR #46, merge
  `52d88dd`, `feat`/`fix`): drag a border → colwidth; grid-sync rebuilds the table `grid` (twips) from
  the change so the resize round-trips (exporter emits w:gridCol from `grid` — an IMPORTED-table resize
  was else dropped on save). New oracle verb `read-table`. +2 `[4d]` tests.
- [x] **Headless validation hurdles** (recorded): synthetic full-drag doesn't trigger the PM pointer
  plugin, and the caret won't stay in an HTML-inserted table — so validated via (a) the plugin ARMS on
  border-hover (`activeHandle` set), and (b) `colwidth` set directly → export → oracle read-table.
- [x] **Oracle-validated**: 180px column → `w:gridCol=2700` → Word 135pt, for new AND imported
  (stale-grid) tables.
- [x] **`/code-review` + re-review**: caught the imported-table data-loss bug (grid not synced — the
  whole point of the grid-sync) + a per-keystroke deep-walk perf issue (switched to `doc.forEach`);
  re-review clean (2 low/by-design notes). Gates: **PM 422 / smoke 9 / roundtrip 27**.
- [x] **4d.1 COMPLETE + merged.** NEXT (pick one): 4d.2 row-resize (+fix setRowHeight px/twips bug) /
  frames-overlay / 4e headers-footers.

### 2026-06-16 (Phase 4c.3 — image z-order, `/loop`)
- [x] **Investigated reposition vs z-order** — found the fork's float-based render can't free-position
  Square images, and the z-index scheme can't faithfully inter-stack (conflates behind-text with
  order; floats aren't positioned). So faithful free-reposition + render-z-stacking both need the
  frames-overlay. Chose z-order (export-faithful, self-contained) as the clean slice.
- [x] **`WC.PM.setImageZOrder`** (PR #44, merge `66d691e`, `feat(layout)`): Bring Forward/Backward/
  toFront/toBack → mutate floating image `relativeHeight` (Word-sane; forward/backward `>=`/`<=` for
  tied peers); ribbon wired off the phantom `WC.Layout`. Oracle `read-shapes` extended (leftPt/topPt/
  zOrder). Validated: two floating images export distinct ZOrderPositions.
- [x] **`/code-review` + re-review**: caught a tie no-op bug (strict `>` → Bring Forward did nothing
  on two equal-height images, the default state); fixed to `>=`/`<=`; re-review clean. +1 `[4c]` test.
- [x] **4c.3 COMPLETE + merged.** Gates: **PM 420 / smoke 9 / roundtrip 27**. DECISION POINT: remaining
  4c (frames-overlay for free-reposition + render z-stacking) is a big piece — or pivot to 4d/4e.

### 2026-06-16 (Phase 4c.1 — image text wrap, `/loop`)
- [x] **Investigated the floating subsystem** — found the fork already RENDERS wrap (float/shape-
  outside/absolute → real reflow) + round-trips it; the gap was the ribbon calling a never-defined
  `WC.Layout`. Validated render + export with probes.
- [x] **`WC.PM.setImageWrap(mode)`** (PR #42, merge `4bbdb51`, `feat(layout)`): wires the ribbon Wrap
  Text (inline/square/tight/through/topbottom/behind/front) to the image `wrap`+`isAnchor` attrs;
  seeds anchorData + (for tight/through) a default bounding-box `wp:wrapPolygon`. commands.js
  re-pointed off the phantom `WC.Layout`.
- [x] **`fix(docx)` valid CT_Anchor** (`translate-anchor-node.js`): a generated (inline→floating)
  anchor now emits the required `<wp:simplePos>` child + attrs (simplePos/behindDoc/locked/
  layoutInCell/allowOverlap) — Word REFUSED to open the file without them. Oracle-caught.
- [x] **Oracle-validated** via `read-shapes`: all 6 floating modes open in Word as floatingShapes
  (square 120×90 px = 90pt×67.5pt). tight/through were rejected pre-polygon-fix.
- [x] **`/code-review` (2 angles + verifiers)**: no correctness bugs; added behind/front/topbottom
  export tests + recorded 4c edges (deferrals.md §A.1d: 4c.2 reposition, 4c.3 z-order, tight=bbox).
- [x] **4c.1 COMPLETE + merged.** Gates: **PM 419 / smoke 9 / roundtrip 27**. NEXT: 4c.2 drag-reposition.

### 2026-06-15 (Phase 4b — image resize, `/loop`)
- [x] **Oracle `read-shapes` verb** (`307338c`, `test(oracle)`): InlineShapes + floating Shapes
  Width/Height in pt + EMU — Word's image-geometry ground truth for 4b/4c/4d.
- [x] **Live image resize** (PR #40, merge `6d8c448`, `feat(insert)`): owned 8-handle overlay
  (`src/renderer/imageresize/image-resize.ts`) mounted in `#pages` (zoom/scroll-tracking via the
  `position:relative` containing block + unscaled offset); drag → preview → one `setNodeMarkup`
  writing the image `size` (px) → exporter emits `wp:extent`/`a:ext` (EMU). Aspect-locked. Replaced
  the decorative handles from `2dca2e4`. +4 `[4a→4b]` tests.
- [x] **Oracle-validated**: 200×100 dragged to 260×130 px = Word InlineShape 195pt×97.5pt =
  2476500×1238250 EMU (exact match to the exported `wp:extent`).
- [x] **`/code-review` + re-review of the fixes**: fixed a re-entrant pointer-listener leak, the
  stale-overlay-on-window-resize gap, and a fragile containing-block dependency; added handle-
  alignment + edge-handle tests; documented the deferred 4b edges (deferrals.md §A.1c). Re-review of
  the fix commit came back clean. Gates: **PM 414 / smoke 9 / roundtrip 27**.
- [x] **4b COMPLETE + merged.** NEXT: 4c (floating anchor/position/wrap).

### 2026-06-15 (Phase 4a2 + 4a3 — finish the pagination page-break family, `/loop`)
- [x] **4a2 unified forced-seam** (PR #37, merge `7779c53`): redesigned manual page breaks to place a seam
  AT the break position `P` (one mechanism for mid-paragraph / end-of-paragraph / trailing / blank-page),
  replacing the "push the next block" model — RESOLVED the deferred mid-paragraph + trailing breaks. Folded
  the 3 seam-emit sites into one `emitSeam`. Status bar counts seams (dropped the dead `skip`). +4 `[4a]`
  tests. Oracle: mid-para = 1 para across 2 pages; trailing = +1 page; blank = content on page 3.
- [x] **4a2 `/code-review`**: extracted `emitSeam` (the strongest finding — triplicated load-bearing
  formula); documented two CONFIRMED deep edges (widow/orphan-relative-to-block-start on a re-overflowing
  mid-broken paragraph; forced break in a measureBlocks-skipped block).
- [x] **4a3 section breaks** (PR #38, merge `0e0f29f`): next-page `w:sectPr` page boundary
  (`sectionBoundaries`). Diagnosed by oracle experiment the semantic the prior 4f spike got backwards — the
  break after a section-ending paragraph is governed by the NEXT section's type (next ender's sectPr, else
  body sectPr / default nextPage), NOT the ender's own type. +4 tests incl. the DISCRIMINATING continuous-
  middle multi-section case. Oracle-validated: single / continuous-ender / nextPage / multi-section /
  before-table all match Word for Windows 16.0.
- [x] **4a3 `/code-review`**: keyed the boundary off the ENDER paragraph (fixes section-break-before-a-table
  position match) + took the following block from measured order; `nextColumn` treated as a page break
  (single-column render); added the discriminating multi-section test; documented the fork insert command's
  first-paragraph (`paraPos<=0`) refusal as a UI (not engine) limitation.
- [x] **Pagination page-break family COMPLETE** — auto-overflow, line-split, manual breaks
  (mid/end/trailing/blank), section breaks (next-page/multi-section/before-table), all oracle-validated.
  Gates on main: **PM 410 / smoke 9 / roundtrip 27.** Remaining Phase-4 work = 4b–4f (distinct subsystems).

### 2026-06-15 (Phase 4a — pagination core, `build/phase-4a-pagination`)
- [x] **Windows headless-rAF fix** (`0f144b9`, `fix(main)`): paint the headless probe window
  transparent+inactive on non-darwin so rAF runs at 60fps (a never-shown window throttles it to ~2fps,
  starving the rAF-coalesced state-sync → ~18 spurious chrome-test failures). Gates green on Windows.
- [x] **Pagination core** (`c11d689`, `feat(pagination)`): owned `Pagination` extension + measure-and-nudge
  PM plugin (`src/renderer/pagination/pagination.ts`) — model-driven multi-page sheets, page margins, seams
  as widget decorations; wired via `getStarterExtensions().concat`. +7 `[4a]` tests.
- [x] **Oracle `read-layout` verb** (`ae7ffb4`, `test(oracle)`): Word page count + per-paragraph start-page
  + break paragraphs — the pagination ground truth.
- [x] **Word-fidelity** (`47d5d23`, `fix(pagination)`): reset browser-default `<p>` margin + `DEFAULT_LINE_HEIGHT`
  1.2→1.225 (NOTICE'd). Oracle-validated: clone now paginates the fixture EXACTLY like Word (2 pages, break
  at para 45). +2 tests.
- [x] **Status bar page count** (`31fb1af`, `feat(pagination)`): live "Page X of Y" from the engine. +1 test.
- [x] **Manual page-break / blank-page geometry** (`9490d4e`): hardBreak[pageBreakType='page'] forces a
  page boundary; blank page (two breaks) skips a sheet (2 gap bands). Oracle: break para + page count = Word.
- [x] **Line-level intra-paragraph split** (`90039b2`): a paragraph taller than the page splits at the line
  (line boxes + widow/orphan + mid-paragraph nudge seam); convergence deadband stops sub-line jitter.
  Oracle: ~65-line paragraph → 2 pages = Word's 2.
- [x] **4a COMPLETE** — all pagination scenarios oracle-match Word. PR #36 opened.
- [x] **Review hardening (3 rounds of `/code-review`)**: `cf7a682` fixed the max-review findings (imported
  run-level breaks, table mid-cell-seam, asymmetric margins, status-bar blank-page count, Linux headless
  window); `88764fa` reverted a `pageBreakSource` over-reach (wrong side / continuous sections) caught by a
  re-review; `8ae47a1` reverted the trailing-break feature (disproportionate edge tail) caught by a 3rd
  review + guarded tables at any nesting depth. Section/trailing/mid-paragraph breaks deferred (§A.1b).
- [x] **4a MERGED to `main`** (PR #36, merge `1c00252`; branch deleted). Gates on main: PM 404 / smoke 9 / roundtrip 27.
- [ ] **4b — image resize** (NEXT, `build/phase-4b-image-resize` off main).
- [ ] **4b — image resize** (NEXT, new branch off main after 4a merges).
- Gates after each: PM 402/402, smoke 9/9, roundtrip 27/0. Oracle note:
  `docs/superpowers/plans/notes/2026-06-15-phase4a-pagination-oracle.json`.

### 2026-06-14 (Phase 3 execution — Home tab: Clipboard section + state-machine spine)
- [x] **Headless test runs** (`81f48b8`, `chore(main)`): probe-mode `electron .` runs hidden on macOS
  (accessory activation policy + no `mainWindow.show()`) — no more window pop-up / focus-steal during work.
- [x] **Clipboard section kickoff (HUMAN GATE):** general research sweep (Explore agent mapped the clone's
  Clipboard surface) → in/out scope proposed → **user locked** (`8a3a930`, `docs/SCOPE.md`): Merge Formatting +
  Set Default Paste IN, auto-capture wired, **Paste Link OUT** (no OLE).
- [x] **Ribbon state-machine SPINE** (`7d2eb30`, `feat(ribbon)`): declarative per-control rule registry on
  `WC.Ribbon` (`registerStateRule`/`applyStateRules`) + facts in `toQueryState`; one `applyStateRules(st)` pass
  per transaction; load-order-safe `WC.registerRibbonRule` queue. Clipboard rules: Cut/Copy enabled on a
  selection, Paste on clipboard content, Format Painter latch (migrated off the slice-8 direct poke). +4 `[home]` tests.
- [x] **Office Clipboard auto-capture** (`5c12180`): `capture()` on Cut/Copy + DOM `copy`/`cut` listener; the
  24-item pane history fills now (was dead in PM). +1 test.
- [x] **Merge Formatting** (`353999c`): `mergeFormattingHtml()` strip-and-paste (adopt destination style, keep
  emphasis); Paste-menu "Merge Formatting" enabled. +2 tests.
- [x] **Set Default Paste** (`f32b58c`): `D.setDefaultPaste` modal + `localStorage` mode honored by
  `pasteDefault`/`defaultPasteMode`. +1 test.
- [x] **2 user-found Clipboard fixes** (real-Word compare): Keep Text Only no longer auto-linkifies a pasted URL
  (`f7fb8ad`, NOTICE'd fork guard); context-aware Paste Options + Merge→**Match Formatting** label (`d282074`).
- [x] **Clipboard gates:** PM **336/337**, smoke 9/9, roundtrip 27/0. Scope + checkpoint docs (`ff1a589`).

### 2026-06-14 (Phase 3 execution — Home tab: Font section + responsive ribbon)
- [x] **Font kickoff (HUMAN GATE):** `font-section-understand` workflow (5 mappers + synthesis) root-caused the
  3 user asks → scope locked in `docs/SCOPE.md`: **Stage A responsiveness (all tabs), two-row arrangement,
  empty-combo fix** IN; Stage B (group→flyout collapse) DEFERRED; dark theme OUT.
- [x] **Empty font/size combo bug** (`57be59f`): `effectiveFont()` fallback (computed-style, Heading-aware →
  doc-default) so combos never blank on an empty doc; mixed selection blanks; activeElement guard. +4 tests.
- [x] **Font two-row arrangement** (`2b3bab7`): `renderFontGroupBody` Word two-row layout. +1 structural test.
- [x] **Responsive ribbon Stage A** (`b63817c`): `installResponsive`/`relayoutRibbon` ResizeObserver condensing
  for all 10 tabs (tighten → drop large labels → shrink large→small); de-clip chevron. +1 test.
- [x] **Adversarial review** (`font-section-review` workflow, 3 lenses + verify): 1 confirmed-important fix
  (drop the redundant raw-mark mixed scan; trust the engine's resolved intersection) + polish (half-points,
  chevron gutter via margin, small-split color bars under glyph) → `bc19f90`. Dismissed 2 false alarms
  (the "trim out-of-scope Home groups" finding fabricated its evidence + is Stage B).
- [x] **Gates green:** PM **341/342** (1 = Windows-only `[10mm]` fixture skip), smoke **9/9**, roundtrip **27/0**.
- [ ] **Next:** visual eyeball (Font arrangement + responsive condensing + Clipboard chrome — user-triggered);
  then Home **section 3 = Paragraph** (kickoff → scope-lock → register its state rules).

### 2026-06-14 (Phase 3 planning — roadmap re-sequence + bug-fix methodology)
- [x] **Strategic re-scope (user decision):** primary goal = a **fully working editing env first**.
  Roadmap re-sequenced — Phase 3 = ribbon **tab-by-tab hardening pass** (bugs + scope + state machine);
  **pagination/layout engine pulled up to Phase 4**; logger/verifier/MCP → 5/6/7.
- [x] **Methodology agreed:** per-section loop (kickoff scope-lock HUMAN GATE → per-feature
  research+state-rules → three-sided compare vs the live clone → fix-now/layout-flag → regression test → gates);
  branch/PR per tab; **state machine** built concurrently (shared evaluator + per-control rule registry);
  **layout bugs flagged as the Phase-4 spec, never hacked** (no new spacer-hack).
- [x] **Architecture sanity check:** PM/OOXML/Word all = a text-flow doc + anchored floating-object layer →
  architecture is RIGHT; the "real canvas" gap is the missing **layout engine** (= Phase 4), not the model.
  Confirmed vs [PAGINATION.md](../PAGINATION.md) ("no `repaginate()` engine today").
- [x] **Docs written:** `plan.md` roadmap re-sequence (+ "pagination LAST"→Phase 4); this `execution-map`
  CURRENT PHASE rewritten; `last-point.md` entry; new `docs/SCOPE.md`; `deferrals.md` §A→Phase-4 + new §A.1
  (layout-engine requirements); resume-point memory.
- [x] **Done:** started **Tab 1 = Home** — cut `fix/ribbon-home`, Clipboard section kickoff + scope lock +
  state-machine spine built (see the Phase 3 execution block above).

### 2026-06-14 (Phase 2 — slice 11: legacy retirement)
- [x] **Orient + deep pre-verification** (ultracode 7-mapper workflow + synthesis): mapped the exact retirement
  surface — the `--legacy` boot path, the public/js legacy-vs-shared classification, the docx-converter decoupling,
  the strangler-scaffolding tallies (~148 PMA / ~177 ELSE), the gate coupling, the **adversarial PM→legacy
  dependency audit**, the docs. Surfaced 5 conflict files; reported the inventory + the 4 scope decisions (AskUserQuestion).
- [x] **Critique-hardened plan** (`8f882fe`) — a 3-critic adversarial workflow caught 3 BLOCKERS the naive plan would
  have shipped (kept test:pm had live `[0a]` legacy assertions; the D6 block-gate is a LIVE Phase-7 feature, not dead
  scaffolding; `review-tools.js`/`home-features.js` own `WC.Review.THES`/`WC.Clipboard`) + majors (preload save/saveAs,
  oracle positional args, CSS visual gate) — all folded.
- [x] **Subagent-driven execution** (fresh agent/task; coordinator review + leak audit + gates after each):
  `481b50c` `[11]` guards · `4959334` flag/boot · `dfb0d9a` leaf engines + WC.Styles reroute · `d01c3bf` WC.Editor +
  zoom/view migration · `21e46f6`/`7e4ea76` converter + oracle · `e22c5a8` commands.js collapse · `17939a0`
  conflict-file prune · `735e144`/`87854d1` remaining-dispatch collapse · `2f07560` D6 reframe · `c1e76d2`/`ccf790c`
  E() leak sweep · `1080d4f` docs · `a065ae8` review cleanup.
- [x] **Discoveries** (gates + leak-audit, not the up-front critique): 3 hidden conflicts (`WC.Styles`; the `WC.Editor`
  zoom/view ownership — deleting it aborted boot via `StatusBar`→`E().zoom`; the `lodash` transitive dep) + **4
  reachable `E()` leaks** (equation dropdown, shapes/Excel/draw-table) — all fixed (PM verb or honest toast).
  Final audit: **zero reachable `E()`**.
- [x] **Three gates green** (idle): PM **326/326**, smoke **9/9**, roundtrip **27/0**. Converter-removal COM oracle
  Leg A PASS (`notes/2026-06-14-slice11-converter-oracle.json`).
- [x] **2-reviewer whole-branch review** (feature-preservation + leak/correctness) → both **Ready to merge** (zero
  Critical/Important); cosmetic minors folded (`a065ae8`).
- [x] **Checkpoint + PR** (this entry). **Next:** PR → user merge approval → branch delete → graph refresh
  (/graphify). Then **Phase 3 (Logger)**.

### 2026-06-13 (Phase 2 — slice 10 PR 4: draw)
- [x] **Orient + deep pre-verification** (ultracode 4-agent fan-out + synthesis): mapped the 8 draw cmds, the fork ink
  capability (real a:custGeom freeform achievable TODAY via the WordArt replay path; real InkML w14:contentPart + wpc:wpc canvas
  are net-new/out-of-scope), the dispatch+leak surface (incl. the ribbon pen-tile bypass), the render gap, and the export baseline.
- [x] **User scope decisions** (AskUserQuestion): real custGeom ink · full live ink chrome · real canvas frame.
- [x] **Critique-hardened plan** (`cd9a22f`) — 3-critic adversarial pass folded in: the reopened-ink render-loss (importer drops
  isInk + overwrites customGeometry → overlay renders from .paths too), missing dIsDrawing/dClearInk verbs, the pre-wired
  .wc-ink-layer Hide-Ink rule, buggy bbox math, and an EARLY Task-1 oracle gate.
- [x] **Subagent-driven execution (Tasks 0–6)**: `b1dabde` red [10dr] · `cfeedd1` fork insertInkShape (+ early oracle gate:
  inline+anchor both open clean → INK_MODE='anchor') · `cb31e41` VectorShapeView empty-for-isInk · `fcc43cc` bridge/draw.ts ·
  `35287ef` bridge/ink-overlay.ts (headless render probe: persisted ink renders) · `15feaee` re-point (legacy 257 byte-identical) ·
  `942f486` THE FLIP + leak audit.
- [x] **Six gates**: PM **317/317**, legacy **257/257 byte-identical**, smoke 9/9 ×2, roundtrip 27/0, docx 17/0.
- [x] **Oracle vs Word 16** (`7a33d0a`, `notes/2026-06-13-slice10-draw-oracle.json`): Leg A — Word opens 3-stroke + canvas
  without repair + preserves custGeom/wp:anchor/colors/highlighter-alpha/rect on resave; Leg B — clone re-imports Word's
  serialization healthy + the overlay renders all 3 imported strokes. **Both legs PASS.**
- [x] **Checkpoint + PR** (this entry). **Next:** slice 11 = legacy retirement.

### 2026-06-13 (Phase 2 — slice 10 PR 3: insert-exotica)
- [x] **Orient + deep fork pre-verification** (5-agent + 3-agent verbatim gather): textBox is much cheaper than
  feared (existing editable VML path); WordArt needs a synthesized `drawingContent` blob; only 2 net-new fork
  commands needed (`insertTextBox`, `insertWordArt`). 14-cmd area, 2 dispatch paths (H.* + dispatchMenu).
- [x] **Critique-hardened plan** (`861b6c7`, `docs/superpowers/plans/2026-06-13-phase2-slice-10-insert-exotica.md`)
  — 3-critic pass folded in (string-typed coverPage id, per-insert id counters, broadened leak grep, byte-exact
  legacy strings, explicit dropCapMenu kind mapping, in-app render-gap notes).
- [x] **Subagent-driven execution (Tasks 0–5)**: `59b62ed` red `[10ex]` tests · `c77b394` fork `insertTextBox` ·
  `4bd1874` fork `insertWordArt` · `003b2c7` `bridge/insert-exotica.ts`+wiring · `b2add2b` relax textBox round-trip
  (user-approved defer of block-level VML-textbox reimport) · `b827c85` re-point WC.Insert/commands.js · `8262258`
  THE FLIP + leak audit (caught + fixed a screenshot leak the first grep missed).
- [x] **Six gates**: PM **310/310**, legacy **257/257 byte-identical**, smoke 9/9 ×2, roundtrip 27/0, docx 17/0.
- [x] **Oracle vs Word 16** (`28d28e0` fix, `81b70eb` probes, `notes/2026-06-13-slice10-exotica-oracle.json`):
  Leg A first FAILED Word open → bisected to coverPage sdt `<w:id>` non-numeric string (ST_DecimalNumber violation)
  → fixed to digits-only string → Word opens 5-construct doc without repair + preserves all constructs on resave;
  Leg B clone re-imports Word's serialization healthy. **Both legs PASS.**
- [x] **Checkpoint + PR** (this entry). **Next:** slice 10 PR 4 = draw.

### 2026-06-13 (Phase 2 — slice 10 PR 2: themes)
- [x] **Orient + deep fork pre-verification** (7-agent verbatim gather + author re-verification): the
  load-bearing finds — named-style export machinery exists (`replayStyles`/`syncStylesDiffToConvertedXml`) and
  Heading1/Title/Normal ARE populated in `translatedLinkedStyles.styles` at runtime; the **export/visual
  asymmetry** (the decoration plugin reads `converter.linkedStyles` ARRAY, not `translatedLinkedStyles`) so a
  faithful redefinition must mutate BOTH + force regen; `w:background` is genuinely net-new.
- [x] **Brainstorm + user decisions** (AskUserQuestion): hover **live-preview** + watermark **visual stand-in**.
- [x] **Critique-hardened plan** (`990d1fa`, `docs/superpowers/plans/2026-06-13-phase2-slice-10-themes.md`) —
  3-critic adversarial pass folded 3 blockers (setDocAttribute not setNodeMarkup(0); DELETE theme bindings or
  Word ignores the literal — K9; drop a non-existent carbonCopy import) + 3 majors (params.tr; backgroundColor
  longhand; PM.markDirty).
- [x] **Subagent-driven execution (6 tasks, two-stage review each):** `9ce22aa`/`5ab3190` red `[10th]` tests ·
  `7e9fcb9` fork `redefineNamedStyles` · `ffd75f7` fork `w:background` · `5ac7e48` `bridge/design.ts` + wiring +
  io.ts markDirty · `e4b1a24` re-point `WC.Design` · `89b2348` THE FLIP + leak audit. Per-task reviews caught:
  the export-only-style sync gate (Task 1), the documentModified-on-no-op (Task 2), the deApplyFonts ok-guard +
  watermark double-encode (Task 3), the colors double-fire (Task 4).
- [x] **Six gates green:** PM 299/299, legacy 257/257 (byte-identical), smoke 9/9 ×2, roundtrip 27/0, docx 17/0.
  (A 2-fail `[6b]` flip-run blip was load-flake — idle re-run 298→299.)
- [x] **Oracle vs Word 16** (`b25292c`, `notes/2026-06-13-slice10-themes-oracle.json`): Leg A clone→Word PASS
  (ROUNDTRIP_OK; constructs survive Word resave; K9 deletes held; heading font via Normal-inheritance), Leg B
  Word→clone PASS (clone imports Word's serialization healthy). Live heading repaint confirmed (decoration span
  Aptos→Georgia).
- [x] **Final whole-branch review** caught a hover-preview-dirties-styled-doc bug → fixed `06bfeb5` (PREVIEW_META
  on the preview regen tr) + a `[10th]` regression test.
- [x] **Checkpoint + PR** (this entry). **Next:** slice 10 PR 3 = insert-exotica.

### 2026-06-12 (Phase 2 — slice 10 PR 1: mail-merge)
- [x] **Orient + graph currency** — graph was already current (commit `de4f967`, 1315 nodes,
  `.graphifyignore` excludes the fork); incremental detect = 0 changed. Per-engine pre-verification
  (4-agent fan-out): fork inventory + scope decisions + PR order (mail-merge → themes → exotica → draw).
- [x] **User decision: maximal real-MS-Word fidelity** (real MERGEFIELD, not w:sdt) → saved to memory.
  Captured real Word's merge-field OOXML via PID-safe COM (`w:fldSimple`).
- [x] **Brainstorm → critique-hardened plan** (`e88bc11`, `docs/superpowers/plans/2026-06-12-phase2-slice-10-mail-merge.md`)
  — 4-reader verbatim gather + 3-critic pass (2 blockers + 3 majors folded in).
- [x] **Subagent-driven execution (6 tasks, two-stage review):** `ea02757` red `[10mm]` + `[0a]` repoint ·
  `2677ec1` fork export branch · `68d42c5` fork import (preprocessor + NodeTranslator + handler entity) ·
  `d76065c` bridge/mail.ts · `1738798` re-point + THE FLIP + leak audit · `e9e2242` review fixes
  (`_mergeResolve` preview/merge unification; immutable name read) · `550180a` oracle.
- [x] **Six gates green:** PM 285/285, legacy 257/257 (byte-identical), smoke 9/9 ×2, roundtrip 27/0, docx 17/0.
- [x] **Oracle vs Word 16:** Leg A clone→Word PASS (ROUNDTRIP_OK; Word resave preserved all 5 field codes,
  no w:sdt, no spurious «Next Record»); Leg B Word→clone PASS (automated fixture import).
- [x] **Checkpoint + PR** (this entry). **Next:** slice 10 PR 2 = themes. Computer-Use visual Mailings
  parity = optional follow-up (functional fidelity already proven via the COM oracle on the user's Word).

### 2026-06-12 (Phase 2 — slice 9: references)
- [x] **Critique-hardened plan** (`docs/superpowers/plans/2026-06-12-phase2-slice-9-references.md`)
  — fork pre-verification (the references family is already mounted + exposed via `editor.doc.*`)
  then a 3-critic adversarial pass (12 amendments: TOC `'0'` not `'??'`, footnote body via
  `getUpdatedDocs`, caption SEQ-shape, `addText`→`setOutlineLevel`, ToF raw field, citations real
  at field/source level / empty-render headless, `--legacy` has no script-gate, …).
- [x] **Red `[9]` tests + D6 repoint** (`3c08fed`) — engine-observable; both `[0a]` guards
  `tableOfContents`→`startMailMerge`.
- [x] **`bridge/references.ts`** (`b0a2194`) — 25 `ref*` verbs over `editor.doc.*` (caret→address
  via an `sdBlockId` mint; citation minted-source-id flow); +22 `[9]` coverage tests (caught + fixed
  a bibliography title→style export bug and an Add-Text wrong-namespace no-op).
- [x] **D9.1 notes area** (`37bfa2e`) — clone-owned continuous-flow `#pm-notes-area` over
  `footnotes.list()`/`footnotes.update`; focused-dirty clobber guard (proven via test).
- [x] **Re-points + THE FLIP** (`6098fa5`) — every References `H.*`/flyout/dialog → `PMA()`→bridge
  (legacy byte-identical); `references` in FLIPPED; leak audit clean; NOTICE'd Add-Text→TOC fork fix;
  Mark-Citation numeric `\c`; refAddSource flat→`b:Source` mapping; refUpdateSource wired.
- [x] **Six gates green:** PM 275/275, legacy 257/257, smoke 9/9 ×2, roundtrip 27/0, docx 17/0.
- [x] **Oracle** (`d820fea`) — extended `docx-inspect.js` + author/import probes; **Leg A clone→Word
  PASS**, **Leg B Word→clone partial** (footnotes+TOC import; SEQ/CITATION fork-importer gap recorded).
- [x] **Checkpoint + PR** — last-point/execution-map/banners advanced; ledger deviations; PR into
  `main`. *(Graph refresh DEFERRED: the raw `graphify update .` CLI pulls the excluded
  `superdoc-fork/` — 19.7k nodes; refresh via the `/graphify` skill, which honors the
  `docs/GRAPHIFY.md` exclusion, next session.)*

### 2026-06-11 (post-slice-8 bug-fix batch — page-click + styles)
- [x] **Page-margin click placed no caret** (`5c4ee25`, PR #26) — root-caused via
  `document.elementFromPoint` (margins are `#pm-editor` padding, outside `.ProseMirror`); fixed in
  `bridge/focus.ts` (clamped `posAtCoords` → nearest text + focus).
- [x] **Styles changed everything on hover** (`5cf317d`, PR #26) — engine scope already correct;
  **disabled PM-mode hover Live Preview** (`ribbon.js`) → click-only apply (selection → selection;
  caret → current paragraph). Recorded as a ledger-C decision.
- [x] **Click below the text → caret to doc END** (`86540d6`, PR #27) — `Selection.atEnd` for
  below-content clicks (Word Ctrl+End); `Selection` added to the `@/pm` barrel.
- [x] **Six gates green:** PM **241/241** (+4 regression tests), legacy 257, smoke 9/9 ×2, docx 17,
  roundtrip 27. Both PRs merged to `main`; branches deleted.

### 2026-06-11 (Slice 8 close-out — direct session; loop process retired)
- [x] **Task 6 (dialogs + proofing PM-safe, `16ebaee`):** Lock/Unlock Tracking (T3) + lock
  gate on the toggle; Track Changes Options (T18) + Advanced (T19, consumed: ins/del mark
  style+color, balloon width) + Change User Name (persisted author identity); Restrict
  Editing pane (X3 → engine `setEditable`); **Compare → real tracked-changes diff**
  (`PM.runCompare` — probe found the naive offset map off by the fork's run-node tokens;
  rewritten right-to-left with a fresh map per op); Thesaurus/Accessibility/Read-Aloud
  (per-word `::highlight`)/Language (P9)/Editor pane (P4)/Word Count (P1) re-pointed at PM.
- [x] **Task 7 THE FLIP (`34e578c`):** `review` → FLIPPED; K8 belt (legacy beforeinput
  interceptor `--legacy`-only); **D8.8 titlebar mode pill** built (cheap): Editing |
  Reviewing | Viewing, state-synced. The 4 flip-pending `[8]` pins went green.
- [x] **Six gates green:** PM **237/237** · legacy 257/257 · smoke 9/9 ×2 · docx 17/17 ·
  roundtrip 27/0.
- [x] **Parity pass:** 58/58 DOM/behavior audit (`scripts/probe-slice8-parity.js`) over the
  57-item checklist — the only finding (R2/R3 enablement greys missing) fixed via
  state-sync `wc-disabled` pokes (`060f55b`); checklist ticked 57/57.
- [x] **Oracle legs A+B PASS vs REAL Word for Windows 16.0 over COM** (no interactive
  session; computer-use access dialog timed out → pivoted to the COM oracle): Leg A
  clone→Word — ROUNDTRIP_OK, `w:ins`/`w:del`/`w:rPrChange` + comments survive Word's own
  resave (K4 resolved: the fork EMITS `w:rPrChange`); Leg B Word→clone — COM-authored
  revisions import as engine marks with the real account author; acceptAll applies Word's
  outcome. Verdicts: `notes/2026-06-11-slice8-oracle.json`.
- [x] **Loop process retired (user decision):** `docs/loop/` removed; the deferral ledger
  moved to [docs/plan/deferrals.md](deferrals.md); execution-map/banners normalized to the
  plain PR flow.
- [x] **PR #25 opened → merged to `main`;** `completion-driven-agent-loop` branch deleted
  (fully contained in the slice-8 history).

### 2026-06-11 (Completion-driven loop — Step 0: Windows replication)
- [x] **Permissions up front (ONE request flow):** Word + File Explorer + Electron (clone)
  at full tier + clipboardRead/Write + systemKeyCombos — no mid-loop prompts remain.
- [x] **Toolchain:** npm install + build; npm `/tmp` probe aliases verified working AS-IS
  (`C:\tmp` exists).
- [x] **Six gates green on Windows:** legacy 257/257 · PM 206/206 · smoke 9/9 ×2 · docx 17/17
  · roundtrip 27/0.
- [x] **`[1]` Mod-Z test platform fix** — was Mac-vacuous (Mod-z = Meta-z there); probe-driven
  root-cause (defaultPrevented + sdBlockRev evidence); critique caught the first rewrite as a
  weakening; final form spies `WC.PM.cmd` (the app.js path) + doc-equality-modulo-sdBlockRev.
- [x] **Windows COM oracle port** (`word-oracle-win.ps1`): 5 verbs live-validated vs Word 16.0;
  critique-hardened (20 findings: exit-2 validation, kill-time PID re-verify, --out splice,
  LiteralPath, $PWD resolution, UTF-8 stdout, vocabulary parity incl. underlineRaw "false").
- [x] **COM runtime rules discovered + documented:** unsandboxed-only (DCOM hang), FOREGROUND-only
  (backgrounded shells wedge in SaveAs2 — OneDrive exonerated), machine-global DocumentN,
  per-instance OM attach for orphan recovery. README Windows section written.
- [x] **Fixtures re-authored on real Windows Word** (`author-fixtures-win.ps1` committed;
  docx-inspect-verified identical shapes) — unblocked `test:roundtrip` on this machine;
  `capture-popups.ps1` committed for slice spec-captures.
- [x] **Checkpoint + commits + push** on `completion-driven-agent-loop`; next iteration = slice 8.

### 2026-06-10/11 (Phase 2 — slice 7)
- [x] Post-merge routine: PR #23 merge verified (`6ca5679`); gates re-verified ON `main`
  (PM 192/192 after an idle re-run — 5 initial fails were load-flake from concurrent agents);
  CLAUDE/AGENTS/plan banners advanced (`343387f`); branch cut.
- [x] Slice-7 **brainstorm-lite** — file-io inventory verified against real code (3-agent sweep +
  author verification). Keys: the fork constructor takes `options.html` in docx mode
  (`createDocFromHTML` composes with the blank-template converter context); legacy opened csv as
  a BLANK doc (csv-as-table = net-new, user-directed); `stripHtmlStyles` = semantic import;
  `getHTML({unflattenLists})` + `textBetween`; docx-inspect is CLI-only.
- [x] Slice-7 **plan** written + 4-critic-hardened (31 findings; 4 unique blockers incl. the
  wrong-paste-pipeline aim and the `[7]` confirmDiscard suite hang) + author pre-verification
  (caught the contextBridge spy non-writability independently) + committed (`a50bfc4`, `964b395`).
- [x] Slice-7 **red `[7]` tests** (13) + `[0b]` rewrites + `[4]` leak pin (`860d753`) — review
  caught the DOM-vs-model pin defect + a red-stage modal hang; 205/192/13.
- [x] Slice-7 **`test:roundtrip` lands FIRST** (`1384831`) — driver+probe, 27 checks, six-gate
  docs + spec §8.1 dated amendment; review hardened stale-artifact deletion + negation pin.
- [x] Slice-7 **IPC** (`f6572dc`) — openBytes filters + `doc:saveTextFile` + `doc:askSavePath`
  (htm→html normalize; extensionless append + GTK overwrite guard).
- [x] Slice-7 **bridge legs** (`cbecba8`) — file-content.ts, `extra.html`+`onContentError`
  threading, contentError blank-recovery, `openHtml/openText/openCsv/pasteHTMLString`,
  io `getHTML`/`getText` (both break leaves); probe-verified html→table→exportDocx BEFORE the
  suite; review fixed the `Math.max` spread + comment contracts.
- [x] Slice-7 **THE FLIP** (`f545429`) — files.js blocks removed; open routing; save legs;
  two-phase saveAs; mode-aware backstage copy; `saveAsBytes` removed; review closed the
  `lastImportBlanked` data-loss vector (+ csv-name, toasts, escapeHtml reuse). 206/205/1.
- [x] Slice-7 **leak fix** (`ae92a36`) — repro confirmed all three forms; fork `handleDocxPaste`
  tag-early/remove-late strip + style-deref guard (NOTICE'd); spec review adjudicated the
  divergence as strictly better (early strip would regress list starts). **PM 206/206.**
- [x] **All six gates green: PM 206/206, legacy 257/257, smoke 9/9 ×2, docx 17/17,
  roundtrip 27/0.**
- [x] Slice-7 **oracle legs A–D** (`73fdd22`) — driven via word-oracle.js + **computer-use MCP**
  (first slice; Grant-File-Access prompt cleared interactively): A docx round-trip PASS (no
  repair; structural identity; slice-6 recheck CLOSED), B html PASS (semantic deviations
  recorded), C csv deviation evidence (real Word = raw delimited text), D txt PASS.
- [x] Slice-7 **docs scoping** (`5e9a3cb`) + checkpoint; **PR #24 next**.

### 2026-06-10 (Phase 2)
- [x] Slice-6 **Word UI Codex probe partially captured** via `.oracle-probes/slice6/CODEX-PROMPT.md`
  — screenshots saved for `A1`, `A2-grid`, `A3-dialog`/`A3-menu`, `A4`, and `B-design`; transcript
  appended to `.oracle-probes/slice6/results.md`. Remaining UI-Codex steps carry because Word kept
  snapping focus among existing unsaved windows after modal close/screenshot events.
- [x] Slice-6 **brainstorm-lite** — confirmed the insert entry-point inventory against real code (6-agent inventory workflow). Key findings: fork ships all insert-primitive + core table commands; **legacy app has NO Table Tools ribbon tab** (table editing was a 9-item right-click menu) → full Table Tools = net-new; equation has no fork `insertMath` (→ styled text); contextual tabs are runtime-injected. User scope decisions: **full Table Tools** + styled-text equation + exotica carve-out + UI-Codex when needed.
- [x] Slice-6 **plan** written + 3-critic-hardened + author-pre-verified + committed (`eb23de9`) — 4 blockers + 6 majors (the two biggest — contextual-tab `{cmd,label,type}` dispatch not `onClick`; ribbon single-tab limit — caught by pre-verification after a critic wrongly cleared them).
- [x] Slice-6 **red `[6]` tests** (19) + D6 repoint `link`→`newComment`, `table`→`tableOfContents` (`20a4fc3`); **docx-inspect** unzip helper (`f8e76e3`).
- [x] Slice-6 **bridge insert.ts** (`b40f36b`) + **bridge table.ts** 6a (`5feefb9`) — insert primitives + table insertion + the 9 ops; review caught a `__PM_TextSelection` global regression + the equation `false`-contract.
- [x] Slice-6 **entry-point rewrites** (`6c0d81b`) — PM branches in commands/dialogs/insert-features + the M2 PM bookmark dialog; legacy byte-identical.
- [x] Slice-6 **THE FLIP** (`d2b3ffb`) — `FLIPPED += insert-basics` + exotica carve-out (machine-verified leak-free) + `Ctrl+K` guard + B2 `WC.Table` guard. 149/149.
- [x] Slice-6 **14 fork table commands** (`752e0e1`) — style/align/indent/size/margins/borders/distribute/split/convert/text-direction/autofit; review found + fixed a **silent export data-loss bug** (top-level attr never reached the nested key the exporter reads) → dual-write + `[6b] EXPORT:` document.xml-grep regression tests.
- [x] Slice-6 **bridge table extras** (`d4074d7`) — the 14 wrapper verbs + `tableSelectFirstRowPair` + B3 merge test.
- [x] Slice-6 **contextual tabs + PM context menu** (`e2840f3`) — Table Layout/Design tabs (runtime `{cmd,label,type}` + new `H.tbl*` handlers + dropdown flyouts), `ribbon.js` multi-tab extension (Header & Footer byte-identical, 257 green), PM `td/th`-scoped context menu (native selection preserved).
- [x] Slice-6 **headless leg-A oracle** (`366aa66`) — clone-exported `.docx` validated via `docx-inspect`: hyperlink rel → `https://example.com`, table 3×4, image embedded in `word/media`, bookmark paired start+end. **All four PASS.**
- [x] **All five gates green: PM 176/176, legacy 257/257, smoke 9/9 ×2, docx 17/17.** Build complete; checkpoint this entry; PR + Word-dependent oracle legs + UI Codex next.
- [x] Slice-6 **Word oracle legs** (`0bd3773`) — leg A reopen-in-Word PASS (no repair prompt); leg C styled-table PARTIAL (`w:tblStyle` dropped → fixed below); leg B blocked (Word session quirks). **PR #23 opened**; banners advanced.
- [x] Slice-6 **table-defect fix batch** (user report → 4-agent hunt: live-repro/code-audit/Word-fidelity/minting-research → 6 reviewed fixes): `fdcb7f6` passive contextual tabs + 'Layout' label; `72b270f` Center/Right alignment geometry fix; `dd56a1a` caret-shading parity + AutoFit-Fixed; `61d84d9` **table styles end-to-end** (minted real-Word defs + visual bake + dynamic gallery); `474291f` direct-border precedence; `a23c868` 27 Fluent icons.
- [x] Slice-6 **"big box" fix** (`d6a07e4`, user re-report) — fresh AND imported tables never painted cell gridlines (invalid `border-insideH/V` CSS, silently dropped); render-only inside-border CSS vars + interior-edge rules; export purity proven. **Final gates: PM 192/192, legacy 257/257, smoke 9/9 ×2, docx 17/17.**

### 2026-06-09 (Phase 2)
- [x] Slice-5 **brainstorm-lite** — confirmed the find/replace entry-point inventory against real code (`H.find`/`H.replace`→`D.findPane`; the legacy `.find-hit` TreeWalker; the fork **already ships** a decoration-based Search extension; ribbon `find` split + `replace` button; app.js Ctrl+F/H). User scope decision: **maximum** (Match Case + Whole Words + Wildcards + Advanced Find + all three Find-dropdown items).
- [x] Slice-5 **plan** written + 3-critic-hardened + committed (`c3f7fb2`) — 3 blockers pre-build (unnamed Search ext → `extensionStorage.search` undefined; bare Ctrl+F/H bypassing D6; `goToDialog` not exported) + 4 majors; one critic "blocker" (missing `.sd-editor-scoped`) refuted by direct verification.
- [x] Slice-5 **red `[5]` tests** (18) + D6 repoint `replace`→`link`, `find`→`table` (`7262ea7`, `4485dc3`).
- [x] Slice-5 **fork work**: `name:'search'` + whole-word + Word-wildcards, threaded through setSearchSession/invalidator/replaceSearchMatch (`0343330`, NOTICE'd).
- [x] Slice-5 **bridge** find/replace surface (`0fe1e60`) + one-undo `norm()` test fix (`375e12b`).
- [x] Slice-5 **entry points**: find pane re-point + options row + `D.goToDialog` (`43e3f78`).
- [x] Slice-5 **THE FLIP** + Ctrl+F/H/edit re-points (`f768175`) — 129/0 first run, zero triage.
- [x] Slice-5 **oracle**: Codex computer-use semantics probes (all match Word) → **wildcard case-sensitivity fix** (`1186532`, 130/0); verdicts (`8a9b9ef`); **legs A/B PASS** (`2fb33e3`).
- [x] **All five gates green: PM 130/130, legacy 257/257, smoke 9/9 ×2, docx 17/17.** Checkpoint + PR next.

### 2026-06-08 (Phase 2)
- [x] Slice-4 **plan** written + 4-critic-hardened + committed (`37b03fd`) — `docs/superpowers/plans/2026-06-07-phase2-slice-4-clipboard.md` (32 findings, 8 confirmed blockers applied: painter double-click trap, two never-green tests, async flyout/dialog races).
- [x] Slice-4 **red `[4]` tests** (16) + D6 run-block repoint cut→replace (`23c9062`, `6031cc2`).
- [x] Slice-4 **clipboard IPC** — `wordAPI.clipboard.*` + webContents edit triggers (`579c5a0`, `281a08e`).
- [x] Slice-4 **oracle probes** — clipboard flavors + Paste Special lists + 9-probe painter matrix vs Word 16.77.1; Step 2.1 scripted, UI-only probes via Codex computer-use → `.oracle-probes/slice4/` (`d5d1002`).
- [x] Slice-4 **fork painter Word scope** — para props + first-run marks, replace-not-merge, link-preserving, cancel cmd, double-click-trap fix (`5793f6e`); resolved→direct marks fix (`e434dfd`).
- [x] Slice-4 **bridge** — clipboard surface + select + painter arm/cancel + Esc layering (`dc70b2e`, `7f9e010`); gitignore `.agents/` (`1bc5ce5`).
- [x] Slice-4 **entry points** — handlers, pasteMenu, `D.pasteSpecial` dialog, selectMenu, flyItem disabled (`5a27de3`, `2f8f891`).
- [x] Slice-4 **state-sync painter chrome** — button latch + copy cursor (`34c1633`).
- [x] Slice-4 **THE FLIP** + Cmd+Shift+C/V chords (`ac98db2`, `0746464`) — 112/0, one triage (sdBlockRev normalization).
- [x] Slice-4 **oracle legs A/B** + Task-9 manual sanity (`3858b64`) — leg A clone→Word PASS (full list fidelity), leg B core PASS + recorded list-marker leak (ship-and-track, user-approved); five gates green; physical Cmd+C/V both directions confirmed.
- [x] Slice-4 **PR #21** merged to `main` (from GitHub, `696b84b`); gates re-verified on `main` (PM 112/112, legacy 257/257, docx 17/17); CLAUDE/AGENTS/plan banners advanced to slices-0a–4 / slice-5-next.

### 2026-06-07 (Phase 2)
- [x] Slice-3 **plan** written + 4-critic-hardened + committed (`a90ce67`) — `docs/superpowers/plans/2026-06-06-phase2-slice-3-styles.md` (4 blockers caught pre-build: setState restore channel, Ctrl+Shift+N shadow, linked-char selection trap, negation-fixture context leak).
- [x] Slice-3 **red tests** (20 `[3]` + cellFor + 4 engine pins) (`1885d1d`, `6ec4e56`).
- [x] Slice-3 **fork work**: heading keymap strip (`3b5d276`), minted style defaults (`ebaac6f`, `4800ce4`, SubtleEmphasis live-Word amendment `7c2f314`), TableInfo+tblLook fix (`8c5e672`, `fcba36a`).
- [x] Slice-3 **bridge**: style-names/resolved-read/applyStyleByName (`131e1d3`), st.block + caret highlight (`c07d0b6`), PM-native hover preview (`d83b29ec`).
- [x] Slice-3 **entry points**: applyStyle + pane (`1b4fdfd` +review fixes), Change-List-Level resolved read (`3ab3f32` — slice-2 deviation closed).
- [x] Slice-3 **THE FLIP** (`af7c559`) — 96/96 first run, zero triage; all five gates green; final-review polish (`dceafa1`).
- [x] **Oracle**: slice-2 followUps CLOSED (lists family PASS incl. the U+25AA discovery; literal roundtrip PASS); `read-style-props` verb + quirks #24-27 (`9951073`); behavior verdicts (re-apply=APPLY; clearing=full-coverage-only) (`b54bd69`); slice-3 legs A 5/5 + B 9/9 + table spot-check (`0e8134b`).
- [x] Slice-3 **PR #19** merged to `main` (clean, no conflicts); gates re-verified on `main` (PM 96/96, legacy 257/257); branch deleted local+remote; CLAUDE/AGENTS banners advanced.

### 2026-06-05 (Phase 2)
- [x] Phase 2 **spec** written + committed (`d68c187`) — `docs/superpowers/specs/2026-06-05-phase2-editing-core-design.md`.
- [x] Phase 2 **implementation plan** written + committed (`75e2d89`) — `docs/superpowers/plans/2026-06-05-phase2-slices-0a-1.md`.
- [x] Slice 0a **`--legacy` boot flag** (`870e01a`) — forwarded to renderer as `?legacy=1`.
- [x] Slice 0a **PM functional suite skeleton + `test:*` aliases** (`210f13f`) — 21 tests scaffolded.
- [x] Slice 0a **page flip + WC.PM bridge core** (`a30f11c`) — `#pm-editor` is the visible page; bridge commands/io/state-sync/focus.
- [x] Slice 0a **failBridge hardening** (`7c25a79`) — pre-init focus guard; un-swallow first blocked toast.
- [x] Slice 0a **D6 integrity guard** (`cf68b84`) — legacy mutations blocked in PM mode at the chokepoints.
- [x] Slice 0a **D6 Save block + audit doc** (`1ccc507`) — PM-mode Save/Open blocked until 0b.
- [x] Slice 0a **D6 courtesy block** (`9c6cad7`) — unflipped commands toast at dispatch; shortcuts D6-aware.
- [x] Slice 0a **PM state-sync** (`e033fe1`) — engine events drive toggles, combos, statusbar; caret-tracking font/size combos.
- [x] Slice 0a **state-sync fixes** (`ab76c5f`) — list toggle guard; size parse tighten.
- [x] Slice 0a **focus discipline** (`23f1251`) — chrome clicks never blur PM view.
- [x] Slice 0a **scrollbar drag fix** (`49e5e86`) — scrollbar dragging alive inside focus-guarded containers.
- [x] Slice 0a **dirty re-point** (`e4ea0bf`) — dirty-state readers mode-aware (PM edits trigger save prompts).
- [x] Slice 0a **visible-page re-points** (`571b1e3`, `e41fb67`) — showHide/readMode/wordCount/properties follow active engine; paragraph-count selectors aligned.
- [x] **All gates green: legacy 257/257, PM 21/21, smoke 9/9 × 2, docx 17/17.**
- [x] **Slice 0b** — file-IO bytes layer (PM-mode open/save via the fork's OOXML converter). DONE: bytes IPC channels, parse-once replaceEditor + failBridge recovery + replace mutex, blank fixture, Files.path invariant enforced + tested. Gates: PM 28/28, legacy 257/257, smoke 9/9 × 2, docx 17/17.
- [x] **Slice 0c** — oracle harness for PM mode. DONE: `scripts/oracle/word-oracle.js` (read-props + roundtrip; object-model only; PID-safe; leak-proof read-props, best-effort roundtrip close). Verified vs Word for Mac 16.77.1; 13+ quirks documented. Commits: `48f55e5`, `cd68993`, `06a10f7`.
- [x] **Slice 1** — character formatting (bold/italic/underline/strike/sub/sup/font/size/grow-shrink/color/highlight/clearFormatting/changeCase + Font dialog + QAT undo/redo → PM transactions; area `character` FLIPPED). Oracle validation (spec §8.3) both legs + negation-run fixture vs Word 16.77.1 — ALL PASS; caught + fixed a boolean-negation state-sync bug and a PM-harness string-return hole; new `read-word-props` oracle verb. Gates: **PM 43/43**, legacy 257/257, smoke 9/9 × 2, docx 17/17. Branch `feature/phase-2-slice-1-character`, PR stacked on slice 0c.
- [x] **Slice 2** — paragraph + lists. DONE 2026-06-06 (`feature/phase-2-slice-2-paragraph`): align ×4, list-aware indent, Layout spinners (+caret readback), line-spacing (+dynamic labels), shading (new fork render), borders, sort, bullets/numbering (+glyph-honoring libraries), Word-native multilevel (`applyListDefinition`/`changeListLevelBy` fork cmds), Paragraph dialog (seeds + one-undo apply), Ctrl+L/E/R/J + Ctrl+Shift+L; hanging-indent gap closed (fork CSS shipped); oracle `read-para-props` verb + validation legs A/B (2 reads pending Word relaunch). Gates: PM 76/76, legacy 257, smoke 9/9 × 2, docx 17. show-marks verified already-done (slice-0a parity).

### 2026-06-06 (Phase 2)
- [x] Slice-2 **plan** written + critique-hardened + committed (`a81508f`) — `docs/superpowers/plans/2026-06-06-phase2-slice-2-paragraph-lists.md`.
- [x] Slice-2 **red tests** (33 `[2]` + helpers + D6 repoint) (`9e6fa78`, `b9958a2`).
- [x] Slice-2 **oracle verb** `read-para-props` + quirks #16-21 (`aabc710`, `e04bf45`).
- [x] Slice-2 **fork work**: shading render + keymap strip (`45d5017`), `applyListDefinition`+`changeListLevelBy` (`5cf1f2d`), element CSS into the build (`bda0278`).
- [x] Slice-2 **entry-point rewrites**: para handlers (`1e64d82`), lists menus (`35fd50d`), shading/borders/sort (`152634b`), state-sync (`453a180`), Paragraph dialog (`931a2f0`).
- [x] Slice-2 **THE FLIP** (`8d8e14f`) — 76/76 first run, zero triage; all five gates green.
- [x] Slice-2 **evidence**: round-trip (`3e1a186`), oracle legs A/B JSONs (`882ea7e`), quirks #22-23 (`86ada55`).
- [x] Slice-2 **PR #17** merged to `main` (conflict round vs PR #16 resolved in `fdef0e3`); gates re-verified on `main` (PM 76/76, legacy 257/257); branch deleted local+remote; CLAUDE/AGENTS banners advanced.
- [x] 5-min **oracle follow-up** after a Word relaunch (two pending reads — commands in the oracleA-lists JSON `followUp` fields). *(Closed 2026-06-07 in the slice-3 oracle session — all rows PASS.)*

### 2026-06-05 (Phase 1 wrap-up)
- [x] Phase 1 **Stage D** — final review = READY TO INTEGRATE; hardened the smoke Tab test (`8de524e`).
- [x] Docs follow-up: harness now needs `npm run build` first; counts 257/17 (`e5db257`).
- [x] Fixed `npm run dev` crash (`Cannot find module './docx-utils'`) — copy via electron-vite `closeBundle` plugin, dev+build, cross-platform (`93e5006`).
- [x] Infra + visual sanity pass: dev/build/built-launch all run; chrome = faithful Word; new core renders the imported `.docx` (lists/numbering) on a Letter page.
- [x] Plan-doc checkpoints; **Phase 1 COMPLETE**; branch `build/phase-1-scaffold` pushed for integration.
- [x] **Phase 2** — started this session (integrated Phase 1 → slice 0a built on `feature/phase-2-editing-core`).

### 2026-06-04
- [x] Merged `research-architecture` → `main` (PR #8).
- [x] Made "never work on `main` — branch first" an explicit rule (plan.md + execution-map.md).
- [x] Restructured last-point.md + execution-map.md into dated logs; updated the `plan-tracking` skill.
- [x] Wrote + committed the Phase 1 spec + implementation plan (`docs/superpowers/`), hardened by 4 workflows.
- [x] Phase 1 **Stage A** — electron-vite + TS build chain; legacy app static under `public/`; gates green.
- [x] Phase 1 **Stage B** — npm-pin + PM single-copy; headless import + fixture; mounted our EditorView; smoke 8/8.
- [x] Phase 1 **Stage C / Option B** — vendored + own the SuperDoc engine (editable source, no npm dep, telemetry no-op, Path B view, Tab/indent); smoke 9/9, functional 257, docx 17.
- [ ] Phase 1 **Stage D** — final review + integrate (PR/merge) + docs follow-up (carries to next session if not finished today).

### 2026-06-03
- [x] Locked ADR-0001…0005; de-risk spike GREEN.
- [x] Created docs/decisions, docs/architecture, docs/research, docs/plan; the `plan-tracking` skill.
- [x] CLAUDE.md / AGENTS.md banners; pushed the `research-architecture` branch.

## At session END (always)
Invoke the **`plan-tracking`** skill: (1) **append** a new dated entry to
[last-point.md](last-point.md) (top); (2) **tick** the Daily work log above (start a new
`### <date>` block if it's a new day); (3) if the phase advanced, update the **CURRENT PHASE**
section.
