# Execution Map — session playbook + daily work log

> How to orient, execute the current phase, and record what got done. The forward plan lives
> here; the **Daily work log** (below) records what we actually did each day, with checkboxes.
> Big picture: [plan.md](plan.md) · dated state snapshots: [last-point.md](last-point.md).
> Renewed via the `plan-tracking` skill.

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
4. **Test:** the 228-test in-renderer suite + the 9-test docx suite stay green; add a regression
   test per change; check feature parity.
5. **Checkpoint** (via the `plan-tracking` skill): **append** a dated entry to last-point.md and
   **tick** the Daily work log below.
6. **PR** for review; merge to the integration line; merge to `main` only at a stable milestone.

## CURRENT PHASE → Phase 2: Editing core behind the existing ribbon (strangler-fig)
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
> docx-inspect). Gates: **PM 176/176**, legacy 257, smoke 9/9 × 2, docx 17.
> **Next: slice 7 — file-io** (open html/txt/csv re-enabled; PM-converter round-trip suite replaces
> `test_docx.js`). ⚠️ slice-6 follow-ups: the Word-dependent oracle legs + UI Codex still to run
> (Word windowed); BOTH `[0a]` D6 tests now on `newComment`/`tableOfContents` (slice 8/9 repoints).

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
