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
> `superdoc` npm dep). Branch **pushed**; integration (merge/PR) is the user's pending choice.

**Goal:** make the owned engine the **ACTIVE** editor — wire `WC.RIBBON` commands → PM transactions,
feature area by feature area, and **retire the legacy `contenteditable` editor** (no more "two
worlds"; the new `#pm-editor` becomes THE page). Strangler-fig: flip one feature at a time, never
big-bang; gate on the 257/17 suites + per-feature Word fidelity.

**First actions (next session):**
- [ ] **Integrate Phase 1 first** (merge/PR to the integration line), then cut
  `feature/phase-2-editing-core` off it (never work on `main`).
- [ ] Run Phase 2 through its own cycle: **`brainstorming` → `writing-plans` → subagent execution**
  (same as Phase 1).
- [ ] Decide the **command→transaction bridge**: map `WC.Commands` dispatch onto the vendored
  Editor's command/keymap API; make `#pm-editor` the visible page and hide/retire legacy `#editor`.
- [ ] **Per feature flipped:** validate behavior + UI vs real Word (macOS AppleScript oracle); keep
  257/17 green; add a regression test.
- [ ] Wire **`.docx` SAVE/export** on the new engine (deferred from Phase 1) when a feature needs it.

**Watch-outs:** no pagination yet (Phase 7 — continuous flow is expected, not a regression);
list-marker/spacing fidelity is per-feature polish; keep the headless Editor reachable for export;
hold the single-PM-copy + telemetry-off invariants.

## Daily work log (newest first — check off what got done)

### 2026-06-05
- [x] Phase 1 **Stage D** — final review = READY TO INTEGRATE; hardened the smoke Tab test (`8de524e`).
- [x] Docs follow-up: harness now needs `npm run build` first; counts 257/17 (`e5db257`).
- [x] Fixed `npm run dev` crash (`Cannot find module './docx-utils'`) — copy via electron-vite `closeBundle` plugin, dev+build, cross-platform (`93e5006`).
- [x] Infra + visual sanity pass: dev/build/built-launch all run; chrome = faithful Word; new core renders the imported `.docx` (lists/numbering) on a Letter page.
- [x] Plan-doc checkpoints; **Phase 1 COMPLETE**; branch `build/phase-1-scaffold` pushed for integration.
- [ ] **Phase 2** — start next session (integrate Phase 1, then strangler-fig: ribbon commands → PM transactions).

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
