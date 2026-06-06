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
> **Slice 0a is DONE** (`feature/phase-2-editing-core`, PR pending): `#pm-editor` is now the visible
> editor behind the `WC.PM` bridge; `--legacy` restores the full legacy app; D6 two-layer guards live;
> ribbon state-sync from engine events; dirty/statusbar/visible-page re-pointed. Gates: 257/21/9×2/17.
>
> **Slices 0b, 0c and 1 are DONE** (see Daily work log + last-point.md): file-IO bytes layer,
> the macOS Word oracle harness, and the **character-formatting flip** (area `character` on the
> PM engine, oracle-validated both ways vs Word 16.77.1).
>
> **Slice 2 is DONE** (`feature/phase-2-slice-2-paragraph`, PR pending): areas **`paragraph` +
> `lists` FLIPPED** — align/indent/spinners/line-spacing/shading/borders/sort, glyph-honoring
> list libraries, Word-native multilevel, Paragraph dialog, Word shortcuts; the slice-1
> hanging-indent gap closed (fork CSS shipped); new `read-para-props` oracle verb (quirks
> #16-23). Gates: **PM 76/76**, legacy 257, smoke 9/9 × 2, docx 17. Oracle legs A/B PASS except
> two reads pending a Word relaunch (see last-point.md).
> **Next: slice 3 — styles** (plan to be written via brainstorm → write-plan).

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
- [ ] Slice-2 **PR** → `main`; 5-min oracle follow-up after Word relaunch (commands in the oracleA-lists JSON).

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
